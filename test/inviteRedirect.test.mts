/**
 * Invite-link HTTP layer + boot capture.
 *
 * The rest of the invite suites prove that the SPA opens signup from a code.
 * This one proves the parts that used to be missing and are the reason a shared
 * `https://<host>/invite?code=NX-VIJAY634` did nothing:
 *
 *   • the server answers the invite paths with a real 302 (so the link works on
 *     a cold load, on a host without SPA fallback, and with JS disabled);
 *   • the redirect targets signup with the code in `?ref=`, never `?code=`
 *     (GoTrue would treat that as a PKCE authorization code);
 *   • the pre-React script shipped in `index.html` captures + rewrites on its
 *     own, and refuses a Supabase authorization code;
 *   • share links are built from the deployment origin, not a hardcoded domain;
 *   • `public/_redirects` carries the same rules for static hosts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import express from 'express';
import type { AddressInfo } from 'node:net';

import {
  inviteRedirectMiddleware,
  normalizeInviteCode,
  resolveInviteRedirect,
} from '../server/inviteRedirects.ts';
import {
  PENDING_REFERRAL_CODE_KEY,
  SIGNUP_REFERRAL_PARAM,
  buildInviteLink,
  isReferralCodeValue,
  normalizeReferralCode,
  resolveInviteOrigin,
} from '../src/lib/inviteLink.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = 'NX-VIJAY634';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Pure redirect resolution
// ---------------------------------------------------------------------------
check(
  'invite link redirects to signup with the code',
  resolveInviteRedirect(`/invite?code=${CODE}`) === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${CODE}`,
  String(resolveInviteRedirect(`/invite?code=${CODE}`))
);
check(
  'short link form /r/<code> is resolved from the path',
  resolveInviteRedirect(`/r/${CODE.toLowerCase()}`) === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${CODE}`
);
check(
  '/invite/<code> path form works too',
  resolveInviteRedirect(`/invite/${CODE}`) === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${CODE}`
);
check('alias /join is an invite path', resolveInviteRedirect('/join') === '/customer/signup');
check('alias /refer is an invite path', resolveInviteRedirect('/refer') === '/customer/signup');
check(
  'every accepted param alias is read',
  ['ref', 'referral', 'referral_code', 'invite', 'invite_code', 'rc'].every(
    (key) => resolveInviteRedirect(`/invite?${key}=${CODE}`) === `/customer/signup?ref=${CODE}`
  )
);
check(
  'a signup URL carrying ?code= is normalised to ?ref=',
  resolveInviteRedirect(`/customer/signup?code=${CODE}`) === `/customer/signup?ref=${CODE}`
);
check(
  'a clean signup URL is left alone (no redirect loop)',
  resolveInviteRedirect(`/customer/signup?${SIGNUP_REFERRAL_PARAM}=${CODE}`) === null
);
check('the app home page is left alone', resolveInviteRedirect('/customer/home') === null);
check('an API route is left alone', resolveInviteRedirect('/api/referrals/resolve') === null);
check(
  'junk in ?code= is dropped, never forwarded',
  resolveInviteRedirect('/invite?code=%F0%9F%98%80') === '/customer/signup'
);
check(
  'a Supabase authorization code is not mistaken for a referral code',
  !isReferralCodeValue('2f9c1a4b7e3d4c5a9b1f0d2e3f4a5b6c7d8e9f0a') &&
    resolveInviteRedirect('/auth/callback?code=2f9c1a4b7e3d4c5a9b1f0d2e3f4a5b6c7d8e9f0a') === null
);
check(
  'server-side code normalisation matches the client',
  normalizeInviteCode(' nx-vijay634 ') === normalizeReferralCode(' nx-vijay634 ') &&
    normalizeInviteCode('nx-vijay634') === CODE
);

// ---------------------------------------------------------------------------
// 2. Real HTTP: express + the middleware mounted before static/SPA
// ---------------------------------------------------------------------------
async function runHttp() {
  const app = express();
  app.use(inviteRedirectMiddleware());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/customer/home', (_req, res) => res.send('<div id="root"></div>'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const res = await fetch(`${base}/invite?code=${CODE}`, { redirect: 'manual' });
  check('GET /invite?code=… returns 302', res.status === 302, String(res.status));
  check(
    'Location is the signup screen with ?ref=',
    res.headers.get('location') === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${CODE}`,
    String(res.headers.get('location'))
  );
  check(
    'redirect is not cacheable (fixes deploy-to-deploy is not sticky)',
    res.headers.get('cache-control') === 'no-store',
    String(res.headers.get('cache-control'))
  );

  const segment = await fetch(`${base}/r/nx-vijay634`, { redirect: 'manual' });
  check(
    'GET /r/<code> redirects',
    segment.status === 302 && /\/customer\/signup\?ref=NX-VIJAY634$/.test(segment.headers.get('location') || ''),
    `${segment.status} → ${segment.headers.get('location')}`
  );

  const head = await fetch(`${base}/invite?code=${CODE}`, { method: 'HEAD', redirect: 'manual' });
  check('HEAD is answered like GET (link unfurlers)', head.status === 302, String(head.status));

  const post = await fetch(`${base}/invite`, { method: 'POST', redirect: 'manual' });
  check('non-GET requests are not redirected', post.status === 404 || post.status === 405, String(post.status));

  const api = await fetch(`${base}/api/health`);
  check('API routes are untouched', api.status === 200, String(api.status));
  const home = await fetch(`${base}/customer/home`);
  check('app routes are untouched', home.status === 200, String(home.status));

  server.close();
}

// ---------------------------------------------------------------------------
// 3. The pre-React capture script shipped in index.html
// ---------------------------------------------------------------------------
function runBootScript(url: string, seedStorage: Record<string, string> = {}) {
  const html = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const match = html.match(/<script>\s*\/\*\*([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html must ship an inline invite capture script');
  const source = match[1].slice(match[1].indexOf('(function'));

  const parsed = new URL(url);
  const location = {
    pathname: parsed.pathname,
    search: parsed.search,
    origin: parsed.origin,
  };
  const store: Record<string, string> = { ...seedStorage };
  const window: Record<string, unknown> = {
    location,
    history: {
      replaceState: (_state: unknown, _title: string, href: string) => {
        const next = new URL(href, parsed.origin);
        location.pathname = next.pathname;
        location.search = next.search;
      },
    },
    localStorage: {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
    },
  };
  vm.runInNewContext(source, {
    window,
    URLSearchParams,
    URL,
    Date,
    JSON,
    String,
    Number,
    Math,
    Boolean,
    encodeURIComponent,
    decodeURIComponent,
    console,
  });
  return {
    marker: window.__NEXORA_INVITE__ as { code?: string; cameFromInvite?: boolean } | undefined,
    stash: store[PENDING_REFERRAL_CODE_KEY],
    pathname: location.pathname,
    search: location.search,
  };
}

const bootInvite = runBootScript(`https://nexora.app/invite?code=${CODE}`);
check(
  'boot script rewrites /invite?code= to the signup screen',
  bootInvite.pathname === '/customer/signup' && bootInvite.search === `?${SIGNUP_REFERRAL_PARAM}=${CODE}`,
  `${bootInvite.pathname}${bootInvite.search}`
);
check('boot script marks the visit as an invite', bootInvite.marker?.cameFromInvite === true);
check(
  'boot script stashes the code under the shared key',
  typeof bootInvite.stash === 'string' && bootInvite.stash.includes(CODE),
  bootInvite.stash || '(empty)'
);

const bootSegment = runBootScript('https://nexora.app/r/nx-vijay634');
check(
  'boot script reads the path-segment form',
  bootSegment.search === `?${SIGNUP_REFERRAL_PARAM}=NX-VIJAY634`,
  bootSegment.search
);

const bootReload = runBootScript('https://nexora.app/customer/signup', {
  [PENDING_REFERRAL_CODE_KEY]: JSON.stringify({ code: CODE, at: '2026-09-10T10:00:00.000Z' }),
});
check(
  'a reload of the bare signup URL re-attaches the stashed code',
  bootReload.search === `?${SIGNUP_REFERRAL_PARAM}=${CODE}`,
  bootReload.search
);

const authCode = '2f9c1a4b7e3d4c5a9b1f0d2e3f4a5b6c7d8e9f0a';
const bootAuth = runBootScript(`https://nexora.app/auth/callback?code=${authCode}`);
check(
  'boot script never hijacks a Supabase auth code',
  bootAuth.marker === undefined &&
    bootAuth.stash === undefined &&
    bootAuth.pathname === '/auth/callback' &&
    bootAuth.search === `?code=${authCode}`,
  `${bootAuth.pathname}${bootAuth.search}`
);

const html = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
check(
  'capture runs before the app bundle',
  html.indexOf('nexora-pending-referral-code') < html.indexOf('src/main.tsx')
);
check(
  'boot script and module share the stash key',
  html.includes(`'${PENDING_REFERRAL_CODE_KEY}'`)
);
check(
  'boot script uses the collision-free signup param',
  html.includes(`'?${SIGNUP_REFERRAL_PARAM}='`) || html.includes(`?${SIGNUP_REFERRAL_PARAM}=`)
);
check('main.tsx imports the boot guard first', (() => {
  const main = readFileSync(path.join(repoRoot, 'src/main.tsx'), 'utf8');
  return main.indexOf('inviteBoot') !== -1 && main.indexOf('inviteBoot') < main.indexOf('from \'react\'');
})());

// ---------------------------------------------------------------------------
// 4. Static-host rules + origin resolution
// ---------------------------------------------------------------------------
const redirects = readFileSync(path.join(repoRoot, 'public/_redirects'), 'utf8');
check(
  '_redirects maps the invite query onto signup?ref=',
  /^\/invite\?code=:code\s+\/customer\/signup\?ref=:code\s+302$/m.test(redirects)
);
check('_redirects covers /r/:splat', /^\/r\/:splat\s+\/customer\/signup\?ref=:splat\s+302$/m.test(redirects));
check('_redirects keeps an SPA fallback', /^\/\*\s+\/index\.html\s+200$/m.test(redirects));

check(
  'share links are built from the live origin, not a hardcoded domain',
  resolveInviteOrigin('https://nexora.app') === 'https://nexora.app' &&
    buildInviteLink(CODE, 'MY_APP_URL').includes('/invite?code=') &&
    !buildInviteLink(CODE, 'MY_APP_URL').includes('MY_APP_URL')
);
process.env.APP_URL = 'https://salon.example.com';
check('APP_URL is honoured when it is a real URL', resolveInviteOrigin() === 'https://salon.example.com');
process.env.APP_URL = 'nonsense-value';
check('a malformed APP_URL is ignored', resolveInviteOrigin() === 'https://nexora.app', resolveInviteOrigin());
delete process.env.APP_URL;

async function run() {
  await runHttp();
  console.log(`\n${passed}/${passed + failed} invite redirect checks passed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
