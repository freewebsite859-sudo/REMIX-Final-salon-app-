import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment, UserProfile } from '../types.ts';
import {
  canReviewBooking,
  getCompletedAppointmentsForReview,
  loadCustomerReviews,
  saveCustomerReviews,
  loadLiveReviews,
  saveReviewLive,
  type CustomerReview,
} from '../lib/reviewsService.ts';
import { isLiveCustomerDataEnabled } from '../lib/supabase';

interface ReviewsPageProps {
  user: UserProfile;
  appointments: Appointment[];
  userId?: string | null;
  onBack?: () => void;
  onNavigateToBooking?: () => void;
  onExploreSalons?: () => void;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({
  user,
  appointments = [],
  userId,
  onBack,
  onNavigateToBooking,
  onExploreSalons,
}) => {
  // Customer submitted reviews state — live Supabase rows when configured,
  // local preview store otherwise.
  const [reviews, setReviews] = useState<CustomerReview[]>(() =>
    isLiveCustomerDataEnabled && userId ? [] : loadCustomerReviews(user.email || user.phone)
  );
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');

  const refreshReviews = async () => {
    if (isLiveCustomerDataEnabled && userId) {
      const live = await loadLiveReviews(userId);
      setReviews(live);
    } else {
      setReviews(loadCustomerReviews(user.email || user.phone));
    }
  };

  useEffect(() => {
    void refreshReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user.email]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Review Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [salonRating, setSalonRating] = useState<number>(5);
  const [staffRating, setStaffRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter completed appointments eligible for review
  const eligibleAppointments = useMemo(
    () => getCompletedAppointmentsForReview(appointments, reviews),
    [appointments, reviews]
  );

  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === selectedBookingId),
    [appointments, selectedBookingId]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  const handleOpenForm = (bookingId?: string) => {
    setFormError(null);
    if (bookingId) {
      const apt = appointments.find((a) => a.id === bookingId);
      if (apt) {
        const check = canReviewBooking(apt);
        if (!check.eligible) {
          showToast(check.reason || 'Review allowed only after completed booking.');
          return;
        }
        setSelectedBookingId(bookingId);
      }
    } else {
      if (eligibleAppointments.length > 0) {
        setSelectedBookingId(eligibleAppointments[0].id);
      } else {
        setSelectedBookingId('');
      }
    }
    setSalonRating(5);
    setStaffRating(5);
    setReviewComment('');
    setPhotoPreview(null);
    setIsFormOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setFormError('Photo must be less than 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedBookingId) {
      setFormError('Please select a completed appointment to review.');
      return;
    }

    const targetApt = appointments.find((a) => a.id === selectedBookingId);
    if (!targetApt) {
      setFormError('Selected appointment not found.');
      return;
    }

    const validation = canReviewBooking(targetApt);
    if (!validation.eligible) {
      setFormError(validation.reason || 'Review allowed only after completed booking.');
      return;
    }

    if (!reviewComment.trim() || reviewComment.trim().length < 5) {
      setFormError('Please write a review of at least 5 characters.');
      return;
    }

    const newReview: CustomerReview = {
      id: `rev-${Date.now()}`,
      bookingId: targetApt.id,
      salonId: targetApt.salonId,
      salonName: targetApt.salonName,
      salonAddress: targetApt.salonAddress,
      salonImage: targetApt.salonImage,
      salonRating,
      staffName: targetApt.stylist?.name || 'Stylist Team',
      staffAvatar: targetApt.stylist?.avatar,
      staffRole: targetApt.stylist?.role || 'Staff Professional',
      staffRating,
      comment: reviewComment.trim(),
      photoUrl: photoPreview || undefined,
      serviceName: targetApt.services.map((s) => s.name).join(', ') || 'Salon Service',
      date: 'Today',
      createdAt: new Date().toISOString(),
      userName: user.name || 'Nexora Customer',
      userAvatar: user.avatar || '',
      verifiedBooking: true,
    };

    if (isLiveCustomerDataEnabled && userId) {
      const { error } = await saveReviewLive(userId, newReview);
      if (error) {
        setFormError(error);
        return;
      }
      await refreshReviews();
    } else {
      const updated = [newReview, ...reviews];
      setReviews(updated);
      saveCustomerReviews(updated, user.email || user.phone);
    }
    setIsFormOpen(false);
    showToast('Review submitted successfully!');
  };

  const filteredReviews = useMemo(() => {
    if (filterRating === 'all') return reviews;
    return reviews.filter((r) => r.salonRating === filterRating);
  }, [reviews, filterRating]);

  return (
    <div
      id="customer-reviews-page"
      data-route="/customer/reviews"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-2"
    >
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 px-4 bg-surface-container-highest/95 backdrop-blur-md text-on-surface rounded-2xl shadow-xl border border-[#b00055]/30 flex items-center gap-2.5 text-[13px] font-semibold">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              id="btn-reviews-back"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shadow-xs transition-colors"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div>
            <h1 className="text-[24px] font-extrabold text-on-surface tracking-tight">My Reviews & Ratings</h1>
            <p className="text-[12px] text-on-surface-variant">Rate salons & stylists from your completed visits</p>
          </div>
        </div>

        {/* Add Review Button */}
        <button
          type="button"
          id="btn-open-review-form"
          onClick={() => handleOpenForm()}
          className="px-4 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px]">rate_review</span>
          <span>Write Review</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* REVIEW RULE NOTICE BANNER                                                 */}
      {/* ========================================================================= */}
      <div
        id="section-reviews-rule-banner"
        className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 mb-4 flex items-center gap-3 text-[12px] text-on-surface"
      >
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0">verified</span>
        <div>
          <span className="font-bold block">Verified Reviews Policy</span>
          <span className="text-on-surface-variant">
            Reviews are allowed <strong>only after a completed booking</strong> to guarantee authentic customer feedback for partner salons and stylists.
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ELIGIBLE UNREVIEWED COMPLETED BOOKINGS BANNER                             */}
      {/* ========================================================================= */}
      {eligibleAppointments.length > 0 && (
        <section
          id="section-eligible-completed-bookings"
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 mb-5"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-800">task_alt</span>
              <h2 className="text-[14px] font-extrabold text-emerald-950">
                Completed Visits Ready for Review ({eligibleAppointments.length})
              </h2>
            </div>
          </div>

          <div className="space-y-2">
            {eligibleAppointments.map((apt) => (
              <div
                key={apt.id}
                className="p-3 rounded-2xl bg-surface-container-lowest border border-emerald-500/20 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-on-surface truncate">{apt.salonName}</h3>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {apt.services.map((s) => s.name).join(', ')} · Stylist: {apt.stylist?.name || 'Salon Staff'} · {apt.date}
                  </p>
                </div>
                <button
                  type="button"
                  id={`btn-review-completed-apt-${apt.id}`}
                  onClick={() => handleOpenForm(apt.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-800 text-white text-[12px] font-bold hover:bg-emerald-900 transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">star</span>
                  <span>Rate Visit</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUBMITTED REVIEWS SECTION                                                 */}
      {/* ========================================================================= */}
      <section id="section-submitted-reviews" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">reviews</span>
            <h2 className="text-[16px] font-bold text-on-surface">Submitted Reviews ({reviews.length})</h2>
          </div>

          {/* Rating filter */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-on-surface-variant font-medium mr-1">Filter:</span>
            {(['all', 5, 4, 3] as const).map((r) => (
              <button
                key={String(r)}
                type="button"
                id={`filter-rating-${r}`}
                onClick={() => setFilterRating(r)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                  filterRating === r
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {r === 'all' ? 'All' : `★ ${r}`}
              </button>
            ))}
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-3.5">
          {filteredReviews.map((rev) => (
            <article
              key={rev.id}
              className="p-4 sm:p-5 rounded-3xl bg-surface-container-low border border-outline-variant/50 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant/40">
                    <img
                      src={rev.salonImage || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=120&q=80'}
                      alt={rev.salonName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="review-salon-name text-[15px] font-extrabold text-on-surface">{rev.salonName}</h3>
                    <p className="text-[11px] text-on-surface-variant">{rev.salonAddress} · {rev.serviceName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-amber-800">star</span>
                  <span className="review-salon-rating text-[13px] font-extrabold text-amber-900">{rev.salonRating}.0</span>
                </div>
              </div>

              {/* Staff rating badge if present */}
              {rev.staffName && (
                <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-[12px]">
                  <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                  <span className="text-on-surface font-semibold">
                    Stylist: <span className="font-bold">{rev.staffName}</span> ({rev.staffRole || 'Stylist'})
                  </span>
                  <div className="review-staff-rating flex items-center gap-0.5 ml-auto text-amber-800 font-bold">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    <span>{rev.staffRating}.0</span>
                  </div>
                </div>
              )}

              {/* Review Text */}
              <p className="review-comment text-[13px] text-on-surface leading-relaxed">{rev.comment}</p>

              {/* Uploaded Review Photo */}
              {rev.photoUrl && (
                <div className="pt-1">
                  <img
                    src={rev.photoUrl}
                    alt="Customer review photo"
                    className="review-photo w-32 h-32 rounded-2xl object-cover border border-outline-variant/50 shadow-xs hover:scale-105 transition-transform"
                  />
                </div>
              )}

              {/* Footer info */}
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant/30">
                <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  <span>Verified Completed Booking</span>
                </span>
                <span>Reviewed on {rev.date}</span>
              </div>
            </article>
          ))}

          {filteredReviews.length === 0 && (
            <div className="text-center py-12 rounded-3xl bg-surface-container-low border border-outline-variant/50 p-6">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant opacity-40 mb-2">rate_review</span>
              <h3 className="text-[16px] font-bold text-on-surface">No reviews submitted yet</h3>
              <p className="text-[12px] text-on-surface-variant mt-1 mb-4 max-w-md mx-auto">
                After completing an appointment at a partner salon, you can rate your experience and stylist here.
              </p>
              {onExploreSalons && (
                <button
                  type="button"
                  onClick={onExploreSalons}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold cursor-pointer"
                >
                  Explore Partner Salons
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* WRITE REVIEW MODAL                                                        */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div
          id="modal-write-review"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-surface-container-highest border border-outline-variant/50 rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">rate_review</span>
                </div>
                <div>
                  <h3 className="text-[18px] font-extrabold text-on-surface">Write a Review</h3>
                  <p className="text-[11px] text-on-surface-variant">Rate salon & staff for your completed visit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {formError && (
              <p className="text-[12px] text-rose-700 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 mb-3">
                {formError}
              </p>
            )}

            {/* If no completed appointments exist */}
            {eligibleAppointments.length === 0 && !selectedBookingId ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[36px] text-amber-700 mb-2">lock_clock</span>
                <p className="text-[13px] font-bold text-on-surface">No Completed Bookings Found</p>
                <p className="text-[12px] text-on-surface-variant mt-1 mb-4">
                  Review is allowed only after a completed booking. Please complete your appointment to leave a review.
                </p>
                {onNavigateToBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      onNavigateToBooking();
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold cursor-pointer"
                  >
                    View My Bookings
                  </button>
                )}
              </div>
            ) : (
              <form id="form-write-review" onSubmit={handleSubmitReview} className="space-y-4">
                {/* 1. Select Completed Booking */}
                <div>
                  <label htmlFor="select-review-booking" className="block text-[12px] font-semibold text-on-surface mb-1">
                    Select Completed Booking
                  </label>
                  <select
                    id="select-review-booking"
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary text-on-surface text-[13px] outline-hidden cursor-pointer"
                  >
                    {eligibleAppointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.salonName} ({apt.services.map((s) => s.name).join(', ')}) · {apt.date}
                      </option>
                    ))}
                    {selectedAppointment && !eligibleAppointments.some((a) => a.id === selectedAppointment.id) && (
                      <option value={selectedAppointment.id}>
                        {selectedAppointment.salonName} ({selectedAppointment.services.map((s) => s.name).join(', ')}) · {selectedAppointment.date}
                      </option>
                    )}
                  </select>
                </div>

                {/* 2. Rate Salon */}
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface mb-1">
                    Rate Salon
                  </label>
                  <div id="rating-salon-picker" className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container border border-outline-variant/40">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        id={`star-rating-salon-${star}`}
                        onClick={() => setSalonRating(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                        title={`${star} star`}
                      >
                        <span
                          className={`material-symbols-outlined text-[26px] ${
                            star <= salonRating ? 'text-amber-800' : 'text-outline-variant'
                          }`}
                        >
                          star
                        </span>
                      </button>
                    ))}
                    <span className="text-[13px] font-bold text-on-surface ml-2">{salonRating} / 5 Stars</span>
                  </div>
                </div>

                {/* 3. Rate Staff */}
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface mb-1">
                    Rate Staff / Stylist ({selectedAppointment?.stylist?.name || 'Staff Member'})
                  </label>
                  <div id="rating-staff-picker" className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container border border-outline-variant/40">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        id={`star-rating-staff-${star}`}
                        onClick={() => setStaffRating(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                        title={`${star} star`}
                      >
                        <span
                          className={`material-symbols-outlined text-[26px] ${
                            star <= staffRating ? 'text-amber-800' : 'text-outline-variant'
                          }`}
                        >
                          star
                        </span>
                      </button>
                    ))}
                    <span className="text-[13px] font-bold text-on-surface ml-2">{staffRating} / 5 Stars</span>
                  </div>
                </div>

                {/* 4. Upload Review Photo */}
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface mb-1">
                    Upload Review Photo <span className="text-[11px] text-on-surface-variant font-normal">(Optional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="input-review-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {photoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-24 h-24 rounded-2xl object-cover border border-primary/40 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoPreview(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-700 text-white flex items-center justify-center cursor-pointer shadow-md"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="btn-upload-review-photo"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-4 rounded-xl border border-dashed border-outline-variant/60 hover:border-primary/60 bg-surface-container text-on-surface text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">add_a_photo</span>
                      <span>Attach Salon Service Photo</span>
                    </button>
                  )}
                </div>

                {/* 5. Write Review Comment */}
                <div>
                  <label htmlFor="textarea-review-comment" className="block text-[12px] font-semibold text-on-surface mb-1">
                    Write Review
                  </label>
                  <textarea
                    id="textarea-review-comment"
                    rows={4}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience about service quality, hygiene, and stylist skill..."
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary text-on-surface text-[13px] outline-hidden resize-none"
                  />
                </div>

                {/* Submit & Cancel */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface text-[13px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-review"
                    onClick={(e) => {
                      handleSubmitReview(e);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-[13px] font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Submit Review
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
