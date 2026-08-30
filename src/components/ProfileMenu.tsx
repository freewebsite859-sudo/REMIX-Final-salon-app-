import React from 'react';

export interface ProfileMenuProps {
  unreadNotifications?: number;
  bookingsCount?: number;
  favouritesCount?: number;
  addressesCount?: number;
  onPersonalInformation: () => void;
  onMyBookings: () => void;
  onFavourites: () => void;
  onReferral: () => void;
  onMembership: () => void;
  onRewards: () => void;
  onNotifications: () => void;
  onAddresses: () => void;
  onSupport: () => void;
  onAppSettings: () => void;
  onPrivacyPolicy: () => void;
  onTerms: () => void;
  onLogout: () => void;
}

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  description: string;
  action: () => void;
  badge?: number;
  tone?: 'default' | 'danger';
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

/**
 * Customer profile menu.
 *
 * A navigation index over the profile's own sections and the app's real
 * destinations — it never fabricates counts: a badge only renders when the
 * caller supplies a number greater than zero.
 */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  unreadNotifications = 0,
  bookingsCount = 0,
  favouritesCount = 0,
  addressesCount = 0,
  onPersonalInformation,
  onMyBookings,
  onFavourites,
  onReferral,
  onMembership,
  onRewards,
  onNotifications,
  onAddresses,
  onSupport,
  onAppSettings,
  onPrivacyPolicy,
  onTerms,
  onLogout,
}) => {
  // Groups are ordered so the rendered menu matches the product spec exactly:
  // Personal Information, My Bookings, Favourites, Referral, Membership,
  // Rewards, Notifications, Addresses, Support, App Settings, Privacy Policy,
  // Terms, Logout. Group headings never re-order these items.
  const groups: MenuGroup[] = [
    {
      title: 'Account',
      items: [
        {
          key: 'personal-information',
          label: 'Personal Information',
          icon: 'manage_accounts',
          description: 'Name, mobile, email, DOB, photo & preferred location',
          action: onPersonalInformation,
        },
        {
          key: 'my-bookings',
          label: 'My Bookings',
          icon: 'event_note',
          description: 'Upcoming and past salon appointments',
          action: onMyBookings,
          badge: bookingsCount,
        },
        {
          key: 'favourites',
          label: 'Favourites',
          icon: 'favorite',
          description: 'Saved salons and services',
          action: onFavourites,
          badge: favouritesCount,
        },
      ],
    },
    {
      title: 'Programme',
      items: [
        {
          key: 'referral',
          label: 'Referral',
          icon: 'redeem',
          description: 'Invite friends and track your invites',
          action: onReferral,
        },
        {
          key: 'membership',
          label: 'Membership',
          icon: 'card_membership',
          description: 'Tier, benefits and renewal date',
          action: onMembership,
        },
        {
          key: 'rewards',
          label: 'Rewards',
          icon: 'loyalty',
          description: 'Points balance and redeemable credit',
          action: onRewards,
        },
        {
          key: 'notifications',
          label: 'Notifications',
          icon: 'notifications',
          description: 'Booking, reward and offer updates',
          action: onNotifications,
          badge: unreadNotifications,
        },
      ],
    },
    {
      title: 'Locations',
      items: [
        {
          key: 'addresses',
          label: 'Addresses',
          icon: 'location_on',
          description: 'Home, work and service locations',
          action: onAddresses,
          badge: addressesCount,
        },
      ],
    },
    {
      title: 'App & Support',
      items: [
        {
          key: 'support',
          label: 'Support',
          icon: 'support_agent',
          description: 'Contact the Nexora care team',
          action: onSupport,
        },
        {
          key: 'app-settings',
          label: 'App Settings',
          icon: 'settings',
          description: 'Notification preferences, alerts and theme',
          action: onAppSettings,
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          key: 'privacy-policy',
          label: 'Privacy Policy',
          icon: 'privacy_tip',
          description: 'How your data is collected and used',
          action: onPrivacyPolicy,
        },
        {
          key: 'terms',
          label: 'Terms',
          icon: 'description',
          description: 'Terms of service and booking rules',
          action: onTerms,
        },
      ],
    },
  ];

  return (
    <div
      id="profile-menu"
      className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
    >
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-outline-variant/30">
        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </div>
        <div>
          <h3 className="font-card-title text-[16px] font-bold text-on-surface">Profile Menu</h3>
          <p className="text-[11px] text-on-surface-variant">Everything about your account in one place</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.title}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1.5">
              {group.title}
            </span>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  id={`profile-menu-${item.key}`}
                  onClick={item.action}
                  className="w-full p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container transition-all flex items-center gap-3 text-left cursor-pointer group"
                >
                  <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-bold text-on-surface">{item.label}</span>
                    <span className="block text-[10px] text-on-surface-variant truncate">
                      {item.description}
                    </span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout sits apart from the navigation groups. */}
        <button
          type="button"
          id="profile-menu-logout"
          onClick={onLogout}
          className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 hover:bg-rose-500/20 text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
