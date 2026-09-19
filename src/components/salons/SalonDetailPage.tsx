import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Salon, SalonService, Stylist } from '../../types';
import { isVerifiedSalon, minSalonPrice, distanceKm } from '../../lib/salonSearch';
import { mapsDirectionsUrl } from '../../lib/mapsGrounding';
import { InteractiveSalonMap } from '../InteractiveSalonMap';
import { SalonCard, RatingPill } from './SalonCard';

export interface SalonDetailPageProps {
  salon: Salon;
  allSalons: Salon[];
  isSaved: boolean;
  savedSalonIds?: string[];
  currentLocation?: string;
  onBack: () => void;
  onToggleSave: (salonId: string) => void;
  onBook: (salon: Salon, service?: SalonService, stylist?: Stylist, services?: SalonService[]) => void;
  onOpenSalon: (salon: Salon) => void;
  onToggleSaveSalon?: (salonId: string) => void;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* ------------------------------------------------------------------------ */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------ */

const AMENITY_ICONS: Record<string, string> = {
  ac: 'ac_unit', wifi: 'wifi', parking: 'local_parking', card: 'credit_card', upi: 'qr_code_2', sanit: 'sanitizer',
  beverage: 'local_cafe', coffee: 'local_cafe', tea: 'emoji_food_beverage', whatsapp: 'chat', wheelchair: 'accessible',
  kids: 'child_care', women: 'woman', men: 'man', organic: 'eco', tv: 'tv', music: 'music_note', wash: 'wash', private: 'meeting_room',
};
const amenityIcon = (a: string) => {
  const k = a.toLowerCase();
  const hit = Object.keys(AMENITY_ICONS).find((key) => k.includes(key));
  return hit ? AMENITY_ICONS[hit] : 'check_circle';
};

/** Deterministic pseudo-availability for staff — UI-only indicator until live schedules exist. */
type Availability = { state: 'available' | 'busy' | 'off'; label: string };
const staffAvailability = (st: Stylist, idx: number): Availability => {
  if ((st.status || '').toLowerCase() === 'inactive' || (st.status || '').toLowerCase() === 'leave') return { state: 'off', label: 'Off today' };
  const seed = (st.id + st.name).split('').reduce((a, c) => a + c.charCodeAt(0), idx);
  const mod = seed % 5;
  if (mod === 0) return { state: 'busy', label: 'Busy till 4 PM' };
  if (mod === 1) return { state: 'busy', label: 'Next slot 6 PM' };
  return { state: 'available', label: 'Available now' };
};

const nextSlots = (): string[] => {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(now.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(start.getTime() + i * 45 * 60_000);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  });
};

const relativeTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

/* ------------------------------------------------------------------------ */
/*  Lightbox                                                                 */
/* ------------------------------------------------------------------------ */

const Lightbox: React.FC<{ images: { url: string; title?: string }[]; index: number; onClose: () => void; onIndex: (i: number) => void }> = ({ images, index, onClose, onIndex }) => {
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose, prev, next]);

  const img = images[index];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      role="dialog" aria-modal="true" aria-label="Photo gallery"
      data-testid="lightbox"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-mono" data-testid="lightbox-counter">{index + 1} / {images.length}</span>
        <button type="button" onClick={onClose} aria-label="Close gallery" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer" data-testid="lightbox-close">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center px-4 sm:px-16" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={prev} aria-label="Previous photo" className="absolute left-2 sm:left-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer" data-testid="lightbox-prev">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <AnimatePresence mode="wait">
          <motion.img
            key={img.url}
            src={img.url}
            alt={img.title || ''}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
          />
        </AnimatePresence>
        <button type="button" onClick={next} aria-label="Next photo" className="absolute right-2 sm:right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer" data-testid="lightbox-next">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <div className="p-4 text-center text-white" onClick={(e) => e.stopPropagation()}>
        {img.title && <p className="text-sm font-semibold">{img.title}</p>}
        <div className="mt-3 flex gap-2 justify-center overflow-x-auto no-scrollbar">
          {images.map((im, i) => (
            <button key={im.url + i} type="button" onClick={() => onIndex(i)} className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${i === index ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`} aria-label={`Photo ${i + 1}`}>
              <img src={im.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------------ */
/*  Page                                                                     */
/* ------------------------------------------------------------------------ */

export const SalonDetailPage: React.FC<SalonDetailPageProps> = ({
  salon, allSalons, isSaved, savedSalonIds = [], currentLocation, onBack, onToggleSave, onBook, onOpenSalon, onToggleSaveSalon,
}) => {
  const images = useMemo(() => {
    const fromGallery = (salon.photoGallery ?? []).map((p) => ({ url: p.url, title: p.title }));
    const plain = salon.gallery.map((u) => ({ url: u }));
    const seen = new Set<string>();
    return [{ url: salon.image, title: salon.name }, ...fromGallery, ...plain].filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  }, [salon]);

  const [lightbox, setLightbox] = useState<number | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [serviceCat, setServiceCat] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<SalonService[]>([]);
  const [chosenStylist, setChosenStylist] = useState<Stylist | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [reviewSort, setReviewSort] = useState<'recent' | 'top'>('recent');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const slots = useMemo(nextSlots, []);

  // Reset per-salon state when navigating between salons.
  useEffect(() => { setLightbox(null); setHeroIdx(0); setServiceCat('all'); setExpanded(new Set()); setCart([]); setChosenStylist(null); setSlot(null); setShowAllReviews(false); window.scrollTo({ top: 0 }); }, [salon.id]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(salon.services.map((s) => s.category)))], [salon.services]);
  const services = serviceCat === 'all' ? salon.services : salon.services.filter((s) => s.category === serviceCat);
  const verified = isVerifiedSalon(salon);
  const cartTotal = cart.reduce((n, s) => n + (s.discountPrice ?? s.price), 0);
  const cartMinutes = cart.reduce((n, s) => n + (s.duration ?? s.durationMinutes ?? 30), 0);
  const inCart = (id: string) => cart.some((s) => s.id === id);
  const toggleCart = (s: SalonService) => setCart((c) => (inCart(s.id) ? c.filter((x) => x.id !== s.id) : [...c, s]));
  const toggleExpand = (id: string) => setExpanded((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const reviews = useMemo(() => {
    const list = [...salon.reviews];
    list.sort((a, b) => (reviewSort === 'top' ? b.rating - a.rating : new Date(b.date).getTime() - new Date(a.date).getTime()));
    return list;
  }, [salon.reviews, reviewSort]);
  const ratingDist = useMemo(() => [5, 4, 3, 2, 1].map((star) => ({ star, n: salon.reviews.filter((r) => Math.round(r.rating) === star).length })), [salon.reviews]);

  const similar = useMemo(() => {
    const mine = new Set(salon.categories.map((c) => c.toLowerCase()));
    return allSalons
      .filter((s) => s.id !== salon.id)
      .map((s) => ({ s, score: s.categories.filter((c) => mine.has(c.toLowerCase())).length * 3 + (s.gender === salon.gender ? 2 : 0) + (s.location.area === salon.location.area ? 2 : 0) - distanceKm(s) * 0.1 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.s);
  }, [allSalons, salon]);

  const directions = mapsDirectionsUrl(salon);
  const bookNow = () => onBook(salon, cart[0], chosenStylist ?? undefined, cart.length ? cart : undefined);

  return (
    <div id="salon-detail-page" className="w-full pb-32 lg:pb-16" data-testid="salon-detail-page" data-salon-id={salon.id}>
      {/* Hero gallery */}
      <section className="relative">
        <div className="relative h-[46vh] min-h-[300px] max-h-[520px] bg-slate-900 overflow-hidden group">
          <AnimatePresence initial={false}>
            <motion.img
              key={images[heroIdx]?.url}
              src={images[heroIdx]?.url}
              alt={salon.name}
              initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightbox(heroIdx)}
              data-testid="hero-image"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-center justify-between">
            <button type="button" onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full bg-white/90 backdrop-blur text-on-surface flex items-center justify-center shadow cursor-pointer" data-testid="detail-back">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (navigator.share) navigator.share({ title: salon.name, url: window.location.href }).catch(() => {}); else navigator.clipboard?.writeText(window.location.href); }} aria-label="Share" className="w-10 h-10 rounded-full bg-white/90 backdrop-blur text-on-surface flex items-center justify-center shadow cursor-pointer">
                <span className="material-symbols-outlined">share</span>
              </button>
              <button
                type="button" onClick={() => onToggleSave(salon.id)} aria-pressed={isSaved} aria-label={isSaved ? 'Remove from favourites' : 'Save salon'}
                className={`w-10 h-10 rounded-full backdrop-blur flex items-center justify-center shadow cursor-pointer transition-colors ${isSaved ? 'bg-primary text-white' : 'bg-white/90 text-on-surface'}`}
                data-testid="detail-save"
              >
                <span className={`material-symbols-outlined ${isSaved ? 'fill-1' : ''}`}>favorite</span>
              </button>
            </div>
          </div>

          {/* Hero nav */}
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => setHeroIdx((i) => (i - 1 + images.length) % images.length)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" data-testid="hero-prev">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" onClick={() => setHeroIdx((i) => (i + 1) % images.length)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" data-testid="hero-next">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </>
          )}

          {/* Title block */}
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 max-w-7xl mx-auto text-white">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${salon.isOpen ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />{salon.isOpen ? 'Open now' : 'Closed'} · {salon.openingHours}
              </span>
              {salon.discountOffer && <span className="text-[10px] font-bold bg-primary px-2 py-0.5 rounded-full">{salon.discountOffer}</span>}
              <span className="text-[10px] font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full capitalize">{salon.gender}</span>
            </div>
            <h1 className="font-page-heading text-2xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-2">
              {salon.name}
              {verified && <span className="material-symbols-outlined text-primary-fixed fill-1 text-2xl" title="Verified">verified</span>}
            </h1>
            <p className="text-sm text-slate-200 mt-1">{salon.tagline}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-100">
              <RatingPill rating={salon.rating} count={salon.reviewCount} />
              <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-base">location_on</span>{salon.location.area}, {salon.location.city}</span>
              <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-base">near_me</span>{salon.distance}</span>
              <span className="font-mono">{salon.priceRange}</span>
            </div>
          </div>

          <button type="button" onClick={() => setLightbox(heroIdx)} className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/90 backdrop-blur text-on-surface text-xs font-bold shadow cursor-pointer" data-testid="open-gallery">
            <span className="material-symbols-outlined text-base">photo_library</span>{images.length} photos
          </button>
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="max-w-7xl mx-auto px-page-margin md:px-6 -mt-6 relative z-10">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1" data-testid="gallery-thumbs">
              {images.map((im, i) => (
                <button key={im.url} type="button" onClick={() => setHeroIdx(i)} onDoubleClick={() => setLightbox(i)} aria-label={`Photo ${i + 1}`} aria-current={i === heroIdx}
                  className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 shadow-md transition-all cursor-pointer ${i === heroIdx ? 'border-primary scale-105' : 'border-white hover:border-primary/50'}`}>
                  <img src={im.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-page-margin md:px-6 pt-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div className="min-w-0 flex flex-col gap-10">
          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: 'call', label: 'Call', href: salon.phone ? `tel:${salon.phone}` : undefined },
              { icon: 'chat', label: 'WhatsApp', href: salon.phone ? `https://wa.me/${salon.phone.replace(/\D/g, '')}` : undefined },
              { icon: 'directions', label: 'Directions', href: directions },
              { icon: 'calendar_month', label: 'Book', onClick: bookNow },
            ].map((a) => (
              a.href ? (
                <a key={a.label} href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="floating-card flex flex-col items-center gap-1 py-3 rounded-2xl bg-white border border-outline-variant/40 text-xs font-bold text-on-surface hover:text-primary">
                  <span className="material-symbols-outlined text-primary">{a.icon}</span>{a.label}
                </a>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} disabled={!a.onClick && !a.href} className="floating-card flex flex-col items-center gap-1 py-3 rounded-2xl bg-white border border-outline-variant/40 text-xs font-bold text-on-surface hover:text-primary disabled:opacity-40 cursor-pointer">
                  <span className="material-symbols-outlined text-primary">{a.icon}</span>{a.label}
                </button>
              )
            ))}
          </div>

          {/* About */}
          <section aria-labelledby="about-h">
            <h2 id="about-h" className="font-section-heading text-lg font-extrabold text-on-surface mb-2">About</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">{(salon as Salon & { about?: string }).about || salon.tagline}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {salon.categories.slice(0, 8).map((c) => <span key={c} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">{c}</span>)}
            </div>
          </section>

          {/* Services */}
          <section aria-labelledby="services-h" id="salon-services">
            <div className="flex items-end justify-between gap-2 mb-3">
              <div>
                <h2 id="services-h" className="font-section-heading text-lg font-extrabold text-on-surface">Services & pricing</h2>
                <p className="text-xs text-on-surface-variant">{salon.services.length} services · from {inr(minSalonPrice(salon))}</p>
              </div>
              {cart.length > 0 && <span className="text-xs font-bold text-primary" data-testid="cart-summary">{cart.length} selected · {inr(cartTotal)}</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 -mx-page-margin px-page-margin md:mx-0 md:px-0">
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => setServiceCat(c)} aria-pressed={serviceCat === c} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-colors cursor-pointer ${serviceCat === c ? 'bg-on-surface text-white border-on-surface' : 'bg-white border-outline-variant/50'}`}>
                  {c === 'all' ? `All (${salon.services.length})` : c}
                </button>
              ))}
            </div>
            <ul className="flex flex-col gap-2" data-testid="service-menu">
              {services.map((s) => {
                const open = expanded.has(s.id);
                const selected = inCart(s.id);
                const mins = s.duration ?? s.durationMinutes;
                return (
                  <li key={s.id} className={`rounded-2xl border bg-white transition-colors ${selected ? 'border-primary shadow-sm shadow-primary/10' : 'border-outline-variant/40'}`} data-testid={`service-row-${s.id}`}>
                    <div className="flex items-start gap-3 p-3.5">
                      <span className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">{s.icon || 'content_cut'}</span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-on-surface truncate">{s.name}</h3>
                          {s.popular && <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Popular</span>}
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-2">
                          {mins && <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">schedule</span>{mins} min</span>}
                          <span>{s.category}</span>
                        </div>
                        <button type="button" onClick={() => toggleExpand(s.id)} aria-expanded={open} className="text-[11px] text-primary font-bold mt-1 inline-flex items-center gap-0.5 cursor-pointer" data-testid={`expand-service-${s.id}`}>
                          {open ? 'Less' : 'Details'}<span className={`material-symbols-outlined text-sm transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="text-xs text-on-surface-variant leading-relaxed overflow-hidden pt-1" data-testid={`service-desc-${s.id}`}>
                              {s.description || 'Performed by our trained professionals using sanitised, single-use tools where applicable.'}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div>
                          {s.discountPrice && s.discountPrice < s.price ? (
                            <><div className="text-[11px] text-secondary line-through font-mono">{inr(s.price)}</div><div className="font-extrabold text-on-surface font-mono">{inr(s.discountPrice)}</div></>
                          ) : (
                            <div className="font-extrabold text-on-surface font-mono">{inr(s.price)}</div>
                          )}
                        </div>
                        <button type="button" onClick={() => toggleCart(s)} aria-pressed={selected} className={`h-8 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary/40 hover:bg-primary/5'}`} data-testid={`add-service-${s.id}`}>
                          {selected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Staff */}
          <section aria-labelledby="staff-h">
            <h2 id="staff-h" className="font-section-heading text-lg font-extrabold text-on-surface mb-1">Our team</h2>
            <p className="text-xs text-on-surface-variant mb-3">Pick a professional or let the salon assign the next available.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="staff-grid">
              {salon.stylists.map((st, i) => {
                const av = staffAvailability(st, i);
                const picked = chosenStylist?.id === st.id;
                const dot = av.state === 'available' ? 'bg-emerald-500' : av.state === 'busy' ? 'bg-amber-500' : 'bg-slate-400';
                return (
                  <button key={st.id} type="button" onClick={() => setChosenStylist(picked ? null : st)} aria-pressed={picked} disabled={av.state === 'off'}
                    className={`floating-card text-left p-3.5 rounded-2xl bg-white border flex flex-col gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${picked ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/40'}`}
                    data-testid={`staff-card-${st.id}`} data-availability={av.state}>
                    <div className="relative w-14 h-14">
                      {st.avatarUrl || st.avatar ? (
                        <img src={st.avatarUrl || st.avatar} alt={st.name} className="w-14 h-14 rounded-2xl object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-lg">{st.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${dot}`} title={av.label} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-on-surface truncate">{st.name}</div>
                      <div className="text-[11px] text-on-surface-variant truncate">{st.role}{st.experience ? ` · ${st.experience}` : ''}</div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${av.state === 'available' ? 'text-emerald-700' : av.state === 'busy' ? 'text-amber-700' : 'text-slate-500'}`}>{av.label}</span>
                      {st.rating && <span className="inline-flex items-center gap-0.5 font-bold text-amber-600"><span className="material-symbols-outlined text-xs fill-1">star</span>{st.rating}</span>}
                    </div>
                    {(st.specialty || st.specialties) && (
                      <div className="flex flex-wrap gap-1">{(st.specialty || st.specialties || []).slice(0, 2).map((sp) => <span key={sp} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">{sp}</span>)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Reviews */}
          <section aria-labelledby="reviews-h">
            <div className="flex items-end justify-between gap-2 mb-3">
              <h2 id="reviews-h" className="font-section-heading text-lg font-extrabold text-on-surface">Reviews</h2>
              <div className="flex rounded-lg border border-outline-variant/50 p-0.5 bg-white text-xs">
                {(['recent', 'top'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setReviewSort(k)} aria-pressed={reviewSort === k} className={`px-2.5 h-7 rounded-md font-bold cursor-pointer ${reviewSort === k ? 'bg-on-surface text-white' : 'text-secondary'}`}>{k === 'recent' ? 'Recent' : 'Top rated'}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 p-4 rounded-2xl bg-white border border-outline-variant/40 mb-3">
              <div className="flex sm:flex-col items-center sm:items-start gap-3">
                <div className="font-display text-5xl font-extrabold text-on-surface leading-none">{salon.rating.toFixed(1)}</div>
                <div>
                  <div className="flex text-amber-500">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={`material-symbols-outlined text-lg ${i < Math.round(salon.rating) ? 'fill-1' : 'text-slate-300'}`}>star</span>)}</div>
                  <div className="text-xs text-on-surface-variant">{salon.reviewCount} verified reviews</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {ratingDist.map(({ star, n }) => (
                  <div key={star} className="flex items-center gap-2 text-[11px]">
                    <span className="w-3 font-bold">{star}</span><span className="material-symbols-outlined text-xs text-amber-500 fill-1">star</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-container-highest overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: `${salon.reviews.length ? (n / salon.reviews.length) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="h-full bg-amber-500 rounded-full" /></div>
                    <span className="w-6 text-right text-secondary">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-3" data-testid="reviews-list">
              {(showAllReviews ? reviews : reviews.slice(0, 3)).map((r) => (
                <li key={r.id} className="p-4 rounded-2xl bg-white border border-outline-variant/40">
                  <div className="flex items-start gap-3">
                    <img src={r.userAvatar} alt="" className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-on-surface truncate">{r.userName}</span>
                        <span className="text-[11px] text-secondary shrink-0">{relativeTime(r.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex text-amber-500">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={`material-symbols-outlined text-sm ${i < r.rating ? 'fill-1' : 'text-slate-300'}`}>star</span>)}</span>
                        {r.serviceUsed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">{r.serviceUsed}</span>}
                      </div>
                      <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{r.comment}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {reviews.length > 3 && (
              <button type="button" onClick={() => setShowAllReviews((v) => !v)} className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer" data-testid="toggle-reviews">
                {showAllReviews ? 'Show fewer' : `Show all ${reviews.length} reviews`}
              </button>
            )}
          </section>

          {/* Amenities */}
          <section aria-labelledby="amenities-h">
            <h2 id="amenities-h" className="font-section-heading text-lg font-extrabold text-on-surface mb-3">Facilities & amenities</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="amenities-list">
              {salon.amenities.map((a) => (
                <li key={a} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-outline-variant/40 text-xs font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-primary text-lg">{amenityIcon(a)}</span>{a}
                </li>
              ))}
            </ul>
          </section>

          {/* Map */}
          <section aria-labelledby="location-h">
            <h2 id="location-h" className="font-section-heading text-lg font-extrabold text-on-surface mb-3">Location & directions</h2>
            <InteractiveSalonMap salon={salon} others={similar} userLocation={currentLocation} onSelectSalon={onOpenSalon} />
          </section>

          {/* Similar */}
          {similar.length > 0 && (
            <section aria-labelledby="similar-h">
              <h2 id="similar-h" className="font-section-heading text-lg font-extrabold text-on-surface mb-3">Similar salons nearby</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="similar-salons">
                {similar.map((s, i) => (
                  <SalonCard key={s.id} salon={s} index={i} isSaved={savedSalonIds.includes(s.id)} onOpen={onOpenSalon} onBook={(x) => onBook(x)} onToggleSave={onToggleSaveSalon ?? onToggleSave} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Booking widget (sticky on desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-3xl bg-white border border-outline-variant/40 shadow-xl shadow-primary/5 p-5 flex flex-col gap-4" data-testid="booking-widget">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Book an appointment</div>
              <div className="text-sm text-on-surface-variant mt-0.5">Instant confirmation on WhatsApp</div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">Services</div>
              {cart.length === 0 ? (
                <button type="button" onClick={() => document.getElementById('salon-services')?.scrollIntoView({ behavior: 'smooth' })} className="w-full text-left p-3 rounded-xl border border-dashed border-outline-variant text-xs text-on-surface-variant hover:border-primary cursor-pointer">
                  + Add services from the menu
                </button>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {cart.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-container-low">
                      <span className="truncate font-semibold">{s.name}</span>
                      <span className="flex items-center gap-2 shrink-0"><span className="font-mono">{inr(s.discountPrice ?? s.price)}</span><button type="button" onClick={() => toggleCart(s)} aria-label={`Remove ${s.name}`} className="material-symbols-outlined text-sm text-secondary hover:text-error cursor-pointer">close</button></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">Professional</div>
              <div className="text-xs p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                <span className="font-semibold">{chosenStylist ? chosenStylist.name : 'Any available'}</span>
                {chosenStylist && <button type="button" onClick={() => setChosenStylist(null)} className="text-primary font-bold cursor-pointer">Change</button>}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">Next available today</div>
              <div className="grid grid-cols-3 gap-1.5" data-testid="slot-grid">
                {slots.map((t) => (
                  <button key={t} type="button" onClick={() => setSlot(t)} aria-pressed={slot === t} className={`h-9 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${slot === t ? 'bg-primary text-white border-primary' : 'bg-white border-outline-variant/50 hover:border-primary'}`}>{t}</button>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant/30 pt-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-secondary uppercase tracking-wider">Estimated</div>
                <div className="font-extrabold font-mono text-on-surface">{cart.length ? inr(cartTotal) : `from ${inr(minSalonPrice(salon))}`}</div>
                {cart.length > 0 && <div className="text-[10px] text-secondary">~{cartMinutes} min</div>}
              </div>
              <button type="button" onClick={bookNow} className="h-11 px-5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary-container transition-colors cursor-pointer shimmer-on-hover" data-testid="widget-book">
                {cart.length ? `Book ${cart.length} service${cart.length > 1 ? 's' : ''}` : 'Book now'}
              </button>
            </div>
            <p className="text-[10px] text-secondary text-center">Free cancellation up to 2 hours before · Pay at salon or UPI</p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky booking bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-white/95 backdrop-blur border-t border-outline-variant/40 pb-safe" data-testid="mobile-book-bar">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-secondary uppercase tracking-wider">{cart.length ? `${cart.length} selected · ~${cartMinutes} min` : 'Starts from'}</div>
            <div className="font-extrabold font-mono text-on-surface">{cart.length ? inr(cartTotal) : inr(minSalonPrice(salon))}</div>
          </div>
          <button type="button" onClick={bookNow} className="h-11 px-6 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-lg shadow-primary/25 cursor-pointer" data-testid="mobile-book">
            {cart.length ? `Book ${cart.length}` : 'Book now'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {lightbox !== null && <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />}
      </AnimatePresence>
    </div>
  );
};
