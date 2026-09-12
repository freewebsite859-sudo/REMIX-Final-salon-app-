export interface Stylist {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  avatarUrl?: string;
  bio?: string;
  rating?: number;
  experience?: string;
  specialty?: string[];
  specialties?: string[];
  phone?: string;
  assignedServices?: string[];
  status?: string;
  accessRole?: string;
  commissionRate?: number;
  hidePhone?: boolean;
}

export interface SalonService {
  id: string;
  name: string;
  category: string;
  duration?: number; // minutes
  durationMinutes?: number;
  price: number;
  discountPrice?: number;
  description: string;
  popular?: boolean;
  icon?: string;
  showDuration?: boolean;
}

export interface Review {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  date: string;
  comment: string;
  serviceUsed?: string;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  title: string;
  category: 'interior' | 'hair' | 'skin' | 'nails' | 'spa' | 'bridal';
  description?: string;
  treatmentName?: string;
  stylistName?: string;
  tag?: string;
}

export interface Salon {
  id: string;
  name: string;
  tagline: string;
  categories: string[];
  /**
   * Curated search tags covering common phrasings users actually type
   * (e.g. 'barber shop', 'mens salon', 'hydra facial'). Optional so remote
   * catalog rows without tagging still normalize cleanly.
   */
  tags?: string[];
  /**
   * Broad match keywords including frequent misspellings and local lingo
   * (e.g. 'barbar', 'saloon', 'gents parlour') so general queries never
   * return an empty result set. Fed into the fuzzy search index.
   */
  keywords?: string[];
  rating: number;
  reviewCount: number;
  distance: string; // e.g. "1.2 km"
  location: {
    area: string;
    city: string;
    address: string;
    latitude: number;
    longitude: number;
    mapsUrl?: string;
  };
  image: string;
  gallery: string[];
  photoGallery?: GalleryPhoto[];
  isOpen: boolean;
  openingHours: string;
  priceRange: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹' | '$' | '$$' | '$$$';
  featured?: boolean;
  trending?: boolean;
  services: SalonService[];
  stylists: Stylist[];
  reviews: Review[];
  amenities: string[];
  discountOffer?: string;
  phone?: string;
  gender: 'unisex' | 'women' | 'men';
  videoReels?: SalonVideoReel[];
  socialVideos?: SocialVideo[];
}

/**
 * Booking lifecycle status shown across confirmation, appointments list,
 * and notifications.
 *
 *   pending   — submitted, awaiting salon/owner lock-in
 *   confirmed — slot locked; customer should attend
 *   completed — visit finished
 *   cancelled — cancelled by customer or salon
 *   no_show   — customer missed the appointment
 *
 * Legacy `in_progress` values are normalized to `confirmed` on read.
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  /** @deprecated Prefer `confirmed`. Kept for older stored rows. */
  | 'in_progress';

/** Delivery state of the WhatsApp confirmation message. */
export type WhatsAppConfirmationStatus =
  | 'sent'
  | 'queued'
  | 'not_sent'
  | 'failed';

export interface Appointment {
  id: string;
  salonId: string;
  salonName: string;
  salonAddress: string;
  salonImage: string;
  salonPhone?: string;
  services: SalonService[];
  stylist?: Stylist;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "5:30 PM"
  status: BookingStatus;
  totalPrice: number;
  advancePaid?: number; // 25% advance amount paid online
  remainingAmount?: number; // 75% balance payable at salon
  paymentMode?: 'advance_25' | 'full' | 'pay_at_salon';
  paymentStatus?: 'paid' | 'pending' | 'failed';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  paymentMethodUsed?: 'upi' | 'card' | 'netbanking' | 'qr' | 'wallet';
  salonConfirmationStatus?: 'confirmed_by_owner' | 'auto_verified' | 'pending_owner_approval';
  ownerConfirmedAt?: string;
  ownerName?: string;
  discountApplied?: number;
  bookingRef: string;
  notes?: string;
  createdAt: string;
  mapsUrl?: string;
  /** Canonical salon coordinates copied from the backend booking record. */
  salonLatitude?: number;
  salonLongitude?: number;
  /** WhatsApp booking-confirmation delivery state. */
  whatsappConfirmationStatus?: WhatsAppConfirmationStatus;
  /** ISO timestamp when the WhatsApp confirmation was sent. */
  whatsappSentAt?: string;
  /** True when this booking was opened from history (enables Rebook CTA). */
  rebookFromHistory?: boolean;
  /**
   * True when the booking was created by the on-device demo store (no live
   * Supabase project configured). Screens use it to label the booking as a
   * demo record instead of implying a captured gateway payment.
   */
  isDemoBooking?: boolean;
}

/**
 * Primary customer bottom-nav destinations (post-login sticky bar):
 * Home · Search · Bookings · Rewards · Profile
 *
 * `saved` is retained for the Favourites screen (reachable from Profile) and
 * is not a bottom-nav item.
 */
export type ActiveTab = 'home' | 'search' | 'bookings' | 'rewards' | 'profile' | 'saved';

export interface SavedServiceRef {
  salonId: string;
  serviceId: string;
}

export interface SavedStaffRef {
  salonId: string;
  stylistId: string;
}

export interface ReferredFriend {
  id: string;
  name: string;
  avatar?: string;
  date: string;
  reward: string;
  status: 'completed' | 'pending';
}

export type AppUserRole = 'customer' | 'salon_owner';

/** A saved service/home address used for bookings and directions. */
export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  isDefault?: boolean;
  createdAt?: string;
}

/** Membership tiers. `standard` means no paid membership is active. */
export type MembershipTier = 'standard' | 'silver' | 'gold' | 'platinum';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  locationArea: string;
  city: string;
  loyaltyPoints: number;
  role?: AppUserRole;
  dateOfBirth?: string;
  gender?: 'men' | 'women';
  preferredServices: string[];
  genderPreference: 'all' | 'women' | 'men' | 'unisex';
  hairProfile?: string;
  hairType?: string;
  desiredLength?: string;
  faceShape?: string;
  stylingGoal?: string;
  skinConcern?: string;
  favoriteStylist?: string;
  defaultLocality?: string;
  // Membership
  membershipTier?: MembershipTier;
  membershipExpiresAt?: string;
  // Saved addresses (home/work/service locations)
  savedAddresses?: SavedAddress[];
  // Referral & Rewards
  referralCode?: string;
  referralCount?: number;
  referralEarnings?: number;
  claimedDiscounts?: number;
  referredFriends?: ReferredFriend[];
  // Loyalty & Rewards state
  claimedRewardIds?: string[];
  // App Settings & Preferences
  notificationsEnabled?: boolean;
  appointmentReminders?: boolean;
  bookingConfirmationNotification?: boolean;
  rewardsNotification?: boolean;
  referralUpdatesNotification?: boolean;
  promotionalOffers?: boolean;
  whatsappAlerts?: boolean;
  appTheme?: 'light' | 'dark' | 'system';
  language?: 'en' | 'hi';
}

export interface RecommendedServiceMatch {
  salonId: string;
  salonName: string;
  salonImage: string;
  salonAddress: string;
  serviceId: string;
  serviceName: string;
  category: string;
  price: number;
  discountPrice?: number;
  duration: number;
  matchScore: number;
  matchReason: string;
  serviceDescription: string;
}

export interface PositiveTheme {
  theme: string;
  percentage: number;
  mentionsCount: number;
  sampleQuote: string;
  tag: string;
}

export interface NegativeTheme {
  theme: string;
  percentage: number;
  mentionsCount: number;
  sampleQuote: string;
  recommendation: string;
  tag: string;
}

export interface SalonSentimentSummary {
  salonId: string;
  salonName: string;
  overallSentiment: 'Overwhelmingly Positive' | 'Very Positive' | 'Mostly Positive' | 'Mixed';
  sentimentScore: number; // 0-100
  positivePercentage: number;
  neutralPercentage: number;
  negativePercentage: number;
  executiveSummary: string;
  topPositiveThemes: PositiveTheme[];
  topNegativeThemes: NegativeTheme[];
  standoutStylists: string[];
  bestForServices: string[];
  vibeBadge: string;
  analyzedReviewCount?: number;
}

export interface AIStyleQuizResult {
  styleSummary: string;
  faceShapeAnalysis: string;
  hairTypeSuitability: string;
  recommendedCutsAndStyles: string[];
  recommendedServices: RecommendedServiceMatch[];
  homeCareTips: string[];
}

export interface LoyaltyReward {
  id: string;
  title: string;
  category: 'discount' | 'free_service' | 'upgrade' | 'multiplier';
  pointsRequired: number;
  discountValue?: number; // In INR, e.g. 200
  discountCode: string;
  description: string;
  isUnlocked: boolean;
  basedOnHistory?: string;
  badgeLabel?: string;
  serviceCategory?: 'hair' | 'skin' | 'nails' | 'spa' | 'grooming' | 'all';
}

export interface LoyaltyActivityItem {
  id: string;
  title: string;
  type: 'earned' | 'redeemed' | 'bonus';
  points: number;
  date: string;
  source: 'appointment' | 'referral' | 'review' | 'quiz' | 'birthday';
  appointmentRef?: string;
  salonName?: string;
  serviceName?: string;
}

export interface SpendMilestoneReward {
  id: string;
  title: string;
  requiredSpend: number;
  discountValue: number;
  discountCode: string;
  description: string;
  perkBadge: string;
  isUnlocked: boolean;
  unlockedAtDate?: string;
}

export type ReminderFrequencyOption = '2_days' | '3_days' | 'weekly' | 'custom';
export type CampaignStatus = 'active' | 'paused' | 'stopped' | 'draft';

export interface AutoReminderConfig {
  isEnabled: boolean;
  status: CampaignStatus;
  customerGroup: string;
  startDate: string;
  endDate: string;
  sendTime: string;
  selectedOffer: string;
  messageTemplate: string;
  maximumReminders: number;
  frequency: ReminderFrequencyOption;
  customDays?: number;
  stopAfterBooking: boolean;
  stopAfterOfferExpiry: boolean;
  skipRecentlyContacted: boolean;
  skipRecentlyContactedDays: number;
  excludeUnsubscribed: boolean;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  campaignStats?: {
    audienceCount: number;
    sentCount: number;
    bookedCount: number;
    optOutCount: number;
    conversionRate: number;
  };
}

export type AppView =
  | 'landing'
  | 'wizard'
  | 'preview'
  | 'dashboard'
  | 'staffPerformance'
  | 'staffCommission'
  | 'growthPartner'
  | 'bookings'
  | 'bookingDetail';

export type BusinessTypeId = 
  | 'hair_salon'         // Hair Cut & Styling Studio
  | 'barber'             // Barber Shop / Men's Grooming
  | 'unisex_salon'       // Unisex Salon
  | 'beauty_parlour'     // Beauty Parlour
  | 'nail_studio'        // Nail Studio
  | 'hair_spa'           // Hair Spa & Treatment
  | 'skincare_clinic'    // Facial & Skincare Clinic
  | 'makeup_studio'      // Makeup Studio
  | 'massage_wellness'   // Massage & Wellness Center
  | 'hair_coloring'      // Hair Coloring Studio
  | 'bridal_lounge'      // Bridal Makeup & Makeover Lounge
  | 'tattoo_studio'      // Tattoo & Body Art Studio
  | 'lash_brow'          // Lash & Brow Bar
  | 'ayurvedic_spa'      // Ayurvedic Rejuvenation Spa
  | 'ayurvedic_wellness_spa' // Ayurvedic & Wellness Spa
  | 'luxury_hair_salon' // Premium Luxury Hair Salon
  | 'bridal_makeover_studio' // Bridal & Makeover Studio
  | 'family_salon' // Modern Unisex Family Salon
  | 'barber_grooming_club' // Gentlemen's Barber & Grooming Club
  | 'nails_lash_brow_bar' // Nails, Lash & Brow Bar
  | 'medispa_aesthetics' // Medi-Spa & Skin Aesthetics Clinic
  | 'organic_bio_salon' // Organic & Eco-Friendly Bio-Salon
  | 'express_beauty_bar' // Express & Quick Beauty Bar
  | 'thai_massage_center' // Thai & Oriental Massage Center
  | 'kids_teens_studio' // Kids & Teens Fun Hair Studio
  | 'resort_spa' // Luxury Hotel & Resort Spa
  | 'vedic_ayurveda_studio'; // Vedic Ayurveda Wellness Studio

export type LayoutStyle = 
  | 'modern_minimalist'
  | 'vintage_industrial'
  | 'contemporary_balanced'
  | 'curved_elegant'
  | 'bento_grid'
  | 'zen_emerald'
  | 'clinical_clean'
  | 'dark_glam'
  | 'earth_bamboo'
  | 'creative_gallery'
  | 'royal_crimson'
  | 'urban_monochrome'
  | 'chic_nude'
  | 'ayurvedic_terracotta'
  | 'botanical_wellness'
  | 'haute_luxe'
  | 'ivory_pearl_bridal'
  | 'family_fresh'
  | 'gents_club'
  | 'berry_pearl_bar'
  | 'medispa_porcelain'
  | 'organic_meadow'
  | 'express_pop'
  | 'oriental_silk'
  | 'candy_playroom'
  | 'resort_luxe'
  | 'vedic_marigold';

export interface BusinessTypeOption {
  id: BusinessTypeId;
  title: string;
  categoryTag: string;
  icon: string;
  aestheticDescription: string;
  description?: string;
  paletteName: string;
  badge: string;
  defaultServices: Array<{ name: string; price: number; duration: number; category: string }>;
}

export type SalonThemePreset = 
  | 'slate_silver'
  | 'vintage_brass'
  | 'pastel_blush'
  | 'rose_gold_ivory'
  | 'neon_gloss_bento'
  | 'emerald_sage'
  | 'clinical_sky_blue'
  | 'obsidian_gold'
  | 'earth_bamboo'
  | 'chroma_gradient'
  | 'royal_crimson_gold'
  | 'urban_monochrome'
  | 'chic_nude_beige'
  | 'ayurvedic_terracotta'
  | 'sage_jade_botanical'
  | 'onyx_champagne_gold'
  | 'ivory_blush_pearl'
  | 'sky_cream_family'
  | 'midnight_copper_club'
  | 'berry_blush_pearl'
  | 'porcelain_sage_teal'
  | 'fern_linen_organic'
  | 'coral_slate_express'
  | 'temple_saffron_silk'
  | 'cotton_candy_sky'
  | 'azure_champagne_luxe'
  | 'marigold_warm_sand';

export interface CategoryTemplateConfig {
  id: BusinessTypeId;
  title: string;
  shortName: string;
  tagline: string;
  about: string;
  icon: string;
  layoutStyle: LayoutStyle;
  paletteLabel: string;
  themePreset: SalonThemePreset;
  subCategories: string[];
  defaultCity: string;
  defaultAddress: string;
  defaultPostalCode: string;
  phone: string;
  whatsapp: string;
  ownerName: string;
  ownerRole: string;
  ownerPhotoUrl: string;
  coverImageUrl: string;
  instagramHandle: string;
  themeStyle: {
    heroBackground: string;
    heroTextColor: string;
    cardBorder: string;
    cardBackground: string;
    cardRadius: string;
    accentColor: string;
    accentBg: string;
    badgeBg: string;
    badgeText: string;
    buttonBg: string;
    buttonText: string;
    priceColor: string;
    isDark?: boolean;
    headerBanner?: string;
  };
  services: SalonService[];
  stylists: Stylist[];
  videoReels?: SalonVideoReel[];
  socialVideos?: SocialVideo[];
}

export interface SalonVideoReel {
  id: string;
  salonId: string;
  salonName: string;
  salonImage: string;
  salonRating: number;
  salonLocation?: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string;
  views?: string;
  likes?: string;
  category: string;
  serviceName?: string;
  servicePrice?: number;
  serviceId?: string;
  stylistName?: string;
  tags?: string[];
  isOwnerHighlight?: boolean;
}

export type VideoCategoryTag = 'SHOWCASE' | 'SHORT' | 'LONG';

export interface SocialVideo {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  description?: string;
  channelTitle?: string;
  thumbnailUrl: string;
  categoryTag: VideoCategoryTag;
  isOwnerVideo: boolean;
  views?: string;
  transformationTag?: string;
}

export interface HomeServiceConfig {
  enabled: boolean;
  baseCharge: number;
  radiusLimitKm: number;
}

export type PromoBannerTheme = 
  | 'gradient_purple'
  | 'royal_gold'
  | 'rose_velvet'
  | 'emerald_botanical'
  | 'obsidian_glam'
  | 'sunset_coral'
  | 'custom';

export interface PromotionalBannerConfig {
  enabled: boolean;
  text: string;
  discountCode?: string;
  badgeText?: string;
  buttonText?: string;
  buttonAction?: 'book' | 'copy';
  themePreset?: PromoBannerTheme;
  customBgColor?: string;
  customTextColor?: string;
  startDate?: string;
  endDate?: string;
}

export interface SalonOffer {
  id: string;
  title: string;
  description: string;
  discountValue: string;
  code: string;
  imageUrl?: string;
  startDate?: string;
  expiryDate?: string;
  terms?: string;
  isActive: boolean;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalVisits?: number;
  totalSpent?: number;
  lastVisit?: string;
  notes?: string;
  favoriteStylist?: string;
  points?: number;
  lifetimePoints?: number;
}

export interface SalonProfile {
  ownerId?: string;
  businessType: BusinessTypeId;
  businessName: string;
  ownerName: string;
  ownerRole: string;
  phone: string;
  whatsapp: string;
  email: string;
  dob?: string;
  whatsappNotificationsEnabled?: boolean;
  tagline: string;
  about: string;
  ownerPhotoUrl: string;
  coverImageUrl: string;
  logoUrl?: string;
  address: string;
  shopFlatNo?: string;
  city: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  areaLocality?: string;
  landmark?: string;
  postalCode?: string;
  themePreset?: SalonThemePreset;
  currency?: string;
  subdomain?: string;
  customDomain?: string;
  customAccentColor?: string;
  brandColor?: string;
  requireDeposit?: boolean;
  depositPercentage?: number;
  instagramHandle?: string;
  facebookUrl?: string;
  facebookPage?: string;
  tiktokUrl?: string;
  tiktokProfile?: string;
  tiktokHandle?: string;
  youtubeChannel?: string;
  googleBusinessUrl?: string;
  whiteLabelEnabled?: boolean;
  heroImages?: string[];
  offers?: SalonOffer[];
  galleryPhotos?: GalleryPhoto[];
  subCategories?: string[];
  themeAccentKey?: string;
  homeService?: HomeServiceConfig;
  promotionalBanner?: PromotionalBannerConfig;
  customThemeOverride?: Record<string, string>;
  isLivePublished?: boolean;
  socialVideos?: SocialVideo[];
}


