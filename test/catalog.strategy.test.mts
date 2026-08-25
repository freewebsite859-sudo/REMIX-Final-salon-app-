import { DEMO_SALONS } from '../src/data/demoCatalog';
import { fetchCatalog, normalizeCatalog } from '../src/lib/catalogService';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const realSalon = {
  id: 'real-salon-1',
  name: 'Real Catalog Salon',
  latitude: 26.9124,
  longitude: 75.8035,
  address: 'Verified address',
  city: 'Jaipur',
  services: [
    { id: 'real-service-1', name: 'Verified Cut', category: 'hair', duration: 45, price: 700 },
  ],
  professionals: [{ id: 'real-pro-1', name: 'Verified Professional' }],
};

function clientFor(data: Record<string, unknown[]>, errors: Record<string, string> = {}) {
  return {
    from(table: string) {
      return {
        async select() {
          return errors[table]
            ? { data: null, error: { message: errors[table] } }
            : { data: data[table] || [], error: null };
        },
      };
    },
  } as any;
}

async function run() {
  const normalized = normalizeCatalog([realSalon], [], [], []);
  check(
    'normalizer accepts valid remote salon rows',
    normalized.length === 1 && normalized[0].name === 'Real Catalog Salon'
  );
  check(
    'normalizer uses only remote child records',
    normalized[0]?.services[0]?.name === 'Verified Cut' &&
      normalized[0]?.stylists[0]?.name === 'Verified Professional'
  );

  const remote = await fetchCatalog(
    clientFor({ salons: [realSalon], services: [], categories: [], professionals: [] })
  );
  check(
    'non-empty valid remote catalog replaces fallback',
    remote.source === 'remote' && remote.salons.length === 1 && remote.salons[0].id === 'real-salon-1'
  );
  check(
    'remote catalog contains no fallback salon rows',
    remote.salons.every((salon) => salon.id === 'real-salon-1')
  );

  const empty = await fetchCatalog(clientFor({ salons: [], services: [], categories: [], professionals: [] }));
  check(
    'empty remote root retains fallback catalog',
    empty.source === 'fallback' && empty.salons.length === DEMO_SALONS.length
  );

  const failed = await fetchCatalog(clientFor({}, { salons: 'catalog table unavailable' }));
  check(
    'remote catalog failure retains fallback catalog',
    failed.source === 'fallback' && failed.salons.length === DEMO_SALONS.length && failed.warnings.length > 0
  );

  const partial = await fetchCatalog(
    clientFor({ salons: [realSalon] }, { services: 'service table unavailable' })
  );
  check(
    'child-table failure never mixes fallback children into remote salons',
    partial.source === 'remote' && partial.salons.length === 1 && partial.salons[0].services.length === 1
  );

  const failedResults = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failedResults.length}/${results.length} catalog checks passed`);
  if (failedResults.length) process.exit(1);
}

run().catch((error) => {
  console.error('Catalog strategy test crashed:', error);
  process.exit(1);
});
