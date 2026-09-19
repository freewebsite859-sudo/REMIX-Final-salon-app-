/**
 * Nexora AI endpoints (OpenAI GPT-4 class models, server-side only).
 *
 *   GET  /api/ai/config                 { configured, model }            — never the key
 *   POST /api/ai/recommendations        personalised salon picks with reasons
 *   POST /api/ai/reminder-message       smart reminder copy for one reminder
 *   POST /api/ai/preferences/analyze    natural-language preference analysis
 *   POST /api/ai/match                  intelligent salon matching for a free-text brief
 *
 * Design rules
 * ------------
 * • The deterministic engine in src/lib/smartMemory.ts always runs first. The
 *   model only re-ranks and explains; it can never invent a salon that is not
 *   in the candidate list the server hands it.
 * • Every endpoint has a template fallback and reports `source: 'template'`
 *   when OpenAI is unconfigured / errors, so the UI never shows a fake "AI".
 * • Prompts carry no PII: the profile summary is behavioural only
 *   (see summariseForAi) and the customer's first name is optional.
 */
import { Router, Request, Response } from 'express';
import type { Salon } from '../src/types';
import {
  recommendSalons,
  summariseForAi,
  templateReminderMessage,
  type Recommendation,
  type SmartReminder,
  type UserPreferences,
} from '../src/lib/smartMemory';

export interface OpenAiConfig {
  configured: boolean;
  apiKey: string | null;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

export function readOpenAiConfig(env: NodeJS.ProcessEnv = process.env): OpenAiConfig {
  const apiKey = (env.OPENAI_API_KEY || '').trim() || null;
  return {
    configured: Boolean(apiKey),
    apiKey,
    model: (env.OPENAI_MODEL || 'gpt-4o').trim(),
    baseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    timeoutMs: Number(env.OPENAI_TIMEOUT_MS || 12_000),
  };
}

/** Minimal chat-completions client. `fetchImpl` is injectable for tests. */
export type ChatFn = (input: {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}) => Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }>;

export function createOpenAiChat(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): ChatFn {
  return async ({ system, user, json = false, maxTokens = 600, temperature = 0.6 }) => {
    const cfg = readOpenAiConfig(env);
    if (!cfg.configured) return { ok: false, error: 'OPENAI_API_KEY not configured' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          temperature,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string }; model?: string };
      if (!res.ok) return { ok: false, error: body?.error?.message || `OpenAI HTTP ${res.status}` };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: false, error: 'Empty completion' };
      return { ok: true, text, model: body.model || cfg.model };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'OpenAI request failed' };
    } finally {
      clearTimeout(timer);
    }
  };
}

const SYSTEM_BASE =
  'You are Nexora, the concierge for an Indian salon & wellness booking app. ' +
  'Be warm, concise and specific. Always use INR with the ₹ symbol. Never invent salons, prices or staff — only use the data provided. ' +
  'Never include phone numbers, emails or addresses. Avoid emojis except at most one.';

const compactSalon = (s: Salon) => ({
  id: s.id,
  name: s.name,
  area: s.location.area,
  rating: s.rating,
  reviews: s.reviewCount,
  from_price: Math.min(...s.services.map((x) => x.price)),
  gender: s.gender,
  categories: s.categories.slice(0, 5),
  top_services: s.services.slice(0, 4).map((x) => ({ name: x.name, price: x.price })),
  offer: s.discountOffer ?? null,
  open: s.isOpen,
  distance: s.distance,
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function parsePrefs(v: unknown): UserPreferences | null {
  if (!isObj(v) || typeof v.user_id !== 'string') return null;
  return {
    user_id: v.user_id,
    favorite_salon_ids: Array.isArray(v.favorite_salon_ids) ? (v.favorite_salon_ids as string[]) : [],
    favorite_staff_ids: Array.isArray(v.favorite_staff_ids) ? (v.favorite_staff_ids as string[]) : [],
    preferred_services: Array.isArray(v.preferred_services) ? (v.preferred_services as string[]) : [],
    service_frequency: isObj(v.service_frequency) ? (v.service_frequency as UserPreferences['service_frequency']) : {},
    insights: isObj(v.insights) ? (v.insights as UserPreferences['insights']) : {},
    updated_at: typeof v.updated_at === 'string' ? v.updated_at : new Date().toISOString(),
  };
}

function parseSalons(v: unknown): Salon[] {
  return Array.isArray(v) ? (v.filter((s) => isObj(s) && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.services)) as unknown as Salon[]) : [];
}

function parseReminders(v: unknown): SmartReminder[] {
  return Array.isArray(v) ? (v.filter((r) => isObj(r) && typeof r.service_type === 'string') as unknown as SmartReminder[]) : [];
}

const safeName = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().split(/\s+/)[0].slice(0, 30) : undefined);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/** Reusable AI reminder composer for the cron dispatcher (falls back to the template). */
export function createReminderComposer(env: NodeJS.ProcessEnv, chat: ChatFn = createOpenAiChat(env)) {
  const cfg = readOpenAiConfig(env);
  return async (reminder: SmartReminder & { full_name?: string | null }, channel: 'whatsapp' | 'sms' | 'push' | 'in_app' = 'whatsapp'): Promise<string> => {
    const template = templateReminderMessage(reminder, { customerName: reminder.full_name ?? undefined });
    if (!cfg.configured) return template;
    const maxChars = channel === 'push' ? 120 : channel === 'sms' ? 160 : 320;
    const ai = await chat({
      system: SYSTEM_BASE + ` Write ONE ${channel} reminder message, max ${maxChars} characters, plain text, no links, no placeholders. It must mention the service, how long it has been, and invite them to book. End with a clear call to action.`,
      user: JSON.stringify({ customerName: reminder.full_name ?? undefined, service_type: reminder.service_type, last_service_date: reminder.last_service_date, cycle_days: reminder.cycle_days }),
      maxTokens: 160,
      temperature: 0.8,
    });
    if (ai.ok === false) return template;
    return ai.text.replace(/^["“]|["”]$/g, '').slice(0, maxChars) || template;
  };
}

export function createAiRouter(env: NodeJS.ProcessEnv = process.env, deps: { chat?: ChatFn } = {}): Router {
  const router = Router();
  const chat = deps.chat ?? createOpenAiChat(env);
  const cfg = readOpenAiConfig(env);

  router.get('/config', (_req: Request, res: Response) => {
    res.json({ configured: cfg.configured, model: cfg.configured ? cfg.model : null, provider: 'openai' });
  });

  /** Personalised recommendations: deterministic engine → optional AI re-rank + explanations. */
  router.post('/recommendations', async (req: Request, res: Response) => {
    const prefs = parsePrefs(req.body?.preferences);
    const salons = parseSalons(req.body?.salons);
    const reminders = parseReminders(req.body?.reminders);
    if (!prefs || salons.length === 0) return res.status(400).json({ error: 'preferences (with user_id) and salons[] are required' });
    const limit = Math.max(1, Math.min(10, Number(req.body?.limit) || 6));
    const customerName = safeName(req.body?.customerName);

    const base = recommendSalons(prefs, salons, reminders, { limit: Math.min(salons.length, limit + 4), excludeSalonIds: req.body?.excludeSalonIds });
    const fallback = { source: 'template' as const, recommendations: base.slice(0, limit).map(stripRec), headline: defaultHeadline(prefs, reminders) };
    if (!cfg.configured) return res.json({ ...fallback, aiError: 'not_configured' });

    const ai = await chat({
      system: SYSTEM_BASE + ' Return strict JSON: {"headline": string, "picks": [{"id": string, "reason": string}]} with at most ' + limit + ' picks, ordered best-first. Every id MUST come from the candidates. Reasons ≤ 18 words, second person, referencing the customer profile when relevant.',
      user: JSON.stringify({
        customer_first_name: customerName ?? null,
        profile: summariseForAi(prefs, reminders),
        candidates: base.map((r) => ({ ...compactSalon(r.salon), engine_score: r.score, engine_reasons: r.reasons })),
      }),
      json: true,
      maxTokens: 700,
    });
    if (ai.ok === false) return res.json({ ...fallback, aiError: ai.error });

    try {
      const parsed = JSON.parse(ai.text) as { headline?: string; picks?: { id?: string; reason?: string }[] };
      const byId = new Map(base.map((r) => [r.salon.id, r]));
      const picks: Recommendation[] = [];
      for (const p of parsed.picks ?? []) {
        const r = p.id ? byId.get(p.id) : undefined;
        if (!r || picks.some((x) => x.salon.id === r.salon.id)) continue;
        picks.push({ ...r, reasons: [typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim() : r.reasons[0], ...r.reasons.slice(0, 2)].slice(0, 3) });
        if (picks.length >= limit) break;
      }
      // Backfill anything the model dropped so the list is never shorter than the engine's.
      for (const r of base) { if (picks.length >= limit) break; if (!picks.some((x) => x.salon.id === r.salon.id)) picks.push(r); }
      return res.json({ source: 'openai', model: ai.model, headline: typeof parsed.headline === 'string' ? parsed.headline.slice(0, 120) : fallback.headline, recommendations: picks.map(stripRec) });
    } catch {
      return res.json({ ...fallback, aiError: 'unparseable_completion' });
    }
  });

  /** Smart reminder copy for one reminder (WhatsApp/SMS/push friendly). */
  router.post('/reminder-message', async (req: Request, res: Response) => {
    const reminder = parseReminders([req.body?.reminder])[0];
    if (!reminder || !reminder.last_service_date) return res.status(400).json({ error: 'reminder with service_type and last_service_date is required' });
    const ctx = {
      customerName: safeName(req.body?.customerName),
      salonName: typeof req.body?.salonName === 'string' ? req.body.salonName.slice(0, 80) : undefined,
      stylistName: typeof req.body?.stylistName === 'string' ? req.body.stylistName.slice(0, 60) : undefined,
    };
    const channel = ['whatsapp', 'sms', 'push', 'in_app'].includes(req.body?.channel) ? (req.body.channel as string) : 'whatsapp';
    const template = templateReminderMessage(reminder, ctx);
    if (!cfg.configured) return res.json({ source: 'template', message: template, channel });

    const maxChars = channel === 'push' ? 120 : channel === 'sms' ? 160 : 320;
    const ai = await chat({
      system: SYSTEM_BASE + ` Write ONE ${channel} reminder message, max ${maxChars} characters, plain text, no links, no placeholders. It must mention the service, how long it has been, and invite them to book. End with a clear call to action.`,
      user: JSON.stringify({ ...ctx, service_type: reminder.service_type, last_service_date: reminder.last_service_date, cycle_days: reminder.cycle_days, salon_known: Boolean(ctx.salonName) }),
      maxTokens: 160,
      temperature: 0.8,
    });
    if (ai.ok === false) return res.json({ source: "template", message: template, channel, aiError: ai.error });
    const message = ai.text.replace(/^["“]|["”]$/g, '').slice(0, maxChars);
    return res.json({ source: 'openai', model: ai.model, message: message || template, channel });
  });

  /** Natural-language analysis of a customer's preferences. */
  router.post('/preferences/analyze', async (req: Request, res: Response) => {
    const prefs = parsePrefs(req.body?.preferences);
    if (!prefs) return res.status(400).json({ error: 'preferences (with user_id) are required' });
    const reminders = parseReminders(req.body?.reminders);
    const summary = summariseForAi(prefs, reminders);
    const fallback = { source: 'template' as const, summary, insights: templateInsights(prefs, summary) };
    if (!cfg.configured) return res.json(fallback);

    const ai = await chat({
      system: SYSTEM_BASE + ' Return strict JSON: {"persona": string (≤ 8 words), "insights": [string] (3–5 bullets, ≤ 20 words each, second person), "next_best_action": string (≤ 20 words)}. Base everything on the profile only.',
      user: JSON.stringify({ customer_first_name: safeName(req.body?.customerName) ?? null, profile: summary }),
      json: true,
      maxTokens: 400,
    });
    if (ai.ok === false) return res.json({ ...fallback, aiError: ai.error });
    try {
      const parsed = JSON.parse(ai.text) as { persona?: string; insights?: string[]; next_best_action?: string };
      return res.json({
        source: 'openai',
        model: ai.model,
        summary,
        persona: typeof parsed.persona === 'string' ? parsed.persona.slice(0, 60) : undefined,
        insights: Array.isArray(parsed.insights) ? parsed.insights.filter((x) => typeof x === 'string').slice(0, 5) : fallback.insights,
        nextBestAction: typeof parsed.next_best_action === 'string' ? parsed.next_best_action.slice(0, 140) : undefined,
      });
    } catch {
      return res.json({ ...fallback, aiError: 'unparseable_completion' });
    }
  });

  /** Intelligent matching for a free-text brief ("bridal trial near Malviya Nagar under ₹5000, female stylist"). */
  router.post('/match', async (req: Request, res: Response) => {
    const brief = typeof req.body?.brief === 'string' ? req.body.brief.trim().slice(0, 400) : '';
    const salons = parseSalons(req.body?.salons);
    if (!brief || salons.length === 0) return res.status(400).json({ error: 'brief and salons[] are required' });
    const prefs = parsePrefs(req.body?.preferences);
    const limit = Math.max(1, Math.min(8, Number(req.body?.limit) || 4));

    // Deterministic pre-filter so the model sees ≤ 25 candidates.
    const words = brief.toLowerCase().split(/[^a-z0-9₹]+/).filter((w) => w.length > 2);
    const pre = salons
      .map((s) => {
        const hay = `${s.name} ${s.location.area} ${s.categories.join(' ')} ${s.services.map((x) => x.name).join(' ')} ${s.gender}`.toLowerCase();
        const hits = words.filter((w) => hay.includes(w)).length;
        return { s, hits };
      })
      .sort((a, b) => b.hits - a.hits || b.s.rating - a.s.rating)
      .slice(0, 25);
    const fallbackMatches = pre.slice(0, limit).map(({ s, hits }) => ({ salonId: s.id, fit: hits > 0 ? Math.min(0.95, 0.5 + hits * 0.12) : 0.4, why: hits > 0 ? `Matches ${hits} of your criteria` : 'Highly rated option nearby' }));
    const fallback = { source: 'template' as const, matches: fallbackMatches };
    if (!cfg.configured) return res.json(fallback);

    const ai = await chat({
      system: SYSTEM_BASE + ' Return strict JSON: {"matches": [{"id": string, "fit": number 0-1, "why": string ≤ 20 words}], "clarify": string|null}. Choose at most ' + limit + ' from candidates only. If the brief is ambiguous set "clarify" to one short question.',
      user: JSON.stringify({ brief, profile: prefs ? summariseForAi(prefs, []) : null, candidates: pre.map(({ s }) => compactSalon(s)) }),
      json: true,
      maxTokens: 500,
      temperature: 0.4,
    });
    if (ai.ok === false) return res.json({ ...fallback, aiError: ai.error });
    try {
      const parsed = JSON.parse(ai.text) as { matches?: { id?: string; fit?: number; why?: string }[]; clarify?: string | null };
      const ids = new Set(pre.map((p) => p.s.id));
      const matches = (parsed.matches ?? [])
        .filter((m) => m.id && ids.has(m.id))
        .slice(0, limit)
        .map((m) => ({ salonId: m.id as string, fit: Math.max(0, Math.min(1, Number(m.fit) || 0.5)), why: typeof m.why === 'string' ? m.why.slice(0, 140) : '' }));
      return res.json({ source: 'openai', model: ai.model, matches: matches.length ? matches : fallbackMatches, clarify: typeof parsed.clarify === 'string' ? parsed.clarify.slice(0, 140) : null });
    } catch {
      return res.json({ ...fallback, aiError: 'unparseable_completion' });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function stripRec(r: Recommendation) {
  return { salonId: r.salon.id, score: r.score, reasons: r.reasons, serviceId: r.service?.id ?? null, reminderId: r.reminder?.id ?? null };
}

function defaultHeadline(prefs: UserPreferences, reminders: SmartReminder[]): string {
  const due = reminders.filter((r) => !r.reminder_sent && !r.dismissed_at && !r.booked_at && r.next_reminder_date <= new Date().toISOString().slice(0, 10));
  if (due.length) return `Time for your ${due[0].service_type.toLowerCase()}`;
  if (prefs.preferred_services.length) return `Picked for your ${prefs.preferred_services[0].toLowerCase()} routine`;
  return 'Top salons picked for you';
}

function templateInsights(prefs: UserPreferences, s: ReturnType<typeof summariseForAi>): string[] {
  const out: string[] = [];
  if (s.total_visits === 0) return ['You have no completed visits yet — book once and Nexora starts learning your rhythm.'];
  out.push(`You've completed ${s.total_visits} visit${s.total_visits === 1 ? '' : 's'}; ${prefs.preferred_services[0] ? `${prefs.preferred_services[0]} is your go-to.` : 'we are still learning your favourites.'}`);
  const cyc = Object.entries(s.service_cycles)[0];
  if (cyc) out.push(`Your ${cyc[0].toLowerCase()} rhythm is roughly every ${cyc[1].every_days} days.`);
  if (s.preferred_time) out.push(`You usually book ${s.preferred_time} slots.`);
  if (s.budget_band) out.push(`Your spend sits in the ${s.budget_band} band${prefs.insights.avg_ticket ? ` (~₹${prefs.insights.avg_ticket} a visit)` : ''}.`);
  if (s.stylist_loyalty != null && s.stylist_loyalty >= 0.5) out.push('You like sticking with the same stylist — we prioritise their availability.');
  if (s.due_now.length) out.push(`Due now: ${s.due_now.join(', ').toLowerCase()}.`);
  return out.slice(0, 5);
}
