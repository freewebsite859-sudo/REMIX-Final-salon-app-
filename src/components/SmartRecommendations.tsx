import React, { useEffect, useMemo, useState } from 'react';
import type { Appointment, Salon, SalonService, SavedStaffRef } from '../types';
import {
  buildReminders,
  daysUntilReminder,
  dueReminders,
  learnPreferences,
  recommendSalons,
  templateReminderMessage,
  type Recommendation,
  type SmartReminder,
  type UserPreferences,
} from '../lib/smartMemory';
import { aiApi, smartApi } from '../lib/smartClient';

/**
 * "For you" rail + "Time for a touch-up" reminder cards.
 *
 * Learning runs locally from the customer's own appointments/favourites (so it
 * works in demo mode with no backend), then — when signed in — is mirrored to
 * `user_preferences` / `smart_reminders` and re-ranked by `/api/ai/recommendations`.
 * Everything renders from the deterministic engine first; AI only improves the
 * copy/order, never the availability of the section.
 */
export interface SmartRecommendationsProps {
  userId: string;
  customerName?: string;
  accessToken?: string | null;
  salons: Salon[];
  appointments: Appointment[];
  savedSalonIds: string[];
  savedStaff?: SavedStaffRef[];
  onOpenSalon: (salon: Salon) => void;
  onBook: (salon: Salon, service?: SalonService) => void;
  className?: string;
}

const DISMISSED_KEY = 'nexora-smart-dismissed';
const readDismissed = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}'); } catch { return {}; } };

export const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({ userId, customerName, accessToken, salons, appointments, savedSalonIds, savedStaff = [], onOpenSalon, onBook, className = '' }) => {
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => (typeof localStorage === 'undefined' ? {} : readDismissed()));
  const [headline, setHeadline] = useState<string | null>(null);
  const [aiOrder, setAiOrder] = useState<Record<string, string[]> | null>(null);
  const [serverReminders, setServerReminders] = useState<SmartReminder[] | null>(null);

  const prefs: UserPreferences = useMemo(
    () => learnPreferences(userId, appointments, { favoriteSalonIds: savedSalonIds, favoriteStaffIds: savedStaff.map((s) => s.stylistId), salons }),
    [userId, appointments, savedSalonIds, savedStaff, salons]
  );
  const localReminders = useMemo(() => buildReminders(prefs, serverReminders ?? []), [prefs, serverReminders]);
  const reminders = useMemo(() => localReminders.filter((r) => !dismissed[r.service_type] || dismissed[r.service_type] < r.next_reminder_date), [localReminders, dismissed]);
  const due = useMemo(() => dueReminders(reminders), [reminders]);
  const recs: Recommendation[] = useMemo(() => recommendSalons(prefs, salons, reminders, { limit: 4 }), [prefs, salons, reminders]);

  // Mirror learning to the server + fetch AI headline/re-rank (signed-in only).
  useEffect(() => {
    if (!accessToken || salons.length === 0) return;
    let cancelled = false;
    const hasSignal = Object.keys(prefs.service_frequency).length > 0 || prefs.favorite_salon_ids.length > 0;
    (async () => {
      if (hasSignal) {
        const saved = await smartApi.savePreferences(accessToken, prefs);
        if (!cancelled && saved.ok) setServerReminders(saved.data.reminders);
      }
      const ai = await aiApi.recommendations({ preferences: prefs, reminders, salons, customerName, limit: 4 });
      if (cancelled || !ai.ok) return;
      setHeadline(ai.data.headline);
      if (ai.data.source === 'openai') setAiOrder(Object.fromEntries(ai.data.recommendations.map((r) => [r.salonId, r.reasons])));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId, appointments.length, savedSalonIds.join(','), salons.length]);

  const ordered = useMemo(() => {
    if (!aiOrder) return recs;
    const byId = new Map(recs.map((r) => [r.salon.id, r]));
    const picked = Object.keys(aiOrder).map((id) => byId.get(id)).filter((r): r is Recommendation => Boolean(r)).map((r) => ({ ...r, reasons: aiOrder[r.salon.id]?.length ? aiOrder[r.salon.id] : r.reasons }));
    return picked.length ? picked : recs;
  }, [recs, aiOrder]);

  const dismiss = (r: SmartReminder, snoozeDays: number) => {
    const until = new Date(Date.now() + Math.max(snoozeDays, 3650) * 86_400_000).toISOString().slice(0, 10);
    const snoozeUntil = snoozeDays > 0 ? new Date(Date.now() + snoozeDays * 86_400_000).toISOString().slice(0, 10) : until;
    const next = { ...dismissed, [r.service_type]: snoozeUntil };
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    if (accessToken && serverReminders?.some((x) => x.id === r.id)) void smartApi.dismissReminder(accessToken, r.id, snoozeDays);
  };

  // No learned signal yet → say nothing rather than a generic "for you" rail.
  const hasSignal = Object.keys(prefs.service_frequency).length > 0 || prefs.favorite_salon_ids.length > 0 || prefs.favorite_staff_ids.length > 0;
  if (!hasSignal || (ordered.length === 0 && due.length === 0)) return null;

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="smart-recs-h" data-testid="smart-recommendations">
      {due.length > 0 && (
        <div className="space-y-2" data-testid="smart-reminders">
          {due.slice(0, 2).map((r) => {
            const salon = salons.find((s) => s.id === r.salon_id) ?? recs.find((x) => x.reminder?.id === r.id)?.salon ?? null;
            const overdue = -daysUntilReminder(r);
            return (
              <div key={r.id} className="rounded-2xl border border-[#f0c9d1] bg-gradient-to-r from-[#fff0f1] to-white p-4 flex gap-3 items-start" role="status">
                <span className="material-symbols-outlined text-[#780032] text-2xl">notifications_active</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#26181a]">Time for your {r.service_type.toLowerCase()}?</p>
                  <p className="text-xs text-[#594045] mt-0.5">{templateReminderMessage(r, { customerName, salonName: salon?.name })}</p>
                  <p className="text-[11px] text-[#8c6f74] mt-1">Last visit {r.last_service_date} · you usually rebook every ~{r.cycle_days} days{overdue > 0 ? ` · ${overdue}d overdue` : ''}</p>
                  <div className="flex gap-2 mt-2">
                    {salon && <button type="button" onClick={() => { if (accessToken && serverReminders?.some((x) => x.id === r.id)) void smartApi.markBooked(accessToken, r.id); onBook(salon, salon.services.find((s) => s.id === recs.find((x) => x.reminder?.id === r.id)?.service?.id)); }} className="px-3 py-1.5 rounded-lg bg-[#780032] text-white text-xs font-bold">Book again</button>}
                    <button type="button" onClick={() => dismiss(r, 7)} className="px-3 py-1.5 rounded-lg bg-white border border-[#e0bec3] text-[#780032] text-xs font-semibold">Remind me in a week</button>
                    <button type="button" onClick={() => dismiss(r, 0)} className="px-2 py-1.5 text-xs text-[#8c6f74]" aria-label="Dismiss reminder">Dismiss</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ordered.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 id="smart-recs-h" className="font-section-heading text-lg font-extrabold text-[#26181a]">{headline || 'Picked for you'}</h2>
            <span className="text-[10px] uppercase tracking-wide font-bold text-[#8c6f74]">{aiOrder ? 'AI personalised' : 'Based on your visits'}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {ordered.map((r) => (
              <article key={r.salon.id} className="snap-start shrink-0 w-64 rounded-2xl overflow-hidden border border-[#e0bec3] bg-white" data-testid="smart-rec-card">
                <button type="button" onClick={() => onOpenSalon(r.salon)} className="block w-full text-left">
                  <img src={r.salon.image} alt="" className="h-28 w-full object-cover" loading="lazy" />
                  <div className="p-3">
                    <p className="font-bold text-sm text-[#26181a] truncate">{r.salon.name}</p>
                    <p className="text-[11px] text-[#594045]">{r.salon.location.area} · ★ {r.salon.rating.toFixed(1)}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {r.reasons.slice(0, 2).map((why) => <li key={why} className="text-[11px] text-[#780032] flex gap-1"><span>•</span><span className="truncate">{why}</span></li>)}
                    </ul>
                  </div>
                </button>
                <div className="px-3 pb-3">
                  <button type="button" onClick={() => onBook(r.salon, r.service)} className="w-full py-1.5 rounded-lg bg-[#fff0f1] text-[#780032] text-xs font-bold">{r.service ? `Book ${r.service.name}` : 'Book now'}</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default SmartRecommendations;
