/**
 * First-login location preference helpers + Jaipur area catalog.
 */
import assert from 'node:assert/strict';
import {
  JAIPUR_AREA_CHIPS,
  formatAreaLabel,
  isInsideJaipur,
  nearestJaipurArea,
} from '../src/lib/jaipurAreas.ts';
import {
  clearCustomerLocation,
  hasCompletedLocationSetup,
  loadCustomerLocation,
  markLocationSetupComplete,
  preferenceFromChip,
  saveCustomerLocation,
} from '../src/lib/customerLocation.ts';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Minimal localStorage shim
const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k, v) => {
    mem.set(k, String(v));
  },
  removeItem: (k) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;
(globalThis as { window?: unknown }).window = globalThis;

// ---- Catalog --------------------------------------------------------------
const expectedNames = [
  'Mansarovar',
  'Vaishali Nagar',
  'Malviya Nagar',
  'Raja Park',
  'C-Scheme',
  'Jagatpura',
  'Tonk Road',
  'Jhotwara',
  'Sanganer',
  'Pratap Nagar',
];
check(
  'Jaipur catalog has all 10 required area chips',
  JAIPUR_AREA_CHIPS.length === 10 &&
    expectedNames.every((n) => JAIPUR_AREA_CHIPS.some((c) => c.name === n)),
  `got ${JAIPUR_AREA_CHIPS.map((c) => c.name).join(', ')}`
);

check(
  'every chip carries lat/lng/city/area',
  JAIPUR_AREA_CHIPS.every(
    (c) =>
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude) &&
      c.city === 'Jaipur' &&
      c.area.length > 0
  )
);

check(
  'most chips include a pincode',
  JAIPUR_AREA_CHIPS.filter((c) => Boolean(c.pincode)).length >= 8
);

check(
  'formatAreaLabel',
  formatAreaLabel({ area: 'Mansarovar', city: 'Jaipur' }) === 'Mansarovar, Jaipur'
);

// ---- Nearest / bounds -----------------------------------------------------
check('Mansarovar coords are inside Jaipur', isInsideJaipur(26.8533, 75.7681));
check('Delhi coords are outside Jaipur', !isInsideJaipur(28.61, 77.2));

const nearMansarovar = nearestJaipurArea(26.854, 75.769);
check(
  'nearestJaipurArea snaps near Mansarovar',
  nearMansarovar?.name === 'Mansarovar',
  nearMansarovar?.name
);

const farAway = nearestJaipurArea(28.61, 77.2, 4000);
check('nearestJaipurArea returns null when far', farAway === null);

// ---- Preference persistence ----------------------------------------------
const USER = 'user-test-1';
clearCustomerLocation(USER);
check('fresh user has not completed setup', hasCompletedLocationSetup(USER) === false);

const chip = JAIPUR_AREA_CHIPS[0];
const pref = preferenceFromChip(chip);
check('preferenceFromChip sets source chip', pref.source === 'chip');
check('preferenceFromChip includes pincode', pref.pincode === chip.pincode);
check(
  'preferenceFromChip has lat/lng/city/area',
  pref.latitude === chip.latitude &&
    pref.longitude === chip.longitude &&
    pref.city === 'Jaipur' &&
    pref.area === 'Mansarovar'
);

const saved = saveCustomerLocation(USER, pref);
check('saveCustomerLocation returns preference', saved !== null && saved.area === 'Mansarovar');
check(
  'saveCustomerLocation marks setup complete',
  hasCompletedLocationSetup(USER) === true
);
check(
  'loadCustomerLocation round-trips fields',
  (() => {
    const loaded = loadCustomerLocation(USER);
    return (
      loaded !== null &&
      loaded.latitude === chip.latitude &&
      loaded.longitude === chip.longitude &&
      loaded.city === 'Jaipur' &&
      loaded.area === 'Mansarovar' &&
      loaded.pincode === chip.pincode &&
      loaded.label === 'Mansarovar, Jaipur'
    );
  })()
);

// Reject invalid coords
const rejected = saveCustomerLocation(USER, {
  ...pref,
  latitude: 999,
});
check('invalid latitude is rejected', rejected === null);

// markLocationSetupComplete alone is enough to suppress the prompt
clearCustomerLocation('user-2');
check('user-2 not set up', hasCompletedLocationSetup('user-2') === false);
markLocationSetupComplete('user-2');
check('skip marks setup complete without a preference', hasCompletedLocationSetup('user-2') === true);

// GPS-shaped preference
const gpsSaved = saveCustomerLocation('user-gps', {
  latitude: 26.85,
  longitude: 75.77,
  city: 'Jaipur',
  area: 'Mansarovar',
  pincode: '302020',
  source: 'gps',
});
check(
  'GPS preference stores source=gps',
  gpsSaved?.source === 'gps' && gpsSaved.pincode === '302020'
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(
    'Failures:',
    failed.map((f) => f.name).join(', ')
  );
  process.exit(1);
}
process.exit(0);
