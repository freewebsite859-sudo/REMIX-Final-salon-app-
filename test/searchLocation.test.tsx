/**
 * Location & Search optimisation.
 *
 * Covers the three failure modes this task exists to fix:
 *
 *  1. FUZZY SEARCH — "BARBAR SHOP" (and friends) must return real local
 *     salons instead of an empty state, without letting typo tolerance
 *     outrank an exact match or invent matches for nonsense.
 *  2. LOCATION FALLBACK — every path (GPS fix, widened radius, typed text,
 *     saved preference, profile, city default) must end with an area that
 *     carries real coordinates, because a coordinate-less preference is
 *     silently discarded by the preference store.
 *  3. MAPS GROUNDING — both toggles must work with no credentials: grounded
 *     results are computed from catalog coordinates, and AI grounding reports
 *     an honest "unconfigured" state rather than pretending to be live.
 *
 * Run: npm run test:search-location
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { DEMO_SALONS } from '../src/data/demoCatalog.ts';
import type { Salon, UserProfile } from '../src/types.ts';
import {
  correctSearchQuery,
  parseSearchQuery,
  searchSalons,
} from '../src/lib/salonSearch.ts';
import {
  correctWord,
  editDistance,
  matchInText,
  rankFuzzyCandidates,
  similarity,
} from '../src/lib/fuzzyMatch.ts';
import {
  APPROXIMATE_SNAP_METERS,
  areaForCoordinates,
  resolveAreaQuery,
  resolveLocationWithFallback,
  suggestAreas,
} from '../src/lib/areaResolver.ts';
import { JAIPUR_AREA_CHIPS } from '../src/lib/jaipurAreas.ts';
import { saveCustomerLocation } from '../src/lib/customerLocation.ts';
import {
  DEFAULT_MAPS_GROUNDING_PREFERENCES,
  MAPS_GROUNDING_STORAGE_KEY,
  describeGroundingCapability,
  groundResults,
  groundSalon,
  isAiGroundingConfigured,
  loadMapsGroundingPreferences,
  requestAiMapsGrounding,
  setMapsGroundingPreference,
} from '../src/lib/mapsGrounding.ts';
import { SearchTab } from '../src/components/SearchTab.tsx';
import { LocationModal } from '../src/components/LocationModal.tsx';

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

// ===========================================================================
// 1. Fuzzy primitives
// ===========================================================================
function testFuzzyPrimitives() {
  check('edit distance: substitution', editDistance('barbar', 'barber') === 1);
  check('edit distance: transposition counts as one', editDistance('hiarcut', 'haircut') === 1);
  check('edit distance: early exit respects the budget', editDistance('abcdef', 'zzzzzz', 2) === 3);
  check('similarity: identical is 1', similarity('Mansarovar', 'mansarovar') === 1);
  check('similarity: unrelated is low', similarity('salon', 'plumber') < 0.4);

  check('word match: typo inside a sentence', matchInText('Best barber in town', 'barbar').hit);
  check(
    'word match: exact hits are flagged exact',
    matchInText('Hair Spa & Keratin', 'keratin').exact
  );
  check('word match: short words are never fuzzy', !matchInText('spa day', 'sea').hit);
  check('word match: nonsense does not match', !matchInText('Nexora Signature Salon', 'plumber').hit);
  check(
    'word match: split/joined words ("hair cut" ≈ "haircut")',
    matchInText('Premium hair cut for men', 'haircut').hit
  );

  check('correctWord: barbar → barber', correctWord('barbar', ['barber', 'salon'])?.to === 'barber');
  check('correctWord: leaves known words alone', correctWord('salon', ['salon', 'saloon']) === null);
  check('correctWord: refuses very short words', correctWord('spa', ['spa']) === null);

  const ranked = rankFuzzyCandidates('mansrovar', JAIPUR_AREA_CHIPS, (c) => [c.name, c.area]);
  check('ranking: typo picks the right locality', ranked[0]?.item.name === 'Mansarovar', ranked[0]?.item.name);
}

// ===========================================================================
// 2. Fuzzy salon search
// ===========================================================================
function testFuzzySearch() {
  const typo = searchSalons(DEMO_SALONS, 'BARBAR SHOP');
  const clean = searchSalons(DEMO_SALONS, 'barber shop');
  check('search: "BARBAR SHOP" returns results', typo.results.length > 0, `${typo.results.length} results`);
  check(
    'search: typo query reaches the same salons as the clean query',
    clean.results.every((r) => typo.results.some((t) => t.salon.id === r.salon.id)),
    `${typo.results.length} vs ${clean.results.length}`
  );
  check('search: correction is surfaced to the UI', /barber/i.test(typo.didYouMean || ''), String(typo.didYouMean));
  check(
    'search: the applied correction is explainable',
    typo.appliedCorrections.some((c) => c.from === 'barbar' && c.to === 'barber')
  );

  const misspelledArea = searchSalons(DEMO_SALONS, 'salom near mansarover');
  check('search: misspelled area + category still resolves', misspelledArea.results.length > 0);
  check('search: fuzzy matching is reported', misspelledArea.usedFuzzyMatching);

  const service = searchSalons(DEMO_SALONS, 'hiarcut');
  check('search: misspelled service returns salons', service.results.length > 0);

  const nonsense = searchSalons(DEMO_SALONS, 'zzzqqq plumbering');
  check('search: nonsense still returns nothing', nonsense.results.length === 0);
  check('search: nonsense does not claim a correction', nonsense.didYouMean === null);

  const exact = searchSalons(DEMO_SALONS, 'haircut');
  check('search: a correctly spelled query is never corrected', exact.didYouMean === null);
  check('search: exact query results are not marked fuzzy', exact.results.every((r) => !r.fuzzy));

  // Exact matches must keep their ranking lead over corrected ones.
  const merged = searchSalons(DEMO_SALONS, 'BARBAR SHOP');
  const firstFuzzyIndex = merged.results.findIndex((r) => r.fuzzy);
  const lastExactIndex = merged.results.map((r) => r.fuzzy).lastIndexOf(false);
  check(
    'search: exact hits are ranked above corrected extras',
    firstFuzzyIndex === -1 || firstFuzzyIndex > lastExactIndex,
    `firstFuzzy=${firstFuzzyIndex} lastExact=${lastExactIndex}`
  );

  const corrected = correctSearchQuery('tatoo studio');
  check('correction: preserves untouched words', corrected.corrected === 'tattoo studio', corrected.corrected);
  const priced = correctSearchQuery('hiarcut under ₹300');
  check('correction: keeps prices intact', /₹300/.test(priced.corrected), priced.corrected);
  check(
    'parse: price still extracted from a misspelled query',
    parseSearchQuery('hiarcut under ₹300').inferred.maxPrice === 300
  );
}

// ===========================================================================
// 3. Location fallback ladder
// ===========================================================================
function testLocationFallback() {
  // Typed text
  check('area query: exact name', resolveAreaQuery('Mansarovar').match?.name === 'Mansarovar');
  check('area query: typo', resolveAreaQuery('mansrovar').match?.name === 'Mansarovar');
  check('area query: alias', resolveAreaQuery('c scheme').match?.name === 'C-Scheme');
  check('area query: PIN code', resolveAreaQuery('302020').match?.name === 'Mansarovar');
  check('area query: PIN codes are exact confidence', resolveAreaQuery('302020').confidence === 'exact');
  check('area query: unknown text has no match', resolveAreaQuery('atlantis').match === null);
  check('area query: empty text has no match', resolveAreaQuery('   ').match === null);
  check('suggestions: typing narrows the chips', suggestAreas('vaish').length > 0);
  check(
    'suggestions: nonsense narrows to nothing',
    suggestAreas('qqqqqqqq').length === 0,
    String(suggestAreas('qqqqqqqq').length)
  );

  // Coordinates
  const exactFix = areaForCoordinates(26.8533, 75.7681);
  check('coords: a fix in Mansarovar snaps exactly', exactFix?.area.name === 'Mansarovar' && !exactFix.approximate);
  const edgeFix = areaForCoordinates(26.75, 75.95);
  check(
    'coords: a fix outside the strict radius still resolves (widened)',
    Boolean(edgeFix) && edgeFix?.approximate === true,
    edgeFix?.area.name
  );
  check('coords: widened radius is bounded', APPROXIMATE_SNAP_METERS === 25_000);
  check('coords: invalid input resolves to nothing', areaForCoordinates(NaN, NaN) === null);

  // The ladder
  const gps = resolveLocationWithFallback({ coords: { latitude: 26.8533, longitude: 75.7681 } });
  check('ladder 1: GPS fix wins', gps.source === 'gps' && gps.area === 'Mansarovar');
  check('ladder 1: GPS fix is not marked approximate', gps.approximate === false);

  const nearby = resolveLocationWithFallback({ coords: { latitude: 26.75, longitude: 75.95 } });
  check('ladder 1b: distant fix uses the nearest locality', nearby.source === 'gps-approximate');
  check('ladder 1b: approximate answers say so', nearby.approximate && /km/.test(nearby.note), nearby.note);

  const typed = resolveLocationWithFallback({ typedText: 'malviya nager' });
  check('ladder 2: typed text is fuzzy-resolved', typed.area === 'Malviya Nagar', typed.area);
  check('ladder 2: typed text carries real coordinates', Number.isFinite(typed.latitude) && typed.latitude > 26);
  check('ladder 2: typed text persists as a manual pick', typed.preferenceSource === 'manual');

  const saved = resolveLocationWithFallback({
    typedText: 'somewhere unknown',
    saved: { latitude: 26.9124, longitude: 75.7873, city: 'Jaipur', area: 'C-Scheme' },
  });
  check('ladder 3: falls back to the saved preference', saved.source === 'saved' && saved.area === 'C-Scheme');

  const profile = resolveLocationWithFallback({ profileArea: 'Jagatpura' });
  check('ladder 4: falls back to the profile area', profile.source === 'profile' && profile.area === 'Jagatpura');

  const last = resolveLocationWithFallback({});
  check('ladder 5: city centre is the last resort', last.source === 'city-default');
  check('ladder 5: city centre is labelled honestly', /city centre/i.test(last.area), last.area);
  check(
    'ladder: every rung produces usable coordinates',
    [gps, nearby, typed, saved, profile, last].every(
      (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
    )
  );

  // The bug this fixes: a coordinate-less preference is rejected by the store,
  // so any resolved location must survive a save round-trip.
  const stored = saveCustomerLocation('user-loc-1', {
    latitude: typed.latitude,
    longitude: typed.longitude,
    city: typed.city,
    area: typed.area,
    pincode: typed.pincode,
    source: typed.preferenceSource,
  });
  check('ladder: a resolved area survives saveCustomerLocation', stored?.area === 'Malviya Nagar');
  const rejected = saveCustomerLocation('user-loc-1', {
    latitude: Number.NaN,
    longitude: Number.NaN,
    city: 'Jaipur',
    area: 'Typed junk',
    source: 'manual',
  });
  check('ladder: coordinate-less picks are still rejected by the store', rejected === null);
}

// ===========================================================================
// 4. Maps grounding
// ===========================================================================
async function testMapsGrounding() {
  localStorage.removeItem(MAPS_GROUNDING_STORAGE_KEY);
  check(
    'grounding: defaults to catalog grounding on, AI off',
    DEFAULT_MAPS_GROUNDING_PREFERENCES.groundedResults === true &&
      DEFAULT_MAPS_GROUNDING_PREFERENCES.aiGrounding === false
  );
  check('grounding: preferences load without storage', loadMapsGroundingPreferences().groundedResults === true);
  setMapsGroundingPreference('groundedResults', false);
  check('grounding: a toggle persists', loadMapsGroundingPreferences().groundedResults === false);
  setMapsGroundingPreference('groundedResults', true);
  check('grounding: toggling back persists', loadMapsGroundingPreferences().groundedResults === true);

  const salon = DEMO_SALONS[0];
  const ground = groundSalon(salon);
  check('grounding: a catalog salon is verified', ground.status === 'verified', ground.status);
  check('grounding: verified salons link to Google Maps', ground.directionsUrl.includes('google.com/maps'));
  check(
    'grounding: directions use the real coordinates',
    ground.directionsUrl.includes(String(salon.location.latitude))
  );

  const noCoords = {
    ...salon,
    id: 'salon-nocoords',
    location: { ...salon.location, latitude: undefined, longitude: undefined, mapsUrl: undefined },
  } as unknown as Salon;
  const unverified = groundSalon(noCoords);
  check('grounding: a salon without coordinates is unverified', unverified.status === 'unverified');
  check(
    'grounding: unverified salons still get a name/address search link',
    unverified.mapsUrl.includes('maps/search') && !unverified.mapsUrl.includes('undefined')
  );

  const results = [{ salon: noCoords }, { salon }];
  const on = groundResults(results, { enabled: true });
  check('grounding: verified results are promoted when on', on.items[0].salon.id === salon.id);
  check('grounding: counts are reported', on.verifiedCount === 1 && on.unverifiedCount === 1);
  const off = groundResults(results, { enabled: false });
  check('grounding: turning it off preserves the original order', off.items[0].salon.id === 'salon-nocoords');
  check('grounding: turning it off never reorders', off.reordered === false);

  // AI grounding without credentials must be honest, not fake.
  check('AI grounding: unconfigured by default', isAiGroundingConfigured({}) === false);
  const capability = describeGroundingCapability({});
  check('AI grounding: capability says unavailable', capability.aiGrounding.available === false);
  check('AI grounding: catalog grounding is always available', capability.groundedResults.available === true);

  const unconfigured = await requestAiMapsGrounding({ query: 'barber near me' }, { env: {} });
  check('AI grounding: reports unconfigured', unconfigured.status === 'unconfigured');
  const disabled = await requestAiMapsGrounding({ query: 'barber' }, { enabled: false, env: {} });
  check('AI grounding: reports disabled when toggled off', disabled.status === 'disabled');

  const configuredEnv = { VITE_NEXORA_MAPS_GROUNDING_ENDPOINT: '/api/maps/ground' };
  check('AI grounding: an endpoint counts as configured', isAiGroundingConfigured(configuredEnv));
  const okResponse = await requestAiMapsGrounding(
    { query: 'barber near Mansarovar' },
    {
      env: configuredEnv,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            summary: 'Three barbers near Mansarovar.',
            places: [{ name: 'Sharp Cuts', address: 'Mansarovar', latitude: 26.85, longitude: 75.76 }],
            citations: ['https://maps.google.com/?cid=1'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as unknown as typeof fetch,
    }
  );
  check(
    'AI grounding: a configured backend returns grounded places',
    okResponse.status === 'ok' && okResponse.places[0]?.name === 'Sharp Cuts'
  );
  const failing = await requestAiMapsGrounding(
    { query: 'barber' },
    {
      env: configuredEnv,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    }
  );
  check('AI grounding: a network failure degrades gracefully', failing.status === 'error');
}

// ===========================================================================
// 5. UI
// ===========================================================================
const host = document.createElement('div');
document.body.appendChild(host);
const root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function clickAct(el: Element | null | undefined) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof window.MouseEvent !== 'undefined' ? window.MouseEvent : window.Event;
  await act(async () => {
    (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function setInput(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error('input missing');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 340));
  });
}

const mockUser: UserProfile = {
  name: 'Ananya Sharma',
  email: 'ananya@example.com',
  phone: '+91 98290 12345',
  avatar: '',
  locationArea: 'Mansarovar',
  city: 'Jaipur',
  loyaltyPoints: 0,
  preferredServices: [],
  genderPreference: 'all',
} as UserProfile;

async function testSearchUi() {
  localStorage.removeItem(MAPS_GROUNDING_STORAGE_KEY);
  await render(
    <SearchTab
      user={mockUser}
      salons={DEMO_SALONS}
      currentLocation="Mansarovar, Jaipur"
      savedSalonIds={[]}
      onOpenSalonDetails={() => {}}
      onBookSalon={() => {}}
      onToggleSaveSalon={() => {}}
    />
  );

  check('UI: search page renders', Boolean(document.getElementById('customer-search-page')));
  check('UI: maps grounding bar is present', Boolean(document.getElementById('maps-grounding-bar')));
  check(
    'UI: grounded results toggle defaults to on',
    document.getElementById('toggle-grounded-results')?.getAttribute('aria-checked') === 'true'
  );
  check(
    'UI: AI grounding toggle is disabled when unconfigured',
    (document.getElementById('toggle-ai-maps-grounding') as HTMLButtonElement | null)?.disabled === true
  );
  check(
    'UI: unconfigured AI grounding explains itself',
    /not configured/i.test(document.getElementById('ai-grounding-unavailable-hint')?.textContent || '')
  );

  await setInput(document.getElementById('search-page-input') as HTMLInputElement, 'BARBAR SHOP');
  const cards = host.querySelectorAll('[id^="search-result-"]');
  check('UI: a typo search shows salons', cards.length > 0, `${cards.length} cards`);
  check(
    'UI: the correction notice appears',
    /barber/i.test(document.getElementById('search-did-you-mean')?.textContent || ''),
    document.getElementById('search-did-you-mean')?.textContent || ''
  );
  check(
    'UI: corrected extras are badged as close matches',
    host.querySelectorAll('[data-fuzzy-match="true"]').length > 0
  );
  check(
    'UI: results carry a verified maps badge',
    host.querySelectorAll('[data-grounding-status="verified"]').length > 0
  );
  check(
    'UI: grounding status counts verified results',
    /verified against catalog coordinates/i.test(
      document.getElementById('maps-grounding-status')?.textContent || ''
    )
  );

  await clickAct(document.getElementById('toggle-grounded-results'));
  check(
    'UI: grounding can be switched off',
    document.getElementById('toggle-grounded-results')?.getAttribute('aria-checked') === 'false'
  );
  check(
    'UI: switching off removes the map badges',
    host.querySelectorAll('[data-grounding-status]').length === 0
  );
  check(
    'UI: the off state is explained',
    /grounding is off/i.test(document.getElementById('maps-grounding-status')?.textContent || '')
  );
  check(
    'UI: the toggle is persisted for the next visit',
    loadMapsGroundingPreferences().groundedResults === false
  );
  await clickAct(document.getElementById('toggle-grounded-results'));

  // A correctly spelled query must not show a correction notice.
  await setInput(document.getElementById('search-page-input') as HTMLInputElement, 'haircut');
  check('UI: no correction notice for a clean query', document.getElementById('search-did-you-mean') === null);
}

async function testLocationUi() {
  const selections: Array<{ label: string; lat?: number; lng?: number; area?: string }> = [];
  let closed = 0;

  await render(
    <LocationModal
      isOpen
      onClose={() => {
        closed += 1;
      }}
      currentLocation="Mansarovar, Jaipur"
      onSelectLocation={(label, lat, lng, meta) =>
        selections.push({ label, lat, lng, area: meta?.area })
      }
    />
  );

  check('UI: location modal renders', Boolean(document.getElementById('location-picker-modal')));

  const input = host.querySelector('input[type="text"]') as HTMLInputElement | null;
  await setInput(input, 'mansrovar');
  check('UI: typo suggestions appear', Boolean(document.getElementById('location-suggestions')));
  check(
    'UI: the top suggestion is the right locality',
    /Mansarovar/i.test(document.getElementById('location-suggestions')?.textContent || '')
  );

  await clickAct(document.getElementById('location-suggestion-mansarovar'));
  check('UI: picking a suggestion selects the area', selections[0]?.area === 'Mansarovar', selections[0]?.area);
  check(
    'UI: a typed pick carries real coordinates (so it can be saved)',
    typeof selections[0]?.lat === 'number' && typeof selections[0]?.lng === 'number',
    `${selections[0]?.lat}, ${selections[0]?.lng}`
  );
  check('UI: modal closes after a typed pick', closed === 1);

  // Unmatched free text must warn instead of saving an unusable location.
  const selections2: Array<{ area?: string }> = [];
  await render(
    <LocationModal
      isOpen
      onClose={() => {}}
      currentLocation="Mansarovar, Jaipur"
      onSelectLocation={(_label, _lat, _lng, meta) => selections2.push({ area: meta?.area })}
    />
  );
  const input2 = host.querySelector('input[type="text"]') as HTMLInputElement | null;
  await setInput(input2, 'atlantis');
  const form = input2?.closest('form');
  await act(async () => {
    form?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
  check('UI: unmatched text is rejected', selections2.length === 0);
  check(
    'UI: unmatched text explains what to do',
    /could not match/i.test(document.getElementById('location-manual-error')?.textContent || ''),
    document.getElementById('location-manual-error')?.textContent || ''
  );
}

async function run() {
  testFuzzyPrimitives();
  testFuzzySearch();
  testLocationFallback();
  await testMapsGrounding();
  await testSearchUi();
  await testLocationUi();

  console.log(`\n${passed}/${passed + failed} location & search checks passed`);
  await act(async () => {
    root.unmount();
  });
  process.exit(failed > 0 ? 1 : 0);
}

void run();
