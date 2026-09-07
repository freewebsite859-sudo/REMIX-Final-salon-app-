import React from 'react';
import { ActiveTab } from '../types';

/** The five sticky bottom-nav destinations shown after login. */
export type BottomNavTab = 'home' | 'search' | 'bookings' | 'rewards' | 'profile';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: BottomNavTab) => void;
  activeAppointmentsCount?: number;
  /** Optional rewards badge (e.g. unclaimed points). */
  rewardsBadgeCount?: number;
  /**
   * When true the bar is not rendered — used on the booking confirmation
   * success screen so the ticket is full-bleed on mobile.
   */
  hidden?: boolean;
}

const NAV_ITEMS: {
  id: BottomNavTab;
  label: string;
  icon: string;
  activeIcon?: string;
}[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar_month' },
  { id: 'rewards', label: 'Rewards', icon: 'stars', activeIcon: 'stars' },
  { id: 'profile', label: 'Profile', icon: 'account_circle' },
];

/** Map any ActiveTab (including Favourites) onto the highlighted bottom-nav item. */
function resolveActiveNav(tab: ActiveTab): BottomNavTab {
  switch (tab) {
    case 'search':
      return 'search';
    case 'bookings':
      return 'bookings';
    case 'rewards':
      return 'rewards';
    case 'profile':
    case 'saved':
      // Favourites is reached from Profile; keep Profile highlighted.
      return tab === 'saved' ? 'profile' : 'profile';
    case 'home':
    default:
      return 'home';
  }
}

/**
 * Sticky mobile bottom navigation.
 *
 * Always visible after login on the main customer shell. Callers hide it on
 * the booking-confirmation success screen (`hidden`) so the confirmed ticket
 * is unobstructed.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  activeAppointmentsCount = 0,
  rewardsBadgeCount = 0,
  hidden = false,
}) => {
  if (hidden) return null;

  const highlighted = resolveActiveNav(activeTab);

  const badgeFor = (id: BottomNavTab): number | undefined => {
    if (id === 'bookings' && activeAppointmentsCount > 0) return activeAppointmentsCount;
    if (id === 'rewards' && rewardsBadgeCount > 0) return rewardsBadgeCount;
    return undefined;
  };

  return (
    <nav
      id="bottom-navigation-bar"
      role="navigation"
      aria-label="Customer main navigation"
      className="fixed bottom-0 left-0 w-full z-40 pb-safe bg-surface/95 backdrop-blur-xl border-t border-outline-variant/40 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
      style={{
        // Keep the bar above the iOS home-indicator / Android gesture bar.
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
      }}
    >
      <div className="flex justify-around items-stretch h-16 max-w-lg mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = highlighted === item.id;
          const badge = badgeFor(item.id);
          return (
            <button
              key={item.id}
              type="button"
              id={`nav-btn-${item.id}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-all duration-200 select-none touch-manipulation ${
                isActive
                  ? 'text-nexora-pink font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface active:scale-95'
              }`}
            >
              {/* Active pill indicator */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-1.5 w-8 h-1 rounded-full bg-nexora-pink/90"
                />
              )}

              <span
                className={`material-symbols-outlined text-[24px] leading-none ${
                  isActive ? 'fill-1' : ''
                }`}
              >
                {isActive && item.activeIcon ? item.activeIcon : item.icon}
              </span>
              <span className="font-nav-label text-[10px] sm:text-[11px] leading-tight mt-0.5 truncate max-w-full px-0.5">
                {item.label}
              </span>

              {badge !== undefined && badge > 0 && (
                <span
                  className="absolute top-1.5 right-[18%] translate-x-1 bg-error text-on-error text-[9px] min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full font-bold shadow-sm ring-1 ring-white"
                  aria-label={`${badge} ${item.id === 'bookings' ? 'upcoming bookings' : 'rewards'}`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
