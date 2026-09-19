/**
 * Smart Memory Engine — pure, side-effect-free core.
 *
 * Learns a customer's service cycles from their booking history, keeps a
 * preference profile, schedules 45-day (or learned-cadence) reminders, and
 * scores salons for personalised recommendations. The browser uses it against
 * local appointment state; the server (`server/smartMemory.ts`) uses the same
 * functions against Supabase rows, so the two never disagree.
 *
 * Mirrors the SQL trigger in
 * `supabase/migrations/20260918120000_smart_memory_engine.sql`.
 */
import type { Appointment, Salon, SalonService } from '../types';
import { distanceKm, minSalonPrice } from './salonSearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const DEFAULT_REMINDER_CYCLE_DAYS = 45;
export const MIN_REMINDER_CYCLE_DAYS = 14;
export const MAX_REMINDER_CYCLE_DAYS = 120;
/** Reminders fire this many days *before* the predicted next visit. */
export const REMINDER_LEAD_DAYS = 3;

export interface ServiceFrequency {
  count: number;
  /** YYYY-MM-DD */
  last_at: string;
  avg_gap_days: number;
  avg_spend: number;
  salon_ids: string[];
  stylist_ids: string[];
}

export interface UserPreferences {
  user_id: string;
  favorite_salon_ids: string[];
  favorite_staff_ids: string[];
  preferred_services: string[];
  service_frequency: Record<string, ServiceFrequency>;
  insights: PreferenceInsights;
  updated_at: string;
}

export interface PreferenceInsights {
  /** 'morning' | 'afternoon' | 'evening' — most common booking window. */
  preferred_time_of_day?: 'morning' | 'afternoon' | 'evening';
  /** Average spend per visit in INR. */
  avg_ticket?: number;
  budget_band?: 'value' | 'mid' | 'premium';
  /** Top areas the customer books in. */
  preferred_areas?: string[];
  /** Fraction of visits where the same stylist was chosen again. */
  stylist_loyalty?: number;
  total_visits?: number;
  /** Salon ids visited more than once, most-visited first. */
  repeat_salons?: string[];
}

export interface SmartReminder {
  id: string;
  user_id: string;
  service_type: string;
  salon_id: string | null;
  stylist_id: string | null;
  last_service_date: string;
  next_reminder_date: string;
  cycle_days: number;
  reminder_sent: boolean;
  dismissed_at?: string | null;
  booked_at?: string | null;
  message?: string | null;
}

export interface Recommendation {
  salon: Salon;
  score: number;
  reasons: string[];
  /** Service the recommendation is anchored on, if any. */
  service?: SalonService;
  /** Set when the recommendation comes from a due reminder. */
  reminder?: SmartReminder;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC-safe, day granularity)
// ---------------------------------------------------------------------------

export const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
};
export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

export const clampCycle = (days: number): number =>
  Math.max(MIN_REMINDER_CYCLE_DAYS, Math.min(MAX_REMINDER_CYCLE_DAYS, Math.round(days)));

/** Canonical service type: category if present, else the service name. */
export const serviceTypeOf = (s: Pick<SalonService, 'category' | 'name'>): string =>
  (s.category && s.category.trim()) || s.name.trim();

const timeOfDay = (time: string): 'morning' | 'afternoon' | 'evening' => {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return 'afternoon';
  let h = parseInt(m[1], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const mode = <T,>(xs: T[]): T | undefined => {
  const m = new Map<T, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
};

// ---------------------------------------------------------------------------
// Preference learning
// ---------------------------------------------------------------------------

export function emptyPreferences(userId: string): UserPreferences {
  return {
    user_id: userId,
    favorite_salon_ids: [],
    favorite_staff_ids: [],
    preferred_services: [],
    service_frequency: {},
    insights: {},
    updated_at: new Date().toISOString(),
  };
}

/**
 * Rebuild the full preference profile from a customer's appointment history.
 * Only completed (or past confirmed) visits count as evidence.
 */
export function learnPreferences(
  userId: string,
  appointments: Appointment[],
  extras: { favoriteSalonIds?: string[]; favoriteStaffIds?: string[]; today?: string; salons?: Salon[] } = {}
): UserPreferences {
  const today = extras.today ?? toIsoDate(new Date());
  const visits = appointments
    .filter((a) => a.status === 'completed' || (a.status === 'confirmed' && a.date < today))
    .sort((a, b) => a.date.localeCompare(b.date));

  const freq: Record<string, ServiceFrequency> = {};
  const gaps: Record<string, number[]> = {};

  for (const apt of visits) {
    for (const svc of apt.services) {
      const type = serviceTypeOf(svc);
      const prev = freq[type];
      if (prev) {
        const gap = Math.max(1, daysBetween(prev.last_at, apt.date));
        if (gap > 0 && apt.date !== prev.last_at) (gaps[type] ??= []).push(gap);
        prev.count += 1;
        prev.last_at = apt.date > prev.last_at ? apt.date : prev.last_at;
        prev.avg_spend = Math.round((prev.avg_spend * (prev.count - 1) + svc.price) / prev.count);
        if (!prev.salon_ids.includes(apt.salonId)) prev.salon_ids.push(apt.salonId);
        if (apt.stylist?.id && !prev.stylist_ids.includes(apt.stylist.id)) prev.stylist_ids.push(apt.stylist.id);
      } else {
        freq[type] = {
          count: 1,
          last_at: apt.date,
          avg_gap_days: DEFAULT_REMINDER_CYCLE_DAYS,
          avg_spend: svc.price,
          salon_ids: [apt.salonId],
          stylist_ids: apt.stylist?.id ? [apt.stylist.id] : [],
        };
      }
    }
  }
  for (const [type, g] of Object.entries(gaps)) {
    if (g.length) freq[type].avg_gap_days = Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10) / 10;
  }

  // Insights
  const tickets = visits.map((a) => a.totalPrice).filter((n) => Number.isFinite(n) && n > 0);
  const avgTicket = tickets.length ? Math.round(tickets.reduce((a, b) => a + b, 0) / tickets.length) : undefined;
  const salonCounts = new Map<string, number>();
  visits.forEach((a) => salonCounts.set(a.salonId, (salonCounts.get(a.salonId) ?? 0) + 1));
  const repeatSalons = Array.from(salonCounts.entries()).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const stylistVisits = visits.filter((a) => a.stylist?.id);
  const stylistRepeat = stylistVisits.filter((a, i) => stylistVisits.slice(0, i).some((p) => p.stylist?.id === a.stylist?.id)).length;
  const areas = visits
    .map((a) => extras.salons?.find((s) => s.id === a.salonId)?.location.area ?? a.salonAddress.split(',').slice(-2, -1)[0]?.trim())
    .filter((x): x is string => Boolean(x));

  const insights: PreferenceInsights = {
    total_visits: visits.length,
    preferred_time_of_day: visits.length ? mode(visits.map((a) => timeOfDay(a.time))) : undefined,
    avg_ticket: avgTicket,
    budget_band: avgTicket == null ? undefined : avgTicket < 600 ? 'value' : avgTicket < 2000 ? 'mid' : 'premium',
    preferred_areas: Array.from(new Set(areas)).slice(0, 3),
    stylist_loyalty: stylistVisits.length > 1 ? Math.round((stylistRepeat / (stylistVisits.length - 1)) * 100) / 100 : undefined,
    repeat_salons: repeatSalons,
  };

  const preferred = Object.entries(freq).sort((a, b) => b[1].count - a[1].count || b[1].last_at.localeCompare(a[1].last_at)).map(([t]) => t);

  return {
    user_id: userId,
    favorite_salon_ids: extras.favoriteSalonIds ?? [],
    favorite_staff_ids: extras.favoriteStaffIds ?? [],
    preferred_services: preferred,
    service_frequency: freq,
    insights,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reminder scheduling (45-day intelligent cycle)
// ---------------------------------------------------------------------------

/** Learned cadence for a service, falling back to the 45-day default. */
export function reminderCycleFor(f: ServiceFrequency | undefined): number {
  if (!f || f.count < 2) return DEFAULT_REMINDER_CYCLE_DAYS;
  return clampCycle(f.avg_gap_days);
}

/**
 * Build the full reminder set from a preference profile. One reminder per
 * service type, anchored on the last visit, firing `REMINDER_LEAD_DAYS` before
 * the predicted next visit.
 */
export function buildReminders(prefs: UserPreferences, existing: SmartReminder[] = []): SmartReminder[] {
  return Object.entries(prefs.service_frequency).map(([type, f]) => {
    const prev = existing.find((r) => r.service_type === type);
    const cycle = reminderCycleFor(f);
    const next = addDays(f.last_at, Math.max(1, cycle - REMINDER_LEAD_DAYS));
    const unchanged = prev && prev.last_service_date === f.last_at;
    return {
      id: prev?.id ?? `rem_${prefs.user_id.slice(0, 8)}_${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      user_id: prefs.user_id,
      service_type: type,
      salon_id: f.salon_ids[f.salon_ids.length - 1] ?? null,
      stylist_id: f.stylist_ids[f.stylist_ids.length - 1] ?? null,
      last_service_date: f.last_at,
      next_reminder_date: next,
      cycle_days: cycle,
      reminder_sent: unchanged ? prev!.reminder_sent : false,
      dismissed_at: unchanged ? prev!.dismissed_at ?? null : null,
      booked_at: unchanged ? prev!.booked_at ?? null : null,
      message: unchanged ? prev!.message ?? null : null,
    };
  });
}

export function isReminderDue(r: SmartReminder, today = toIsoDate(new Date())): boolean {
  return !r.reminder_sent && !r.dismissed_at && !r.booked_at && r.next_reminder_date <= today;
}

export function dueReminders(reminders: SmartReminder[], today = toIsoDate(new Date())): SmartReminder[] {
  return reminders.filter((r) => isReminderDue(r, today)).sort((a, b) => a.next_reminder_date.localeCompare(b.next_reminder_date));
}

/** Days until the reminder fires (negative = overdue). */
export function daysUntilReminder(r: SmartReminder, today = toIsoDate(new Date())): number {
  return daysBetween(today, r.next_reminder_date);
}

/**
 * Deterministic fallback reminder copy — used when the AI endpoint is not
 * configured or fails. Always correct, just less charming.
 */
export function templateReminderMessage(r: SmartReminder, ctx: { customerName?: string; salonName?: string; stylistName?: string } = {}): string {
  const since = Math.max(0, daysBetween(r.last_service_date, toIsoDate(new Date())));
  const who = ctx.customerName ? `Hi ${ctx.customerName.split(' ')[0]}! ` : 'Hi! ';
  const where = ctx.salonName ? ` at ${ctx.salonName}` : '';
  const withWhom = ctx.stylistName ? ` with ${ctx.stylistName}` : '';
  return `${who}It's been ${since} days since your last ${r.service_type.toLowerCase()}${where}. Your usual ${r.cycle_days}-day cycle is coming up — shall we book your next slot${withWhom}? Reply YES or tap to choose a time.`;
}

// ---------------------------------------------------------------------------
// Intelligent salon matching / recommendations
// ---------------------------------------------------------------------------

export interface RecommendOptions {
  limit?: number;
  today?: string;
  /** Exclude salons the customer already has an upcoming booking at. */
  excludeSalonIds?: string[];
}

/**
 * Score every salon against the learned profile and return the best matches
 * with human-readable reasons. Deterministic; the AI layer only re-ranks /
 * explains on top of this.
 */
export function recommendSalons(
  prefs: UserPreferences,
  salons: Salon[],
  reminders: SmartReminder[] = [],
  opts: RecommendOptions = {}
): Recommendation[] {
  const today = opts.today ?? toIsoDate(new Date());
  const limit = opts.limit ?? 6;
  const exclude = new Set(opts.excludeSalonIds ?? []);
  const due = dueReminders(reminders, today);
  const preferredTypes = new Set(prefs.preferred_services.map((s) => s.toLowerCase()));
  const repeat = new Set(prefs.insights.repeat_salons ?? []);
  const favSalons = new Set(prefs.favorite_salon_ids);
  const favStaff = new Set(prefs.favorite_staff_ids);
  const areas = new Set((prefs.insights.preferred_areas ?? []).map((a) => a.toLowerCase()));
  const band = prefs.insights.budget_band;

  const out: Recommendation[] = [];
  for (const salon of salons) {
    if (exclude.has(salon.id)) continue;
    let score = salon.rating * 4; // 0–20 baseline on quality
    const reasons: string[] = [];
    let service: SalonService | undefined;
    let reminder: SmartReminder | undefined;

    // Due reminder at this salon → strongest signal.
    const dueHere = due.find((r) => r.salon_id === salon.id);
    if (dueHere) {
      score += 40;
      reminder = dueHere;
      service = salon.services.find((s) => serviceTypeOf(s).toLowerCase() === dueHere.service_type.toLowerCase());
      reasons.push(`Your ${dueHere.service_type.toLowerCase()} is due (every ~${dueHere.cycle_days} days)`);
    } else {
      // Or a due reminder anywhere that this salon can serve.
      const servable = due.find((r) => salon.services.some((s) => serviceTypeOf(s).toLowerCase() === r.service_type.toLowerCase()));
      if (servable) {
        score += 18;
        reminder = servable;
        service = salon.services.find((s) => serviceTypeOf(s).toLowerCase() === servable.service_type.toLowerCase());
        reasons.push(`Offers the ${servable.service_type.toLowerCase()} you're due for`);
      }
    }

    if (repeat.has(salon.id)) { score += 22; reasons.push('You keep coming back here'); }
    else if (Object.values(prefs.service_frequency).some((f) => f.salon_ids.includes(salon.id))) { score += 10; reasons.push('You have visited before'); }
    if (favSalons.has(salon.id)) { score += 15; reasons.push('In your favourites'); }
    if (salon.stylists.some((st) => favStaff.has(st.id))) { score += 12; reasons.push('Your favourite stylist works here'); }

    const matchingTypes = salon.services.filter((s) => preferredTypes.has(serviceTypeOf(s).toLowerCase()));
    if (matchingTypes.length) {
      score += Math.min(15, matchingTypes.length * 5);
      if (!service) service = matchingTypes.find((s) => s.popular) ?? matchingTypes[0];
      reasons.push(`Great for ${Array.from(new Set(matchingTypes.map((s) => serviceTypeOf(s)))).slice(0, 2).join(' & ').toLowerCase()}`);
    }

    if (areas.has(salon.location.area.toLowerCase())) { score += 8; reasons.push(`In ${salon.location.area}, where you usually book`); }
    const km = distanceKm(salon);
    if (km <= 2) score += 6; else if (km <= 5) score += 3;

    if (band) {
      const from = minSalonPrice(salon);
      const fits = band === 'value' ? from <= 500 : band === 'mid' ? from <= 1500 : true;
      if (fits) score += 4; else score -= 6;
      if (band === 'premium' && salon.priceRange.length >= 3) { score += 4; reasons.push('Matches your premium taste'); }
    }

    if (salon.discountOffer) { score += 3; if (reasons.length < 3) reasons.push(salon.discountOffer); }
    if (salon.isOpen) score += 2;

    if (reasons.length === 0) reasons.push(salon.rating >= 4.7 ? 'Top rated near you' : 'Popular in your city');
    out.push({ salon, score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 3), service, reminder });
  }

  return out.sort((a, b) => b.score - a.score || b.salon.rating - a.salon.rating).slice(0, limit);
}

/** Compact, PII-free summary of a profile for the AI prompt. */
export function summariseForAi(prefs: UserPreferences, reminders: SmartReminder[], today = toIsoDate(new Date())) {
  return {
    total_visits: prefs.insights.total_visits ?? 0,
    preferred_services: prefs.preferred_services.slice(0, 5),
    service_cycles: Object.fromEntries(
      Object.entries(prefs.service_frequency).slice(0, 6).map(([k, f]) => [k, { visits: f.count, every_days: reminderCycleFor(f), last: f.last_at, days_since: daysBetween(f.last_at, today) }])
    ),
    due_now: dueReminders(reminders, today).map((r) => r.service_type),
    budget_band: prefs.insights.budget_band ?? null,
    preferred_time: prefs.insights.preferred_time_of_day ?? null,
    preferred_areas: prefs.insights.preferred_areas ?? [],
    stylist_loyalty: prefs.insights.stylist_loyalty ?? null,
  };
}
