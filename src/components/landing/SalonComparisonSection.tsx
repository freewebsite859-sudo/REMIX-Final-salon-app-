import React from 'react';
import { motion } from 'motion/react';

interface ComparisonRow {
  label: string;
  old: string;
  smart: string;
  icon: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Bookings',
    old: 'Phone calls, missed rings, and double-booked chairs',
    smart: 'Instant WhatsApp & online booking with live slot availability',
    icon: 'event_available',
  },
  {
    label: 'Discovery',
    old: 'Word of mouth and a faded Just Dial listing',
    smart: 'A branded website, video reels, and Google-ready SEO pages',
    icon: 'travel_explore',
  },
  {
    label: 'Pricing',
    old: 'Laminated menu that nobody updates',
    smart: 'Live INR (₹) rate card synced across web, app & reception',
    icon: 'currency_rupee',
  },
  {
    label: 'Reminders',
    old: 'No-shows because nobody called back',
    smart: 'Automated reminders, countdowns & re-booking nudges',
    icon: 'notifications_active',
  },
  {
    label: 'Loyalty',
    old: 'Paper punch cards lost in handbags',
    smart: 'Digital rewards wallet, referrals & memberships',
    icon: 'loyalty',
  },
  {
    label: 'Payments',
    old: 'Cash only, change shortages, no receipts',
    smart: 'UPI, cards & Razorpay with instant digital receipts',
    icon: 'account_balance_wallet',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

interface SalonComparisonSectionProps {
  onCta?: () => void;
  className?: string;
}

export const SalonComparisonSection: React.FC<SalonComparisonSectionProps> = ({ onCta, className = '' }) => {
  return (
    <section
      className={`pt-8 border-t border-outline-variant/30 flex flex-col gap-8 ${className}`}
      aria-labelledby="comparison-heading"
      data-testid="salon-comparison-section"
    >
      <div className="text-center max-w-2xl mx-auto">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
          Old Salon vs Smart Salon
        </span>
        <h2
          id="comparison-heading"
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mt-1"
        >
          Same Chair. Completely Different Business.
        </h2>
        <p className="text-sm text-on-surface-variant mt-2">
          See how a Nexora-powered salon replaces the daily chaos of a traditional parlour with a calm, automated, always-on booking machine.
        </p>
      </div>

      {/* Split screen */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-0 rounded-3xl overflow-hidden border border-outline-variant/40 shadow-xl shadow-primary/5">
        {/* Divider badge */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
          <span className="absolute w-16 h-16 rounded-full bg-primary/30 animate-pulse-ring" />
          <span className="relative w-14 h-14 rounded-full bg-primary text-on-primary font-display font-extrabold text-sm flex items-center justify-center shadow-lg ring-4 ring-surface">
            VS
          </span>
        </div>

        {/* OLD side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-slate-900 text-slate-200 p-6 sm:p-8 flex flex-col gap-5"
          data-testid="comparison-old"
        >
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_20%_20%,#fff_1px,transparent_1px)] bg-[length:18px_18px]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-2xl">history</span>
              <h3 className="font-display text-lg font-extrabold text-white">The Old Salon</h3>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
              Offline
            </span>
          </div>

          <ul className="relative flex flex-col gap-3">
            {COMPARISON_ROWS.map((row, i) => (
              <motion.li
                key={row.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/70"
              >
                <span className="material-symbols-outlined text-rose-400 text-lg mt-0.5 shrink-0">close</span>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{row.label}</div>
                  <p className="text-sm text-slate-200 leading-snug line-through decoration-slate-500/70">{row.old}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* SMART side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="relative bg-gradient-to-br from-white via-surface-container-low to-primary-fixed/40 text-on-surface p-6 sm:p-8 flex flex-col gap-5"
          data-testid="comparison-smart"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
              <h3 className="font-display text-lg font-extrabold text-on-surface">The Smart Salon</h3>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live on Nexora
            </span>
          </div>

          <ul className="relative flex flex-col gap-3">
            {COMPARISON_ROWS.map((row, i) => (
              <motion.li
                key={row.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                className="floating-card flex items-start gap-3 p-3 rounded-xl bg-white border border-outline-variant/40"
              >
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base">{row.icon}</span>
                </span>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">{row.label}</div>
                  <p className="text-sm text-on-surface leading-snug font-medium">{row.smart}</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-lg ml-auto shrink-0">check_circle</span>
              </motion.li>
            ))}
          </ul>

          {onCta && (
            <button
              onClick={onCta}
              className="relative shimmer-on-hover mt-2 w-full sm:w-auto self-start bg-primary hover:bg-primary-container text-on-primary text-sm font-bold h-11 px-6 rounded-xl shadow-lg shadow-primary/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Make My Salon Smart</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
};
