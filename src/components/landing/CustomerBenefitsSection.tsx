import React from 'react';
import { motion } from 'motion/react';

interface Benefit {
  icon: string;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
  accent: string; // tailwind gradient classes
  float: string; // float animation class
}

const BENEFITS: Benefit[] = [
  {
    icon: 'bolt',
    title: 'Book in 30 Seconds',
    description: 'Pick a service, stylist and slot — confirmed instantly on WhatsApp. No hold music, no call-backs.',
    stat: '30s',
    statLabel: 'avg. booking time',
    accent: 'from-amber-400/25 to-orange-500/10',
    float: 'animate-float',
  },
  {
    icon: 'currency_rupee',
    title: 'Transparent ₹ Pricing',
    description: 'Every service shows its real INR rate upfront. What you see on the site is what you pay at the counter.',
    stat: '0',
    statLabel: 'hidden charges',
    accent: 'from-emerald-400/25 to-teal-500/10',
    float: 'animate-float-delayed',
  },
  {
    icon: 'alarm_on',
    title: 'Never Miss an Appointment',
    description: 'Smart reminders and a live countdown keep your slot top of mind, with one-tap reschedule if plans change.',
    stat: '92%',
    statLabel: 'fewer no-shows',
    accent: 'from-sky-400/25 to-indigo-500/10',
    float: 'animate-float-slow',
  },
  {
    icon: 'redeem',
    title: 'Earn Rewards Every Visit',
    description: 'Collect points, unlock memberships and refer friends — your loyalty wallet travels with you across salons.',
    stat: '₹250+',
    statLabel: 'avg. yearly savings',
    accent: 'from-pink-400/25 to-primary/10',
    float: 'animate-float',
  },
  {
    icon: 'verified_user',
    title: 'Verified Stylists & Reviews',
    description: 'Browse real portfolios, ratings and video reels before you choose who touches your hair or skin.',
    stat: '4.8★',
    statLabel: 'avg. stylist rating',
    accent: 'from-violet-400/25 to-purple-500/10',
    float: 'animate-float-delayed',
  },
  {
    icon: 'contactless',
    title: 'Pay Your Way',
    description: 'UPI, cards or cash — secure Razorpay checkout with instant digital receipts and full payment history.',
    stat: 'UPI',
    statLabel: 'cards & wallets',
    accent: 'from-rose-400/25 to-red-500/10',
    float: 'animate-float-slow',
  },
];

interface CustomerBenefitsSectionProps {
  className?: string;
}

export const CustomerBenefitsSection: React.FC<CustomerBenefitsSectionProps> = ({ className = '' }) => {
  return (
    <section
      className={`relative pt-8 border-t border-outline-variant/30 flex flex-col gap-8 ${className}`}
      aria-labelledby="benefits-heading"
      data-testid="customer-benefits-section"
    >
      {/* Ambient glows */}
      <div className="absolute -top-10 left-0 w-72 h-72 bg-primary-fixed/30 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-tertiary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="text-center max-w-2xl mx-auto">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
          Why Customers Love Smart Salons
        </span>
        <h2
          id="benefits-heading"
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mt-1"
        >
          Built Around the Way You Actually Book
        </h2>
        <p className="text-sm text-on-surface-variant mt-2">
          Less waiting, no surprises, and a little reward every time you show up looking your best.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BENEFITS.map((b, i) => (
          <motion.article
            key={b.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: (i % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="floating-card group relative p-6 rounded-2xl bg-white border border-outline-variant/40 flex flex-col gap-4 overflow-hidden"
            data-testid="benefit-card"
          >
            {/* Accent gradient */}
            <div className={`absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-br ${b.accent} blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700`} />

            <div className="relative flex items-start justify-between gap-3">
              <span className={`${b.float} w-12 h-12 rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined text-2xl">{b.icon}</span>
              </span>
              <div className="text-right">
                <div className="font-display text-2xl font-extrabold text-on-surface leading-none">{b.stat}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-secondary mt-1">{b.statLabel}</div>
              </div>
            </div>

            <div className="relative">
              <h3 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors">{b.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{b.description}</p>
            </div>

            <div className="relative mt-auto h-1 w-full rounded-full bg-surface-container-highest overflow-hidden">
              <div className="h-full w-0 group-hover:w-full bg-gradient-to-r from-primary to-primary-fixed-dim transition-all duration-700 ease-out" />
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};
