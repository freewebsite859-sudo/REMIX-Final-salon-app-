import React, { useState, useEffect } from 'react';
import { GroundingChunk, UserProfile, Salon, SalonService, AIStyleQuizResult, RecommendedServiceMatch } from '../types';

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
  initialTab?: 'quiz' | 'chat';
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
}) => {
  const [activeMode, setActiveMode] = useState<'quiz' | 'chat'>(initialTab);

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

  // Chat State
  const [promptInput, setPromptInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [responseMarkdown, setResponseMarkdown] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  // Sync state when user prop changes
  useEffect(() => {
    if (user.hairType) setHairType(user.hairType);
    if (user.desiredLength) setDesiredLength(user.desiredLength);
    if (user.faceShape) setFaceShape(user.faceShape);
    if (user.stylingGoal) setStylingGoal(user.stylingGoal);
  }, [user]);

  if (!isOpen) return null;

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

    // If user checked save to profile, update profile
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
    const foundSalon = salons.find((s) => s.id === rec.salonId || s.name.toLowerCase().includes(rec.salonName.toLowerCase()));
    
    if (foundSalon && onBookService) {
      const foundService = foundSalon.services.find((srv) => srv.id === rec.serviceId || srv.name.toLowerCase().includes(rec.serviceName.toLowerCase())) || {
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
                  <h2 className="font-card-title text-[18px] font-bold text-on-surface">Nexora AI Beauty Stylist</h2>
                  <span className="text-[10px] font-bold bg-[#b00055]/10 text-[#b00055] px-2 py-0.5 rounded-full border border-[#b00055]/20 uppercase">
                    Gemini 3.7
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-nexora-pink">pin_drop</span>
                  <span>Grounded in verified salons near {currentLocation}</span>
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

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-surface-container-highest rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveMode('quiz')}
              className={`py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'quiz'
                  ? 'bg-white text-primary shadow-xs border border-outline-variant/30'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-nexora-pink">palette</span>
              <span>AI Style Quiz</span>
              <span className="text-[10px] bg-[#b00055] text-white px-1.5 py-0.2 rounded-full font-bold">New</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('chat')}
              className={`py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'chat'
                  ? 'bg-white text-primary shadow-xs border border-outline-variant/30'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>Ask AI Stylist</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {activeMode === 'quiz' ? (
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
                          <span className="text-[10px] text-on-surface-variant leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Active Face Shape Pro Tip */}
                    {faceShape && (
                      <div className="mt-2 p-2.5 bg-primary-fixed/30 rounded-xl border border-primary-fixed flex items-center gap-2 text-[11px] text-on-surface">
                        <span className="material-symbols-outlined text-nexora-pink text-[16px]">lightbulb</span>
                        <span>
                          <strong>Stylist Tip for {faceShape} Face:</strong>{' '}
                          {FACE_SHAPE_OPTIONS.find((f) => f.id === faceShape)?.tip}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step 4: Primary Styling Goal */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-bold text-on-surface flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">4</span>
                        <span>Primary Styling Goal & Priority</span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">Selected: <strong>{stylingGoal}</strong></span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                            <span className="text-[10px] text-on-surface-variant">{opt.desc}</span>
                          </div>
                          {stylingGoal === opt.id && (
                            <span className="material-symbols-outlined text-[18px] text-[#b00055]">check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save to Profile Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="save-style-profile"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      className="w-4 h-4 text-[#b00055] rounded focus:ring-[#b00055] border-outline-variant cursor-pointer"
                    />
                    <label htmlFor="save-style-profile" className="text-[12px] text-on-surface font-medium cursor-pointer">
                      Save these style preferences to my profile for future salon recommendations
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleRunStyleQuiz}
                    disabled={isQuizLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-primary via-nexora-pink to-primary-container text-white font-bold rounded-xl text-[14px] shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isQuizLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>AI Analyzing Face Shape & Matching Salons...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                        <span>Generate AI Style Blueprint & Matched Services</span>
                      </>
                    )}
                  </button>

                  {quizError && (
                    <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[12px]">
                      {quizError}
                    </div>
                  )}
                </div>
              ) : (
                /* Quiz Results View */
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  {/* Summary Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-primary to-nexora-pink text-white shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[22px]">verified</span>
                        <h3 className="font-card-title text-[16px] font-bold">Personalized Style Blueprint</h3>
                      </div>
                      <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                        {faceShape} · {hairType} · {desiredLength}
                      </span>
                    </div>
                    <p className="text-[12px] opacity-95 leading-relaxed">{quizResult.styleSummary}</p>
                  </div>

                  {/* Architectural Analysis Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40">
                      <div className="flex items-center gap-1.5 mb-1.5 text-nexora-pink">
                        <span className="material-symbols-outlined text-[18px]">face</span>
                        <h4 className="font-bold text-[13px] text-on-surface">Face Shape Harmony</h4>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        {quizResult.faceShapeAnalysis}
                      </p>
                    </div>

                    <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40">
                      <div className="flex items-center gap-1.5 mb-1.5 text-nexora-pink">
                        <span className="material-symbols-outlined text-[18px]">texture</span>
                        <h4 className="font-bold text-[13px] text-on-surface">Texture & Density Fit</h4>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        {quizResult.hairTypeSuitability}
                      </p>
                    </div>
                  </div>

                  {/* Recommended Cut Concepts */}
                  {quizResult.recommendedCutsAndStyles && quizResult.recommendedCutsAndStyles.length > 0 && (
                    <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                      <h4 className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                        Flattering Cut & Layer Concepts for You
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {quizResult.recommendedCutsAndStyles.map((cut, i) => (
                          <div
                            key={i}
                            className="px-3 py-1.5 bg-primary-fixed/40 border border-primary-fixed text-primary font-semibold text-[12px] rounded-lg flex items-center gap-1.5 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[14px]">content_cut</span>
                            <span>{cut}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Salon Services */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-nexora-pink text-[18px]">storefront</span>
                        <h4 className="font-bold text-[14px] text-on-surface">
                          Recommended Services at Top Salons Near {currentLocation}
                        </h4>
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-medium">Direct Booking Available</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {quizResult.recommendedServices.map((rec, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 hover:border-nexora-pink transition-all shadow-xs flex flex-col gap-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={rec.salonImage}
                                alt={rec.salonName}
                                className="w-12 h-12 rounded-xl object-cover ring-1 ring-black/10"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h5 className="font-bold text-[13px] text-on-surface">{rec.serviceName}</h5>
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                    {rec.matchScore}% Match
                                  </span>
                                </div>
                                <p className="text-[11px] font-medium text-nexora-pink">{rec.salonName}</p>
                                <p className="text-[10px] text-on-surface-variant">{rec.salonAddress}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-baseline gap-1 justify-end">
                                <span className="font-bold text-[14px] text-primary">₹{rec.discountPrice || rec.price}</span>
                                {rec.discountPrice && (
                                  <span className="text-[11px] text-on-surface-variant line-through">₹{rec.price}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-on-surface-variant">{rec.duration} mins</span>
                            </div>
                          </div>

                          <div className="p-2 bg-surface-container rounded-lg text-[11px] text-on-surface flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-nexora-pink flex-shrink-0 mt-0.5">
                              psychology
                            </span>
                            <span><strong>Why AI matched this:</strong> {rec.matchReason}</span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30">
                            <span className="text-[11px] text-on-surface-variant">{rec.serviceDescription}</span>
                            <button
                              type="button"
                              onClick={() => handleBookServiceMatch(rec)}
                              className="px-3.5 py-1.5 bg-[#b00055] hover:bg-[#900045] text-white font-bold rounded-xl text-[11px] transition-colors flex items-center gap-1 flex-shrink-0 shadow-xs cursor-pointer"
                            >
                              <span>Book Service</span>
                              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stylist Home Maintenance Tips */}
                  {quizResult.homeCareTips && quizResult.homeCareTips.length > 0 && (
                    <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="material-symbols-outlined text-nexora-pink text-[18px]">spa</span>
                        <h4 className="font-bold text-[13px] text-on-surface">Pro Maintenance Routine for Your Hair</h4>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {quizResult.homeCareTips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-[12px] text-on-surface">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600 flex-shrink-0 mt-0.5">
                              check_circle
                            </span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Google Maps Sources */}
                  {quizResult.groundingSources && quizResult.groundingSources.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="material-symbols-outlined text-nexora-pink text-[16px]">location_on</span>
                        <h4 className="font-bold text-[12px] text-on-surface">Verified Google Maps Sources</h4>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {quizResult.groundingSources.map((chunk, i) => {
                          const title = chunk.maps?.title || chunk.web?.title || `Verified Salon #${i + 1}`;
                          const url = chunk.maps?.uri || chunk.web?.uri;
                          return (
                            <div key={i} className="flex items-center justify-between text-[11px] p-2 bg-surface-container rounded-lg">
                              <span className="font-medium text-on-surface truncate">{title}</span>
                              {url && (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-nexora-pink font-semibold flex items-center gap-0.5 hover:underline ml-2 flex-shrink-0"
                                >
                                  <span>View on Maps</span>
                                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuizResult(null)}
                      className="flex-1 py-2.5 bg-surface-container-highest text-on-surface font-semibold rounded-xl text-[12px] hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      <span>Adjust Style Quiz Answers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('chat');
                        setPromptInput(`I just took the AI style quiz for my ${faceShape} face shape and ${hairType} hair. Can you recommend specific styling products or color advice?`);
                      }}
                      className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-[12px] hover:bg-nexora-pink transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                      <span>Ask AI Stylist Follow-up</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chat Mode */
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
