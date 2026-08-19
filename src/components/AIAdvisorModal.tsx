import React, { useState, useEffect } from 'react';
import {
  GroundingChunk,
  UserProfile,
  Salon,
  SalonService,
  AIStyleQuizResult,
  RecommendedServiceMatch,
  SalonSentimentSummary,
} from '../types';

interface AIAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentLocation: string;
  salons?: Salon[];
  onUpdateUser?: (updated: UserProfile) => void;
  onSelectSalon?: (salon: Salon) => void;
  onSelectSalonByName?: (name: string) => void;
  onBookService?: (salon: Salon, service: SalonService) => void;
  initialTab?: 'quiz' | 'chat' | 'sentiment';
  initialSalonId?: string;
}

const HAIR_TYPE_OPTIONS = [
  { id: 'Straight', label: 'Straight (Type 1)', desc: 'Sleek, glossy, easily lacks root volume', icon: 'line_style' },
  { id: 'Wavy', label: 'Wavy (Type 2)', desc: 'Soft "S" waves, versatile bounce & body', icon: 'waves' },
  { id: 'Curly', label: 'Curly (Type 3)', desc: 'Springy spirals, needs moisture & definition', icon: 'all_inclusive' },
  { id: 'Coily', label: 'Coily (Type 4)', desc: 'Tight zig-zag coils, delicate & dense texture', icon: 'blur_on' },
  { id: 'Fine / Thin', label: 'Fine / Thin', desc: 'Needs internal layers & weightless lift', icon: 'density_small' },
  { id: 'Thick / Coarse', label: 'Thick / Coarse', desc: 'Needs debulking & movement control', icon: 'density_large' },
];

const DESIRED_LENGTH_OPTIONS = [
  { id: 'Pixie / Ultra Short', label: 'Pixie / Crop', desc: 'High-fashion, sculpted contours', icon: 'content_cut' },
  { id: 'Bob / Chin-Length', label: 'Bob / Chin-Length', desc: 'Classic French or modern blunt lob', icon: 'face_3' },
  { id: 'Shoulder Length', label: 'Shoulder / Collarbone', desc: 'Versatile, effortless daily styling', icon: 'face_4' },
  { id: 'Mid-Back / Long', label: 'Mid-Back / Long', desc: 'Cascading layers & voluminous movement', icon: 'face_2' },
  { id: 'Extra Long', label: 'Extra Long & Flowing', desc: 'Luxurious length with polished tips', icon: 'auto_awesome' },
];

const FACE_SHAPE_OPTIONS = [
  {
    id: 'Oval',
    label: 'Oval Face',
    desc: 'Evenly balanced proportions; pairs with versatile cuts',
    tip: 'Curtain fringes and butterfly layers highlight cheekbones',
    icon: 'egg_alt',
  },
  {
    id: 'Round',
    label: 'Round Face',
    desc: 'Soft curved jawline & wider cheekbones',
    tip: 'Crown volume & diagonal layers elongate your silhouette',
    icon: 'circle',
  },
  {
    id: 'Square',
    label: 'Square Face',
    desc: 'Prominent, defined angular jawline',
    tip: 'Soft feathered layers & wispy fringes soften strong angles',
    icon: 'crop_square',
  },
  {
    id: 'Heart',
    label: 'Heart Face',
    desc: 'Wider forehead with delicate, tapered chin',
    tip: 'Chin-length bobs & lower volume balance proportions',
    icon: 'favorite',
  },
  {
    id: 'Diamond',
    label: 'Diamond Face',
    desc: 'High sculpted cheekbones & narrow jaw',
    tip: 'Side-swept bangs & collarbone layers highlight eyes',
    icon: 'diamond',
  },
  {
    id: 'Oblong',
    label: 'Oblong / Long',
    desc: 'Elongated face length with subtle curves',
    tip: 'Blunt bangs & horizontal fullness create width balance',
    icon: 'view_agenda',
  },
];

const STYLING_GOAL_OPTIONS = [
  { id: 'Volume & Movement', label: 'Volume & Movement', desc: 'Airy bounce without heavy stiffness' },
  { id: 'Frizz Defense & Shine', label: 'Frizz Defense & Sleek Shine', desc: 'Silky humidity-resistant finish' },
  { id: 'Low-Maintenance Wash & Go', label: 'Low-Maintenance Routine', desc: 'Easy 5-minute everyday styling' },
  { id: 'Balayage & Dimensional Color', label: 'Balayage & Depth', desc: 'Sun-kissed highlights & gloss shield' },
  { id: 'Scalp Detox & Hair Repair', label: 'Scalp & Hair Repair Spa', desc: 'Deep moisture & bond restoration' },
];

export const AIAdvisorModal: React.FC<AIAdvisorModalProps> = ({
  isOpen,
  onClose,
  user,
  currentLocation,
  salons = [],
  onUpdateUser,
  onSelectSalon,
  onSelectSalonByName,
  onBookService,
  initialTab = 'quiz',
  initialSalonId,
}) => {
  const [activeMode, setActiveMode] = useState<'quiz' | 'sentiment' | 'chat'>(initialTab);

  // Quiz Form State
  const [hairType, setHairType] = useState<string>(user.hairType || 'Wavy');
  const [desiredLength, setDesiredLength] = useState<string>(user.desiredLength || 'Shoulder Length');
  const [faceShape, setFaceShape] = useState<string>(user.faceShape || 'Oval');
  const [stylingGoal, setStylingGoal] = useState<string>(user.stylingGoal || 'Volume & Movement');
  const [saveToProfile, setSaveToProfile] = useState(true);

  // Quiz results
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizResult, setQuizResult] = useState<AIStyleQuizResult | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Sentiment State
  const [selectedSentimentSalonId, setSelectedSentimentSalonId] = useState<string>(
    initialSalonId || (salons.length > 0 ? salons[0].id : 'salon-1')
  );
  const [isSentimentLoading, setIsSentimentLoading] = useState(false);
  const [sentimentSummary, setSentimentSummary] = useState<SalonSentimentSummary | null>(null);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const [sentimentCache, setSentimentCache] = useState<Record<string, SalonSentimentSummary>>({});

  // Chat State
  const [promptInput, setPromptInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [responseMarkdown, setResponseMarkdown] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  // Sync state when props change
  useEffect(() => {
    if (user.hairType) setHairType(user.hairType);
    if (user.desiredLength) setDesiredLength(user.desiredLength);
    if (user.faceShape) setFaceShape(user.faceShape);
    if (user.stylingGoal) setStylingGoal(user.stylingGoal);
  }, [user]);

  useEffect(() => {
    if (initialTab) setActiveMode(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialSalonId) setSelectedSentimentSalonId(initialSalonId);
  }, [initialSalonId]);

  // Fetch Sentiment Summary for chosen salon
  const fetchSalonSentiment = async (targetSalonId: string) => {
    if (sentimentCache[targetSalonId]) {
      setSentimentSummary(sentimentCache[targetSalonId]);
      return;
    }

    const currentSalon = salons.find((s) => s.id === targetSalonId);
    if (!currentSalon) return;

    setIsSentimentLoading(true);
    setSentimentError(null);

    try {
      const res = await fetch('/api/salons/sentiment-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId: currentSalon.id,
          salonName: currentSalon.name,
          reviews: currentSalon.reviews || [],
          location: currentSalon.location || { area: currentLocation },
        }),
      });

      const data = await res.json();
      if (data.success && data.sentiment) {
        setSentimentSummary(data.sentiment);
        setSentimentCache((prev) => ({ ...prev, [targetSalonId]: data.sentiment }));
      } else {
        setSentimentError(data.error || 'Unable to generate sentiment summary.');
      }
    } catch (err) {
      console.error('Sentiment fetch error:', err);
      setSentimentError('Network error while analyzing salon reviews.');
    } finally {
      setIsSentimentLoading(false);
    }
  };

  // Auto-fetch sentiment when entering sentiment mode or switching salon
  useEffect(() => {
    if (activeMode === 'sentiment' && selectedSentimentSalonId) {
      fetchSalonSentiment(selectedSentimentSalonId);
    }
  }, [activeMode, selectedSentimentSalonId]);

  if (!isOpen) return null;

  const currentSentimentSalon = salons.find((s) => s.id === selectedSentimentSalonId) || salons[0];

  const samplePrompts = [
    '💇 Recommend top hair stylist in Mansarovar for modern fade & textured layers',
    '✨ Where can I get an authentic Hydra Facial Deluxe near me with high ratings?',
    '👰 Best salon in Jaipur for bridal makeup & pre-bridal skin package',
    '🌿 Which spa near me offers Swedish aromatherapy & deep tissue massage?',
  ];

  // Submit AI Style Quiz
  const handleRunStyleQuiz = async () => {
    setIsQuizLoading(true);
    setQuizError(null);

    if (saveToProfile && onUpdateUser) {
      onUpdateUser({
        ...user,
        hairType,
        desiredLength,
        faceShape,
        stylingGoal,
        hairProfile: `${hairType} · ${desiredLength}`,
      });
    }

    try {
      const res = await fetch('/api/salons/ai-style-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hairType,
          desiredLength,
          faceShape,
          stylingGoal,
          location: {
            area: currentLocation,
            latitude: 26.8533,
            longitude: 75.7681,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setQuizResult(data.result);
      } else {
        setQuizError(data.error || 'Unable to generate style quiz recommendations. Please try again.');
      }
    } catch (err) {
      console.error('AI Style Quiz Error:', err);
      setQuizError('Network error connecting to Nexora AI Style Engine.');
    } finally {
      setIsQuizLoading(false);
    }
  };

  // Chat Ask AI
  const handleAskAI = async (queryToUse?: string) => {
    const query = queryToUse || promptInput;
    if (!query.trim()) return;

    setIsChatLoading(true);
    setChatError(null);
    setResponseMarkdown(null);
    setGroundingChunks([]);

    try {
      const res = await fetch('/api/salons/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: query,
          preferences: {
            preferredServices: user.preferredServices,
            genderPreference: user.genderPreference,
            hairProfile: user.hairProfile,
            hairType: user.hairType || hairType,
            desiredLength: user.desiredLength || desiredLength,
            faceShape: user.faceShape || faceShape,
            skinConcern: user.skinConcern,
            favoriteStylist: user.favoriteStylist,
            defaultLocality: user.defaultLocality,
          },
          location: {
            area: currentLocation,
            latitude: 26.8533,
            longitude: 75.7681,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponseMarkdown(data.text || data.summary || 'Recommendations ready!');
        setGroundingChunks(data.groundingChunks || []);
      } else {
        setChatError(data.error || 'Failed to get AI recommendation. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setChatError('Network error while connecting to Nexora AI Advisor.');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Find Salon & Service to book directly
  const handleBookServiceMatch = (rec: RecommendedServiceMatch) => {
    const foundSalon = salons.find(
      (s) => s.id === rec.salonId || s.name.toLowerCase().includes(rec.salonName.toLowerCase())
    );

    if (foundSalon && onBookService) {
      const foundService = foundSalon.services.find(
        (srv) => srv.id === rec.serviceId || srv.name.toLowerCase().includes(rec.serviceName.toLowerCase())
      ) || {
        id: rec.serviceId,
        name: rec.serviceName,
        category: (rec.category as any) || 'hair',
        price: rec.price,
        discountPrice: rec.discountPrice,
        duration: rec.duration,
        description: rec.serviceDescription,
      };

      onClose();
      onBookService(foundSalon, foundService);
      return;
    }

    if (foundSalon && onSelectSalon) {
      onClose();
      onSelectSalon(foundSalon);
      return;
    }

    if (onSelectSalonByName) {
      onClose();
      onSelectSalonByName(rec.salonName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        id="ai-advisor-modal-container"
        className="w-full max-w-2xl bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-outline-variant/40 max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/30 bg-surface-container-low flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary via-nexora-pink to-primary-container flex items-center justify-center text-white shadow-sm ring-2 ring-primary/20">
                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-card-title text-[18px] font-bold text-on-surface">Nexora AI Beauty Advisor</h2>
                  <span className="text-[10px] font-bold bg-[#b00055]/10 text-[#b00055] px-2 py-0.5 rounded-full border border-[#b00055]/20 uppercase">
                    Gemini 3.7
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-nexora-pink">pin_drop</span>
                  <span>Grounded in verified salon reviews near {currentLocation}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Mode Switcher (3 Tabs) */}
          <div className="grid grid-cols-3 p-1 bg-surface-container-highest rounded-xl gap-1">
            <button
              type="button"
              id="ai-tab-quiz-btn"
              onClick={() => setActiveMode('quiz')}
              className={`py-2 px-2 rounded-lg text-[12px] sm:text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'quiz'
                  ? 'bg-white text-primary shadow-xs border border-outline-variant/30'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-nexora-pink">palette</span>
              <span>Style Quiz</span>
            </button>

            <button
              type="button"
              id="ai-tab-sentiment-btn"
              onClick={() => setActiveMode('sentiment')}
              className={`py-2 px-2 rounded-lg text-[12px] sm:text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'sentiment'
                  ? 'bg-white text-primary shadow-xs border border-outline-variant/30'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#b00055]">insights</span>
              <span>Sentiment</span>
              <span className="text-[9px] bg-[#b00055] text-white px-1.5 py-0.2 rounded-full font-bold">AI</span>
            </button>

            <button
              type="button"
              id="ai-tab-chat-btn"
              onClick={() => setActiveMode('chat')}
              className={`py-2 px-2 rounded-lg text-[12px] sm:text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'chat'
                  ? 'bg-white text-primary shadow-xs border border-outline-variant/30'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* ========================================================================= */}
          {/* TAB 1: AI STYLE QUIZ                                                      */}
          {/* ========================================================================= */}
          {activeMode === 'quiz' && (
            <div className="flex flex-col gap-4">
              {/* Profile Sync Notice */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-nexora-pink text-[18px]">account_circle</span>
                  <span>
                    Profile Loaded for <strong>{user.name}</strong>:{' '}
                    <span className="text-on-surface-variant">
                      {user.hairType || 'Wavy'} · {user.desiredLength || 'Shoulder Length'} · {user.faceShape || 'Oval'} Face
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHairType(user.hairType || 'Wavy');
                    setDesiredLength(user.desiredLength || 'Shoulder Length');
                    setFaceShape(user.faceShape || 'Oval');
                    setStylingGoal(user.stylingGoal || 'Volume & Movement');
                  }}
                  className="text-[11px] text-[#b00055] font-bold hover:underline cursor-pointer"
                >
                  Reset to Profile
                </button>
              </div>

              {!quizResult ? (
                /* Quiz Form */
                <div className="flex flex-col gap-5">
                  {/* Step 1: Hair Type & Texture */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>Your Hair Type & Natural Texture</span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">Selected: <strong>{hairType}</strong></span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HAIR_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setHairType(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                            hairType === opt.id
                              ? 'bg-[#b00055]/10 border-[#b00055] text-on-surface ring-1 ring-[#b00055]'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-[18px] text-nexora-pink">{opt.icon}</span>
                            {hairType === opt.id && (
                              <span className="material-symbols-outlined text-[16px] text-[#b00055]">check_circle</span>
                            )}
                          </div>
                          <span className="text-[12px] font-bold text-on-surface">{opt.label}</span>
                          <span className="text-[10px] text-on-surface-variant leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Desired Hair Length */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">2</span>
                        <span>Desired Hair Length & Target</span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">Selected: <strong>{desiredLength}</strong></span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {DESIRED_LENGTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDesiredLength(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                            desiredLength === opt.id
                              ? 'bg-[#b00055]/10 border-[#b00055] text-on-surface ring-1 ring-[#b00055]'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-[18px] text-nexora-pink">{opt.icon}</span>
                            {desiredLength === opt.id && (
                              <span className="material-symbols-outlined text-[16px] text-[#b00055]">check_circle</span>
                            )}
                          </div>
                          <span className="text-[12px] font-bold text-on-surface">{opt.label}</span>
                          <span className="text-[10px] text-on-surface-variant leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Face Shape */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">3</span>
                        <span>Your Face Shape</span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">Selected: <strong>{faceShape}</strong></span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {FACE_SHAPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFaceShape(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                            faceShape === opt.id
                              ? 'bg-[#b00055]/10 border-[#b00055] text-on-surface ring-1 ring-[#b00055]'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-[18px] text-nexora-pink">{opt.icon}</span>
                            {faceShape === opt.id && (
                              <span className="material-symbols-outlined text-[16px] text-[#b00055]">check_circle</span>
                            )}
                          </div>
                          <span className="text-[12px] font-bold text-on-surface">{opt.label}</span>
                          <span className="text-[10px] text-on-surface-variant leading-tight">{opt.tip}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Primary Styling Goal */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">4</span>
                        <span>Your Primary Hair & Glow Goal</span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">Selected: <strong>{stylingGoal}</strong></span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {STYLING_GOAL_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setStylingGoal(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            stylingGoal === opt.id
                              ? 'bg-[#b00055]/10 border-[#b00055] text-on-surface ring-1 ring-[#b00055]'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <div>
                            <span className="text-[12px] font-bold text-on-surface block">{opt.label}</span>
                            <span className="text-[11px] text-on-surface-variant">{opt.desc}</span>
                          </div>
                          {stylingGoal === opt.id && (
                            <span className="material-symbols-outlined text-[18px] text-[#b00055]">check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save to Profile Toggle */}
                  <label className="flex items-center gap-2 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 text-[12px]">
                      <span className="font-semibold text-on-surface">Save preferences to my Nexora Profile</span>
                      <p className="text-[11px] text-on-surface-variant">
                        Updates your saved hair profile and beauty recommendations across the app.
                      </p>
                    </div>
                  </label>

                  {/* Submit Button */}
                  <button
                    id="submit-ai-style-quiz-btn"
                    type="button"
                    onClick={handleRunStyleQuiz}
                    disabled={isQuizLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary via-[#b00055] to-nexora-pink text-white font-bold rounded-xl shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isQuizLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Analyzing with Gemini 3.7 AI...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        <span>Find My Perfect Style & Match Salons</span>
                      </>
                    )}
                  </button>

                  {quizError && (
                    <div className="p-3 bg-error-container text-on-error-container rounded-xl text-[12px]">
                      {quizError}
                    </div>
                  )}
                </div>
              ) : (
                /* Quiz Results View */
                <div className="flex flex-col gap-4">
                  {/* Summary Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#b00055]/15 via-primary/10 to-surface-container border border-[#b00055]/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#b00055] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                        AI Style Synthesis
                      </span>
                      <button
                        onClick={() => setQuizResult(null)}
                        className="text-[11px] text-primary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        Retake Quiz
                      </button>
                    </div>
                    <p className="text-[13px] text-on-surface leading-relaxed font-medium">
                      {quizResult.styleSummary}
                    </p>
                  </div>

                  {/* Face Shape & Texture Deep Dive */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-primary text-[12px] font-bold">
                        <span className="material-symbols-outlined text-[16px]">face</span>
                        <span>Face Silhouette Analysis</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {quizResult.faceShapeAnalysis}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#b00055] text-[12px] font-bold">
                        <span className="material-symbols-outlined text-[16px]">waves</span>
                        <span>Hair Type Suitability</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {quizResult.hairTypeSuitability}
                      </p>
                    </div>
                  </div>

                  {/* Recommended Cuts & Silhouettes */}
                  <div>
                    <h3 className="font-card-title text-[13px] font-bold text-on-surface mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-nexora-pink">content_cut</span>
                      <span>Target Haircuts Tailored to You</span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {quizResult.recommendedCutsAndStyles.map((cut, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-surface-container-highest text-on-surface rounded-lg text-[11px] font-semibold border border-outline-variant/40"
                        >
                          ✨ {cut}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Matched Salon Services in Jaipur */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-card-title text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
                        <span>Top Salon Services Matching Your Quiz</span>
                      </h3>
                      <span className="text-[11px] text-on-surface-variant">Near {currentLocation}</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {quizResult.recommendedServices.map((rec, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/50 transition-all shadow-xs"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[13px] text-on-surface">{rec.serviceName}</span>
                              <span className="text-[10px] bg-success-emerald/10 text-success-emerald font-bold px-1.5 py-0.2 rounded">
                                {rec.matchScore}% Match
                              </span>
                            </div>
                            <p className="text-[11px] text-primary font-semibold mt-0.5">
                              📍 {rec.salonName} <span className="text-on-surface-variant font-normal">({rec.salonAddress})</span>
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                              💡 <em>{rec.matchReason}</em>
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/20">
                            <div className="text-left sm:text-right">
                              <span className="font-bold text-[14px] text-primary">₹{rec.discountPrice || rec.price}</span>
                              {rec.discountPrice && (
                                <span className="text-[10px] line-through text-on-surface-variant block">₹{rec.price}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleBookServiceMatch(rec)}
                              className="px-3.5 py-1.5 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
                            >
                              Book Match
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Home Maintenance Tips */}
                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
                    <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-warning-amber">lightbulb</span>
                      <span>Daily Styling & Maintenance Advice</span>
                    </h4>
                    <ul className="flex flex-col gap-1 text-[11px] text-on-surface-variant list-disc pl-4">
                      {quizResult.homeCareTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Bar */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuizResult(null)}
                      className="flex-1 py-2.5 bg-surface-container text-on-surface text-[12px] font-semibold rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer"
                    >
                      Change Preferences
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('sentiment')}
                      className="flex-1 py-2.5 bg-[#b00055] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">insights</span>
                      <span>Check Salon Reviews Sentiment</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SALON SENTIMENT SUMMARY (FEATURE REQUEST)                           */}
          {/* ========================================================================= */}
          {activeMode === 'sentiment' && (
            <div className="flex flex-col gap-4">
              {/* Salon Quick Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-bold text-on-surface flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#b00055]">storefront</span>
                    <span>Select Salon to Analyze Reviews Sentiment</span>
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-normal">
                    {salons.length} Salons available in Jaipur
                  </span>
                </label>

                {/* Salon Carousel Buttons */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {salons.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSentimentSalonId(s.id)}
                      className={`px-3 py-2 rounded-xl text-left shrink-0 transition-all flex items-center gap-2 cursor-pointer border ${
                        selectedSentimentSalonId === s.id
                          ? 'bg-[#b00055]/10 border-[#b00055] ring-1 ring-[#b00055]'
                          : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
                      }`}
                    >
                      <img
                        src={s.image}
                        alt={s.name}
                        className="w-7 h-7 rounded-lg object-cover shrink-0"
                      />
                      <div className="max-w-[130px]">
                        <span className="text-[11px] font-bold text-on-surface truncate block">{s.name}</span>
                        <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px] text-warning-amber fill-1">star</span>
                          <span>{s.rating}</span>
                          <span>· {s.location.area}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {isSentimentLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-10 h-10 border-3 border-[#b00055]/30 border-t-[#b00055] rounded-full animate-spin" />
                  <p className="text-[13px] font-semibold text-on-surface">
                    Analyzing verified client reviews for {currentSentimentSalon?.name || 'Salon'}...
                  </p>
                  <p className="text-[11px] text-on-surface-variant max-w-sm">
                    Synthesizing top positive praises, constructive patterns, and stylist reputation with Gemini 3.7.
                  </p>
                </div>
              )}

              {/* Error State */}
              {sentimentError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[12px]">
                  {sentimentError}
                </div>
              )}

              {/* Sentiment Summary Results */}
              {!isSentimentLoading && sentimentSummary && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Hero Sentiment Score & Vibe Card */}
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Sentiment Score Badge Circle */}
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success-emerald/20 to-[#b00055]/20 border border-success-emerald/40 flex flex-col items-center justify-center text-center shrink-0">
                          <span className="font-card-title text-[20px] font-black text-on-surface leading-none">
                            {sentimentSummary.sentimentScore}
                          </span>
                          <span className="text-[9px] font-bold text-success-emerald uppercase">/ 100</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-success-emerald/15 text-success-emerald text-[11px] font-extrabold border border-success-emerald/30">
                              {sentimentSummary.overallSentiment}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              Analyzed {sentimentSummary.analyzedReviewCount || 35}+ verified reviews
                            </span>
                          </div>
                          <h3 className="font-card-title text-[15px] font-bold text-on-surface mt-1">
                            {sentimentSummary.salonName}
                          </h3>
                        </div>
                      </div>

                      {/* Vibe Badge */}
                      <span className="px-3 py-1 bg-surface-container-highest text-[#b00055] rounded-full text-[11px] font-bold border border-[#b00055]/20 shrink-0 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        {sentimentSummary.vibeBadge}
                      </span>
                    </div>

                    {/* Sentiment Distribution Bar */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/20">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface">
                        <span className="text-success-emerald flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-success-emerald inline-block" />
                          Positive: {sentimentSummary.positivePercentage}%
                        </span>
                        <span className="text-warning-amber flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-warning-amber inline-block" />
                          Neutral: {sentimentSummary.neutralPercentage}%
                        </span>
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                          Constructive: {sentimentSummary.negativePercentage}%
                        </span>
                      </div>

                      <div className="h-2.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-success-emerald transition-all duration-500"
                          style={{ width: `${sentimentSummary.positivePercentage}%` }}
                          title={`Positive: ${sentimentSummary.positivePercentage}%`}
                        />
                        <div
                          className="h-full bg-warning-amber transition-all duration-500"
                          style={{ width: `${sentimentSummary.neutralPercentage}%` }}
                          title={`Neutral: ${sentimentSummary.neutralPercentage}%`}
                        />
                        <div
                          className="h-full bg-rose-400 transition-all duration-500"
                          style={{ width: `${sentimentSummary.negativePercentage}%` }}
                          title={`Constructive: ${sentimentSummary.negativePercentage}%`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Executive AI Sentiment Summary */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/5 via-[#b00055]/10 to-surface-container-low border border-[#b00055]/20 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#b00055]">
                      <span className="material-symbols-outlined text-[15px]">psychology</span>
                      <span>Executive Client Consensus</span>
                    </div>
                    <p className="text-[13px] text-on-surface leading-relaxed font-medium">
                      "{sentimentSummary.executiveSummary}"
                    </p>
                  </div>

                  {/* TOP POSITIVE THEMES (PROS) */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-card-title text-[14px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-success-emerald">thumb_up</span>
                        <span>Top Positive Themes & Client Praises</span>
                      </h4>
                      <span className="text-[10px] text-success-emerald font-bold bg-success-emerald/10 px-2 py-0.5 rounded-full">
                        {sentimentSummary.topPositiveThemes.length} Highlights
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sentimentSummary.topPositiveThemes.map((theme, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-surface-container-lowest border border-success-emerald/30 flex flex-col gap-2 hover:border-success-emerald transition-all shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[12px] font-bold text-on-surface leading-snug">
                              {theme.theme}
                            </span>
                            <span className="text-[10px] bg-success-emerald/15 text-success-emerald font-extrabold px-1.5 py-0.2 rounded shrink-0">
                              {theme.percentage}% Mention
                            </span>
                          </div>

                          <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                            🏷️ {theme.tag}
                          </span>

                          <p className="text-[11px] text-on-surface-variant italic bg-surface-container-low p-2 rounded-lg border border-outline-variant/20">
                            "{theme.sampleQuote}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TOP NEGATIVE / CONSTRUCTIVE THEMES (AREAS TO NOTE) */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-card-title text-[14px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-rose-500">info</span>
                        <span>Constructive Feedback & Client Pro-Tips</span>
                      </h4>
                      <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">
                        AI Guidance
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {sentimentSummary.topNegativeThemes.map((theme, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-surface-container-lowest border border-rose-500/25 flex flex-col gap-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span className="text-[12px] font-bold text-on-surface">{theme.theme}</span>
                            </div>
                            <span className="text-[10px] bg-rose-500/15 text-rose-600 font-bold px-1.5 py-0.2 rounded">
                              {theme.percentage}% noted
                            </span>
                          </div>

                          <p className="text-[11px] text-on-surface-variant italic">
                            "{theme.sampleQuote}"
                          </p>

                          {theme.recommendation && (
                            <div className="p-2 rounded-lg bg-warning-amber/10 border border-warning-amber/30 text-warning-amber text-[11px] font-medium flex items-center gap-1.5 mt-0.5">
                              <span className="material-symbols-outlined text-[14px] shrink-0">tips_and_updates</span>
                              <span><strong>Pro-Tip:</strong> {theme.recommendation}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Standout Stylists & Best For Services */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sentimentSummary.standoutStylists && sentimentSummary.standoutStylists.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">star</span>
                          Standout Stylists Praised
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {sentimentSummary.standoutStylists.map((st, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-surface-container-highest text-on-surface rounded-lg text-[11px] font-semibold border border-outline-variant/40"
                            >
                              ⭐ {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {sentimentSummary.bestForServices && sentimentSummary.bestForServices.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#b00055] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">loyalty</span>
                          Highest Rated Treatments
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {sentimentSummary.bestForServices.map((srv, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-surface-container-highest text-on-surface rounded-lg text-[11px] font-semibold border border-outline-variant/40"
                            >
                              ✨ {srv}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSentimentSalon && onSelectSalon) {
                          onClose();
                          onSelectSalon(currentSentimentSalon);
                        }
                      }}
                      className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-[#b00055] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                      <span>Book at {currentSentimentSalon?.name}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CHAT ASK AI ADVISOR                                                */}
          {/* ========================================================================= */}
          {activeMode === 'chat' && (
            <div className="flex flex-col gap-4">
              {/* Input Area */}
              <div className="relative">
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Ask anything: 'Recommend the best keratin hair spa in Jaipur', 'What haircut suits a round face and fine hair?'..."
                  rows={2}
                  className="w-full p-3 pl-3 pr-12 bg-surface-container-highest text-on-surface rounded-xl text-[13px] border-0 focus:ring-1 focus:ring-nexora-pink"
                />
                <button
                  onClick={() => handleAskAI()}
                  disabled={isChatLoading || !promptInput.trim()}
                  className="absolute right-2 bottom-3 p-2 bg-primary text-white rounded-lg hover:bg-nexora-pink transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>

              {/* Sample Prompt Chips */}
              {!responseMarkdown && !isChatLoading && (
                <div>
                  <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-2">
                    Popular Styling Queries
                  </span>
                  <div className="flex flex-col gap-2">
                    {samplePrompts.map((sp, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPromptInput(sp);
                          handleAskAI(sp);
                        }}
                        className="p-2.5 text-left rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-[12px] text-on-surface transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span>{sp}</span>
                        <span className="material-symbols-outlined text-[16px] text-nexora-pink group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Spinner */}
              {isChatLoading && (
                <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-10 h-10 border-3 border-nexora-pink/30 border-t-nexora-pink rounded-full animate-spin" />
                  <p className="text-[13px] font-medium text-on-surface">
                    Consulting Google Maps & analyzing verified reviews in {currentLocation}...
                  </p>
                </div>
              )}

              {/* Error */}
              {chatError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[12px]">
                  {chatError}
                </div>
              )}

              {/* AI Markdown Output */}
              {responseMarkdown && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-[13px] leading-relaxed text-on-surface whitespace-pre-line shadow-xs">
                    {responseMarkdown}
                  </div>

                  {/* Maps Grounding Links */}
                  {groundingChunks && groundingChunks.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/50">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="material-symbols-outlined text-nexora-pink text-[18px]">location_on</span>
                        <h4 className="font-semibold text-[13px] text-on-surface">Verified Google Maps Sources</h4>
                      </div>
                      <div className="flex flex-col gap-2">
                        {groundingChunks.map((chunk, i) => {
                          const title = chunk.maps?.title || chunk.web?.title || `Place Reference #${i + 1}`;
                          const url = chunk.maps?.uri || chunk.web?.uri;
                          const snippet = chunk.maps?.placeAnswerSources?.reviewSnippets?.[0]?.snippet;

                          return (
                            <div key={i} className="p-2.5 rounded-lg bg-surface-container text-[12px] flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-on-surface">{title}</span>
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-nexora-pink font-semibold flex items-center gap-0.5 hover:underline"
                                  >
                                    <span>View on Maps</span>
                                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                  </a>
                                )}
                              </div>
                              {snippet && (
                                <p className="text-[11px] text-on-surface-variant italic">"{snippet}"</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
