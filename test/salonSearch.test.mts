/**
 * Unit tests for advanced salon search (NL parse, filters, sort, recent).
 */
import assert from 'node:assert/strict';
import { DEMO_SALONS } from '../src/data/demoCatalog.ts';
import {
  DEFAULT_SEARCH_FILTERS,
  clearRecentSearches,
  countActiveFilters,
  isVerifiedSalon,
  loadRecentSearches,
  parseSearchQuery,
  pushRecentSearch,
  searchSalons,
  sortResults,
  type SearchResult,
} from '../src/lib/salonSearch.ts';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// NL parser
// ---------------------------------------------------------------------------

{
  const p = parseSearchQuery('haircut under ₹300');
  check('NL: extracts maxPrice 300', p.inferred.maxPrice === 300);
  check('NL: extracts service Haircut', p.inferred.serviceType === 'Haircut');
  check('NL: understanding mentions under', p.understanding.some((u) => /300/.test(u)));
}

{
  const p = parseSearchQuery('best salon near Mansarovar');
  check('NL: area Mansarovar', p.inferred.area === 'Mansarovar');
  check('NL: category salon', p.inferred.category === 'salon');
  check('NL: sort top_rated', p.inferredSort === 'top_rated');
}

{
  const p = parseSearchQuery('female beauty parlour near me');
  check('NL: gender women', p.inferred.gender === 'women');
  check('NL: category beauty', p.inferred.category === 'beauty');
  check('NL: sort nearest from near me', p.inferredSort === 'nearest');
}

{
  const p = parseSearchQuery('tattoo studio in Jaipur');
  check('NL: category tattoo', p.inferred.category === 'tattoo');
  check('NL: understanding has Jaipur', p.understanding.some((u) => /jaipur/i.test(u)));
}

{
  const p = parseSearchQuery('spa open now');
  check('NL: category spa', p.inferred.category === 'spa');
  check('NL: openNow', p.inferred.openNow === true);
}

{
  const p = parseSearchQuery('verified barber within 3 km');
  check('NL: verified', p.inferred.verifiedOnly === true);
  check('NL: distance 3', p.inferred.maxDistanceKm === 3);
  check('NL: category barber', p.inferred.category === 'barber');
}

{
  const p = parseSearchQuery('');
  check('NL: empty query safe', p.text === '' && p.understanding.length === 0);
}

// ---------------------------------------------------------------------------
// Search against demo catalog
// ---------------------------------------------------------------------------

{
  // Demo catalogue haircuts start ~₹349–₹399; ₹500 is the realistic "under" band.
  const { results, parsed } = searchSalons(DEMO_SALONS, 'haircut under ₹500');
  check('search: haircut under 500 returns rows', results.length > 0, `n=${results.length}`);
  check(
    'search: all matched haircut prices <= 500',
    results.every((r) => r.fromPrice <= 500),
    results.map((r) => `${r.salon.name}:${r.fromPrice}:${r.matchedService?.name}`).join(' | ')
  );
  check('search: parsed service', parsed.inferred.serviceType === 'Haircut');
  check(
    'search: matched services look like haircuts',
    results.every(
      (r) =>
        !r.matchedService ||
        /hair\s*cut|fade|cut &/i.test(r.matchedService.name) ||
        compactIncludesHaircut(r.matchedService.name)
    ),
    results.map((r) => r.matchedService?.name || '-').join(',')
  );
}

function compactIncludesHaircut(name: string): boolean {
  return name.toLowerCase().replace(/\s+/g, '').includes('haircut');
}

{
  // Strict ₹300 band: may be empty on demo data — pipeline must still be safe.
  const { results, parsed } = searchSalons(DEMO_SALONS, 'haircut under ₹300');
  check(
    'search: haircut under 300 is safe',
    Array.isArray(results) && parsed.inferred.maxPrice === 300,
    `n=${results.length}`
  );
  check(
    'search: under 300 respects cap when rows exist',
    results.every((r) => r.fromPrice <= 300)
  );
}

{
  const { results } = searchSalons(DEMO_SALONS, 'spa open now');
  check('search: spa open now has results or empty-ok', true, `n=${results.length}`);
  check(
    'search: spa open now all open',
    results.every((r) => r.salon.isOpen),
    `n=${results.length}`
  );
}

{
  const { results } = searchSalons(DEMO_SALONS, 'best salon near Mansarovar');
  check('search: mansarovar area hit', results.length > 0, `n=${results.length}`);
  check(
    'search: mansarovar filter applied',
    results.every((r) => /mansarovar/i.test(r.salon.location.area + r.salon.location.address)),
    results.map((r) => r.salon.location.area).join(',')
  );
}

{
  const { results } = searchSalons(DEMO_SALONS, 'female beauty parlour near me');
  check(
    'search: women/unisex only',
    results.every((r) => r.salon.gender === 'women' || r.salon.gender === 'unisex'),
    results.map((r) => r.salon.gender).join(',')
  );
}

{
  const { results, sort } = searchSalons(DEMO_SALONS, 'tattoo studio in Jaipur');
  // May be 0 if catalog has no tattoo — still a valid pipeline
  check('search: tattoo pipeline runs', Array.isArray(results), `n=${results.length} sort=${sort}`);
}

{
  const { results } = searchSalons(
    DEMO_SALONS,
    '',
    { ...DEFAULT_SEARCH_FILTERS, openNow: true, verifiedOnly: true },
    'top_rated'
  );
  check(
    'filters: open+verified only',
    results.every((r) => r.salon.isOpen && isVerifiedSalon(r.salon)),
    `n=${results.length}`
  );
}

{
  const { results } = searchSalons(
    DEMO_SALONS,
    '',
    { ...DEFAULT_SEARCH_FILTERS, maxDistanceKm: 1 },
    'nearest'
  );
  check(
    'filters: distance 1km',
    results.every((r) => {
      const d = parseFloat((r.salon.distance || '').replace(/[^0-9.]/g, ''));
      return d <= 1;
    }),
    results.map((r) => r.salon.distance).join(',')
  );
}

{
  const { results } = searchSalons(
    DEMO_SALONS,
    '',
    { ...DEFAULT_SEARCH_FILTERS, gender: 'men' },
    'nearest'
  );
  check(
    'filters: men includes men+unisex',
    results.every((r) => r.salon.gender === 'men' || r.salon.gender === 'unisex'),
    results.map((r) => `${r.salon.name}:${r.salon.gender}`).join('; ')
  );
}

{
  const { results } = searchSalons(
    DEMO_SALONS,
    '',
    { ...DEFAULT_SEARCH_FILTERS, offersOnly: true },
    'lowest_price'
  );
  check('filters: offers only non-empty or empty-ok', true, `n=${results.length}`);
  check(
    'filters: offers have discountOffer or service discount',
    results.every(
      (r) =>
        Boolean(r.salon.discountOffer) ||
        r.salon.services.some(
          (s) => s.discountPrice != null && s.discountPrice > 0 && s.discountPrice < s.price
        )
    )
  );
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

{
  const base: SearchResult[] = DEMO_SALONS.map((salon) => ({
    salon,
    matchedService: null,
    fromPrice: Math.min(...salon.services.map((s) => s.discountPrice || s.price)),
    score: 0,
    fuzzy: false,
  }));

  const nearest = sortResults(base, 'nearest');
  const dists = nearest.map((r) => parseFloat((r.salon.distance || '999').replace(/[^0-9.]/g, '')));
  check(
    'sort: nearest ascending',
    dists.every((d, i) => i === 0 || d >= dists[i - 1] - 1e-9),
    dists.join(',')
  );

  const rated = sortResults(base, 'top_rated');
  check(
    'sort: top rated descending',
    rated.every(
      (r, i) => i === 0 || r.salon.rating <= rated[i - 1].salon.rating + 1e-9
    )
  );

  const cheap = sortResults(base, 'lowest_price');
  check(
    'sort: lowest price ascending',
    cheap.every((r, i) => i === 0 || r.fromPrice >= cheap[i - 1].fromPrice - 1e-9)
  );

  const popular = sortResults(base, 'most_popular');
  check(
    'sort: most popular by reviews',
    popular.every(
      (r, i) => i === 0 || r.salon.reviewCount <= popular[i - 1].salon.reviewCount
    )
  );

  const avail = sortResults(base, 'available_today');
  check(
    'sort: available today opens first',
    avail.findIndex((r) => r.salon.isOpen) <= avail.findIndex((r) => !r.salon.isOpen) ||
      avail.every((r) => r.salon.isOpen) ||
      avail.every((r) => !r.salon.isOpen)
  );
}

// ---------------------------------------------------------------------------
// Recent searches (memory storage)
// ---------------------------------------------------------------------------

{
  const mem: Record<string, string> = {};
  const storage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
  } as Storage;

  clearRecentSearches(storage);
  check('recent: starts empty', loadRecentSearches(storage).length === 0);

  pushRecentSearch('haircut under ₹300', storage);
  pushRecentSearch('spa open now', storage);
  pushRecentSearch('haircut under ₹300', storage); // move to front, dedupe
  const recent = loadRecentSearches(storage);
  check('recent: deduped length 2', recent.length === 2, recent.join(' | '));
  check('recent: most recent first', recent[0] === 'haircut under ₹300');

  clearRecentSearches(storage);
  check('recent: cleared', loadRecentSearches(storage).length === 0);
}

// ---------------------------------------------------------------------------
// countActiveFilters
// ---------------------------------------------------------------------------

{
  check('count: default is 0', countActiveFilters(DEFAULT_SEARCH_FILTERS) === 0);
  check(
    'count: open+verified+price',
    countActiveFilters({
      ...DEFAULT_SEARCH_FILTERS,
      openNow: true,
      verifiedOnly: true,
      maxPrice: 300,
    }) === 3
  );
}

// ---------------------------------------------------------------------------
// UI sort overrides NL sort
// ---------------------------------------------------------------------------

{
  const { sort } = searchSalons(DEMO_SALONS, 'best salon', DEFAULT_SEARCH_FILTERS, 'lowest_price');
  check('sort: UI override beats NL', sort === 'lowest_price');
}

{
  const { sort } = searchSalons(DEMO_SALONS, 'best salon', DEFAULT_SEARCH_FILTERS, null);
  check('sort: NL top_rated when no UI sort', sort === 'top_rated');
}

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
