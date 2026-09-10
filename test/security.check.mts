/**
 * Security guard tests for the browser Supabase client.
 *
 * `src/lib/supabase/client.ts` refuses to construct a client when the key
 * handed to the browser is privileged (`role: service_role`), because such a
 * client would bypass row-level security for every visitor. It also treats
 * placeholder / non-JWT values as absent so a scaffolded `.env` can never
 * produce a client that only ever fails.
 *
 * The client reads its config once at module-evaluation time, so every
 * scenario runs in a fresh child process (see securityProbe.mts).
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = `${here}..`;
const probe = `${here}securityProbe.mts`;

// The probe is TypeScript with top-level await, so it must run through tsx
// exactly like every other suite in this project.
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

const PROJECT_URL = 'https://qwaehqsmodekbgvnaavz.supabase.co';

/** Build a JWT-shaped token. Only the payload is inspected by the guard. */
function jwt(role: string): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    role,
    iss: 'supabase',
    ref: 'qwaehqsmodekbgvnaavz',
    iat: 1700000000,
    exp: 1900000000,
  });
  return `${header}.${payload}.${b64url({ sig: 'vZ1r4KdQ7mW0pT8sYbN2uA' })}`;
}

type ProbeResult = {
  clientCreated: boolean;
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  isPrivilegedKey: boolean;
  anonKeyRole: string | null;
  urlPlaceholder: boolean;
  anonKeyPlaceholder: boolean;
};

function probeWith(env: Record<string, string>): ProbeResult {
  const out = execFileSync(process.execPath, [tsxCli, probe], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const line = out
    .split('\n')
    .reverse()
    .find((l) => l.startsWith('PROBE '));
  if (!line) throw new Error(`probe printed no verdict for ${JSON.stringify(env)}`);
  return JSON.parse(line.slice('PROBE '.length)) as ProbeResult;
}

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const anonKey = jwt('anon');
const serviceKey = jwt('service_role');

// 1. A privileged key must be rejected outright — no client, flagged as such.
const privileged = probeWith({
  VITE_SUPABASE_URL: PROJECT_URL,
  VITE_SUPABASE_ANON_KEY: serviceKey,
});
check(
  'service_role key is flagged as privileged',
  privileged.isPrivilegedKey === true,
  `isPrivilegedKey=${privileged.isPrivilegedKey}, role=${privileged.anonKeyRole}`,
);
check(
  'service_role key never creates a browser client',
  privileged.clientCreated === false,
  `clientCreated=${privileged.clientCreated}`,
);
check(
  'service_role key is not reported as configured',
  privileged.isConfigured === false,
  `isConfigured=${privileged.isConfigured}`,
);

// 2. A legitimate anon key must still work — the guard cannot break real auth.
const legit = probeWith({
  VITE_SUPABASE_URL: PROJECT_URL,
  VITE_SUPABASE_ANON_KEY: anonKey,
});
check('anon key is accepted', legit.hasAnonKey === true, `hasAnonKey=${legit.hasAnonKey}`);
check(
  'anon key creates the shared client',
  legit.clientCreated === true && legit.isConfigured === true,
  `clientCreated=${legit.clientCreated}, isConfigured=${legit.isConfigured}`,
);
check('anon key is not misread as privileged', legit.isPrivilegedKey === false);

// 3. Placeholder values are treated as absent, never as credentials.
const placeholder = probeWith({
  VITE_SUPABASE_URL: 'https://your-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'paste-your-anon-key-here',
});
check(
  'placeholder URL + key flagged and rejected',
  placeholder.clientCreated === false &&
    placeholder.urlPlaceholder === true &&
    placeholder.anonKeyPlaceholder === true,
  JSON.stringify(placeholder),
);

// 4. A non-JWT scratch token cannot masquerade as a key.
const scratch = probeWith({
  VITE_SUPABASE_URL: PROJECT_URL,
  VITE_SUPABASE_ANON_KEY: 'sk-not-a-jwt-token',
});
check(
  'non-JWT token rejected without creating a client',
  scratch.clientCreated === false && scratch.hasAnonKey === false,
  `clientCreated=${scratch.clientCreated}, hasAnonKey=${scratch.hasAnonKey}`,
);

// 5. Fully unconfigured: no client, and it must not throw at import time.
const unconfigured = probeWith({
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
});
check(
  'unconfigured environment yields no client and no crash',
  unconfigured.clientCreated === false && unconfigured.isConfigured === false,
  `clientCreated=${unconfigured.clientCreated}, isConfigured=${unconfigured.isConfigured}`,
);

const total = passed + failed;
console.log(
  `\n${passed}/${total} security checks passed${failed ? ` (${failed} failed)` : ''}`,
);
process.exit(failed === 0 ? 0 : 1);
