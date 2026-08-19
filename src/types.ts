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
  discountApplied?: number;
  bookingRef: string;
  notes?: string;
  createdAt: string;
  mapsUrl?: string;
}

export interface GroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        snippet?: string;
      }[];
    };
  };
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface AISalonRecommendation {
  summary: string;
  recommendations: {
    salonName: string;
    service: string;
    highlight: string;
    approxPrice: string;
    mapsUrl?: string;
  }[];
  groundingSources: GroundingChunk[];
}

export type ActiveTab = 'home' | 'explore' | 'appointments' | 'saved' | 'profile';

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

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  locationArea: string;
  city: string;
  loyaltyPoints: number;
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
  // Referral & Rewards
  referralCode?: string;
  referralCount?: number;
  referralEarnings?: number;
  claimedDiscounts?: number;
  referredFriends?: ReferredFriend[];
  // App Settings & Preferences
  notificationsEnabled?: boolean;
  appointmentReminders?: boolean;
  promotionalOffers?: boolean;
  whatsappAlerts?: boolean;
  aiAdvisorAlerts?: boolean;
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
  groundingSources?: GroundingChunk[];
}
