#!/usr/bin/env node
/**
 * Fire the smart-reminder dispatcher once. Schedule daily, e.g.
 *   0 4 * * *  cd /srv/nexora && NEXORA_API_URL=https://app.example.com CRON_SECRET=… npm run reminders:run
 * Exit code is non-zero if the endpoint rejects or is unreachable, so cron alerts.
 */
const base = (process.env.NEXORA_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET;
if (!secret) { console.error('CRON_SECRET is required'); process.exit(2); }

const res = await fetch(`${base}/api/smart/reminders/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
  body: JSON.stringify({ limit: Number(process.env.REMINDER_BATCH || 200) }),
}).catch((err) => { console.error('dispatcher unreachable:', err.message); process.exit(1); });

const body = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`dispatcher HTTP ${res.status}:`, body); process.exit(1); }
console.log(`[reminders] due=${body.due} sent=${body.sent} inAppOnly=${body.inAppOnly}`);
for (const r of body.results ?? []) console.log(`  ${r.id} → ${r.channel}${r.error ? ` (${r.error})` : ''}`);
