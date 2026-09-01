export interface Stylist {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  experience: string;
  specialty: string[];
}

export interface SalonService {
  id: string;
  name: string;
  category: 'hair' | 'skin' | 'nails' | 'spa' | 'grooming' | 'bridal';
  duration: number; // minutes
  price: number;
  discountPrice?: number;
  description: string;
  popular?: boolean;
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
}

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
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
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
}

export type ActiveTab = 'home' | 'appointments' | 'saved' | 'profile';

export interface SavedServiceRef {
  salonId: string;
  serviceId: string;
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
  promotionalOffers?: boolean;
  whatsappAlerts?: boolean;
  appTheme?: 'light' | 'dark' | 'system';
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
