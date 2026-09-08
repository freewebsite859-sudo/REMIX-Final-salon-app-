import React, { useEffect, useMemo, useState } from 'react';
import { Salon, SalonService, Stylist, Review } from '../types';
import { StaticMapPreview } from './StaticMapPreview';
import { buildBookingMetadataServices } from '../lib/bookingContract';
import { computeBookingTotals } from '../lib/bookingCore';

/** Indian-rupee formatting with thousands separators (e.g. ₹3,150). */
function formatINR(amount: number): string {
  return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

interface SalonDetailModalProps {
  salon: Salon | null;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Start the booking flow. `services` carries the full multi-service
   * selection (bulk booking); `service` stays for single-tap "Book" entries
   * and is always the first item of `services` when both are present.
   */
  onBookService: (
    salon: Salon,
    service?: SalonService,
    stylist?: Stylist,
    services?: SalonService[]
  ) => void;
  isSaved?: boolean;
  onToggleSave?: (salonId: string) => void;
  onAddReview?: (salonId: string, review: Review) => void;
  initialTab?: 'services' | 'reviews' | 'about';
  userLocation?: string;
  savedServiceIds?: string[];
  onToggleSaveService?: (salonId: string, serviceId: string) => void;
}

type ModalTab = 'services' | 'reviews' | 'about';

export const SalonDetailModal: React.FC<SalonDetailModalProps> = ({
  salon,
  isOpen,
  onClose,
  onBookService,
  isSaved = false,
  onToggleSave,
  onAddReview,
  initialTab = 'services',
  userLocation = '',
  savedServiceIds = [],
  onToggleSaveService,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  /**
   * Multi-service cart for this salon (bulk selection).
   * Stored as ids so a re-render of the catalog can never desynchronise the
   * checked state from the salon's canonical service objects.
   */
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Review & Rating Tab States
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewName, setReviewName] = useState<string>('');
  const [reviewService, setReviewService] = useState<string>('');
  const [reviewStylist, setReviewStylist] = useState<string>('');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewFilterRating, setReviewFilterRating] = useState<number | 'all'>('all');
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'helpful'>('newest');
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});
  const [userVoted, setUserVoted] = useState<Record<string, boolean>>({});
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);

  const salonId = salon?.id ?? null;

  // A fresh salon (or a re-opened sheet) always starts with an empty cart.
  useEffect(() => {
    setSelectedServiceIds([]);
  }, [salonId, isOpen]);

  // Selected services resolved against the live catalog, in catalog order.
  const selectedServices = useMemo<SalonService[]>(() => {
    if (!salon) return [];
    return salon.services.filter((srv) => selectedServiceIds.includes(srv.id));
  }, [salon, selectedServiceIds]);

  // Cart totals use the canonical booking line items, so the number shown
  // here is exactly what the booking modal and the server compute.
  const cartTotals = useMemo(
    () => computeBookingTotals(buildBookingMetadataServices(selectedServices), 0),
    [selectedServices]
  );

  if (!isOpen || !salon) return null;

  const toggleService = (srv: SalonService) => {
    setSelectedServiceIds((prev) =>
      prev.includes(srv.id) ? prev.filter((id) => id !== srv.id) : [...prev, srv.id]
    );
  };

  const clearCart = () => setSelectedServiceIds([]);

  /** Book the current multi-service cart (falls back to a single service). */
  const bookSelection = (single?: SalonService, stylist?: Stylist) => {
    const chosen = single
      ? [single, ...selectedServices.filter((s) => s.id !== single.id)]
      : selectedServices;
    if (chosen.length === 0) {
      onBookService(salon, undefined, stylist);
      return;
    }
    onBookService(salon, chosen[0], stylist, chosen);
  };

  const categories = ['all', ...Array.from(new Set(salon.services.map((s) => s.category)))];

  const filteredServices = activeCategory === 'all'
    ? salon.services
    : salon.services.filter((s) => s.category === activeCategory);

  const images = (salon.gallery?.length ? salon.gallery : [salon.image]).filter(Boolean);

  // Quick compliment tag options
  const quickCompliments = [
    '✨ Super Clean & Sanitized',
    '💇 Excellent Haircut',
    '💆 Relaxing Ambience',
    '⏱️ Punctual Service',
    '🌟 Polite & Skilled Staff',
    '☕ Great Waiting Lounge',
    '💰 Great Value for Money',
  ];

  // Calculate rating distributions from reviews actually returned by the
  // catalog. Never manufacture a distribution from an aggregate count.
  const allReviews = salon.reviews || [];
  const totalReviewsCount = allReviews.length;
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = allReviews.filter((review) => review.rating === stars).length;
    const percentage = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
    return { stars, count, percentage };
  });

  // Filter and sort reviews
  const displayReviews = allReviews
    .filter((rev) => {
      if (reviewFilterRating !== 'all' && rev.rating !== reviewFilterRating) return false;
      if (reviewSearch.trim()) {
        const query = reviewSearch.toLowerCase();
        const matchesComment = rev.comment.toLowerCase().includes(query);
        const matchesName = rev.userName.toLowerCase().includes(query);
        const matchesService = rev.serviceUsed?.toLowerCase().includes(query);
        if (!matchesComment && !matchesName && !matchesService) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating;
      if (reviewSort === 'helpful') {
        const votesA = helpfulVotes[a.id] || 0;
        const votesB = helpfulVotes[b.id] || 0;
        return votesB - votesA;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleHelpfulClick = (reviewId: string) => {
    if (userVoted[reviewId]) {
      setHelpfulVotes((prev) => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] || 1) - 1) }));
      setUserVoted((prev) => ({ ...prev, [reviewId]: false }));
    } else {
      setHelpfulVotes((prev) => ({ ...prev, [reviewId]: (prev[reviewId] || 0) + 1 }));
      setUserVoted((prev) => ({ ...prev, [reviewId]: true }));
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    const fullComment = selectedTags.length > 0
      ? `${reviewComment.trim()} (${selectedTags.join(', ')})`
      : reviewComment.trim();

    if (!onAddReview) {
      setSubmitSuccessMessage('Reviews are unavailable until the authenticated review service is configured. No review was published.');
      return;
    }

    const newReview: Review = {
      id: '',
      userName: reviewName.trim(),
      userAvatar: '',
      rating: reviewRating,
      date: new Date().toISOString(),
      comment: fullComment,
      serviceUsed: reviewService || undefined,
    };

    // The parent callback is the seam for an authenticated, server-side
    // review mutation. This component never mutates the salon prop directly.
    onAddReview(salon.id, newReview);
    setReviewComment('');
    setSelectedTags([]);
    setShowReviewForm(false);
    setSubmitSuccessMessage('Review submitted for verification.');
    setTimeout(() => setSubmitSuccessMessage(null), 4000);
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return 'Exceptional! 🌟';
      case 4: return 'Very Good 👍';
      case 3: return 'Average / Good 👌';
      case 2: return 'Below Expectations 😐';
      case 1: return 'Poor Experience 👎';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="salon-detail-modal-container"
        className="w-full max-w-xl bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-outline-variant/30 max-h-[94vh] overflow-y-auto relative flex flex-col"
      >
        {/* Header Gallery */}
        <div className="relative h-60 w-full bg-surface-container-highest shrink-0">
          <img
            src={images[activeImageIndex] || salon.image}
            alt={salon.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <button
              id="salon-modal-close-btn"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors shadow-sm"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleSave && (
                <button
                  id="salon-modal-fav-btn"
                  onClick={() => onToggleSave(salon.id)}
                  className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-colors shadow-sm ${
                    isSaved ? 'bg-surface text-nexora-pink' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                  aria-label="Save salon"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isSaved ? 'fill-1' : ''}`}>
                    favorite
                  </span>
                </button>
              )}
              {salon.location.mapsUrl && (
                <a
                  id="salon-modal-maps-link"
                  href={salon.location.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors shadow-sm"
                  title="Open in Google Maps"
                >
                  <span className="material-symbols-outlined text-[20px]">map</span>
                </a>
              )}
            </div>
          </div>

          {/* Previous / Next Arrow buttons on Hero image if multiple */}
          {images.length > 1 && (
            <div className="absolute inset-y-0 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center pointer-events-auto backdrop-blur-xs transition-colors"
                aria-label="Previous image"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center pointer-events-auto backdrop-blur-xs transition-colors"
                aria-label="Next image"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}

          {/* Bottom Title inside Image */}
          <div className="absolute bottom-3 left-4 right-4 text-white z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-success-emerald text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                {salon.isOpen ? 'Open Now' : 'Closed'}
              </span>
              <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                {salon.priceRange} · {salon.gender}
              </span>
            </div>
            <h1 className="font-card-title text-[22px] font-bold leading-tight">{salon.name}</h1>
            <p className="text-[12px] opacity-90">{salon.tagline}</p>
          </div>

          {/* Thumbnail dots if multiple */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeImageIndex === i ? 'bg-white w-4' : 'bg-white/50 w-1.5'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Metrics Bar */}
        <div className="px-4 pt-3 pb-1 bg-surface">
          <div className="flex items-center justify-between bg-surface-container-low p-2.5 rounded-2xl border border-outline-variant/40">
            <button
              onClick={() => setActiveTab('reviews')}
              className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-warning-amber text-[20px] fill-1">star</span>
              <div>
                <div className="font-bold text-[14px] leading-tight text-on-surface flex items-center gap-1">
                  {salon.rating}
                  <span className="font-normal text-[11px] text-nexora-pink underline">
                    ({salon.reviewCount || allReviews.length} reviews)
                  </span>
                </div>
                <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Verified Ratings</span>
              </div>
            </button>
            <div className="h-6 w-px bg-outline-variant/60" />
            <button
              onClick={() => setActiveTab('about')}
              className="flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
              title="View on Map"
            >
              <span className="material-symbols-outlined text-nexora-pink text-[20px]">near_me</span>
              <div>
                <div className="font-bold text-[14px] leading-tight text-on-surface flex items-center gap-1">
                  {salon.distance}
                  <span className="text-[10px] text-nexora-pink underline font-normal">Map</span>
                </div>
                <span className="text-[10px] text-on-surface-variant uppercase font-semibold">{salon.location.area}</span>
              </div>
            </button>
            <div className="h-6 w-px bg-outline-variant/60" />
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
              <div>
                <div className="font-bold text-[12px] leading-tight text-on-surface truncate max-w-[90px]">{salon.openingHours}</div>
                <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Daily</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Modal Navigation Tabs */}
        <div className="px-4 border-b border-outline-variant/40 bg-surface sticky top-0 z-20">
          <div className="flex gap-1.5 py-2 overflow-x-auto no-scrollbar">
            <button
              id="salon-tab-services"
              onClick={() => setActiveTab('services')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'services'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">content_cut</span>
              <span>Services</span>
            </button>

            <button
              id="salon-tab-reviews"
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'reviews'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] fill-1 text-warning-amber">star</span>
              <span>Reviews</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'reviews' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary font-bold'
              }`}>
                {allReviews.length}
              </span>
            </button>

            <button
              id="salon-tab-about"
              onClick={() => setActiveTab('about')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'about'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              <span>Location</span>
            </button>
          </div>
        </div>

        {/* Content Body based on Active Tab */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 flex-1">
          {/* ======================= TAB 1: SERVICES ======================= */}
          {activeTab === 'services' && (
            <>
              {/* Discount Banner if present */}
              {salon.discountOffer && (
                <div className="bg-gradient-to-r from-nexora-pink to-primary text-white p-3 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">local_offer</span>
                    <span className="text-[13px] font-bold">{salon.discountOffer}</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">NEXORA20</span>
                </div>
              )}

              {/* Services Catalog */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-section-heading text-[15px] text-on-surface">Services Catalog</h3>
                  <span className="text-[12px] text-on-surface-variant">
                    {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2.5">
                  Tap services to add them to this appointment — book several treatments in one visit.
                </p>

                {/* Category Filter Chips */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-[12px] font-medium capitalize whitespace-nowrap transition-colors ${
                        activeCategory === cat
                          ? 'bg-primary text-white font-semibold shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Service Items */}
                <div className="flex flex-col gap-2.5">
                  {filteredServices.map((srv) => {
                    const isSelected = selectedServiceIds.includes(srv.id);
                    return (
                    <div
                      key={srv.id}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      data-service-id={srv.id}
                      data-selected={isSelected ? 'true' : 'false'}
                      onClick={() => toggleService(srv)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleService(srv);
                        }
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer select-none outline-none ${
                        isSelected
                          ? 'bg-nexora-pink/[0.06] border-nexora-pink ring-1 ring-nexora-pink shadow-xs'
                          : 'bg-surface-container-lowest border-outline-variant/40 hover:border-nexora-pink/50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-nexora-pink border-nexora-pink text-white'
                            : 'border-on-surface-variant/50 bg-surface text-transparent'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[13px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-medium text-[14px] text-on-surface">{srv.name}</h4>
                          {srv.popular && (
                            <span className="bg-warning-amber/15 text-warning-amber text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">{srv.description}</p>
                        <span className="text-[11px] text-on-surface-variant mt-1 inline-block">
                          ⏱ {srv.duration} mins
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-[15px] text-primary">₹{srv.discountPrice || srv.price}</span>
                          {srv.discountPrice && (
                            <span className="text-[11px] line-through text-on-surface-variant block">₹{srv.price}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {onToggleSaveService && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleSaveService(salon.id, srv.id);
                              }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                savedServiceIds.includes(srv.id)
                                  ? 'bg-nexora-pink/10 text-nexora-pink'
                                  : 'bg-surface-container text-on-surface-variant hover:text-nexora-pink'
                              }`}
                              title={savedServiceIds.includes(srv.id) ? 'Remove saved service' : 'Save service'}
                            >
                              <span className={`material-symbols-outlined text-[16px] ${savedServiceIds.includes(srv.id) ? 'fill-1' : ''}`}>
                                bookmark
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`toggle-service-${srv.id}`}
                            aria-label={
                              isSelected ? `Remove ${srv.name} from appointment` : `Add ${srv.name} to appointment`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleService(srv);
                            }}
                            className={`px-3 py-1 text-[12px] font-semibold rounded-lg transition-colors shadow-xs border ${
                              isSelected
                                ? 'bg-nexora-pink/10 text-nexora-pink border-nexora-pink/40 hover:bg-nexora-pink/15'
                                : 'bg-primary text-white border-primary hover:bg-nexora-pink'
                            }`}
                          >
                            {isSelected ? 'Added' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              bookSelection(srv);
                            }}
                            className="px-3 py-1 bg-surface-container text-nexora-pink text-[12px] font-semibold rounded-lg border border-outline-variant/60 hover:border-nexora-pink transition-colors"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ======================= TAB 3: REVIEWS & RATINGS ======================= */}
          {activeTab === 'reviews' && (
            <div className="flex flex-col gap-5">
              {/* Success Notification */}
              {submitSuccessMessage && (
                <div className="p-3 rounded-xl bg-success-emerald/10 border border-success-emerald/30 text-success-emerald text-[13px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{submitSuccessMessage}</span>
                </div>
              )}

              {/* 1. Star-Rating Summary Card */}
              <div 
                id="rating-summary-card"
                className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Big Rating Score */}
                  <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 min-w-[130px] shrink-0 text-center w-full sm:w-auto">
                    <span className="font-card-title text-[36px] font-extrabold text-on-surface leading-none">
                      {salon.rating}
                    </span>
                    <div className="flex items-center text-warning-amber my-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`material-symbols-outlined text-[18px] ${
                            star <= Math.round(salon.rating) ? 'fill-1 text-warning-amber' : 'text-outline-variant'
                          }`}
                        >
                          star
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      Based on {salon.reviewCount || allReviews.length} reviews
                    </span>
                    <span className="mt-1 text-[10px] text-success-emerald font-bold bg-success-emerald/10 px-2 py-0.5 rounded-full">
                      98% Recommend
                    </span>
                  </div>

                  {/* Rating Distribution Breakdown Bars */}
                  <div className="flex-1 w-full flex flex-col justify-center gap-1.5">
                    {ratingDistribution.map((item) => (
                      <button
                        key={item.stars}
                        onClick={() => setReviewFilterRating(reviewFilterRating === item.stars ? 'all' : item.stars)}
                        className={`flex items-center gap-2 text-[12px] group text-left p-0.5 rounded-md transition-colors ${
                          reviewFilterRating === item.stars ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span className="w-6 shrink-0 flex items-center gap-0.5 text-[11px] font-semibold">
                          {item.stars} <span className="material-symbols-outlined text-[12px] text-warning-amber fill-1">star</span>
                        </span>
                        <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              reviewFilterRating === item.stars ? 'bg-primary' : 'bg-warning-amber'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-on-surface-variant w-10 text-right shrink-0">
                          {item.percentage}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating Quality Category Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/30 text-center">
                  <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Cleanliness</span>
                    <span className="text-[13px] font-bold text-on-surface flex items-center justify-center gap-0.5 mt-0.5">
                      4.9 <span className="material-symbols-outlined text-[13px] text-warning-amber fill-1">star</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Staff Skill</span>
                    <span className="text-[13px] font-bold text-on-surface flex items-center justify-center gap-0.5 mt-0.5">
                      4.9 <span className="material-symbols-outlined text-[13px] text-warning-amber fill-1">star</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Value</span>
                    <span className="text-[13px] font-bold text-on-surface flex items-center justify-center gap-0.5 mt-0.5">
                      4.8 <span className="material-symbols-outlined text-[13px] text-warning-amber fill-1">star</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Ambience</span>
                    <span className="text-[13px] font-bold text-on-surface flex items-center justify-center gap-0.5 mt-0.5">
                      4.9 <span className="material-symbols-outlined text-[13px] text-warning-amber fill-1">star</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Submit Review CTA Button / Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-section-heading text-[15px] text-on-surface">Client Feedback</h3>
                  <p className="text-[11px] text-on-surface-variant">Real experiences from verified appointments</p>
                </div>
                <button
                  id="write-review-toggle-btn"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-nexora-pink transition-colors shadow-xs shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showReviewForm ? 'close' : 'rate_review'}
                  </span>
                  <span>{showReviewForm ? 'Cancel' : 'Write a Review'}</span>
                </button>
              </div>

              {/* Interactive Review Composer Form */}
              {showReviewForm && (
                <form
                  id="salon-review-form"
                  onSubmit={handleSubmitReview}
                  className="p-4 rounded-2xl bg-surface-container-lowest border-2 border-primary/30 flex flex-col gap-3.5 shadow-sm animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-card-title text-[14px] font-bold text-on-surface">Submit Your Review</h4>
                    <span className="text-[11px] text-on-surface-variant">Verified Client</span>
                  </div>

                  {/* Interactive Star Rating Selector */}
                  <div>
                    <label className="text-[12px] font-semibold text-on-surface block mb-1">
                      Your Rating <span className="text-nexora-pink">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 text-warning-amber transition-transform hover:scale-110"
                            aria-label={`${star} star`}
                          >
                            <span
                              className={`material-symbols-outlined text-[26px] ${
                                star <= (hoverRating || reviewRating) ? 'fill-1' : 'text-outline-variant'
                              }`}
                            >
                              star
                            </span>
                          </button>
                        ))}
                      </div>
                      <span className="text-[12px] font-bold text-primary">
                        {getRatingLabel(hoverRating || reviewRating)}
                      </span>
                    </div>
                  </div>

                  {/* Reviewer Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface block mb-1">Your Name</label>
                      <input
                        id="review-name-input"
                        type="text"
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-3 py-2 text-[12px] rounded-lg bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none"
                      />
                    </div>

                    {/* Service Experienced */}
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface block mb-1">Service Experienced</label>
                      <select
                        id="review-service-select"
                        value={reviewService}
                        onChange={(e) => setReviewService(e.target.value)}
                        className="w-full px-3 py-2 text-[12px] rounded-lg bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none"
                      >
                        <option value="">Select Service (Optional)</option>
                        {salon.services.map((srv) => (
                          <option key={srv.id} value={srv.name}>{srv.name} (₹{srv.discountPrice || srv.price})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stylist Visited */}
                  {salon.stylists?.length > 0 && (
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface block mb-1">Stylist / Specialist Visited</label>
                      <select
                        id="review-stylist-select"
                        value={reviewStylist}
                        onChange={(e) => setReviewStylist(e.target.value)}
                        className="w-full px-3 py-2 text-[12px] rounded-lg bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none"
                      >
                        <option value="">Select Stylist (Optional)</option>
                        {salon.stylists.map((st) => (
                          <option key={st.id} value={st.name}>{st.name} - {st.role}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Quick Compliment Pills */}
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-1.5">
                      Quick Highlights (Tap to attach)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {quickCompliments.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${
                            selectedTags.includes(tag)
                              ? 'bg-primary text-white font-semibold'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment Textarea */}
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface block mb-1">
                      Your Feedback <span className="text-nexora-pink">*</span>
                    </label>
                    <textarea
                      id="review-comment-textarea"
                      required
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your honest experience about the haircut, hygiene, staff courtesy, ambience, or duration..."
                      className="w-full px-3 py-2 text-[12px] rounded-lg bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="px-3 py-1.5 text-[12px] text-on-surface-variant hover:text-on-surface"
                    >
                      Cancel
                    </button>
                    <button
                      id="review-submit-btn"
                      type="submit"
                      disabled={!reviewComment.trim()}
                      className="px-4 py-2 bg-primary text-white text-[12px] font-semibold rounded-lg hover:bg-nexora-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Submit Review</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 3. Review Filter & Sort Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                {/* Search in reviews */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    placeholder="Search reviews (e.g. hair spa, fade, clean)..."
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-xl bg-surface-container-low border border-outline-variant/40 focus:border-primary focus:outline-none"
                  />
                  {reviewSearch && (
                    <button
                      onClick={() => setReviewSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[14px]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Star Filter & Sort Controls */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <select
                    value={reviewFilterRating}
                    onChange={(e) => setReviewFilterRating(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-xl bg-surface-container-low border border-outline-variant/40 focus:outline-none text-on-surface"
                  >
                    <option value="all">All Stars</option>
                    <option value="5">5 Stars only</option>
                    <option value="4">4 Stars only</option>
                    <option value="3">3 Stars only</option>
                  </select>

                  <select
                    value={reviewSort}
                    onChange={(e) => setReviewSort(e.target.value as any)}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-xl bg-surface-container-low border border-outline-variant/40 focus:outline-none text-on-surface"
                  >
                    <option value="newest">Most Recent</option>
                    <option value="highest">Highest Rating</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>

              {/* Active Filter Chips */}
              {reviewFilterRating !== 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant">Filtering by:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {reviewFilterRating} Stars
                    <button onClick={() => setReviewFilterRating('all')} className="hover:opacity-75">✕</button>
                  </span>
                </div>
              )}

              {/* 4. User Feedback Reviews List */}
              <div className="flex flex-col gap-3">
                {displayReviews.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant mb-1">rate_review</span>
                    <p className="font-semibold text-[13px] text-on-surface">No reviews matched your filter</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">Try resetting filters or write the first review!</p>
                    <button
                      onClick={() => { setReviewFilterRating('all'); setReviewSearch(''); }}
                      className="mt-3 px-3 py-1 text-[11px] font-semibold bg-primary text-white rounded-lg"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  displayReviews.map((rev) => {
                    const votes = helpfulVotes[rev.id] || 0;
                    const hasVoted = userVoted[rev.id] || false;
                    return (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 flex flex-col gap-2 hover:border-outline-variant transition-colors"
                      >
                        {/* User Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={rev.userAvatar}
                              alt={rev.userName}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-outline-variant/40"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-semibold text-[13px] text-on-surface leading-tight">
                                  {rev.userName}
                                </h5>
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-success-emerald bg-success-emerald/10 px-1.5 py-0.2 rounded-full">
                                  <span className="material-symbols-outlined text-[10px]">verified</span>
                                  Verified Client
                                </span>
                              </div>
                              <span className="text-[10px] text-on-surface-variant">{rev.date}</span>
                            </div>
                          </div>

                          {/* Star Display */}
                          <div className="flex items-center text-warning-amber">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`material-symbols-outlined text-[14px] ${
                                  star <= rev.rating ? 'fill-1' : 'text-outline-variant/60'
                                }`}
                              >
                                star
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Service Tag */}
                        {rev.serviceUsed && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px] text-primary">spa</span>
                              Treatment: <strong className="text-on-surface font-semibold">{rev.serviceUsed}</strong>
                            </span>
                          </div>
                        )}

                        {/* Comment Body */}
                        <p className="text-[12px] text-on-surface leading-relaxed">{rev.comment}</p>

                        {/* Helpful & Action Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 text-[11px]">
                          <span className="text-on-surface-variant text-[10px]">
                            Was this review helpful?
                          </span>
                          <button
                            onClick={() => handleHelpfulClick(rev.id)}
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                              hasVoted
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">thumb_up</span>
                            <span>Helpful {votes > 0 && `(${votes})`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ======================= TAB 3: LOCATION & TEAM ======================= */}
          {activeTab === 'about' && (
            <div className="flex flex-col gap-5">
              {/* Visual Static Map Preview Relative to User */}
              <StaticMapPreview
                salon={salon}
                userLocation={userLocation}
              />

              {/* Stylists Team */}
              {salon.stylists?.length > 0 && (
                <div>
                  <h3 className="font-section-heading text-[15px] text-on-surface mb-2.5">
                    Styling Specialists & Barbers
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {salon.stylists.map((st) => (
                      <div
                        key={st.id}
                        className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 flex items-center gap-3"
                      >
                        <img
                          src={st.avatar}
                          alt={st.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-surface-container shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-card-title text-[13px] text-on-surface leading-tight font-bold truncate">
                            {st.name}
                          </h4>
                          <p className="text-[10px] text-on-surface-variant truncate">{st.role}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-bold text-warning-amber flex items-center gap-0.5">
                              ★ {st.rating}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">· {st.experience}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => bookSelection(undefined, st)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-surface-container text-nexora-pink rounded-lg hover:bg-primary hover:text-white transition-colors shrink-0"
                        >
                          Book
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amenities */}
              {salon.amenities?.length > 0 && (
                <div>
                  <h3 className="font-section-heading text-[15px] text-on-surface mb-2">Salon Amenities</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {salon.amenities.map((am) => (
                      <span
                        key={am}
                        className="px-3 py-2 rounded-xl bg-surface-container-low text-[11px] text-on-surface font-medium flex items-center gap-1.5 border border-outline-variant/30"
                      >
                        <span className="material-symbols-outlined text-[15px] text-success-emerald">check_circle</span>
                        {am}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Action — live multi-service cart */}
        <div className="sticky bottom-0 bg-surface/95 backdrop-blur-md p-4 border-t border-outline-variant/40 flex items-center gap-3 z-10">
          <div className="flex-1 min-w-0">
            {selectedServices.length > 0 ? (
              <div id="salon-detail-cart-summary">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-nexora-pink">
                    {selectedServices.length}{' '}
                    {selectedServices.length === 1 ? 'service' : 'services'} selected
                  </span>
                  <button
                    type="button"
                    id="salon-detail-clear-cart"
                    onClick={clearCart}
                    className="text-[10px] font-semibold text-on-surface-variant underline hover:text-nexora-pink"
                  >
                    Clear
                  </button>
                </div>
                <span className="font-bold text-[18px] text-primary">
                  {formatINR(cartTotals.subtotal)}
                </span>
                <span className="text-[11px] text-on-surface-variant ml-1.5">
                  · {cartTotals.durationMinutes} mins
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Starting from</span>
                <span className="font-bold text-[18px] text-primary">
                  {formatINR(
                    salon.services.reduce(
                      (min, srv) => Math.min(min, srv.discountPrice || srv.price || 0),
                      salon.services[0]?.discountPrice || salon.services[0]?.price || 399
                    )
                  )}
                </span>
              </div>
            )}
          </div>
          <button
            id="salon-detail-book-now-btn"
            onClick={() => bookSelection()}
            className="flex-2 py-3 px-6 bg-primary text-white font-button-text rounded-xl hover:bg-nexora-pink transition-colors shadow-md text-center whitespace-nowrap"
          >
            {selectedServices.length > 1
              ? `Book ${selectedServices.length} Services`
              : selectedServices.length === 1
                ? 'Book 1 Service'
                : 'Book Appointment'}
          </button>
        </div>
      </div>

    </div>
  );
};
