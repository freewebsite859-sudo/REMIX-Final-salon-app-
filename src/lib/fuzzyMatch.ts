/**
 * Typo-tolerant matching primitives shared by salon search and the location
 * picker.
 *
 * Customers type on phones, in a hurry, in a second language: "BARBAR SHOP",
 * "salom near mansarover", "hiarcut". Exact substring matching answers all of
 * those with "no results", which is indistinguishable from "this city has no
 * barbers" — the single worst failure mode for a local marketplace.
 *
 * The rules here are deliberately conservative so fuzziness never invents a
 * match a human would not accept:
 *   - the typo budget scales with word length (never fuzzy on <4 characters),
 *   - transpositions count as ONE edit ("hiarcut" ≈ "haircut"),
 *   - an exact hit always outranks a corrected hit.
 *
 * Everything is pure and dependency-free so it can run in the browser, in the
 * Node test harness, and on the server.
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Lowercase, strip accents/punctuation, collapse whitespace. */
export function normalizeForMatch(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised text with all spaces removed ("hair cut" → "haircut"). */
export function compactForMatch(value: string): string {
  return normalizeForMatch(value).replace(/\s+/g, '');
}

/** Split text into comparable words. */
export function tokenize(value: string): string[] {
  const normalized = normalizeForMatch(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Edit distance
// ---------------------------------------------------------------------------

/**
 * Optimal string alignment (Damerau-Levenshtein) distance with an early exit.
 *
 * Returns `maxDistance + 1` as soon as every cell in a row exceeds the budget,
 * which keeps large catalog scans cheap.
 */
export function editDistance(a: string, b: string, maxDistance = Number.POSITIVE_INFINITY): number {
  const s = a || '';
  const t = b || '';
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  if (Math.abs(s.length - t.length) > maxDistance) return maxDistance + 1;

  let prevPrev: number[] = [];
  let prev: number[] = new Array(t.length + 1);
  let curr: number[] = new Array(t.length + 1);

  for (let j = 0; j <= t.length; j += 1) prev[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let value = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      );
      // Transposition ("hiarcut" → "haircut" costs 1, not 2).
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    prevPrev = prev;
    prev = curr;
    curr = new Array(t.length + 1);
  }

  return prev[t.length];
}

/**
 * How many edits we tolerate for a word of this length.
 * Short words are left alone — "spa" must not match "spb"/"sea".
 */
export function typoBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/** 0…1 closeness between two words (1 = identical). */
export function similarity(a: string, b: string): number {
  const s = normalizeForMatch(a);
  const t = normalizeForMatch(b);
  if (!s && !t) return 1;
  const longest = Math.max(s.length, t.length);
  if (!longest) return 0;
  const distance = editDistance(s, t);
  return Math.max(0, 1 - distance / longest);
}

// ---------------------------------------------------------------------------
// Word-level matching
// ---------------------------------------------------------------------------

export interface WordMatch {
  hit: boolean;
  /** True when the candidate contained the term verbatim. */
  exact: boolean;
  distance: number;
}

const NO_MATCH: WordMatch = { hit: false, exact: false, distance: Number.POSITIVE_INFINITY };

/**
 * Compare a single query word against a single candidate word.
 * Accepts exact equality, a long-enough prefix ("massa" → "massage"), and
 * edits inside the typo budget for the shorter of the two words.
 */
export function matchWord(candidate: string, term: string): WordMatch {
  const c = normalizeForMatch(candidate);
  const t = normalizeForMatch(term);
  if (!c || !t) return NO_MATCH;
  if (c === t) return { hit: true, exact: true, distance: 0 };
  // Prefix / containment: typing fewer letters is not a typo.
  if (t.length >= 4 && c.startsWith(t)) return { hit: true, exact: true, distance: 0 };
  if (t.length >= 5 && c.includes(t)) return { hit: true, exact: true, distance: 0 };

  const budget = typoBudget(Math.min(c.length, t.length));
  if (budget === 0) return NO_MATCH;
  const distance = editDistance(c, t, budget);
  if (distance <= budget) return { hit: true, exact: false, distance };

  // A typo inside a longer compound word ("barbarshop" vs "barber shop").
  if (c.length > t.length + budget) {
    const window = c.slice(0, t.length + budget);
    const windowDistance = editDistance(window, t, budget);
    if (windowDistance <= budget) return { hit: true, exact: false, distance: windowDistance };
  }
  return NO_MATCH;
}

/**
 * Does `term` appear — exactly or with a tolerable typo — anywhere in `text`?
 * Multi-word terms must match as a run of consecutive words, so "hair spa"
 * does not match a salon that merely mentions "hair" and "spa" separately.
 */
export function matchInText(text: string, term: string): WordMatch {
  const haystack = normalizeForMatch(text);
  const needle = normalizeForMatch(term);
  if (!needle) return { hit: true, exact: true, distance: 0 };
  if (!haystack) return NO_MATCH;
  if (haystack.includes(needle)) return { hit: true, exact: true, distance: 0 };

  const needleWords = needle.split(' ').filter(Boolean);
  const words = haystack.split(' ').filter(Boolean);
  if (needleWords.length === 0 || words.length === 0) return NO_MATCH;

  if (needleWords.length === 1) {
    // Also allow "hair cut" (text) ≈ "haircut" (term) and vice versa.
    const compactHaystack = haystack.replace(/\s+/g, '');
    if (needle.length >= 5 && compactHaystack.includes(needle)) {
      return { hit: true, exact: true, distance: 0 };
    }
    let best: WordMatch = NO_MATCH;
    for (const word of words) {
      const m = matchWord(word, needle);
      if (m.hit && m.distance < best.distance) best = m;
      if (best.exact) break;
    }
    if (!best.hit && needle.length >= 6) {
      // Compare against joined word pairs: "hairspa" ≈ "hair spa".
      for (let i = 0; i < words.length - 1; i += 1) {
        const joined = words[i] + words[i + 1];
        const m = matchWord(joined, needle);
        if (m.hit && m.distance < best.distance) best = m;
        if (best.exact) break;
      }
    }
    return best;
  }

  // Multi-word term: slide a window of the same length across the text.
  let best: WordMatch = NO_MATCH;
  for (let i = 0; i + needleWords.length <= words.length; i += 1) {
    let total = 0;
    let exact = true;
    let ok = true;
    for (let j = 0; j < needleWords.length; j += 1) {
      const m = matchWord(words[i + j], needleWords[j]);
      if (!m.hit) {
        ok = false;
        break;
      }
      if (!m.exact) exact = false;
      total += m.distance;
    }
    if (ok && total < best.distance) best = { hit: true, exact, distance: total };
    if (best.exact) break;
  }
  if (best.hit) return best;

  // Last resort: compare the whole phrase without spaces.
  const compactTerm = needle.replace(/\s+/g, '');
  const compactHaystack = haystack.replace(/\s+/g, '');
  if (compactTerm.length >= 6 && compactHaystack.includes(compactTerm)) {
    return { hit: true, exact: true, distance: 0 };
  }
  return NO_MATCH;
}

/** Convenience boolean form of {@link matchInText}. */
export function fuzzyIncludes(text: string, term: string): boolean {
  return matchInText(text, term).hit;
}

// ---------------------------------------------------------------------------
// Candidate ranking
// ---------------------------------------------------------------------------

export interface FuzzyCandidate<T> {
  item: T;
  /** Which of the candidate's aliases matched. */
  matched: string;
  distance: number;
  /** 0…1, higher is better. */
  score: number;
  exact: boolean;
}

export interface FuzzyMatchOptions {
  /** Minimum 0…1 similarity for a candidate to be considered. Default 0.6. */
  minScore?: number;
  /** Cap on returned suggestions. Default 5. */
  limit?: number;
}

/**
 * Rank candidates against a term. `aliases` returns every string a candidate
 * can be known by (name, area, pincode, nicknames…).
 */
export function rankFuzzyCandidates<T>(
  term: string,
  candidates: readonly T[],
  aliases: (candidate: T) => string[],
  options: FuzzyMatchOptions = {}
): FuzzyCandidate<T>[] {
  const needle = normalizeForMatch(term);
  if (!needle) return [];
  const minScore = options.minScore ?? 0.6;
  const limit = options.limit ?? 5;

  const scored: FuzzyCandidate<T>[] = [];
  for (const item of candidates) {
    let best: FuzzyCandidate<T> | null = null;
    for (const alias of aliases(item)) {
      const candidate = normalizeForMatch(alias);
      if (!candidate) continue;

      let distance: number;
      let exact = false;
      if (candidate === needle) {
        distance = 0;
        exact = true;
      } else if (candidate.startsWith(needle) || candidate.includes(needle)) {
        // Partial typing is exact-but-incomplete; rank just under a full hit.
        distance = 0;
        exact = true;
      } else {
        const m = matchInText(candidate, needle);
        if (!m.hit) continue;
        distance = m.distance;
        exact = m.exact;
      }

      const lengthPenalty =
        candidate === needle ? 0 : Math.min(0.2, Math.abs(candidate.length - needle.length) / 40);
      const score = Math.max(
        0,
        1 - distance / Math.max(needle.length, 1) - lengthPenalty
      );
      if (!best || score > best.score) {
        best = { item, matched: alias, distance, score, exact };
      }
    }
    if (best && best.score >= minScore) scored.push(best);
  }

  return scored
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, limit);
}

/** Highest-ranked candidate, or null when nothing clears `minScore`. */
export function bestFuzzyCandidate<T>(
  term: string,
  candidates: readonly T[],
  aliases: (candidate: T) => string[],
  options: FuzzyMatchOptions = {}
): FuzzyCandidate<T> | null {
  return rankFuzzyCandidates(term, candidates, aliases, { ...options, limit: 1 })[0] || null;
}

// ---------------------------------------------------------------------------
// Spelling correction against a vocabulary
// ---------------------------------------------------------------------------

export interface WordCorrection {
  from: string;
  to: string;
  distance: number;
}

/**
 * Correct a single word against a vocabulary. Returns null when the word is
 * already known, is too short to correct safely, or nothing is close enough.
 */
export function correctWord(word: string, vocabulary: readonly string[]): WordCorrection | null {
  const w = normalizeForMatch(word);
  if (w.length < 4) return null;
  let best: WordCorrection | null = null;
  for (const entry of vocabulary) {
    const candidate = normalizeForMatch(entry);
    if (!candidate || candidate.includes(' ')) continue;
    if (candidate === w) return null; // already a real word
    const shortest = Math.min(candidate.length, w.length);
    if (shortest < 3) continue;
    // One edit is enough for short words ("spaa" → "spa"); longer words get
    // two, which is where real-world typing errors cluster.
    const budget = shortest <= 4 ? 1 : Math.min(typoBudget(Math.max(candidate.length, w.length)), 2);
    if (budget === 0) continue;
    if (Math.abs(candidate.length - w.length) > budget) continue;
    const distance = editDistance(candidate, w, budget);
    if (distance > budget) continue;
    if (!best || distance < best.distance || (distance === best.distance && candidate < best.to)) {
      best = { from: w, to: candidate, distance };
    }
  }
  return best;
}

export interface PhraseCorrection {
  /** The phrase with every correctable word replaced. */
  corrected: string;
  /** One entry per word that changed. */
  corrections: WordCorrection[];
}

/** Correct every word of a phrase against a vocabulary. */
export function correctPhrase(phrase: string, vocabulary: readonly string[]): PhraseCorrection {
  const words = normalizeForMatch(phrase).split(' ').filter(Boolean);
  const corrections: WordCorrection[] = [];
  const out = words.map((word) => {
    const fix = correctWord(word, vocabulary);
    if (!fix) return word;
    corrections.push(fix);
    return fix.to;
  });
  return { corrected: out.join(' '), corrections };
}
