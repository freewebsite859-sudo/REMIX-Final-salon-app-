import React from 'react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeAppointmentsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  activeAppointmentsCount,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'explore', label: 'Explore', icon: 'explore' },
    { id: 'appointments', label: 'Appointments', icon: 'calendar_month', badge: activeAppointmentsCount },
    { id: 'saved', label: 'Saved', icon: 'favorite' },
    { id: 'profile', label: 'Profile', icon: 'account_circle' },
  ];

  return (
    <nav 
      id="bottom-navigation-bar" 
      className="fixed bottom-0 left-0 w-full z-40 pb-safe bg-surface/90 backdrop-blur-xl border-t border-outline-variant/40 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 select-none ${
                isActive ? 'text-nexora-pink font-semibold scale-105' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              <span className="font-nav-label text-[11px] leading-tight mt-1">
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-2 right-1/4 translate-x-2 bg-error text-on-error text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm ring-1 ring-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
