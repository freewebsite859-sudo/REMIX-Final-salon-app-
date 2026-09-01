/**
 * Nexora local demo auth client.
 *
 * When no real Supabase project is configured (no VITE_SUPABASE_ANON_KEY),
 * the app falls back to THIS instead of disabling auth. It implements exactly
 * the surface the codebase uses — `auth.*` and a small PostgREST-style query
 * builder — backed entirely by localStorage. Nothing leaves the browser.
 *
 * Semantics deliberately mirror supabase-js so no call-site needs to know
 * which client it got:
 *   - signUp returns a live session immediately (email confirmation is off)
 *   - wrong password  -> { error: { message: 'Invalid login credentials' } }
 *   - unknown table   -> { error: { code: '42P01' } } so services fall back
 *                        to their documented graceful paths (e.g. demo catalog)
 *   - onAuthStateChange fires INITIAL_SESSION on subscribe, then
 *     SIGNED_IN / SIGNED_OUT on real changes
 *
 * Passwords are stored as salted SHA-256 — this is a local demo store, not a
 * security boundary; do not reuse a real password you care about.
 */

type Row = Record<string, unknown>;

interface DemoUserRecord {
  id: string;
  email: string;
  salt: string;
  hash: string;
  full_name: string;
  mobile: string;
  role: string;
  created_at: string;
}

const K_USERS = 'nexora.demo.users';
const K_TABLE = (name: string) => `nexora.demo.table.${name}`;

/** Tables the demo store actually backs. Everything else reports "missing". */
const DEMO_TABLES = new Set([
  'profiles',
  'user_locations',
  'notifications',
  'notification_preferences',
  'notification_deliveries',
]);

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const store = ls();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — demo store degrades silently */
  }
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${salt}:${password}`)
      );
      return Array.from(new Uint8Array(bytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* non-secure context — fall through to the weak hash */
  }
  // FNV-1a fallback for environments without Web Crypto (tests, http).
  let h = 0x811c9dc5;
  const s = `${salt}:${password}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv${h.toString(16)}`;
}

// ---------------------------------------------------------------------------
// user + session records (supabase-shaped)
// ---------------------------------------------------------------------------

function toAuthUser(rec: DemoUserRecord) {
  return {
    id: rec.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: rec.email,
    phone: '',
    confirmed_at: rec.created_at,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: rec.full_name, mobile: rec.mobile, role: rec.role },
    identities: [{ id: rec.id, user_id: rec.id, provider: 'email' }],
    created_at: rec.created_at,
    updated_at: new Date().toISOString(),
  };
}

function toSession(rec: DemoUserRecord) {
  return {
    access_token: `demo-${rec.id}`,
    token_type: 'bearer',
    expires_in: 10 * 365 * 24 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600,
    refresh_token: `demo-refresh-${rec.id}`,
    user: toAuthUser(rec),
  };
}

// ---------------------------------------------------------------------------
// tiny PostgREST-shaped builder over a localStorage table
// ---------------------------------------------------------------------------

interface Ops {
  mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  filters: Array<[string, unknown]>;
  payload?: unknown;
  onConflict?: string;
  returning?: boolean;
  columns?: string | null;
  count?: 'exact' | null;
  head?: boolean;
  orderBy?: { column: string; ascending: boolean } | null;
  limitN?: number | null;
  single?: boolean;
  strictSingle?: boolean;
}

function project(row: Row, columns: string | null): Row {
  if (!columns || columns.trim() === '*') return { ...row };
  const out: Row = {};
  for (const col of columns.split(',').map((c) => c.trim()).filter(Boolean)) {
    if (col in row) out[col] = row[col];
  }
  return out;
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([k, v]) => row[k] === v);
}

class DemoQueryBuilder implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count: number | null }> {
  constructor(private table: string, private ops: Ops) {}

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.ops.columns = columns;
    if (options?.count) this.ops.count = options.count;
    if (options?.head) this.ops.head = true;
    // `.update(...).select(...)` / `.insert(...).select(...)` return rows.
    if (this.ops.mode === 'update' || this.ops.mode === 'insert') this.ops.returning = true;
    return this;
  }
  eq(column: string, value: unknown) {
    this.ops.filters.push([column, value]);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.ops.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.ops.limitN = n;
    return this;
  }
  insert(payload: unknown) {
    this.ops.mode = 'insert';
    this.ops.payload = payload;
    this.ops.returning = false;
    return this;
  }
  update(patch: Row) {
    this.ops.mode = 'update';
    this.ops.payload = patch;
    this.ops.returning = false;
    return this;
  }
  upsert(payload: unknown, opts?: { onConflict?: string }) {
    this.ops.mode = 'upsert';
    this.ops.payload = payload;
    this.ops.onConflict = opts?.onConflict;
    this.ops.returning = false;
    return this;
  }
  delete() {
    this.ops.mode = 'delete';
    return this;
  }
  single() {
    this.ops.single = true;
    this.ops.strictSingle = true;
    return this;
  }
  maybeSingle() {
    this.ops.single = true;
    this.ops.strictSingle = false;
    return this;
  }

  then<TResult1 = { data: unknown; error: { message: string; code?: string } | null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run() {
    const { table, ops } = this;
    if (!DEMO_TABLES.has(table)) {
      return {
        data: null,
        error: {
          message: `relation "public.${table}" does not exist`,
          code: '42P01',
        },
        count: null,
      };
    }

    const rows: Row[] = readJson<Row[]>(K_TABLE(table), []);
    const write = (next: Row[]) => writeJson(K_TABLE(table), next);

    if (ops.mode === 'select') {
      let result = rows.filter((r) => matches(r, ops.filters));
      if (ops.orderBy) {
        const { column, ascending } = ops.orderBy;
        result = [...result].sort((a, b) => {
          const av = String(a[column] ?? '');
          const bv = String(b[column] ?? '');
          return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      const total = result.length;
      if (ops.limitN != null) result = result.slice(0, ops.limitN);
      const projected = result.map((r) => project(r, ops.columns ?? '*'));
      if (ops.single) {
        if (projected.length === 0) {
          return ops.strictSingle
            ? { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count: total }
            : { data: null, error: null, count: total };
        }
        return { data: projected[0], error: null, count: total };
      }
      if (ops.head && ops.count) {
        return { data: null, error: null, count: total };
      }
      return { data: projected, error: null, count: ops.count ? total : null };
    }

    if (ops.mode === 'insert') {
      const incoming = (Array.isArray(ops.payload) ? ops.payload : [ops.payload]) as Row[];
      const stamped = incoming.map((row) => ({
        id: uuid(),
        created_at: new Date().toISOString(),
        // Column defaults the real schema provides (never overwrite explicit values).
        ...(table === 'notifications' ? { is_read: false, read_at: null } : {}),
        ...row,
      }));
      write([...rows, ...stamped]);
      if (ops.returning || ops.columns) {
        const out = stamped.map((r) => project(r, ops.columns ?? '*'));
        return { data: ops.single ? (out[0] ?? null) : out, error: null, count: out.length };
      }
      return { data: null, error: null, count: stamped.length };
    }

    if (ops.mode === 'update') {
      const patch = ops.payload as Row;
      let touched = 0;
      const next = rows.map((r) => {
        if (!matches(r, ops.filters)) return r;
        touched += 1;
        return { ...r, ...patch };
      });
      write(next);
      if (ops.returning) {
        const out = next
          .filter((r) => matches(r, ops.filters))
          .map((r) => project(r, ops.columns ?? '*'));
        if (ops.single) return { data: out[0] ?? null, error: null, count: touched };
        return { data: out, error: null, count: touched };
      }
      return { data: null, error: null, count: touched };
    }

    if (ops.mode === 'upsert') {
      const incoming = (Array.isArray(ops.payload) ? ops.payload : [ops.payload]) as Row[];
      const keys = (ops.onConflict ?? 'id').split(',').map((k) => k.trim()).filter(Boolean);
      const next = [...rows];
      for (const row of incoming) {
        const idx = next.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (idx >= 0) next[idx] = { ...next[idx], ...row };
        else next.push({ id: uuid(), created_at: new Date().toISOString(), ...row });
      }
      write(next);
      return { data: null, error: null, count: incoming.length };
    }

    // delete
    const kept = rows.filter((r) => !matches(r, ops.filters));
    const removed = rows.length - kept.length;
    write(kept);
    return { data: null, error: null, count: removed };
  }
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

export interface LocalDemoClient {
  __isNexoraDemo: true;
  auth: {
    getSession: () => Promise<{ data: { session: unknown }; error: null }>;
    signInWithPassword: (c: { email: string; password: string }) => Promise<{ data: { user: unknown; session: unknown }; error: { message: string; status?: number } | null }>;
    signUp: (c: { email: string; password: string; options?: { data?: Record<string, string> } }) => Promise<{ data: { user: unknown; session: unknown }; error: { message: string } | null }>;
    signOut: () => Promise<{ error: null }>;
    updateUser: (attrs: Record<string, unknown>) => Promise<{ data: { user: unknown }; error: { message: string } | null }>;
    resetPasswordForEmail: (email: string) => Promise<{ data: null; error: { message: string } }>;
    refreshSession: () => Promise<{ data: { session: unknown }; error: null }>;
    onAuthStateChange: (
      cb: (event: string, session: unknown) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  from: (table: string) => DemoQueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export function createLocalDemoClient(storageKey: string): LocalDemoClient {
  const listeners = new Set<(event: string, session: unknown) => void>();

  const users = () => readJson<Record<string, DemoUserRecord>>(K_USERS, {});
  const saveUsers = (u: Record<string, DemoUserRecord>) => writeJson(K_USERS, u);

  function currentRec(): DemoUserRecord | null {
    const sess = readJson<{ currentSession?: { access_token?: string } } | null>(storageKey, null);
    const token = sess?.currentSession?.access_token;
    if (!token || !token.startsWith('demo-')) return null;
    const id = token.slice('demo-'.length);
    const all = users();
    return Object.values(all).find((r) => r.id === id) ?? null;
  }

  function persist(rec: DemoUserRecord | null) {
    if (rec) {
      writeJson(storageKey, { currentSession: toSession(rec), provider: 'demo' });
    } else {
      ls()?.removeItem(storageKey);
    }
  }

  function emit(event: string) {
    const session = (() => {
      const rec = currentRec();
      return rec ? toSession(rec) : null;
    })();
    queueMicrotask(() => {
      for (const cb of Array.from(listeners)) {
        try {
          cb(event, session);
        } catch {
          /* a handler throwing must not break the others */
        }
      }
    });
  }

  function sessionOrNull() {
    const rec = currentRec();
    return rec ? toSession(rec) : null;
  }

  const client: LocalDemoClient = {
    __isNexoraDemo: true,

    auth: {
      getSession: async () => ({ data: { session: sessionOrNull() }, error: null }),

      refreshSession: async () => ({ data: { session: sessionOrNull() }, error: null }),

      signInWithPassword: async ({ email, password }) => {
        const key = email.trim().toLowerCase();
        const rec = users()[key];
        if (!rec) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
        }
        const hash = await hashPassword(password, rec.salt);
        if (hash !== rec.hash) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
        }
        persist(rec);
        emit('SIGNED_IN');
        return { data: { user: toAuthUser(rec), session: toSession(rec) }, error: null };
      },

      signUp: async ({ email, password, options }) => {
        const key = email.trim().toLowerCase();
        const all = users();
        if (all[key]) {
          return { data: { user: null, session: null }, error: { message: 'User already registered' } };
        }
        if (typeof password !== 'string' || password.length < 6) {
          return { data: { user: null, session: null }, error: { message: 'Password should be at least 6 characters.' } };
        }
        const salt = uuid();
        const rec: DemoUserRecord = {
          id: uuid(),
          email: key,
          salt,
          hash: await hashPassword(password, salt),
          full_name: options?.data?.full_name || key.split('@')[0],
          mobile: options?.data?.mobile || '',
          role: options?.data?.role === 'salon_owner' ? 'salon_owner' : 'customer',
          created_at: new Date().toISOString(),
        };
        all[key] = rec;
        saveUsers(all);

        // Mirror what the real project's handle_new_user trigger would insert,
        // so profileService finds the row immediately after signup.
        const profiles = readJson<Row[]>(K_TABLE('profiles'), []);
        if (!profiles.some((p) => p.id === rec.id)) {
          profiles.push({
            id: rec.id,
            user_id: rec.id,
            email: rec.email,
            role: rec.role,
            full_name: rec.full_name,
            created_at: rec.created_at,
            updated_at: rec.created_at,
          });
          writeJson(K_TABLE('profiles'), profiles);
        }

        persist(rec);
        emit('SIGNED_IN');
        return { data: { user: toAuthUser(rec), session: toSession(rec) }, error: null };
      },

      signOut: async () => {
        persist(null);
        emit('SIGNED_OUT');
        return { error: null };
      },

      updateUser: async (attrs) => {
        const rec = currentRec();
        if (!rec) return { data: { user: null }, error: { message: 'Not authenticated' } };
        const all = users();
        const key = rec.email;
        if (typeof attrs.password === 'string') {
          const salt = uuid();
          rec.salt = salt;
          rec.hash = await hashPassword(attrs.password, salt);
        }
        const meta = (attrs.data ?? {}) as Record<string, string>;
        if (meta.full_name) rec.full_name = meta.full_name;
        if (meta.mobile !== undefined) rec.mobile = meta.mobile;
        all[key] = rec;
        saveUsers(all);
        persist(rec);
        emit('USER_UPDATED');
        return { data: { user: toAuthUser(rec) }, error: null };
      },

      resetPasswordForEmail: async () => ({
        data: null,
        error: {
          message:
            'Demo mode does not send emails. Sign in with your current password and change it from Profile, or create a new account.',
        },
      }),

      onAuthStateChange: (cb) => {
        listeners.add(cb);
        const session = sessionOrNull();
        queueMicrotask(() => {
          try {
            cb('INITIAL_SESSION', session);
          } catch {
            /* ignore */
          }
        });
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
    },

    from: (table: string) =>
      new DemoQueryBuilder(table, {
        mode: 'select',
        filters: [],
        columns: null,
        count: null,
        head: false,
        orderBy: null,
        limitN: null,
        single: false,
      }),

    rpc: async (fn: string) => {
      if (fn === 'mark_all_notifications_read') {
        const rec = currentRec();
        const rows = readJson<Row[]>(K_TABLE('notifications'), []);
        let n = 0;
        const next = rows.map((r) => {
          if (r.is_read === false && (!rec || r.user_id === rec.id)) {
            n += 1;
            return { ...r, is_read: true, read_at: new Date().toISOString() };
          }
          return r;
        });
        writeJson(K_TABLE('notifications'), next);
        return { data: n, error: null };
      }
      if (fn === 'unread_notification_count') {
        const rec = currentRec();
        const rows = readJson<Row[]>(K_TABLE('notifications'), []);
        const n = rows.filter((r) => r.is_read === false && (!rec || r.user_id === rec.id)).length;
        return { data: n, error: null };
      }
      return {
        data: null,
        error: { message: `Could not find the function public.${fn}`, code: 'PGRST202' },
      };
    },
  };

  return client;
}
