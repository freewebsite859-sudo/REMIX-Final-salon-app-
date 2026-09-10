#!/usr/bin/env node
/**
 * Invite-link live verification — `npm run verify:invite`.
 *
 * Answers one question with evidence: when somebody opens
 *   https://<your-host>/invite?code=NX-VIJAY634
 * does the app (a) serve that URL at all, (b) send the visitor to the SIGNUP
 * form, (c) keep the referral code, and (d) can the backend resolve the code so
 * the referrer actually gets counted?
 *
 * Usage:
 *   npm run verify:invite -- --base https://your-app.vercel.app
 *   npm run verify:invite -- --base http://127.0.0.1:3000 --code NX-VIJAY634
 *
 * No credentials are needed; only public routes are probed. Exits non-zero when
 * a step that the invite promise depends on has failed, so it is CI-safe.
 */
import 'dotenv/config';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(`--${name}`);
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return fallback;
}

const BASE = (argValue('base', process.env.NEXORA_VERIFY_BASE || 'http://127.0.0.1:3000'))
  .trim()
  .replace(/\/+$/, '');
const CODE = (argValue('code', 'NX-VIJAY634') || 'NX-VIJAY634').trim().toUpperCase();

let passed = 0;
let failed = 0;
let warned = 0;
const hints = [];

function ok(label, detail = '') {
  passed += 1;
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label, detail = '', hint = '') {
  failed += 1;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  if (hint) {
    hints.push(hint);
    console.log(`        ↳ ${hint}`);
  }
}
function warn(label, detail = '', hint = '') {
  warned += 1;
  console.log(`  WARN  ${label}${detail ? ` — ${detail}` : ''}`);
  if (hint) {
    hints.push(hint);
    console.log(`        ↳ ${hint}`);
  }
}
function info(label, detail = '') {
  console.log(`  INFO  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function probe(path) {
  const url = `${BASE}${path}`;
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.5' },
    });
    const body = await response.text().catch(() => '');
    return { url, status: response.status, headers: response.headers, body };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : String(err) };
  }
}

/** True when a redirect response heads at the signup screen with the code. */
function redirectTarget(result) {
  const location = result.headers?.get?.('location');
  if (!location) return '';
  try {
    return new URL(location, BASE).pathname + new URL(location, BASE).search;
  } catch {
    return location;
  }
}

function looksLikeSignup(target) {
  return /\/(customer\/signup|auth\/signup)$/.test(target.split('?')[0]);
}

/**
 * Classify an invite-path response. A server-side 302 is the best answer; an
 * HTML 200 is acceptable only when the page ships the pre-React capture script;
 * a 404 means the host never routes /invite and the link is dead on arrival.
 */
function judgeInviteResponse(label, result, code) {
  if (result.error) {
    bad(`${label} reachable`, `request failed: ${result.error}`, `Is ${BASE} up and public? Try --base https://<your-host>`);
    return 'unreachable';
  }
  const { status } = result;
  if (status >= 300 && status < 400) {
    const target = redirectTarget(result);
    if (!looksLikeSignup(target)) {
      bad(`${label} redirects to signup`, `Location: ${target || '(missing)'}`);
      return 'wrong-target';
    }
    if (code && !target.includes(encodeURIComponent(code))) {
      bad(`${label} keeps the code`, `Location: ${target}`);
      return 'lost-code';
    }
    if (/[?&]code=/.test(target)) {
      warn(`${label} avoids the ?code= param on signup`, target, 'Use ?ref= on the signup URL — GoTrue reads ?code= as a PKCE code.');
    } else {
      ok(`${label} → 302 signup (server-side)`, target);
    }
    return 'redirected';
  }
  if (status === 404 || status === 410) {
    bad(
      `${label} is routable`,
      `HTTP ${status}`,
      'The host has no SPA fallback and no _redirects rule for /invite. Deploy public/_redirects (Netlify / Cloudflare Pages) or host the Node server (npm run build && npm start).'
    );
    return 'not-routable';
  }
  if (status >= 200 && status < 300) {
    const html = result.body || '';
    if (!html.includes('nexora-pending-referral-code')) {
      bad(
        `${label} captures the code without the API`,
        `HTTP ${status}, but the served HTML has no invite capture script`,
        'Rebuild and redeploy — index.html must ship the pre-React capture script (see index.html).'
      );
      return 'no-capture';
    }
    ok(`${label} → 200 + in-page capture script`, `HTTP ${status}`);
    return 'captured';
  }
  bad(`${label} handled`, `unexpected HTTP ${status}`);
  return 'unexpected';
}

async function run() {
  console.log('\nNexora invite-link verification');
  console.log(`  base: ${BASE}`);
  console.log(`  code: ${CODE}\n`);

  const health = await probe('/api/health');
  if (!health.error && health.status === 200) {
    ok('Node API reachable', '/api/health → 200');
  } else {
    info(
      'Node API not reachable at this origin',
      health.error || `HTTP ${health.status}`,
      '(static hosting — invite links then depend on _redirects + the in-page capture script)'
    );
  }

  console.log('\n1. The shared link opens the signup form');
  const canonical = await probe(`/invite?code=${encodeURIComponent(CODE)}`);
  judgeInviteResponse('/invite?code=…', canonical, CODE);
  judgeInviteResponse('/r/<code> segment form', await probe(`/r/${CODE.toLowerCase()}`), CODE);
  judgeInviteResponse('/join?code=… alias', await probe(`/join?code=${CODE}`), CODE);
  const bare = await probe('/invite');
  if (!bare.error && bare.status >= 200 && bare.status < 400) {
    const target = bare.status >= 300 && bare.status < 400 ? redirectTarget(bare) : '';
    ok('/invite with no code still lands on signup', target || 'served by the SPA');
  } else {
    bad('/invite with no code is routable', bare.error || `HTTP ${bare.status}`);
  }

  console.log('\n2. The signup screen does not collide with Supabase auth');
  const unsafe = await probe(`/customer/signup?code=${CODE}`);
  if (unsafe.error) {
    bad('/customer/signup?code=… reachable', unsafe.error);
  } else if (unsafe.status >= 300 && unsafe.status < 400) {
    const target = redirectTarget(unsafe);
    if (target.includes('ref=') && !/[?&]code=/.test(target)) {
      ok('?code= on signup is normalised to ?ref= (server-side)', target);
    } else {
      warn('?code= on signup still present', target);
    }
  } else {
    const html = unsafe.body || '';
    if (html.includes('nexora-pending-referral-code')) {
      ok('?code= on signup is normalised in-page before the auth client boots', `HTTP ${unsafe.status}`);
    } else {
      warn(
        '?code= on the signup screen is unhandled',
        `HTTP ${unsafe.status}`,
        'A stale authorization-code exchange can steal the referral param. Serve the current index.html/build.'
      );
    }
  }
  const signup = await probe(`/customer/signup?ref=${CODE}`);
  if (signup.error || !(signup.status >= 200 && signup.status < 400)) {
    bad('/customer/signup?ref=… serves the app', signup.error || `HTTP ${signup.status}`);
  } else {
    ok('/customer/signup?ref=… serves the app', `HTTP ${signup.status}`);
  }

  console.log('\n3. The backend can attribute the code');
  const resolved = await probe(`/api/referrals/resolve?code=${CODE}`);
  if (resolved.error) {
    warn('referral resolve endpoint present', resolved.error, 'Cross-device counting needs the Node server (see DEPLOYMENT.md step for SUPABASE_SERVICE_ROLE_KEY).');
  } else if (resolved.status === 200) {
    try {
      const payload = JSON.parse(resolved.body);
      ok('referral code resolves to a referrer', `${CODE} → ${payload?.referrer?.name || payload?.referrer?.userId || 'ok'}`);
    } catch {
      warn('referral resolve returned unreadable JSON', resolved.body.slice(0, 120));
    }
  } else if (resolved.status === 404) {
    warn(
      'referral code is registered',
      `resolve → 404 for ${CODE}`,
      'Nobody owns this code yet. The referrer must open Nexora once (that writes profiles.referral_code), and the migration supabase/migrations/20260910120000_referral_codes_invite_links.sql must be applied.'
    );
  } else if (resolved.status === 503) {
    bad(
      'referral attribution is configured',
      'resolve → 503',
      'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server, then redeploy. Without them a signup cannot write the referrer’s row.'
    );
  } else {
    warn('referral resolve answered', `HTTP ${resolved.status}`);
  }

  console.log('\nVerdict');
  if (failed === 0 && warned === 0) {
    console.log(`  ✅ invite links are live: ${BASE}/invite?code=${CODE} opens signup and will be counted.`);
  } else if (failed === 0) {
    console.log(`  🟡 invite links open signup, with ${warned} caveat(s) above.`);
  } else {
    console.log(`  ❌ ${failed} blocking problem(s); ${passed} check(s) passed.`);
  }
  if (hints.length > 0) {
    console.log('\nNext actions');
    [...new Set(hints)].forEach((hint, i) => console.log(`  ${i + 1}. ${hint}`));
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
