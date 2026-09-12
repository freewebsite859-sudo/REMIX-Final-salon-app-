import React, { useState, useEffect } from 'react';
import { SalonProfile, SalonOffer } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Sparkles, 
  Image as ImageIcon, 
  Calendar, 
  Tag, 
  Loader2, 
  Check, 
  Clock,
  X,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Share2
} from 'lucide-react';

interface OffersManagementProps {
  profile: SalonProfile;
  setProfile: React.Dispatch<React.SetStateAction<SalonProfile>>;
  primaryAccentColor?: string;
}

type AestheticStyle = 'luxury_gold' | 'minimalist_chic' | 'festive_glow' | 'botanical_zen' | 'modern_studio';

// Live Expiration Countdown Component
const OfferCountdownTimer: React.FC<{ startDate?: string; expiryDate?: string }> = ({ startDate, expiryDate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUpcoming, setIsUpcoming] = useState(false);

  useEffect(() => {
    if (!expiryDate) {
      setTimeLeft('No Expiry');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      
      // Check if start date is in the future
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        if (now < start) {
          const diffStart = start.getTime() - now.getTime();
          const startDays = Math.ceil(diffStart / (1000 * 60 * 60 * 24));
          setTimeLeft(`Starts in ${startDays}d`);
          setIsUpcoming(true);
          return;
        }
      }

      setIsUpcoming(false);
      const end = new Date(expiryDate + 'T23:59:59');
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // update every 30 seconds
    return () => clearInterval(interval);
  }, [startDate, expiryDate]);

  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold tracking-tight ${
      isExpired 
        ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100/55' 
        : isUpcoming 
        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100/55'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/55'
    }`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{timeLeft}</span>
    </div>
  );
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

export const OffersManagement: React.FC<OffersManagementProps> = ({
  profile,
  setProfile,
  primaryAccentColor = '#1e293b'
}) => {
  const [editingOffer, setEditingOffer] = useState<SalonOffer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [terms, setTerms] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // AI Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<AestheticStyle>('luxury_gold');
  const [aiError, setAiError] = useState<string | null>(null);

  // Social Sharing State & Action
  const [shareCopied, setShareCopied] = useState(false);
  const handleShareCampaign = async () => {
    const promoText = `✨ Special Promo Offer from ${profile.businessName || 'our salon'}! ✨\n\n🎁 ${title || 'Special Promotion'}\n🔥 Discount: ${discountValue || 'Limited offer'}\n🎟️ Coupon Code: ${code || 'WELCOME'}\n📅 Validity: ${formatDate(startDate)} - ${formatDate(expiryDate)}\n\nBook your slot now at: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Special Promo Offer',
          text: promoText,
          url: window.location.origin,
        });
      } catch (err) {
        console.log('Share failed or was cancelled, falling back to clipboard:', err);
        navigator.clipboard.writeText(promoText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } else {
      navigator.clipboard.writeText(promoText);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const offers = profile.offers || [];

  const handleOpenAddForm = () => {
    setIsAddingNew(true);
    setEditingOffer(null);
    setTitle('');
    setCode('');
    setDiscountValue('');
    setDescription('');
    setStartDate(new Date().toISOString().split('T')[0]); // Default to today
    setExpiryDate('');
    setTerms('');
    setImageUrl('');
    setIsActive(true);
    setAiPrompt('');
    setAiError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (offer: SalonOffer) => {
    setIsAddingNew(false);
    setEditingOffer(offer);
    setTitle(offer.title);
    setCode(offer.code);
    setDiscountValue(offer.discountValue);
    setDescription(offer.description);
    setStartDate(offer.startDate || '');
    setExpiryDate(offer.expiryDate || '');
    setTerms(offer.terms || '');
    setImageUrl(offer.imageUrl || '');
    setIsActive(offer.isActive !== false);
    setAiPrompt('');
    setAiError(null);
    setIsFormOpen(true);
  };

  const handleDeleteOffer = (id: string) => {
    const updated = offers.filter(o => o.id !== id);
    setProfile(prev => ({
      ...prev,
      offers: updated
    }));
  };

  // Triggers AI Image generation using Imagen by building a customized prompt based on Title & Description
  const handleGenerateAIImage = async (useOfferDetails: boolean = false) => {
    let promptToUse = aiPrompt;

    if (useOfferDetails) {
      if (!title.trim() && !description.trim()) {
        setAiError('Please enter a Campaign Title or Description first to generate a banner from it.');
        return;
      }
      
      let synthesized = `A luxury commercial promotional banner artwork for "${title}".`;
      if (description) {
        synthesized += ` Highlighting: ${description}.`;
      }
      synthesized += ` Premium spa materials, high-end editorial cosmetics placement, atmospheric depth, soft shadows.`;
      
      setAiPrompt(synthesized);
      promptToUse = synthesized;
    } else {
      if (!promptToUse.trim()) {
        setAiError('Please describe the visual style/prompt or use the "Generate from Details" trigger.');
        return;
      }
    }

    setIsGenerating(true);
    setAiError(null);

    const styleDescriptions: Record<AestheticStyle, string> = {
      luxury_gold: 'High-end editorial beauty photoshoot, golden hour warm lighting, gold leaf accents, ultra-luxurious spa aesthetic',
      minimalist_chic: 'Clean minimalist salon space, soft neutral tones, high key lighting, crisp details',
      festive_glow: 'Vibrant celebratory aesthetic, warm golden bokeh lights, marigold tones, radiant celebratory glow',
      botanical_zen: 'Serene botanical spa, lush green leaves, essential oil mist, natural stones and bamboo textures',
      modern_studio: 'Contemporary sleek beauty studio, soft neon edge highlights, crisp fashion magazine editorial look',
    };

    const finalPrompt = `An ultra-high resolution, professional commercial promotional graphic background without any text overlays, labels, or watermarks. Subject: ${promptToUse}. Vibe style: ${styleDescriptions[selectedStyle]}. Intricate details, extreme realism, stunning aesthetic.`;

    try {
      const response = await fetch('/api/generate-promo-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          serviceName: title || 'Premium Salon Styling',
          category: profile.businessType || 'Beauty Salon',
          style: selectedStyle,
          aspectRatio: '4:3',
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setImageUrl(data.imageUrl);
      } else {
        throw new Error(data.fallbackNotice || 'Gemini Imagen API returned fallback image on generation.');
      }
    } catch (err: any) {
      console.error('AI generation failed:', err);
      setAiError(err?.message || 'Unable to generate image. Please verify your API key settings or try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !code || !discountValue) return;

    const offerData: SalonOffer = {
      id: isAddingNew ? `off-${Date.now()}` : (editingOffer?.id || ''),
      title,
      code: code.toUpperCase().trim(),
      discountValue,
      description,
      startDate: startDate || new Date().toISOString().split('T')[0],
      expiryDate,
      terms,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=400&q=80',
      isActive
    };

    let updatedOffers = [];
    if (isAddingNew) {
      updatedOffers = [...offers, offerData];
    } else {
      updatedOffers = offers.map(o => o.id === offerData.id ? offerData : o);
    }

    setProfile(prev => ({
      ...prev,
      offers: updatedOffers
    }));

    setIsFormOpen(false);
    setEditingOffer(null);
  };

  return (
    <div id="offers-management-dashboard" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600 shrink-0" />
            <h3 className="font-display font-black text-xl text-slate-900">
              Dynamic Offers & Discounts Studio
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create, update and manage live promotional discount coupon cards appearing on all website templates.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddForm}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Offer</span>
        </button>
      </div>

      {/* Grid of Existing Offers */}
      {offers.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center">
          <Tag className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-600">No active promotional campaigns yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Launch your first coupon offer with custom discount codes to drive customer loyalty and bookings!
          </p>
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="mt-4 px-3.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
          >
            Create Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {offers.map((offer) => (
            <div 
              key={offer.id}
              className={`rounded-xl border p-4 flex gap-4 bg-slate-50/30 transition-all hover:shadow-xs relative ${
                offer.isActive === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 relative bg-slate-100 border border-slate-200">
                <img 
                  src={offer.imageUrl} 
                  alt={offer.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-1 right-1 text-[8px] bg-red-500 text-white font-black px-1 py-0.5 rounded shadow-sm">
                  {offer.discountValue}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-900 truncate" title={offer.title}>
                      {offer.title}
                    </h4>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      offer.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {offer.isActive !== false ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {offer.description || 'No description provided.'}
                  </p>

                  {/* Validity & Live Countdown */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <OfferCountdownTimer startDate={offer.startDate} expiryDate={offer.expiryDate} />
                    <div className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/50">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatDate(offer.startDate)} - {formatDate(offer.expiryDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                  <div className="font-mono text-xs font-bold text-indigo-600 tracking-wider">
                    CODE: <span className="font-black bg-indigo-50 px-1.5 py-0.5 rounded">{offer.code}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(offer)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Edit Offer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Offer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pop-up Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-display font-black text-lg text-slate-900 flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-indigo-600" />
                <span>{isAddingNew ? 'Create Promotional Campaign' : 'Edit Campaign Details'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOffer} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Form Fields */}
                <div className="flex flex-col gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Campaign / Offer Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Monsoon Makeover, Festive Glow"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Coupon Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. MONSOON20"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white uppercase font-mono tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Discount Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="e.g. 20% OFF, Flat ₹500"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Offer Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what services are included and the value proposition..."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* Start & End Dates Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Start Date</span>
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>Expiry Date</span>
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Campaign Status
                      </label>
                      <select
                        value={isActive ? 'active' : 'paused'}
                        onChange={(e) => setIsActive(e.target.value === 'active')}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      >
                        <option value="active">Active & Visible</option>
                        <option value="paused">Paused / Draft</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Terms & Conditions
                      </label>
                      <input
                        type="text"
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        placeholder="e.g. Valid on services above ₹3000 only."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Promo Graphic Image URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Paste Unsplash URL or generate dynamically using Gemini below..."
                        className="w-full text-xs p-2.5 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-mono"
                      />
                      <ImageIcon className="absolute right-2.5 top-3 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Graphic Studio with Imagen Trigger */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
                      <Sparkles className="w-4 h-4 animate-pulse text-indigo-600" />
                      <h5 className="text-xs font-black font-mono-caps uppercase tracking-wide">
                        Imagen AI Promotional Studio
                      </h5>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Use Imagen AI to automatically create studio backgrounds and professional artworks matching your specific offer details or descriptions.
                    </p>

                    <div className="mt-4 flex flex-col gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600">
                            AI Visual Prompt Description
                          </label>
                          <button
                            type="button"
                            onClick={() => handleGenerateAIImage(true)}
                            disabled={isGenerating || (!title.trim() && !description.trim())}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Instantly generate prompt & trigger image creation from current campaign text"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Generate from Offer Info</span>
                          </button>
                        </div>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="e.g. Luxurious spa setup with burning aromatic candles, orchids, wet therapy stones with dynamic atmospheric vapor"
                          rows={3}
                          className="w-full text-[11px] p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Select Banner Vibe Aesthetic
                        </label>
                        <select
                          value={selectedStyle}
                          onChange={(e) => setSelectedStyle(e.target.value as AestheticStyle)}
                          className="w-full text-[11px] p-2.5 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value="luxury_gold">Luxury Gold (Warm glow & gold leaf)</option>
                          <option value="minimalist_chic">Minimalist Chic (Scandinavian light & clean)</option>
                          <option value="festive_glow">Festive Glow (Celebratory bokeh & marigolds)</option>
                          <option value="botanical_zen">Botanical Zen (Spa stone, leaves, natural steam)</option>
                          <option value="modern_studio">Modern Studio (Contemporary neon highlights & edge-glow)</option>
                        </select>
                      </div>

                      {aiError && (
                        <div className="text-[10px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100/50 font-medium flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          <span>{aiError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleGenerateAIImage(false)}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Gemini is generating banner...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate from Custom Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE INTERACTIVE PREVIEW CARD SECTION (Spanning full width at the bottom) */}
              <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-5">
                <div className="flex items-center gap-1.5 text-slate-800 mb-3">
                  <span className="material-symbols-outlined text-base">visibility</span>
                  <h5 className="text-xs font-black uppercase tracking-wider font-display">
                    Interactive Live Website Coupon Preview
                  </h5>
                </div>

                <div className="p-1 rounded-2xl bg-gradient-to-r from-indigo-50 to-slate-50 border border-slate-200/60">
                  <div className="bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200 flex flex-col sm:flex-row relative">
                    {/* Image / Graphic Display */}
                    <div className="w-full sm:w-1/3 h-36 sm:h-auto relative shrink-0 bg-slate-100 border-r border-slate-200">
                      <img 
                        src={imageUrl || 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=400&q=80'} 
                        alt="Campaign graphic" 
                        className="w-full h-full object-cover transition-all duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-red-500 text-white font-black px-2 py-0.5 rounded-md text-[10px] tracking-wide shadow-xs uppercase">
                        {discountValue || 'PROMO'}
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {/* Live Expiration Countdown */}
                          <OfferCountdownTimer startDate={startDate} expiryDate={expiryDate} />
                          
                          {/* Validity Badge next to Countdown Timer */}
                          <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-indigo-100">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            <span>Validity: {formatDate(startDate) || 'Now'} - {formatDate(expiryDate) || 'Always'}</span>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                          {title || 'Untitled Campaign'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {description || 'Please enter a campaign description to preview it on your card.'}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-dashed border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">COUPON CODE</div>
                          <div className="font-mono font-black text-sm text-emerald-600 tracking-widest uppercase">
                            {code || 'DRAFT20'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleShareCampaign}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                              shareCopied 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/40'
                            }`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{shareCopied ? 'Promo Copied! ✨' : 'Share Promo'}</span>
                          </button>

                          <button
                            type="button"
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(code || 'DRAFT20');
                            }}
                          >
                            Copy Code
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Left & Right slitted aesthetic circles */}
                    <div className="hidden sm:block absolute left-[33.33%] top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-50 border-r border-slate-200 z-10" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title || !code || !discountValue}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  <span>{isAddingNew ? 'Save and Publish Offer' : 'Update Offer Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
