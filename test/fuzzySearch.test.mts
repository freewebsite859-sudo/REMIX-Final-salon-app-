import { DEMO_SALONS } from '../src/data/demoCatalog';
import type { Salon } from '../src/types';
import {
  normalizeText,
  tokenizeQuery,
  searchSalons,
  suggestQueryCorrections,
} from '../src/lib/fuzzySearch';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const ids = (salons: Salon[]) => salons.map((s) => s.name).join(', ');

/** Synthetic catalog so suggestion behavior is deterministic. */
const fakeSalon = (name: string, categories: string[]): Salon => ({
  ...(DEMO_SALONS[0] as Salon),
  id: `fake-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  categories,
  services: [],
});

function run() {
  // ---------------------------------------------------------------------
  // Normalization & tokenization
  // ---------------------------------------------------------------------
  check('normalization strips accents, case and punctuation', normalizeText("L'Oréal Deep-Hair Spa!") === 'l oreal deep hair spa');
  check('query tokenizer drops stopwords', tokenizeQuery('salon near me')?.join(',') === 'salon');
  check('empty-ish queries tokenize to nothing', tokenizeQuery('the near me').length === 0);

  // ---------------------------------------------------------------------
  // Exact search still works (no regression)
  // ---------------------------------------------------------------------
  const nail = searchSalons(DEMO_SALONS, 'nail');
  check('exact term "nail" finds the nail salon first', nail[0]?.salon.name === 'The Nail Artistry & Polish Bar', ids(nail.map((r) => r.salon)));

  const hair = searchSalons(DEMO_SALONS, 'hair');
  check('exact term "hair" returns multiple salons', hair.length >= 2, `${hair.length} results`);

  check('empty query returns the whole catalog', searchSalons(DEMO_SALONS, '').length === DEMO_SALONS.length);
  check('stopword-only query ("near me") returns the whole catalog', searchSalons(DEMO_SALONS, 'near me').length === DEMO_SALONS.length);

  // ---------------------------------------------------------------------
  // Typo tolerance — the reported bug: 'BARBAR SHOP' vs 'BARBER'
  // ---------------------------------------------------------------------
  const barbarShop = searchSalons(DEMO_SALONS, 'BARBAR SHOP');
  check(
    'typo query "BARBAR SHOP" finds the barber salon (was: "No Salons Match Your Search")',
    barbarShop.some((r) => r.salon.name === 'Premium Hair Studio'),
    ids(barbarShop.map((r) => r.salon)),
  );
  check('"BARBAR SHOP" ranks the barber salon first', barbarShop[0]?.salon.name === 'Premium Hair Studio');

  const barbar = searchSalons(DEMO_SALONS, 'barbar');
  check('single typo token "barbar" matches "Barber" category', barbar.some((r) => r.salon.name === 'Premium Hair Studio'));

  const faciall = searchSalons(DEMO_SALONS, 'faciall');
  check('doubled-letter typo "faciall" finds facial salon', faciall.some((r) => r.salon.name === 'Luxe Beauty Lounge'));

  const delux = searchSalons(DEMO_SALONS, 'hydra facial delux');
  check(
    'multi-typo query "hydra facial delux" finds the hydra facial salon',
    delux.some((r) => r.salon.name === 'Luxe Beauty Lounge'),
    ids(delux.map((r) => r.salon)),
  );

  // ---------------------------------------------------------------------
  // Multi-word queries
  // ---------------------------------------------------------------------
  const beardTrim = searchSalons(DEMO_SALONS, 'beard trim');
  check(
    'multi-word "beard trim" finds the salon offering "Beard Trim"',
    beardTrim.some((r) => r.salon.name === 'Premium Hair Studio'),
    ids(beardTrim.map((r) => r.salon)),
  );

  const haircut = searchSalons(DEMO_SALONS, 'haircut');
  check(
    'compound "haircut" matches spaced "Hair Cut" services',
    haircut.some((r) => r.salon.name === 'Scissors & Shears Salon') &&
      haircut.some((r) => r.salon.name === 'Luxe Beauty Lounge'),
    ids(haircut.map((r) => r.salon)),
  );

  const hairCut = searchSalons(DEMO_SALONS, 'hair cut');
  check('two-token "hair cut" matches the same salons', hairCut.some((r) => r.salon.name === 'Scissors & Shears Salon'));

  const areaSearch = searchSalons(DEMO_SALONS, 'malviya nagar salon');
  check(
    'area + generic word query "malviya nagar salon" finds the Malviya Nagar salon',
    areaSearch.some((r) => r.salon.name === 'Glow & Grace Spa & Salon'),
    ids(areaSearch.map((r) => r.salon)),
  );

  // ---------------------------------------------------------------------
  // Relevancy ranking
  // ---------------------------------------------------------------------
  const beardSpa = searchSalons(DEMO_SALONS, 'beard spa');
  const premiumIdx = beardSpa.findIndex((r) => r.salon.name === 'Premium Hair Studio');
  const scissorsIdx = beardSpa.findIndex((r) => r.salon.name === 'Scissors & Shears Salon');
  check(
    '"beard spa" ranks exact-phrase "Beard Spa" salon above partial match',
    premiumIdx !== -1 && scissorsIdx !== -1 && premiumIdx < scissorsIdx,
    `order: ${ids(beardSpa.map((r) => r.salon))}`,
  );

  const scores = searchSalons(DEMO_SALONS, 'beard trim').map((r) => r.score);
  check('scores are sorted best-match first', scores.every((s, i) => i === 0 || scores[i - 1] >= s), scores.map((s) => s.toFixed(2)).join(' > '));

  // ---------------------------------------------------------------------
  // No false positives / suggestions
  // ---------------------------------------------------------------------
  check('gibberish query returns no results', searchSalons(DEMO_SALONS, 'asdf qwerty').length === 0);
  check('gibberish query produces no suggestions', suggestQueryCorrections(DEMO_SALONS, 'asdf qwerty').length === 0);

  const barberShopCatalog = [fakeSalon('Barber King', ['Barber Shop', 'Men'])];
  const suggestion = suggestQueryCorrections(barberShopCatalog, 'brbr shp');
  check(
    '"did you mean" corrects heavy typos ("brbr shp" -> "barber shop")',
    suggestion.length > 0 && suggestion[0] === 'barber shop',
    suggestion.join(' | '),
  );

  // ---------------------------------------------------------------------
  // Quick-search dropdown queries (src/lib/searchSuggestions.ts) — every
  // click-to-search option must return relevant salons from the engine.
  // ---------------------------------------------------------------------
  const quickExpectations: Array<[string, string]> = [
    ['barber men grooming', 'Premium Hair Studio'],
    ['hair cut styling', 'Scissors & Shears Salon'],
    ['hydra facial skin', 'Luxe Beauty Lounge'],
    ['beard trim shave', 'Premium Hair Studio'],
    ['spa nails', 'The Nail Artistry & Polish Bar'],
  ];
  for (const [query, expectedSalon] of quickExpectations) {
    const quickResults = searchSalons(DEMO_SALONS, query);
    check(
      `quick category "${query}" finds ${expectedSalon}`,
      quickResults.some((r) => r.salon.name === expectedSalon),
      ids(quickResults.map((r) => r.salon)),
    );
  }
  const popularTerms = ['haircut', 'beard trim', 'hydra facial', 'spa', 'nails art', 'keratin', 'detan', 'bridal'];
  check(
    'every popular-search tag returns at least one salon',
    popularTerms.every((term) => searchSalons(DEMO_SALONS, term).length > 0),
  );

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

run();
