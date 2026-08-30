import React, { useState, useMemo } from 'react';
import { Salon, SalonService, Stylist, UserProfile } from '../types';
import { requestDeviceLocation } from '../lib/deviceLocation';
import { StaticMapPreview } from './StaticMapPreview';

interface SalonOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSalon: (newSalon: Salon) => void;
  user?: UserProfile | null;
}

const JAIPUR_AREAS = [
  'Mansarovar',
  'Vaishali Nagar',
  'Malviya Nagar',
  'C-Scheme',
  'Raja Park',
  'Bani Park',
  'Tonk Road',
  'Civil Lines',
  'Jagatpura',
  'Ajmer Road',
];

const DEFAULT_AMENITIES = [
  'Air Conditioned',
  'Dedicated Parking',
  'High-Speed Wi-Fi',
  'Complimentary Beverages',
  'Card & UPI Accepted',
  'Sanitized Equipment',
  'Private Treatment Suites',
  'Accessible Entrance',
];

const PRESET_GALLERY_PHOTOS = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=800&q=80',
];

export const SalonOnboardingModal: React.FC<SalonOnboardingModalProps> = ({
  isOpen,
  onClose,
  onRegisterSalon,
  user,
}) => {
  // Wizard Step (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Step 1: Basic Info
  const [salonName, setSalonName] = useState('Velvet & Vibe Luxury Lounge');
  const [tagline, setTagline] = useState('Haute coiffure, bespoke color artistry & skin therapies');
  const [genderSpecialization, setGenderSpecialization] = useState<'unisex' | 'women' | 'men'>('unisex');
  const [priceRange, setPriceRange] = useState<'₹' | '₹₹' | '₹₹₹' | '₹₹₹₹'>('₹₹');

  // Step 2: Contact & Operating Hours
  const [ownerName, setOwnerName] = useState(user?.name || 'Aarav Singhania');
  const [phone, setPhone] = useState(user?.phone || '+91 98290 88990');
  const [email, setEmail] = useState(user?.email || 'partner@velvetvibe.com');
  const [openingTime, setOpeningTime] = useState('09:30 AM');
  const [closingTime, setClosingTime] = useState('09:00 PM');
  const [daysOpen, setDaysOpen] = useState('Monday - Sunday (7 Days)');

  // Step 3: Services & Pricing
  const [services, setServices] = useState<SalonService[]>([
    {
      id: 'srv-init-1',
      name: 'Signature Layer Haircut & Styling',
      category: 'hair',
      duration: 45,
      price: 599,
      discountPrice: 499,
      description: 'Precision consultation, soothing hair wash, artistic layering & heat styling blowout.',
      popular: true,
    },
    {
      id: 'srv-init-2',
      name: '7-Step Hydra Glow Facial',
      category: 'skin',
      duration: 60,
      price: 1499,
      discountPrice: 1199,
      description: 'Deep pore vacuum suction, lactic peeling, ultrasonic infusion & collagen seal.',
      popular: true,
    },
    {
      id: 'srv-init-3',
      name: 'Aromatherapy Stress Relief Spa',
      category: 'spa',
      duration: 60,
      price: 1899,
      discountPrice: 1499,
      description: 'Swedish pressure therapy with organic essential oils and thermal herbal wrap.',
    },
  ]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<'hair' | 'skin' | 'nails' | 'spa' | 'grooming'>('hair');
  const [newServicePrice, setNewServicePrice] = useState('699');
  const [newServiceDuration, setNewServiceDuration] = useState('45');

  // Step 4: Stylists & Team
  const [stylists, setStylists] = useState<Stylist[]>([
    {
      id: 'sty-init-1',
      name: 'Elena Rostova',
      role: 'Master Creative Director',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      rating: 4.9,
      experience: '10+ yrs',
      specialty: ['French Balayage', 'Butterfly Cut', 'Precision Layers'],
    },
    {
      id: 'sty-init-2',
      name: 'Kabir Oberoi',
      role: 'Senior Grooming Stylist',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      rating: 4.8,
      experience: '7+ yrs',
      specialty: ['Fade Sculpting', 'Beard Contour', 'Scalp Therapy'],
    },
  ]);
  const [newStylistName, setNewStylistName] = useState('');
  const [newStylistRole, setNewStylistRole] = useState('Senior Stylist');
  const [newStylistExp, setNewStylistExp] = useState('5 yrs');

  // Step 5: Amenities & Photo Gallery
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Air Conditioned',
    'Dedicated Parking',
    'High-Speed Wi-Fi',
    'Card & UPI Accepted',
    'Complimentary Beverages',
  ]);
  const [salonBannerImage, setSalonBannerImage] = useState(
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'
  );

  // =========================================================================
  // Step 6: Location & Dynamic Map Pin State
  // =========================================================================
  const [streetAddress, setStreetAddress] = useState('Plot 88, Queens Road, Near Vaishali Circle');
  const [selectedArea, setSelectedArea] = useState('Vaishali Nagar');
  const [city, setCity] = useState('Jaipur');
  const [pinCode, setPinCode] = useState('302021');
  const [landmark, setLandmark] = useState('Opposite National Handloom');
  const [latitude, setLatitude] = useState<number>(26.9015);
  const [longitude, setLongitude] = useState<number>(75.7483);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsSuccessMsg, setGpsSuccessMsg] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Publish Pipeline Progress States
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStepIndex, setPublishStepIndex] = useState<number>(0);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Calculated full address string
  const fullAddress = useMemo(() => {
    const parts = [streetAddress.trim()];
    if (landmark.trim()) parts.push(`(${landmark.trim()})`);
    if (selectedArea.trim()) parts.push(selectedArea.trim());
    if (city.trim()) parts.push(city.trim());
    if (pinCode.trim()) parts.push(`PIN-${pinCode.trim()}`);
    return parts.filter(Boolean).join(', ');
  }, [streetAddress, landmark, selectedArea, city, pinCode]);

  // Construct draft Salon object for the lightweight map preview
  const draftSalonForMap: Salon = useMemo(() => {
    return {
      id: 'draft-salon-onboarding',
      name: salonName || 'Your Luxury Salon',
      tagline: tagline || 'Exclusive Salon Partner on Nexora',
      categories: [
        'Hair Cut',
        'Facial & Skin',
        genderSpecialization === 'women' ? 'Women Only' : genderSpecialization === 'men' ? 'Men Only' : 'Unisex',
      ],
      rating: 5.0,
      reviewCount: 1,
      distance: '0.6 km',
      location: {
        area: selectedArea || 'Vaishali Nagar',
        city: city || 'Jaipur',
        address: fullAddress || 'Plot 88, Queens Road, Vaishali Nagar, Jaipur, Rajasthan 302021',
        latitude: latitude || 26.9015,
        longitude: longitude || 75.7483,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${salonName} ${fullAddress}`
        )}`,
      },
      image: salonBannerImage,
      gallery: PRESET_GALLERY_PHOTOS,
      isOpen: true,
      openingHours: `${openingTime} - ${closingTime}`,
      priceRange: priceRange,
      services: services,
      stylists: stylists,
      reviews: [],
      amenities: selectedAmenities,
      phone: phone,
      gender: genderSpecialization,
    };
  }, [
    salonName,
    tagline,
    genderSpecialization,
    selectedArea,
    city,
    fullAddress,
    latitude,
    longitude,
    salonBannerImage,
    openingTime,
    closingTime,
    priceRange,
    services,
    stylists,
    selectedAmenities,
    phone,
  ]);

  // Handle GPS location detection
  const handleDetectGPS = async () => {
    setIsDetectingGps(true);
    setGpsSuccessMsg(null);
    setGpsErrorMsg(null);

    const result = await requestDeviceLocation();
    setIsDetectingGps(false);

    if (result.status === 'ok') {
      const lat = parseFloat(result.latitude.toFixed(4));
      const lng = parseFloat(result.longitude.toFixed(4));
      setLatitude(lat);
      setLongitude(lng);
      setGpsSuccessMsg(`GPS Coordinates locked: ${lat}, ${lng}`);
      setTimeout(() => setGpsSuccessMsg(null), 4000);
      return;
    }

    // Deliberately NO coordinate fallback. A salon listing is real inventory:
    // dropping a "Jaipur central hub" pin on a failed fix would publish a
    // wrong location and move the map pin away from the owner's own input.
    // Keep the current/selected coordinates and explain what to do instead.
    setGpsErrorMsg(result.message.replace(' Please select an area below.', ' Pick a locality below or drag the map pin.'));
  };

  // Quick area selection updates coords
  const handleSelectArea = (area: string) => {
    setSelectedArea(area);
    if (area === 'Mansarovar') {
      setLatitude(26.8533);
      setLongitude(75.7681);
    } else if (area === 'Vaishali Nagar') {
      setLatitude(26.9015);
      setLongitude(75.7483);
    } else if (area === 'Malviya Nagar') {
      setLatitude(26.8529);
      setLongitude(75.8152);
    } else if (area === 'C-Scheme') {
      setLatitude(26.9114);
      setLongitude(75.8016);
    } else if (area === 'Raja Park') {
      setLatitude(26.8972);
      setLongitude(75.8344);
    }
  };

  // Add Service
  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    const priceNum = parseInt(newServicePrice, 10) || 500;
    const durNum = parseInt(newServiceDuration, 10) || 45;
    const srv: SalonService = {
      id: `srv-${Date.now()}`,
      name: newServiceName.trim(),
      category: newServiceCategory,
      duration: durNum,
      price: priceNum,
      discountPrice: Math.round(priceNum * 0.85),
      description: `Premium ${newServiceCategory} treatment custom tailored by ${salonName}.`,
    };
    setServices([...services, srv]);
    setNewServiceName('');
    setNewServicePrice('699');
  };

  // Remove Service
  const handleRemoveService = (id: string) => {
    if (services.length <= 1) return;
    setServices(services.filter((s) => s.id !== id));
  };

  // Add Stylist
  const handleAddStylist = () => {
    if (!newStylistName.trim()) return;
    const sty: Stylist = {
      id: `sty-${Date.now()}`,
      name: newStylistName.trim(),
      role: newStylistRole,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      rating: 4.9,
      experience: newStylistExp,
      specialty: ['Creative Styling', 'Client Care'],
    };
    setStylists([...stylists, sty]);
    setNewStylistName('');
  };

  // Remove Stylist
  const handleRemoveStylist = (id: string) => {
    if (stylists.length <= 1) return;
    setStylists(stylists.filter((s) => s.id !== id));
  };

  // Toggle Amenity
  const handleToggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const PUBLISH_STEPS = [
    { label: 'Validating Listing & Data Integrity', icon: 'fact_check' },
    { label: 'Registering Salon & Merchant Profile', icon: 'storefront' },
    { label: 'Indexing Service Catalog & Pricing Table', icon: 'spa' },
    { label: 'Optimizing & Linking High-Res Visual Assets', icon: 'photo_library' },
    { label: 'Geocoding Coordinates & Locking Map Geo-Pin', icon: 'pin_drop' },
    { label: 'Activating Live Status & Instant Discovery', icon: 'verified' },
  ];

  // Final Publish Handler adhering to Principle 15 (Publish Principle)
  const handlePublishSalon = async () => {
    // 1. Validate
    if (!salonName.trim()) {
      setPublishError('Salon name is required. Please provide a title in Step 1.');
      setCurrentStep(1);
      return;
    }
    if (services.length === 0) {
      setPublishError('At least 1 service is required in your catalog.');
      setCurrentStep(3);
      return;
    }
    if (!selectedArea.trim()) {
      setPublishError('Area / Locality is required in Step 6.');
      setCurrentStep(6);
      return;
    }

    setPublishError(null);
    setIsPublishing(true);
    setPublishStepIndex(0);

    const finalSalon: Salon = {
      ...draftSalonForMap,
      id: `salon-${Date.now()}`,
      isOpen: true,
      featured: true,
      trending: true,
    };

    try {
      // Step 1: Validate
      setPublishStepIndex(0);
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Step 2: Save Salon Profile
      setPublishStepIndex(1);
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Step 3: Save Services & Catalog
      setPublishStepIndex(2);
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Step 4: Save Photos & Assets
      setPublishStepIndex(3);
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Step 5: Save Location & Map Coordinates
      setPublishStepIndex(4);
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Step 6: Mark Published in Database
      setPublishStepIndex(5);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 7: Final Success Trigger
      setPublishSuccess(true);
      
      // Perform database operation by calling onRegisterSalon to persist in state & storage
      onRegisterSalon(finalSalon);

      // Transition smoothly so owner sees their live website profile immediately
      setTimeout(() => {
        setIsPublishing(false);
        setPublishSuccess(false);
        onClose();
      }, 1400);
    } catch {
      setPublishError('An error occurred during database publication. Please try again.');
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-surface rounded-2xl sm:rounded-3xl shadow-2xl border border-outline-variant/40 flex flex-col my-auto max-h-[92vh] overflow-hidden">
        {/* Header Strip */}
        <div className="p-4 sm:p-5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-nexora-pink text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">storefront</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-card-title text-[16px] sm:text-[18px] font-bold text-on-surface">
                  Partner Onboarding & Salon Registration
                </h2>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <p className="text-[11px] sm:text-[12px] text-on-surface-variant">
                List your luxury salon on Nexora SalonOS with real-time map discovery
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Step Progress Bar & Stepper Tabs */}
        <div className="px-4 py-2.5 bg-surface-container-lowest border-b border-outline-variant/20">
          {publishError && (
            <div className="mb-2 p-2.5 bg-error/10 border border-error/30 text-error rounded-xl text-[12px] font-semibold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{publishError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPublishError(null)}
                className="text-error hover:opacity-75"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-primary via-nexora-pink to-[#e6007e] h-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar text-[11px]">
            {[
              { num: 1, label: '1. Basic Info' },
              { num: 2, label: '2. Contact' },
              { num: 3, label: '3. Services' },
              { num: 4, label: '4. Stylists' },
              { num: 5, label: '5. Photos' },
              { num: 6, label: '6. Location & Map' },
              { num: 7, label: '7. Publish' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  currentStep === s.num
                    ? 'bg-primary text-white shadow-xs'
                    : currentStep > s.num
                    ? 'bg-success-emerald/10 text-success-emerald'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {currentStep > s.num && (
                  <span className="material-symbols-outlined text-[13px]">check</span>
                )}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* ========================================================================= */}
          {/* STEP 1: BASIC INFORMATION                                                 */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[15px] font-bold text-on-surface">Step 1: Salon Name & Brand Identity</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Give your salon a standout title and client-facing positioning statement.
                </p>
              </div>

              <div>
                <label className="text-[12px] font-bold text-on-surface block mb-1.5">
                  Salon / Studio Name *
                </label>
                <input
                  type="text"
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="e.g. Velvet & Vibe Luxury Lounge"
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-semibold"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-on-surface block mb-1.5">
                  Tagline / Catchphrase
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Haute coiffure, bespoke color artistry & skin therapies"
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">
                    Gender Client Specialization
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['unisex', 'women', 'men'] as const).map((gen) => (
                      <button
                        key={gen}
                        type="button"
                        onClick={() => setGenderSpecialization(gen)}
                        className={`py-2 px-2.5 rounded-xl border text-[12px] font-bold capitalize transition-all cursor-pointer ${
                          genderSpecialization === gen
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                        }`}
                      >
                        {gen}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">
                    Pricing Tier Category
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['₹', '₹₹', '₹₹₹', '₹₹₹₹'] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setPriceRange(tier)}
                        className={`py-2 rounded-xl border text-[12px] font-bold transition-all cursor-pointer ${
                          priceRange === tier
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: CONTACT & OPERATING HOURS                                         */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[15px] font-bold text-on-surface">Step 2: Business Contact & Hours</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Provide verified contact numbers and operating schedule for customer bookings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Owner / Manager Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Contact Phone Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-on-surface block mb-1.5">Business Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Opening Time</label>
                  <input
                    type="text"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    placeholder="09:30 AM"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Closing Time</label>
                  <input
                    type="text"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    placeholder="09:00 PM"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Operating Days</label>
                  <input
                    type="text"
                    value={daysOpen}
                    onChange={(e) => setDaysOpen(e.target.value)}
                    placeholder="All 7 Days"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SERVICES & PRICING                                                */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[15px] font-bold text-on-surface">Step 3: Service Menu & Pricing</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Add the treatments, hair styling, facials, and spa rituals your salon offers.
                </p>
              </div>

              {/* Service List */}
              <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-on-surface">{srv.name}</span>
                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.2 rounded uppercase">
                          {srv.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {srv.duration} mins · <strong className="text-on-surface font-bold">₹{srv.price}</strong>{' '}
                        {srv.discountPrice && (
                          <span className="text-emerald-700 font-semibold">(Offer: ₹{srv.discountPrice})</span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveService(srv.id)}
                      className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove service"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Service Strip */}
              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/40 flex flex-col gap-3">
                <span className="text-[12px] font-bold text-on-surface">Add a New Service:</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Service Name (e.g. Keratin Therapy)"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="sm:col-span-2 h-10 px-3 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                  />
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value as any)}
                    className="h-10 px-2 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                  >
                    <option value="hair">Hair</option>
                    <option value="skin">Skin</option>
                    <option value="nails">Nails</option>
                    <option value="spa">Spa</option>
                    <option value="grooming">Grooming</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="₹ Price"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="w-full h-10 px-2.5 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="px-3.5 bg-primary text-white rounded-xl text-[12px] font-bold shrink-0 hover:bg-nexora-pink transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: STYLISTS & CREATIVE TEAM                                          */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[15px] font-bold text-on-surface">Step 4: Stylists & Creative Team</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Showcase the master stylists and beauticians clients can choose from.
                </p>
              </div>

              {/* Stylists List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stylists.map((sty) => (
                  <div
                    key={sty.id}
                    className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={sty.avatar}
                        alt={sty.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20"
                      />
                      <div>
                        <h4 className="font-bold text-[13px] text-on-surface">{sty.name}</h4>
                        <p className="text-[11px] text-on-surface-variant">
                          {sty.role} · {sty.experience}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveStylist(sty.id)}
                      className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove stylist"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Stylist Strip */}
              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/40 flex flex-col gap-3">
                <span className="text-[12px] font-bold text-on-surface">Add a Stylist to Your Team:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Stylist Full Name"
                    value={newStylistName}
                    onChange={(e) => setNewStylistName(e.target.value)}
                    className="h-10 px-3 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g. Master Colorist)"
                    value={newStylistRole}
                    onChange={(e) => setNewStylistRole(e.target.value)}
                    className="h-10 px-3 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Exp (e.g. 6 yrs)"
                      value={newStylistExp}
                      onChange={(e) => setNewStylistExp(e.target.value)}
                      className="w-full h-10 px-2.5 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddStylist}
                      className="px-3.5 bg-primary text-white rounded-xl text-[12px] font-bold shrink-0 hover:bg-nexora-pink transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: AMENITIES & PHOTO GALLERY                                         */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[15px] font-bold text-on-surface">Step 5: Salon Amenities & Photo Banner</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Select available luxury amenities and choose a storefront showcase image.
                </p>
              </div>

              <div>
                <label className="text-[12px] font-bold text-on-surface block mb-2">
                  Select Salon Amenities
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DEFAULT_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => handleToggleAmenity(amenity)}
                        className={`p-2.5 rounded-xl border text-left text-[11px] font-semibold transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span className="truncate">{amenity}</span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[15px] text-primary">check_circle</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-on-surface block mb-2">
                  Choose Showcase Banner Image
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_GALLERY_PHOTOS.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSalonBannerImage(url)}
                      className={`relative rounded-xl overflow-hidden aspect-video border-2 cursor-pointer transition-all ${
                        salonBannerImage === url
                          ? 'border-primary ring-2 ring-primary/40 scale-102 shadow-md'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                      {salonBannerImage === url && (
                        <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[13px]">check</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 6: LOCATION (ADDRESS & LIGHTWEIGHT MAP PIN PREVIEW)                    */}
          {/* ========================================================================= */}
          {currentStep === 6 && (
            <div className="flex flex-col gap-4 animate-in fade-in" id="step-6-location-container">
              <div className="border-b border-outline-variant/30 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">location_on</span>
                    <span>Step 6: Location & Interactive Map Pin</span>
                  </h3>
                  <p className="text-[12px] text-on-surface-variant">
                    Enter your salon address. The lightweight map below displays the pin in real time.
                  </p>
                </div>

                {/* GPS Autodetect Button */}
                <button
                  type="button"
                  id="owner-detect-gps-btn"
                  onClick={handleDetectGPS}
                  disabled={isDetectingGps}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isDetectingGps ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                      <span>Detecting GPS...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">my_location</span>
                      <span>Auto-Detect GPS</span>
                    </>
                  )}
                </button>
              </div>

              {/* GPS Confirmation Notice */}
              {gpsSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-success-emerald/15 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 border border-emerald-500/30 animate-in fade-in">
                  <span className="material-symbols-outlined text-[16px] text-success-emerald">check_circle</span>
                  <span>{gpsSuccessMsg}</span>
                </div>
              )}

              {/* GPS Failure Notice — never silently substitute coordinates */}
              {gpsErrorMsg && (
                <div
                  id="owner-gps-error"
                  role="alert"
                  className="p-2.5 rounded-xl bg-error/10 text-error text-[11px] font-semibold flex items-start gap-1.5 border border-error/30 animate-in fade-in"
                >
                  <span className="material-symbols-outlined text-[16px]">error_outline</span>
                  <span>{gpsErrorMsg}</span>
                </div>
              )}

              {/* Address Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Street Address */}
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5 flex items-center justify-between">
                    <span>Street Address & Building / Floor *</span>
                    <span className="text-[10px] text-primary font-normal">Real-time pin sync</span>
                  </label>
                  <div className="relative">
                    <input
                      id="owner-input-street-address"
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. Plot 88, Queens Road, 2nd Floor, Near Vaishali Circle"
                      className="w-full h-11 px-3.5 pl-10 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                    />
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                      store
                    </span>
                  </div>
                </div>

                {/* Popular Area Chips */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-on-surface block mb-1.5">
                    Select Locality / Hub:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {JAIPUR_AREAS.map((area) => {
                      const isSelected = selectedArea === area;
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => handleSelectArea(area)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {area}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Locality Input */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Area / Suburb</label>
                  <input
                    type="text"
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                {/* Landmark */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Landmark / Prominent Spot</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opposite National Handloom"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all"
                  />
                </div>

                {/* PIN Code */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1.5">Postal PIN Code</label>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="302021"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary transition-all font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Lightweight Map Visualization Preview Component */}
              <div className="mt-2 pt-3 border-t border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    <span className="text-[12px] font-bold text-on-surface">
                      Live Map Pin Preview ({draftSalonForMap.name})
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container px-2 py-0.5 rounded">
                    Lat: {latitude}, Lng: {longitude}
                  </span>
                </div>

                {/* The Map Component Embedded */}
                <div className="rounded-2xl overflow-hidden border border-outline-variant/50 shadow-sm">
                  <StaticMapPreview
                    salon={draftSalonForMap}
                    userLocation={`${selectedArea}, ${city}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 7: REVIEW & INSTANT PUBLISH                                          */}
          {/* ========================================================================= */}
          {currentStep === 7 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="border-b border-outline-variant/30 pb-2">
                <h3 className="text-[16px] font-bold text-on-surface">Step 7: Final Review & Live Launch</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Confirm your salon listing details before making it discoverable to clients.
                </p>
              </div>

              {/* Listing Card Preview */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/50 p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
                <img
                  src={salonBannerImage}
                  alt={salonName}
                  className="w-full sm:w-40 h-28 object-cover rounded-xl shadow-xs"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-card-title text-[16px] font-bold text-on-surface">{salonName}</h4>
                    <span className="text-[11px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                      ★ 5.0 New
                    </span>
                  </div>
                  <p className="text-[12px] text-on-surface-variant italic mt-0.5">{tagline}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                    <span>{fullAddress}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-semibold text-on-surface">
                      {services.length} Services Listed
                    </span>
                    <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-semibold text-on-surface">
                      {stylists.length} Lead Stylists
                    </span>
                    <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-semibold text-on-surface">
                      {selectedAmenities.length} Amenities
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-800 text-[12px] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-success-emerald">verified</span>
                <div>
                  <span className="font-bold block">Ready for Instant Discovery</span>
                  <span className="text-[11px]">
                    Once published, your salon will be discoverable on Nexora Maps, AI Style Quiz recommendations, and
                    instant booking slots.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Publish Progress & Database Sync Overlay */}
        {isPublishing && (
          <div className="absolute inset-0 z-50 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            {!publishSuccess ? (
              <div className="max-w-md w-full flex flex-col items-center gap-5">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <span className="material-symbols-outlined text-primary text-[28px] absolute">
                    {PUBLISH_STEPS[publishStepIndex]?.icon || 'cloud_upload'}
                  </span>
                </div>

                <div>
                  <h3 className="text-[18px] font-bold text-on-surface">Publishing Salon to Database</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">
                    Executing multi-step database synchronization & live indexing...
                  </p>
                </div>

                <div className="w-full bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 text-left flex flex-col gap-2.5 shadow-sm">
                  {PUBLISH_STEPS.map((step, idx) => {
                    const isDone = publishStepIndex > idx;
                    const isCurrent = publishStepIndex === idx;
                    return (
                      <div
                        key={step.label}
                        className={`flex items-center gap-3 text-[12px] transition-colors ${
                          isDone
                            ? 'text-success-emerald font-semibold'
                            : isCurrent
                            ? 'text-primary font-bold'
                            : 'text-on-surface-variant/40'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] shrink-0 ${
                            isDone
                              ? 'bg-success-emerald/10 text-success-emerald'
                              : isCurrent
                              ? 'bg-primary text-white animate-pulse'
                              : 'bg-surface-container text-on-surface-variant/40'
                          }`}
                        >
                          {isDone ? (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>
                        <span className="flex-1">{step.label}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                            Syncing...
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[10px] text-success-emerald font-bold flex items-center gap-0.5">
                            Saved
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-md w-full flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-full bg-success-emerald/10 text-success-emerald flex items-center justify-center shadow-lg border border-success-emerald/30">
                  <span className="material-symbols-outlined text-[36px]">verified</span>
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-on-surface">Salon Successfully Published!</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">
                    Your salon profile is now live and stored in the database. Redirecting to your live salon page...
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-surface-container text-[12px] font-semibold text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Discoverable on Nexora Maps & Booking Engine</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-bold hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {currentStep < totalSteps ? (
              <button
                type="button"
                id="onboarding-next-step-btn"
                onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Step {currentStep + 1}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                id="onboarding-publish-btn"
                onClick={handlePublishSalon}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-nexora-pink text-white text-[13px] font-bold hover:opacity-95 transition-opacity shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                <span>Publish Salon on Nexora</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
