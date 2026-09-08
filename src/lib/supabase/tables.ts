/**
 * Nexora SalonOS Customer App — canonical table registry.
 *
 * These are the ONLY table names the customer app is allowed to use. The app
 * must not invent new tables, must not rename existing ones, and must never
 * drop/reset data. All reads/writes go through these constants so the schema
 * name can be detected once and reused everywhere.
 *
 * The registry intentionally does not include helper tables that belong to
 * the server/ECOSYSTEM (referral_codes, notification_preferences, etc.) —
 * it is scoped to the 18 customer-app tables requested for this app.
 */
export const SALONOS_TABLES = {
  profiles: 'profiles',
  salons: 'salons',
  salonServices: 'salon_services',
  salonStaff: 'salon_staff',
  staffSlots: 'staff_slots',
  bookings: 'bookings',
  bookingServices: 'booking_services',
  favourites: 'favourites',
  reviews: 'reviews',
  rewardWallets: 'reward_wallets',
  rewardTransactions: 'reward_transactions',
  customerQrPayments: 'customer_qr_payments',
  memberships: 'memberships',
  referrals: 'referrals',
  notifications: 'notifications',
  searchHistory: 'search_history',
  offers: 'offers',
  offerRedemptions: 'offer_redemptions',
} as const;

export type SalonOSTableName = (typeof SALONOS_TABLES)[keyof typeof SALONOS_TABLES];

/**
 * All 18 tables the customer app depends on.
 */
export const CUSTOMER_APP_TABLES: SalonOSTableName[] = Object.values(SALONOS_TABLES) as SalonOSTableName[];

export const CUSTOMER_APP_TABLE_COUNT = CUSTOMER_APP_TABLES.length;

/**
 * Read-only tables surfaced to every authenticated customer (active/open rows
 * only in normal operation). Private rows are owned by the signed-in user and
 * filtered by `user_id`.
 */
export const READ_ONLY_TABLES: SalonOSTableName[] = [
  'salons',
  'salon_services',
  'salon_staff',
  'staff_slots',
  'offers',
] as SalonOSTableName[];

export const PRIVATE_TABLES: SalonOSTableName[] = [
  'profiles',
  'favourites',
  'reviews',
  'reward_wallets',
  'reward_transactions',
  'customer_qr_payments',
  'memberships',
  'referrals',
  'notifications',
  'search_history',
  'offer_redemptions',
] as SalonOSTableName[];

export function isReadOnlyTable(name: string): boolean {
  return READ_ONLY_TABLES.includes(name as SalonOSTableName);
}

export function isPrivateTable(name: string): boolean {
  return PRIVATE_TABLES.includes(name as SalonOSTableName);
}
