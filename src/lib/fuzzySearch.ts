import type { Salon } from '../types';

/**
 * Normalized, typo-tolerant, multi-token fuzzy search for the salon catalog.
 *
 * Why custom instead of Fuse.js:
 *  - No new runtime dependency (keeps the bundle lean and the supply chain small).
 *  - Fuse.js matches the query as one string against one record; salon search needs
 *    per-token AND/OR semantics across DIFFERENT fields ("beard" hits a category,
 *    "trim" hits a service name of the same salon).
 *  - We need explicit field-weighted relevancy ranking (name > category > service > area).
 *
 * Matching strategy (per query token):
 *  1. Exact word            -> 1.00
 *  2. Adjacent-word join    -> 1.00   ("haircut" <-> "Hair Cut")
 *  3. Word prefix           -> 0.88   ("barb" -> "barber")
 *  4. Word-internal infix   -> 0.85   ("sage" -> "massage", len >= 4 only)
 *  5. Suffix tolerance      -> 0.82   ("facials" -> "facial")
 *  6. Bounded Levenshtein   -> 0.80 * (1 - dist/maxLen)   ("barbar" -> "barber")
 *
 * A token "matches" a salon when its best weighted field score >= MIN_TOKEN_SCORE.
 * A salon matches the query when every matchable token matches (strict tier); if no
 * salon satisfies that, we fall back to salons matching at least half of the
 * matchable tokens (recall tier). Tokens that resemble nothing in the whole catalog
 * vocabulary (e.g. "shop" in "barbar shop") never disqualify a result — they are
 * simply ignored, mirroring how modern search engines drop unknown terms.
 */

export const MIN_TOKEN_SCORE = 0.6;
// High bar for "did you mean": single-edit typos score >= 0.67 while
// unrelated words of similar length land near 0.5 and must be filtered out.
const SUGGESTION_SCORE = 0.6;

/** Function words that add noise but never discriminate between salons. */
const QUERY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'for', 'to', 'of', 'in', 'at', 'on', 'near', 'me',
  'my', 'with', 'please', 'show', 'find', 'best', 'top', 'any', 'new',
]);

export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (e.g. L'Oréal -> loreal)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizeText(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/** Query tokens with stopwords removed ("salon near me" -> ["salon"]). */
export function tokenizeQuery(query: string): string[] {
  return tokenizeText(query).filter((token) => !QUERY_STOPWORDS.has(token));
}

/** Allowed typo distance grows with word length so short words stay precise. */
function typoBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/** Levenshtein distance capped at `max`; returns max + 1 as soon as it is exceeded. */
function boundedLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Uncapped Levenshtein (used for "did you mean" suggestions). */
function levenshtein(a: string, b: string): number {
  return boundedLevenshtein(a, b, Math.max(a.length, b.length));
}

/**
 * Token words plus adjacent-pair joins so compound queries match spaced data:
 * "Hair Cut & Wash" -> [hair, cut, wash, haircut, cutwash].
 */
function wordsWithJoins(text: string): string[] {
  const words = tokenizeText(text);
  if (words.length < 2) return words;
  const joined = words.slice();
  for (let i = 0; i + 1 < words.length; i++) {
    joined.push(words[i] + words[i + 1]);
  }
  return joined;
}

/** Score one query token against a single catalog word (0..1). */
function scoreTokenAgainstWord(token: string, word: string): number {
  if (!token || !word) return 0;
  if (token === word) return 1.0;
  if (word.startsWith(token)) return 0.88; // barb -> barber
  if (token.length >= 4 && word.includes(token)) return 0.85; // sage -> massage
  if (token.startsWith(word) && word.length >= 3 && token.length - word.length <= 2) {
    return 0.82; // facials -> facial
  }
  const shorter = Math.min(token.length, word.length);
  const budget = typoBudget(shorter);
  if (budget === 0) return 0;
  const dist = boundedLevenshtein(token, word, budget);
  if (dist > budget) return 0;
  return 0.8 * (1 - dist / Math.max(token.length, word.length)); // barbar -> barber
}

/** Best score of a token against any word of a field. */
function scoreTokenAgainstWords(token: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    const score = scoreTokenAgainstWord(token, word);
    if (score > best) best = score;
    if (best === 1.0) break;
  }
  return best;
}

interface SearchField {
  weight: number;
  words: string[];
  text: string;
}

/** Weighted searchable fields of a salon (weight = relevancy importance). */
function buildSalonFields(salon: Salon): SearchField[] {
  const services = salon.services ?? [];
  const stylists = salon.stylists ?? [];
  const professionalText = stylists
    .flatMap((st) => [st.role, ...st.specialty])
    .join(' ');

  const fields: Array<{ weight: number; text: string }> = [
    { weight: 1.0, text: salon.name },
    { weight: 0.92, text: (salon.categories ?? []).join(' ') },
    // Curated search tags: the exact phrasings users type ('barber shop',
    // 'mens salon', 'hydra facial') rank just under categories.
    { weight: 0.9, text: (salon.tags ?? []).join(' ') },
    // Broad keywords incl. misspellings ('barbar', 'saloon') and local lingo
    // ('gents parlour') so general queries never come back empty.
    { weight: 0.85, text: (salon.keywords ?? []).join(' ') },
    { weight: 0.88, text: services.map((srv) => srv.name).join(' ') },
    { weight: 0.75, text: `${salon.location?.area ?? ''} ${salon.location?.city ?? ''}` },
    { weight: 0.65, text: professionalText },
    { weight: 0.6, text: salon.tagline ?? '' },
    { weight: 0.5, text: (salon.amenities ?? []).join(' ') },
  ];

  return fields
    .filter((field) => normalizeText(field.text).length > 0)
    .map((field) => ({
      weight: field.weight,
      text: normalizeText(field.text),
      words: wordsWithJoins(field.text),
    }));
}

/** All distinct catalog words (>= 3 chars) across the given salons. */
function buildVocabulary(salons: Salon[]): string[] {
  const vocab = new Set<string>();
  for (const salon of salons) {
    for (const field of buildSalonFields(salon)) {
      for (const word of field.words) {
        if (word.length >= 3) vocab.add(word);
      }
    }
  }
  return Array.from(vocab);
}

interface TokenEvaluation {
  token: string;
  score: number; // best weighted field score for this salon
  matched: boolean;
}

interface SalonEvaluation {
  salon: Salon;
  score: number;
  matchedCount: number; // how many matchable tokens matched this salon
}

function evaluateSalon(salon: Salon, tokens: string[], fieldsCache?: Map<string, SearchField[]>): SalonEvaluation {
  const fields = fieldsCache?.get(salon.id) ?? buildSalonFields(salon);
  const evaluations: TokenEvaluation[] = tokens.map((token) => {
    let best = 0;
    for (const field of fields) {
      const weighted = scoreTokenAgainstWords(token, field.words) * field.weight;
      if (weighted > best) best = weighted;
    }
    return { token, score: best, matched: best >= MIN_TOKEN_SCORE };
  });

  const base = evaluations.reduce((sum, ev) => sum + ev.score, 0) / tokens.length;

  // Phrase bonus: the full multi-word query appearing inside one field.
  let phraseBonus = 0;
  if (tokens.length > 1) {
    const phrase = tokens.join(' ');
    for (const field of fields) {
      if (field.text.includes(phrase)) {
        phraseBonus = Math.max(phraseBonus, field.weight >= 0.9 ? 0.12 : 0.08);
      }
    }
  }

  return {
    salon,
    score: Math.min(1, base + phraseBonus),
    matchedCount: evaluations.filter((ev) => ev.matched).length,
  };
}

export interface ScoredSalon {
  salon: Salon;
  /** 0..1 relevancy — higher is more relevant. */
  score: number;
  /** How many query tokens matched this salon. */
  matchedTokens: number;
}

/**
 * Search salons with typo tolerance and multi-word relevancy ranking.
 * Returns salons sorted best-match first; empty array when nothing is relevant.
 */
export function searchSalons(salons: Salon[], query: string): ScoredSalon[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return salons.map((salon) => ({ salon, score: 1, matchedTokens: 0 }));
  }

  const fieldsCache = new Map<string, SearchField[]>();
  for (const salon of salons) fieldsCache.set(salon.id, buildSalonFields(salon));

  // Tokens that resemble at least one catalog word anywhere. Unmatchable tokens
  // ("shop" in "barbar shop") are dropped instead of failing the whole search.
  const vocabulary = buildVocabulary(salons);
  const matchable = tokens.filter(
    (token) => vocabulary.some((word) => scoreTokenAgainstWord(token, word) >= MIN_TOKEN_SCORE),
  );
  if (matchable.length === 0) return [];

  const evaluated = salons.map((salon) => evaluateSalon(salon, matchable, fieldsCache));
  const bestPossible = matchable.length;
  const maxMatched = evaluated.reduce((max, ev) => Math.max(max, ev.matchedCount), 0);
  if (maxMatched === 0) return [];

  // Strict tier: some salon matches every matchable token -> require all.
  // Recall tier: otherwise accept salons matching at least half the tokens.
  const required = maxMatched === bestPossible ? bestPossible : Math.max(1, Math.ceil(bestPossible / 2));

  return evaluated
    .filter((ev) => ev.matchedCount >= required)
    .sort(
      (a, b) =>
        b.matchedCount - a.matchedCount ||
        b.score - a.score ||
        (b.salon.rating ?? 0) - (a.salon.rating ?? 0),
    )
    .map((ev) => ({ salon: ev.salon, score: ev.score, matchedTokens: ev.matchedCount }));
}

/**
 * "Did you mean" candidates for a query that returned nothing.
 * Replaces tokens with their closest catalog word when reasonably similar.
 */
export function suggestQueryCorrections(salons: Salon[], query: string, limit = 3): string[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const vocabulary = buildVocabulary(salons);
  let changed = false;
  const corrected = tokens.map((token) => {
    let bestWord = token;
    let bestScore = 0;
    for (const word of vocabulary) {
      const sim = 1 - levenshtein(token, word) / Math.max(token.length, word.length);
      if (sim > bestScore) {
        bestScore = sim;
        bestWord = word;
      }
    }
    if (bestWord !== token && bestScore >= SUGGESTION_SCORE) {
      changed = true;
      return bestWord;
    }
    return token;
  });

  if (!changed) return [];
  const suggestion = corrected.join(' ');
  return suggestion === tokens.join(' ') ? [] : [suggestion].slice(0, limit);
}
