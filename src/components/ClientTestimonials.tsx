import React, { useState, useEffect } from 'react';
import { Star, X, Check, Info } from 'lucide-react';
import { Testimonial } from '../templateData';

interface TestimonialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (testimonial: Testimonial) => void;
  editingTestimonial: Testimonial | null;
  defaultCity?: string;
  availableServices?: string[];
}

const TESTIMONIAL_PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', // Female 1
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', // Male 1
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', // Female 2
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', // Male 2
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', // Female 3
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'  // Male 3
];

export const TestimonialModal: React.FC<TestimonialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTestimonial,
  defaultCity = 'Bangalore',
  availableServices = [],
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [serviceName, setServiceName] = useState('');
  const [comment, setComment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(TESTIMONIAL_PRESET_AVATARS[0]);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [useCustomAvatar, setUseCustomAvatar] = useState(false);
  const [formError, setFormError] = useState('');

  // Synchronize fields when modal opens or editing testimonial changes
  useEffect(() => {
    if (isOpen) {
      if (editingTestimonial) {
        setName(editingTestimonial.name || '');
        setLocation(editingTestimonial.location || '');
        setRating(editingTestimonial.rating || 5);
        setServiceName(editingTestimonial.serviceName || '');
        setComment(editingTestimonial.comment || '');
        
        const isPreset = TESTIMONIAL_PRESET_AVATARS.includes(editingTestimonial.avatarUrl);
        if (isPreset) {
          setAvatarUrl(editingTestimonial.avatarUrl);
          setUseCustomAvatar(false);
          setCustomAvatarInput('');
        } else {
          setAvatarUrl(editingTestimonial.avatarUrl);
          setUseCustomAvatar(true);
          setCustomAvatarInput(editingTestimonial.avatarUrl || '');
        }
        setFormError('');
      } else {
        // Defaults for new testimonial
        setName('');
        setLocation(defaultCity);
        setRating(5);
        setServiceName(availableServices[0] || 'Signature Care');
        setComment('');
        setAvatarUrl(TESTIMONIAL_PRESET_AVATARS[Math.floor(Math.random() * TESTIMONIAL_PRESET_AVATARS.length)]);
        setCustomAvatarInput('');
        setUseCustomAvatar(false);
        setFormError('');
      }
    }
  }, [isOpen, editingTestimonial, defaultCity, availableServices]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Client name is required.');
      return;
    }
    if (!comment.trim()) {
      setFormError('Review comment cannot be empty.');
      return;
    }
    if (comment.length < 10) {
      setFormError('Please write a slightly longer review (at least 10 characters).');
      return;
    }

    const finalAvatar = useCustomAvatar ? (customAvatarInput.trim() || TESTIMONIAL_PRESET_AVATARS[0]) : avatarUrl;

    const saved: Testimonial = {
      id: editingTestimonial?.id || `rev-${Date.now()}`,
      name: name.trim(),
      location: location.trim() || defaultCity,
      rating: Number(rating),
      serviceName: serviceName.trim(),
      comment: comment.trim(),
      avatarUrl: finalAvatar,
      date: editingTestimonial?.date || new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
    };

    onSave(saved);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white border border-slate-150 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 my-auto relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950 text-base md:text-lg">
              {editingTestimonial ? 'Edit Featured Review' : 'Add Featured Client Review'}
            </h3>
            <p className="text-xs text-slate-400 font-medium">Manage testimonials featured on your website preview</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-start gap-2 animate-shake">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{formError}</span>
            </div>
          )}

          {/* Client Name & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Client Name <span className="text-rose-500">*</span></label>
              <input 
                type="text"
                placeholder="e.g. Priyanjali Sen"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 outline-hidden"
                maxLength={40}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Location</label>
              <input 
                type="text"
                placeholder="e.g. Indiranagar, Bangalore"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 outline-hidden"
                maxLength={30}
              />
            </div>
          </div>

          {/* Star Rating & Service Availed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Star Rating</label>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-0.5 hover:scale-110 transition-transform cursor-pointer focus:outline-hidden"
                  >
                    <Star 
                      className={`w-6 h-6 transition-all ${
                        star <= rating 
                          ? 'text-amber-400 fill-amber-400 drop-shadow-xs' 
                          : 'text-slate-200 hover:text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Service Availed</label>
              <input 
                type="text"
                placeholder="e.g. Premium Gel Manicure"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 outline-hidden"
                list="service-suggestions"
              />
              <datalist id="service-suggestions">
                {availableServices.map((srv, idx) => (
                  <option key={idx} value={srv} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Review Text */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Client Review / Comment <span className="text-rose-500">*</span></label>
            <textarea
              placeholder="e.g. Absolutely loved the service here! The staff was incredibly warm, and my nails look pristine. High level of hygiene maintained!"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (formError) setFormError('');
              }}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 outline-hidden resize-none"
              maxLength={300}
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>Write a genuine customer endorsement</span>
              <span>{comment.length}/300 chars</span>
            </div>
          </div>

          {/* Avatar Photo Selection */}
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">Client Avatar Photo</label>
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setUseCustomAvatar(false)}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${!useCustomAvatar ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Preset Avatars
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomAvatar(true)}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${useCustomAvatar ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Custom URL
                </button>
              </div>
            </div>

            {!useCustomAvatar ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 items-center bg-slate-50 p-2 rounded-xl border border-slate-100 overflow-x-auto w-full">
                  {TESTIMONIAL_PRESET_AVATARS.map((url, idx) => {
                    const isSelected = avatarUrl === url;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        className={`relative w-11 h-11 rounded-full overflow-hidden border-2 shrink-0 transition-transform hover:scale-105 cursor-pointer ${
                          isSelected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-transparent'
                        }`}
                      >
                        <img 
                          src={url} 
                          alt={`Preset avatar ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white font-bold" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input 
                  type="url"
                  placeholder="Paste Unsplash or web image URL..."
                  value={customAvatarInput}
                  onChange={(e) => setCustomAvatarInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500 outline-hidden"
                />
                <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                  {customAvatarInput.trim() ? (
                    <img 
                      src={customAvatarInput} 
                      alt="Custom client preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingTestimonial ? 'Update Review' : 'Add Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
