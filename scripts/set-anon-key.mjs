#!/usr/bin/env node
/**
 * Installs the public Supabase anon key into .env, then rebuilds and verifies.
 *
 *   node scripts/set-anon-key.mjs <anon-key>
 *   node scripts/set-anon-key.mjs            # reads the key from stdin
 *   node scripts/set-anon-key.mjs --no-build <anon-key>
 *
 * Safety:
 *   - refuses a service_role (or any non-anon) key — that would bypass RLS for
 *     every visitor if it were inlined into the browser bundle
 *   - warns when the key's project ref does not match VITE_SUPABASE_URL
 *   - never prints the full key, only a short preview
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const positional = args.filter((a) => !a.startsWith('--'));

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

const key = (positional[0] ?? readStdin()).trim().replace(/^["']|["']$/g, '');

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!key) {
  fail(
    'No key supplied.\n' +
      '  Usage: node scripts/set-anon-key.mjs <anon-key>\n' +
      '  Get it from: Supabase Dashboard → your project → Settings → API →\n' +
      '               Project API keys → anon public'
  );
}

// --- Decode the JWT claims without pulling in a JWT library ------------------
function claims(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

if (key.length <= 20) fail('That does not look like a Supabase key (too short).');
if (key.split('.').length !== 3) fail('That is not a JWT. Supabase API keys have three dot-separated parts.');

const payload = claims(key);
if (!payload) fail('Could not decode the key payload — is it copied in full?');

if (payload.role === 'service_role') {
  fail(
    'REFUSED: that is a service_role key.\n' +
      '  It would be inlined into the public browser bundle and bypass row-level\n' +
      '  security for every visitor. Use the "anon public" key instead.\n' +
      '  Supabase Dashboard → Settings → API → Project API keys → anon public'
  );
}
if (payload.role && payload.role !== 'anon') {
  fail(`REFUSED: expected an "anon" key but the JWT role claim is "${payload.role}".`);
}

const preview = `${key.slice(0, 10)}…${key.slice(-6)} (len ${key.length}, role=${payload.role ?? 'unknown'})`;

// --- Locate .env and read the current URL -----------------------------------
const root = process.cwd();
const envPath = path.join(root, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const urlMatch = env.match(/^VITE_SUPABASE_URL=(.*)$/m);
const projectUrl = (urlMatch?.[1] ?? '').trim();
const urlRef = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (urlRef && payload.ref && payload.ref !== urlRef) {
  console.warn(
    `\n⚠ Project mismatch: the key belongs to "${payload.ref}" but VITE_SUPABASE_URL\n` +
      `  points at "${urlRef}". Both must be the same Supabase project or every\n` +
      `  request will be rejected. Fix one of them and re-run.\n`
  );
  fail('Project ref mismatch — not writing the key.');
}

// --- Write the key -----------------------------------------------------------
if (/^VITE_SUPABASE_ANON_KEY=/m.test(env)) {
  env = env.replace(/^VITE_SUPABASE_ANON_KEY=.*$/m, `VITE_SUPABASE_ANON_KEY=${key}`);
} else {
  env += `${env.endsWith('\n') || env === '' ? '' : '\n'}VITE_SUPABASE_ANON_KEY=${key}\n`;
}
if (!/^VITE_SUPABASE_URL=/m.test(env)) {
  env += 'VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co\n';
}
fs.writeFileSync(envPath, env);
console.log(`\n✓ Wrote anon key to .env — ${preview}`);

if (fs.existsSync(path.join(root, '.gitignore'))) {
  const ignored = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  if (!/\.env/.test(ignored)) {
    console.warn('⚠ .gitignore does not mention .env — do not commit this file.');
  }
}

// --- Verify the client now considers itself configured -----------------------
// Written to a temp .mts file rather than `tsx --eval`, because --eval compiles
// to CJS where top-level await is rejected.
import os from 'node:os';
const probePath = path.join(os.tmpdir(), `nexora-verify-${process.pid}.mts`);
// Absolute specifier — the probe lives in tmpdir, so a relative one would not
// resolve back into the project.
const clientSpecifier = `file://${path.join(root, 'src/lib/supabase/client.ts')}`;
fs.writeFileSync(
  probePath,
  [
    `const m = await import(${JSON.stringify(clientSpecifier)});`,
    'const s = m.getSupabaseConfigStatus();',
    "console.log('  isSupabaseConfigured =', m.isSupabaseConfigured);",
    "console.log('  hasUrl =', s.hasUrl, '| hasAnonKey =', s.hasAnonKey, '| privileged =', s.isPrivilegedKey);",
    "console.log('  url =', s.url, '| keyRef =', s.anonKeyRef);",
    'process.exit(m.isSupabaseConfigured ? 0 : 1);',
    '',
  ].join('\n')
);

const verified = spawnSync('npx', ['tsx', probePath], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, VITE_SUPABASE_ANON_KEY: key, VITE_SUPABASE_URL: projectUrl || process.env.VITE_SUPABASE_URL },
});
fs.rmSync(probePath, { force: true });
process.stdout.write(verified.stdout ?? '');
if (verified.status !== 0) {
  process.stderr.write(verified.stderr ?? '');
  fail('The Supabase client still reports itself unconfigured after writing the key.');
}
console.log('✓ Supabase client is now configured — live authentication is enabled.\n');

// --- Rebuild so the production bundle picks the key up -----------------------
if (noBuild) {
  console.log('Skipped the rebuild (--no-build). Run `npm run build` before `npm start`.');
  console.log('`npm run dev` needs no rebuild — Vite reads .env live.');
  process.exit(0);
}

console.log('Rebuilding so the browser bundle picks up the key…');
const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) fail('Build failed.');
console.log('\n✓ Done. Live authentication is configured.');
console.log('  npm run dev    → dev server (Vite middleware, reads .env live)');
console.log('  npm start      → production server, serves the dist/ bundle you just built');
