/**
 * Account deletion: server router (POST /api/user/delete) + browser client.
 *
 * Deletion is destructive and irreversible, so the contract that matters is
 * honesty: the endpoint must delete exactly the token's own account, and every
 * failure mode must report failure rather than implying success.
 */
import assert from 'node:assert/strict';
import express from 'express';
import { createUserAccountRouter, extractBearerToken, type AccountStore } from '../server/userAccount.ts';
import { requestAccountDeletion } from '../src/lib/accountDeletion.ts';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------
{
  const req = (h: Record<string, string>) => ({ headers: h }) as any;
  check('bearer token is extracted', extractBearerToken(req({ authorization: 'Bearer abc.def.ghi' })) === 'abc.def.ghi');
  check('bearer scheme is case-insensitive', extractBearerToken(req({ authorization: 'bearer abc' })) === 'abc');
  check('surrounding whitespace is trimmed', extractBearerToken(req({ authorization: 'Bearer   abc  ' })) === 'abc');
  check('a missing header yields null', extractBearerToken(req({})) === null);
  check('a non-bearer scheme yields null', extractBearerToken(req({ authorization: 'Basic xyz' })) === null);
  check('an empty bearer yields null', extractBearerToken(req({ authorization: 'Bearer ' })) === null);
}

// ---------------------------------------------------------------------------
// Router behaviour against an in-memory store
// ---------------------------------------------------------------------------
type Call = { verify?: string; delete?: string };

function harness(options: {
  configured?: boolean;
  verifyOk?: boolean;
  deleteOk?: boolean;
  userId?: string;
}) {
  const calls: Call[] = [];
  const store: AccountStore = {
    async verifyAccessToken(token: string) {
      calls.push({ verify: token });
      return options.verifyOk === false
        ? { ok: false, error: 'Token expired' }
        : { ok: true, userId: options.userId ?? 'user-123' };
    },
    async deleteUser(userId: string) {
      calls.push({ delete: userId });
      return options.deleteOk === false ? { ok: false, error: 'upstream failure' } : { ok: true };
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/user', createUserAccountRouter({ NODE_ENV: 'test' }, store));
  return { app, calls };
}

/** Minimal in-process request — no socket, no port. */
async function call(
  app: express.Express,
  options: { token?: string | null; body?: unknown } = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const req: any = {
      method: 'POST',
      url: '/api/user/delete',
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      end(payload?: string) {
        let parsed: any = null;
        try {
          parsed = payload ? JSON.parse(payload) : null;
        } catch {
          parsed = payload;
        }
        resolve({ status: this.statusCode, body: parsed });
      },
      json(payload: unknown) {
        return this.end(JSON.stringify(payload));
      },
      write(c: string) {
        chunks.push(Buffer.from(c));
        return true;
      },
    };
    // Simulate the body arriving.
    app(req, res, () => res.end());
    if (options.body !== undefined) {
      req.emit?.('data', JSON.stringify(options.body));
      req.emit?.('end');
    }
  });
}

// 1. Happy path
{
  const { app, calls } = harness({});
  const res = await call(app, { token: 'valid.token.here', body: {} });
  check(
    'a valid token deletes the account and reports success',
    res.status === 200 && res.body?.success === true,
    `status=${res.status} body=${JSON.stringify(res.body)}`
  );
  check(
    'the deleted id comes from the verified token, not the request body',
    calls.some((c) => c.delete === 'user-123')
  );
}

// 2. Identity cannot be spoofed via the body
{
  const { app, calls } = harness({ userId: 'real-owner' });
  const res = await call(app, { token: 'valid.token', body: { userId: 'someone-else' } });
  check(
    'a body-supplied userId is ignored — only the token owner is deleted',
    res.body?.deletedUserId === 'real-owner' &&
      calls.some((c) => c.delete === 'real-owner') &&
      !calls.some((c) => c.delete === 'someone-else'),
    `deleted=${res.body?.deletedUserId}`
  );
}

// 3. Missing token
{
  const { app, calls } = harness({});
  const res = await call(app, { token: null, body: {} });
  check(
    'a request without a token is rejected 401 and deletes nothing',
    res.status === 401 && !calls.some((c) => c.delete),
    `status=${res.status}`
  );
}

// 4. Invalid / expired token
{
  const { app, calls } = harness({ verifyOk: false });
  const res = await call(app, { token: 'expired.token', body: {} });
  check(
    'an unverifiable token is rejected 401 and deletes nothing',
    res.status === 401 && !calls.some((c) => c.delete),
    `status=${res.status}`
  );
}

// 5. Upstream deletion failure must not report success
{
  const { app } = harness({ deleteOk: false });
  const res = await call(app, { token: 'valid.token', body: {} });
  check(
    'an upstream failure answers 500 and never claims success',
    res.status === 500 && res.body?.success !== true && /No data was deleted/.test(res.body?.error || ''),
    `status=${res.status} error="${res.body?.error}"`
  );
}

// 6. Unconfigured deployment answers an honest 503
{
  const app = express();
  app.use(express.json());
  // No injected store and no SUPABASE_* env → the real createServiceClient path.
  app.use('/api/user', createUserAccountRouter({}));
  const res = await call(app, { token: 'valid.token', body: {} });
  check(
    'an unconfigured deployment answers 503 with configured:false',
    res.status === 503 && res.body?.configured === false,
    `status=${res.status} body=${JSON.stringify(res.body)}`
  );
}

// ---------------------------------------------------------------------------
// Browser client
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: any) => Promise<Response>) {
  (globalThis as any).fetch = handler;
}

// Client: no token → never calls the network
{
  let called = false;
  stubFetch(async () => {
    called = true;
    return new Response('{}', { status: 200 });
  });
  const out = await requestAccountDeletion(null);
  check(
    'the client refuses to call the API without a token',
    out.success === false && out.reason === 'unauthenticated' && called === false
  );
}

// Client: success
{
  stubFetch(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  const out = await requestAccountDeletion('tok');
  check('the client reports success on a 200', out.success === true && out.reason === 'deleted');
}

// Client: 200 without success:true is NOT success
{
  stubFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const out = await requestAccountDeletion('tok');
  check(
    'a 200 that does not carry success:true is treated as a failure',
    out.success === false && out.reason === 'server_error',
    out.reason
  );
}

// Client: 401
{
  stubFetch(async () => new Response(JSON.stringify({ error: 'Session expired.' }), { status: 401 }));
  const out = await requestAccountDeletion('tok');
  check('a 401 maps to unauthenticated', out.success === false && out.reason === 'unauthenticated');
}

// Client: 503
{
  stubFetch(
    async () => new Response(JSON.stringify({ configured: false }), { status: 503 })
  );
  const out = await requestAccountDeletion('tok');
  check(
    'a 503 is explained as "not configured", and states nothing was deleted',
    out.success === false && out.reason === 'not_configured' && /No data was deleted/.test(out.message),
    out.message
  );
}

// Client: non-JSON error body (proxy HTML) must not be mistaken for success
{
  stubFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  const out = await requestAccountDeletion('tok');
  check(
    'a non-JSON error body is handled without throwing',
    out.success === false && out.reason === 'server_error' && /502/.test(out.message),
    out.message
  );
}

// Client: network failure
{
  stubFetch(async () => {
    throw new Error('ECONNREFUSED');
  });
  const out = await requestAccountDeletion('tok');
  check(
    'a network failure resolves to a failure outcome instead of throwing',
    out.success === false && out.reason === 'network_error' && /No data was deleted/.test(out.message),
    out.message
  );
}

// Client: sends the token as a bearer header and POSTs
{
  let seen: { url?: string; method?: string; auth?: string } = {};
  stubFetch(async (url: string, init: any) => {
    seen = { url, method: init.method, auth: init.headers?.Authorization };
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  await requestAccountDeletion('secret.jwt.value');
  check(
    'the client POSTs to /api/user/delete with a bearer token',
    seen.url === '/api/user/delete' && seen.method === 'POST' && seen.auth === 'Bearer secret.jwt.value',
    JSON.stringify(seen)
  );
}

(globalThis as any).fetch = realFetch;

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length === 0 ? 'PASS  account deletion' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
