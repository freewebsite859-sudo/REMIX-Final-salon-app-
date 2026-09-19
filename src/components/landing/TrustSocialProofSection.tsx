import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';

/* -------------------------------------------------------------------------- */
/*                           QR Revolution Demonstration                       */
/* -------------------------------------------------------------------------- */

const QR_STEPS = [
  { icon: 'qr_code_2', title: 'Scan at the mirror', copy: 'Every chair, counter and window carries a unique Nexora QR.' },
  { icon: 'stars', title: 'Earn instantly', copy: 'Points land in the customer wallet before the cape comes off.' },
  { icon: 'rate_review', title: 'Review in one tap', copy: 'Google-style rating prompt, no app download required.' },
  { icon: 'event_repeat', title: 'Re-book on the spot', copy: 'Pre-filled next appointment with stylist and slot suggestions.' },
];

const useQrDataUrl = (payload: string) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const qrFn =
      QRCode.toDataURL ||
      (QRCode as unknown as { default: { toDataURL: typeof QRCode.toDataURL } }).default?.toDataURL;
    if (!qrFn) return;
    qrFn(payload, { margin: 1, width: 240, color: { dark: '#26181a', light: '#ffffff' } })
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [payload]);
  return url;
};

const QrRevolutionDemo: React.FC = () => {
  const [active, setActive] = useState(0);
  const qrUrl = useQrDataUrl('https://nexora.in/s/arts-by-uma?chair=3&src=mirror');

  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a + 1) % QR_STEPS.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 rounded-3xl bg-slate-950 text-white p-6 sm:p-8 overflow-hidden border border-slate-800"
      data-testid="qr-revolution-demo"
    >
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] bg-[length:28px_28px]" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-primary/30 blur-3xl pointer-events-none" />

      {/* QR device mock */}
      <div className="relative lg:col-span-2 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -2 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="animate-float relative w-56 sm:w-64 rounded-3xl bg-white text-on-surface p-5 shadow-2xl shadow-primary/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">spa</span>
              <span className="text-xs font-extrabold tracking-tight">Arts By Uma</span>
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">CHAIR 03</span>
          </div>
          <div className="relative aspect-square rounded-2xl bg-white border border-slate-200 p-2 overflow-hidden">
            {qrUrl ? (
              <img src={qrUrl} alt="Nexora chair QR code" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full grid grid-cols-8 gap-0.5" aria-hidden>
                {Array.from({ length: 64 }).map((_, i) => (
                  <span key={i} className={`rounded-[2px] ${((i * 7) % 3 === 0) ? 'bg-slate-900' : 'bg-transparent'}`} />
                ))}
              </div>
            )}
            {/* scan line */}
            <motion.div
              aria-hidden
              className="absolute left-2 right-2 h-0.5 bg-primary shadow-[0_0_12px_2px_rgba(163,0,70,.6)]"
              animate={{ top: ['8%', '92%', '8%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <p className="text-[10px] text-center text-slate-500 mt-3 font-medium">
            Scan to earn <span className="text-primary font-bold">+50 pts</span> & rate your stylist
          </p>
        </motion.div>

        {/* Floating notification chips */}
        <motion.div
          className="animate-float-delayed absolute -right-2 top-4 sm:right-2 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <span className="material-symbols-outlined text-sm">check_circle</span> +50 points credited
        </motion.div>
        <motion.div
          className="animate-float-slow absolute -left-2 bottom-6 sm:left-2 bg-white text-on-surface text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <span className="material-symbols-outlined text-sm text-amber-500 fill-1">star</span> 5★ review posted
        </motion.div>
      </div>

      {/* Steps */}
      <div className="relative lg:col-span-3 flex flex-col gap-5">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary-fixed-dim">The QR Revolution</span>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            One scan replaces the loyalty card, the feedback form and the follow-up call.
          </h3>
        </div>
        <ol className="flex flex-col gap-2">
          {QR_STEPS.map((step, i) => {
            const isActive = i === active;
            return (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'bg-white/10 border-primary-fixed-dim/60 shadow-lg shadow-primary/20 translate-x-1'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                  data-testid={`qr-step-${i}`}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-primary text-white' : 'bg-white/10 text-slate-300'}`}>
                    <span className="material-symbols-outlined text-xl">{step.icon}</span>
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{step.title}</span>
                      <span className="text-[10px] font-mono text-slate-400">0{i + 1}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-snug">{step.copy}</p>
                    {isActive && (
                      <motion.div
                        layoutId="qr-progress"
                        className="h-0.5 mt-2 rounded-full bg-gradient-to-r from-primary to-primary-fixed-dim origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 3.1, ease: 'linear' }}
                      />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { v: '3.2×', l: 'more reviews collected' },
            { v: '41%', l: 'customers re-book on-site' },
            { v: '0', l: 'apps to install' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 text-center">
              <div className="font-display text-xl font-extrabold text-primary-fixed">{s.v}</div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Interactive Rewards Preview                        */
/* -------------------------------------------------------------------------- */

const REWARD_SERVICES = [
  { name: 'Master Cut & Blowdry', price: 750 },
  { name: 'Hydra Facial', price: 2400 },
  { name: 'Keratin Smoothing', price: 4200 },
  { name: 'Bridal Trial', price: 6500 },
];
const TIERS = [
  { name: 'Silver', min: 0, rate: 0.05, color: 'from-slate-300 to-slate-500' },
  { name: 'Gold', min: 1500, rate: 0.08, color: 'from-amber-300 to-amber-600' },
  { name: 'Platinum', min: 4000, rate: 0.12, color: 'from-violet-300 to-primary' },
];

const useCountUp = (target: number, duration = 600) => {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
};

const RewardsPreview: React.FC = () => {
  const [visits, setVisits] = useState(4);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [referrals, setReferrals] = useState(1);

  const service = REWARD_SERVICES[serviceIdx];
  const spend = visits * service.price;
  const tier = useMemo(() => [...TIERS].reverse().find((t) => spend * 0.1 >= t.min) ?? TIERS[0], [spend]);
  const points = Math.round(spend * tier.rate) + referrals * 200;
  const savings = Math.round(points); // 1 point = ₹1
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const progress = nextTier ? Math.min(1, (spend * 0.1 - tier.min) / (nextTier.min - tier.min)) : 1;

  const animatedPoints = useCountUp(points);
  const animatedSavings = useCountUp(savings);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6 rounded-3xl bg-white border border-outline-variant/40 p-6 sm:p-8 shadow-xl shadow-primary/5"
      data-testid="rewards-preview"
    >
      {/* Controls */}
      <div className="flex flex-col gap-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Interactive Rewards Preview</span>
          <h3 className="font-display text-2xl font-extrabold tracking-tight text-on-surface mt-1">
            Play with the numbers. Watch the wallet fill.
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">Every rupee spent earns points; every referral adds ₹200. Points are redeemable 1:1 on any service.</p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-xs font-bold text-on-surface">
            <span>Visits this year</span>
            <span className="font-mono text-primary" data-testid="rewards-visits">{visits}</span>
          </span>
          <input
            type="range" min={1} max={24} value={visits}
            onChange={(e) => setVisits(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
            aria-label="Visits this year"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-on-surface">Usual service</span>
          <div className="grid grid-cols-2 gap-2">
            {REWARD_SERVICES.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setServiceIdx(i)}
                className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                  i === serviceIdx ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline-variant/40 hover:border-primary/50'
                }`}
                aria-pressed={i === serviceIdx}
              >
                <div className="font-bold text-on-surface leading-tight">{s.name}</div>
                <div className="font-mono text-secondary mt-0.5">₹{s.price.toLocaleString('en-IN')}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-on-surface">Friends referred</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReferrals((r) => Math.max(0, r - 1))} className="w-8 h-8 rounded-lg border border-outline-variant/50 hover:bg-surface-container cursor-pointer" aria-label="Fewer referrals">−</button>
            <span className="w-6 text-center font-mono font-bold" data-testid="rewards-referrals">{referrals}</span>
            <button type="button" onClick={() => setReferrals((r) => Math.min(10, r + 1))} className="w-8 h-8 rounded-lg border border-outline-variant/50 hover:bg-surface-container cursor-pointer" aria-label="More referrals">+</button>
          </div>
        </div>
      </div>

      {/* Wallet card */}
      <div className="flex items-center justify-center">
        <motion.div
          key={tier.name}
          initial={{ rotateY: -12, opacity: 0.6 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="floating-card relative w-full max-w-sm rounded-3xl p-6 text-white overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#3f0017 0%,#780032 45%,#a30046 100%)' }}
          data-testid="rewards-wallet-card"
        >
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-[radial-gradient(circle_at_30%_120%,rgba(255,217,223,.35),transparent_60%)]" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg">spa</span>
              <span className="text-xs font-extrabold tracking-wider uppercase">Nexora Wallet</span>
            </div>
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-gradient-to-r ${tier.color} text-slate-900 shadow`} data-testid="rewards-tier">
              {tier.name}
            </span>
          </div>

          <div className="relative mt-8">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Points balance</div>
            <div className="font-display text-5xl font-extrabold tracking-tight mt-1 tabular-nums" data-testid="rewards-points">
              {animatedPoints.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-white/80 mt-1">
              = <span className="font-bold text-primary-fixed">₹{animatedSavings.toLocaleString('en-IN')}</span> off your next visit
            </div>
          </div>

          <div className="relative mt-6">
            <div className="flex items-center justify-between text-[10px] text-white/80 mb-1.5">
              <span>{tier.name} · {Math.round(tier.rate * 100)}% back</span>
              <span>{nextTier ? `${nextTier.name} at ₹${(nextTier.min * 10).toLocaleString('en-IN')} spend` : 'Top tier unlocked'}</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary-fixed to-white"
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              />
            </div>
          </div>

          <div className="relative mt-6 flex items-center justify-between text-[10px] font-mono text-white/70">
            <span>{visits} × {service.name}</span>
            <span>₹{spend.toLocaleString('en-IN')} spent</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Transparency Proof Elements                        */
/* -------------------------------------------------------------------------- */

const PROOFS = [
  { icon: 'receipt_long', title: 'Price-lock guarantee', copy: 'The ₹ you see online is the ₹ on the bill. Any change requires customer approval in-app.', badge: 'Live rate card' },
  { icon: 'verified', title: 'Verified-visit reviews only', copy: 'Reviews can only be posted after a QR-confirmed appointment. No bots, no bought stars.', badge: '100% verified' },
  { icon: 'lock', title: 'Your data stays yours', copy: 'Phone numbers are masked from salons until booking is confirmed; delete your account any time.', badge: 'DPDP-ready' },
  { icon: 'currency_rupee', title: 'Refunds in 3 days', copy: 'Cancel before the window and Razorpay refunds land in your UPI within 72 hours.', badge: 'Razorpay secured' },
];

const TransparencyProof: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="transparency-proof">
    {PROOFS.map((p, i) => (
      <motion.div
        key={p.title}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="floating-card group relative p-5 rounded-2xl bg-white border border-outline-variant/40 flex flex-col gap-3"
        data-testid="proof-card"
      >
        <div className="flex items-center justify-between">
          <span className="w-10 h-10 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">{p.icon}</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check</span>{p.badge}
          </span>
        </div>
        <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{p.title}</h4>
        <p className="text-xs text-on-surface-variant leading-relaxed">{p.copy}</p>
      </motion.div>
    ))}
  </div>
);

/* -------------------------------------------------------------------------- */
/*                             Testimonial Carousel                            */
/* -------------------------------------------------------------------------- */

export interface LandingTestimonial {
  name: string;
  location: string;
  rating: number;
  service: string;
  salon: string;
  quote: string;
  avatar: string;
}

export const LANDING_TESTIMONIALS: LandingTestimonial[] = [
  { name: 'Priya Sharma', location: 'Malviya Nagar, Jaipur', rating: 5, service: 'Hydra Facial', salon: 'Glow Studio', quote: 'Booked from WhatsApp in under a minute, and the ₹ price on the site was exactly what I paid. The reminder the night before is a lifesaver.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { name: 'Rohan Mehta', location: 'Vaishali Nagar, Jaipur', rating: 5, service: 'Executive Cut', salon: 'The Royal Blade', quote: 'Scanned the QR on the mirror, rated my barber, got 50 points. Redeemed them on my next beard trim. Zero effort loyalty.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { name: 'Ananya Iyer', location: 'C-Scheme, Jaipur', rating: 5, service: 'Bridal Trial', salon: 'Arts By Uma', quote: 'Watching the stylist reels before choosing made all the difference. I knew exactly whose hands I was trusting for my wedding.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80' },
  { name: 'Kabir Singh', location: 'Mansarovar, Jaipur', rating: 4, service: 'Keratin Smoothing', salon: 'Lush Unisex', quote: 'Had to cancel once — refund hit my UPI in two days without a single phone call. That is the transparency I want.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { name: 'Meera Rathore', location: 'Raja Park, Jaipur', rating: 5, service: 'Nail Art', salon: 'Nail Couture', quote: 'Referred three friends, earned ₹600 in the wallet. My monthly manicure basically pays for itself now.', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
];

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span className="flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={`material-symbols-outlined text-base ${i < n ? 'text-amber-500 fill-1' : 'text-slate-300'}`}>star</span>
    ))}
  </span>
);

export const TestimonialCarousel: React.FC<{ testimonials?: LandingTestimonial[]; autoPlayMs?: number }> = ({
  testimonials = LANDING_TESTIMONIALS,
  autoPlayMs = 5000,
}) => {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const count = testimonials.length;

  const go = (next: number, d: number) => {
    setDir(d);
    setIndex(((next % count) + count) % count);
  };

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => go(index + 1, 1), autoPlayMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, autoPlayMs, count]);

  const t = testimonials[index];
  const avg = (testimonials.reduce((s, x) => s + x.rating, 0) / count).toFixed(1);

  return (
    <div
      className="relative rounded-3xl bg-gradient-to-br from-surface-container-low via-white to-primary-fixed/30 border border-outline-variant/40 p-6 sm:p-10 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      data-testid="testimonial-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      <span className="material-symbols-outlined absolute top-4 left-6 text-[120px] leading-none text-primary/10 select-none pointer-events-none">format_quote</span>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Aggregate */}
        <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-2">
          <div className="font-display text-5xl font-extrabold text-on-surface leading-none">{avg}</div>
          <div>
            <Stars n={Math.round(Number(avg))} />
            <div className="text-xs text-on-surface-variant mt-1">from {count * 218} verified visits</div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 mt-3 text-[10px] font-mono font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="material-symbols-outlined text-xs">verified</span> QR-verified reviews
          </div>
        </div>

        {/* Slide */}
        <div className="md:col-span-2 relative min-h-[190px]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.figure
              key={index}
              custom={dir}
              initial={{ opacity: 0, x: 40 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 * dir }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-4"
              data-testid="testimonial-slide"
            >
              <Stars n={t.rating} />
              <blockquote className="text-lg sm:text-xl font-medium text-on-surface leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow" loading="lazy" />
                <div>
                  <div className="text-sm font-bold text-on-surface">{t.name}</div>
                  <div className="text-xs text-on-surface-variant">{t.location} · {t.service} at {t.salon}</div>
                </div>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="relative mt-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose testimonial">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Testimonial ${i + 1}`}
              onClick={() => go(i, i > index ? 1 : -1)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === index ? 'w-8 bg-primary' : 'w-2 bg-outline-variant hover:bg-primary/50'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(index - 1, -1)} aria-label="Previous testimonial" className="w-9 h-9 rounded-full border border-outline-variant/60 bg-white hover:bg-primary hover:text-white hover:border-primary transition-colors flex items-center justify-center cursor-pointer" data-testid="testimonial-prev">
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <button type="button" onClick={() => go(index + 1, 1)} aria-label="Next testimonial" className="w-9 h-9 rounded-full border border-outline-variant/60 bg-white hover:bg-primary hover:text-white hover:border-primary transition-colors flex items-center justify-center cursor-pointer" data-testid="testimonial-next">
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Section shell                                */
/* -------------------------------------------------------------------------- */

export const TrustSocialProofSection: React.FC<{ className?: string }> = ({ className = '' }) => (
  <section
    className={`pt-8 border-t border-outline-variant/30 flex flex-col gap-10 ${className}`}
    aria-labelledby="trust-heading"
    data-testid="trust-social-proof-section"
  >
    <div className="text-center max-w-2xl mx-auto">
      <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Trust & Social Proof</span>
      <h2 id="trust-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mt-1">
        Loyalty You Can See. Pricing You Can Trust.
      </h2>
      <p className="text-sm text-on-surface-variant mt-2">
        A QR on every chair, a wallet in every pocket, and reviews that can only come from real visits.
      </p>
    </div>

    <QrRevolutionDemo />
    <RewardsPreview />
    <TransparencyProof />
    <TestimonialCarousel />
  </section>
);
