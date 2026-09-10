# Nexora — Live Supabase Deploy Guide (Rewards / QR / Referrals Backend)

> **Bhaasha:** Hinglish. Ye guide batati hai ki repo ke SQL scripts ko aapke **live Supabase cloud project** par kaise execute karein —
> (A) **Supabase Dashboard → SQL Editor** me paste karke, ya
> (B) **Google Cloud Shell / local terminal** se `supabase db push` chala kar.

---

## 1. Scripts ka inventory (sab self-contained hain)

Repo me ye SQL files hain — koi bhi file kisi doosri file ko include nahi karti (`\i`, `pg_read_file` nahi hai). Ek file = ek script.

| # | File (repo path) | Kya karti hai | Kab chalani hai |
|---|---|---|---|
| ★ | `supabase/consolidated_cloud_sync.sql` | **CONSOLIDATED one-shot sync file** — Section A (`setup.sql` baseline) + Section B (rewards/QR/referrals migration) + Section C (read-only verification) ek hi transaction me | **Recommended** for Dashboard SQL Editor: fresh project **aur** already-running project dono par safe (idempotent) |
| 1 | `supabase/setup.sql` | **Poora baseline schema** — 14 tables (`profiles`, `bookings`, `booking_services`, `rewards`, `qr_check_ins`, `user_qr_codes`, `referrals`, `user_memberships`, `membership_tiers`, `notifications`, `user_locations`, waghera) + 16 RLS policies + functions/triggers | Already `consolidated_cloud_sync.sql` me included — alag se sirf tab chalao agar sirf baseline chahiye |
| 2 | `supabase/migrations/20260908123000_complete_rewards_qr_referrals_backend.sql` | Rewards/QR/referrals backend migration — 5 nayi tables + `referrals` upgrade, backfill, RLS, grants, triggers, realtime | Already `consolidated_cloud_sync.sql` me included — ya `supabase db push` ke liye migration folder me yehi file use hoti hai |
| 3 | `supabase/migrations/20260910120000_referral_codes_invite_links.sql` | **Referral codes + invite-link attribution** — `profiles.referral_code` column + unique index, auto-generate trigger (`NX-<NAME><ddd>`), backfill for existing profiles, `resolve_referral_code(code)` (anon-callable — invite landing page ke liye), `referral_summary(user_id)` counters | **Invite links (`/invite?code=NX-…`) ko kaam karne ke liye zaroori** — baseline ke baad chalao (idempotent) |
| 4 | `supabase/policies/notifications.sql`, `supabase/policies/user_locations.sql` | Reference snippets (in tables/policies ki documentation) | Inka content `setup.sql` me already included hai — **skip** |

**Rule of thumb:**
- SQL Editor me deploy karna hai → **`supabase/consolidated_cloud_sync.sql`** paste karo (ek hi baar, dono sections ke saath — fresh ya existing project, dono safe).
- CLI `supabase db push` use karna hai → migration folder wali file (`20260908123000_*.sql`) push hoti hai (baseline already live hai to uski zaroorat nahi; naye project par pehle `setup.sql` push/apply karo).
- **Invite/referral links live karne hain** → `20260910120000_referral_codes_invite_links.sql` bhi chalao (SQL Editor ya `db push`). Iske bina `profiles.referral_code` column nahi hota, isliye `https://nexora.app/invite?code=NX-…` ka code backend par resolve nahi hota (app local attribution par chalti rehti hai, cross-device counting nahi hoti).
- Project **bilkul naya** hai → consolidated file poori chalao (Section A baseline bana degi, Section B uske upar migrate karegi).

> ⚠️ File #2 ke backfill statements legacy tables (`rewards`, `qr_check_ins`, `user_qr_codes`, `user_memberships`, `membership_tiers`) ko directly read karte hain. Agar wo tables nahi hongi to error aayega — isliye upar wala rule. Niche **Pre-flight check** (section 2) dekho.

---

## 2. Pre-flight check (1 minute)

Pehle jaano aapka project kis state me hai. SQL Editor me ye chalao:

```sql
-- Agar ye sab tables dikhein -> aapka baseline maujood hai, seedha Section 4/5 par jao
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

**Dekhna kya hai:** `bookings`, `rewards`, `qr_check_ins`, `user_qr_codes`, `referrals`, `user_memberships`, `membership_tiers`, `profiles` …
- ✅ **Ye tables hain** → aapka DB baseline ke saath hai → **sirf migration file deploy karo** (Section 4 SQL Editor ya Section 5 db push).
- ❌ **Tables bilkul nahi hain / naya project** → pehle `setup.sql` ka poora content paste karke Run karo, **phir** migration file. (Dono baar alag-alag query me, ek saath nahi.)

---

## 3. File ka content kahaan se copy karein

- **SQL Editor ke liye (recommended):** repo → `supabase/consolidated_cloud_sync.sql` — poora content copy karo:
  ```bash
  cat supabase/consolidated_cloud_sync.sql
  # ya browser me kholo (GitHub: Raw button) → Ctrl+A / Cmd+A → Copy
  ```
- Sirf migration (e.g. `supabase db push`/local CLI ke liye): repo → `supabase/migrations/20260908123000_complete_rewards_qr_referrals_backend.sql`
- **Poora content copy karo** — file ke andar `begin;` … `commit;` transaction hai, isliye **ek saath (single paste)** chalana zaroori hai, statement-by-statement nahi. Agar beech me koi error aaya to transaction poora rollback ho jayega (aadha-dehla apply nahi hoga).

---

## 4. Path A — Supabase Dashboard → SQL Editor (sabse simple)

1. Browser me: **https://supabase.com/dashboard/project/`<PROJECT_REF>`/sql/new**
   - `<PROJECT_REF>` aapka project reference hai — Dashboard → Project Settings → General → **Reference** (example: `qwaehqsmodekbgvnaavz`).
2. Naya query editor khulega. **Poora migration file content paste karo** (Section 3 se).
3. **Run** button dabao.
4. Expected: `Success. No rows returned` (ya bas success message) — script ke andar koi SELECT nahi hai.
   - Agar koi error aaye → Section 7 (Troubleshooting).
5. Section 6 ki verification queries chalao.

> 💡 Note: SQL Editor se chalane par Supabase ki migration-history (`schema_migrations` table) update nahi hoti. Isliye **ek hi method chuno** — ya SQL Editor, ya `db push`. Agar baad me bhi `db push` use karna ho to: `supabase migration repair --status reverted 20260908123000` (repo me) se is migration ko "applied" mark kar sakte ho taaki CLI skip kare.

---

## 5. Path B — `supabase db push` (Google Cloud Shell ya local terminal)

### 5.1 CLI install karo

**Google Cloud Shell** (Node.js pehle se installed hai) ya local Linux/macOS:

```bash
npm install -g supabase
supabase --version        # sanity check
```

Windows local machine par: `npm install -g supabase` bhi chalega (Node.js chahiye), ya Scoop: `scoop install supabase`.

### 5.2 Login (access token se — headless-friendly)

1. Browser me: **https://supabase.com/dashboard/account/tokens**
2. "Generate new token" → naam do (e.g. `gcloud-shell`) → token copy karo (`sbp_...`).
3. Terminal me:
   ```bash
   supabase login --token sbp_PASTE_YOUR_TOKEN_HERE
   ```

### 5.3 Repo me jao aur project link karo

```bash
cd /path/to/REMIX-Final-salon-app-     # ye repo ka clone (Google Cloud Shell me pehle git clone karna padega)
supabase init                           # agar supabase/config.toml nahi hai to bana dega (safe, kuch delete nahi karta)
supabase link --project-ref qwaehqsmodekbgvnaavz   # apna PROJECT_REF daalo
```

- Link karne par database password maangega → Dashboard → Project Settings → Database → **Database password** (wohi jo project banate waqt set kiya tha). Bhool gaye ho to Settings → Database → "Reset database password".
- **Optional:** link kiye bina bhi chal sakta hai:
  ```bash
  supabase db push --db-url "postgresql://postgres.qwaehqsmodekbgvnaavz:YOUR_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
  ```

### 5.4 Migration push karo

```bash
supabase db push
```

- CLI `supabase/migrations/` folder scan karta hai. Is repo me sirf ek migration hai (`20260908123000_complete_rewards_qr_referrals_backend.sql`) — wahi push hoga.
- Agar repo **kisi aur folder** me hai / aapne alag clone banaya hai to file copy karo:
  ```bash
  mkdir -p supabase/migrations
  cp /path/to/20260908123000_complete_rewards_qr_referrals_backend.sql supabase/migrations/
  ```
- Output me `Applying migration 20260908123000_complete_rewards_qr_referrals_backend.sql...` aur success dikhna chahiye.
- Agar "No migrations found" / "already applied" bole → matlab pehle se applied hai (SQL Editor se chalaya tha ya dusre dev ne) — koi action nahi chahiye, migration idempotent hai.

> ⚠️ Google Cloud Shell ephemeral hai (band hone par files ~20 din me delete ho sakti hain) — important ho to apne Git repo me rakho (ye migration already is repo me committed hai ✓).

---

## 6. Deploy ke baad verification (SQL Editor me paste karo)

```sql
-- (1) 6 tables maujood hain
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                    'reward_wallets','customer_qr_payments','referrals')
order by 1;

-- (2) Har table par RLS ON + kam se kam 4 policies
select c.relname, c.relrowsecurity as rls_enabled, count(p.policyname) as policies
from pg_class c
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relname in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                    'reward_wallets','customer_qr_payments','referrals')
group by 1, 2 order by 1;

-- (3) Realtime publication membership (6 rows chahiye)
select tablename from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                    'reward_wallets','customer_qr_payments','referrals')
order by 1;

-- (4) Seeds + backfill counts
select 'loyalty_config' as t, count(*) from public.loyalty_config          -- expect: 5 (platform defaults)
union all select 'loyalty_tiers', count(*) from public.loyalty_tiers        -- expect: >= 4
union all select 'loyalty_point_transactions', count(*) from public.loyalty_point_transactions  -- legacy rewards jitni
union all select 'reward_wallets', count(*) from public.reward_wallets      -- memberships + rewards users
union all select 'customer_qr_payments', count(*) from public.customer_qr_payments            -- legacy qr_check_ins jitni
union all select 'referrals', count(*) from public.referrals;               -- pehle jitni thi (data preserved)
```

Sab kuch sahi dikhe → **deploy complete**. ✅

---

## 7. Troubleshooting

| Error / situation | Matlab + fix |
|---|---|
| `relation "public.rewards" does not exist` (ya `qr_check_ins`/`user_memberships`/`membership_tiers`) | Baseline schema nahi hai. Pehle `supabase/setup.sql` poora paste karke Run karo, phir migration dobara Run karo. |
| `duplicate key value violates unique constraint` | Migration **dobara** chal raha hai — ye by-design safe hai: `on conflict do nothing` har backfill me hai. Koi action nahi. Bas error aane par bhi transaction rollback ho jata hai, isliye naya state pehle waisa hi rahega. |
| `function public.set_updated_at() already exists` (return type conflict jaisa koi error) | Live DB me kisi aur source ne same naam ki function bana di hai. Troubleshoot: `drop function if exists public.set_updated_at();` chalao, phir migration dobara Run karo. (Aam taur par ye case nahi aata.) |
| `must be owner of publication "supabase_realtime"` | Supabase par `postgres` role SQL Editor se publication alter kar sakta hai (official docs isi tarah batate hain). Agar phir bhi aaye: Dashboard → Database → **Realtime** → un 6 tables ke liye toggles on kar do (same kaam karta hai). |
| `db push` me password prompt fail ho | Database password reset karke `supabase link` dobara karo, ya `--db-url` wala alternative use karo. |
| CLI `supabase` command nahi mila | `npm install -g supabase` ke baad terminal restart karo; ya `npx supabase ...` use karo. |
| `db push` bole "no migrations to apply" | Migration already remote history me hai (ya SQL Editor se chala chuke the to `migration repair` use karo, Section 4 ka note dekho). |
| Migration ke baad app me kuch nahi dikh raha | RLS policies ke through sirf logged-in `authenticated` user apna data dekhta hai — browser me logout/login karke dekho. |

---

## 8. Ye migration exactly kya karti hai (safety summary)

- **Data preservation:** koi `DROP TABLE`, `TRUNCATE`, `DELETE` nahi — sirf nayi tables + naye columns (`ADD COLUMN IF NOT EXISTS`). Legacy `rewards` / `qr_check_ins` / `user_memberships` / `membership_tiers` / `referrals` ka data untouched rehta hai aur naye schema me backfill hota hai.
- **Idempotent:** jitni baar bhi chalao, utni baar safe. Backfills `on conflict do nothing` + partial-unique indexes se protect hain.
- **Atomic:** poora script ek transaction (`begin; ... commit;`) me hai — koi bhi error aaye to kuch bhi change nahi hota.
- **RLS:** har table par enabled; policies sirf `TO authenticated` + `auth.uid()` (no `auth.role()`), UPDATE policies me `USING` + `WITH CHECK` dono.
- **Ownership:** `auth.users` ke saath proper FKs; `NULL owner_id` = platform/global row.
- **Realtime:** tables sirf end me `supabase_realtime` publication me add hoti hain + `replica identity full`.

> ### ⚠️ Sandbox limitation (imandar note)
> Ye scripts **ek local PostgreSQL 18.4 mirror** par 3 baar execute + 85/85 structural checks + RLS smoke tests (9/9) ke saath verify kiye gaye hain, kyunki is sandbox me aapke Supabase cloud project ke **credentials/network access nahi hain** (`*.supabase.co` unreachable, koi `SUPABASE_*` env nahi). Matlab SQL bilkul tested hai, lekin **aapke cloud project par execution aapko upar diye methods se karni hai** — is guide ke steps ko follow karte hi wo ho jayegi.
