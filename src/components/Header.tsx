import React from 'react';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  currentLocation: string;
  onOpenLocation: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  hasUnreadNotifications?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentLocation,
  onOpenLocation,
  onOpenProfile,
  onOpenNotifications,
  hasUnreadNotifications = true,
}) => {
  return (
    <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
      <div className="h-16 px-page-margin max-w-4xl mx-auto flex items-center justify-between gap-gutter">
        {/* Brand & Location */}
        <div className="flex items-center gap-2.5">
          <div 
            id="brand-logo-container"
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-nexora-pink to-primary-container flex items-center justify-center text-white shadow-sm font-hero-heading font-extrabold text-[16px]">
              N
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-hero-heading font-bold text-[15px] tracking-tight text-on-surface">Nexora</span>
                <span className="text-[9px] uppercase font-bold text-nexora-pink tracking-wider bg-surface-container px-1 py-0.2 rounded leading-tight">SalonOS</span>
              </div>
              <button 
                id="location-picker-btn"
                onClick={onOpenLocation}
                className="flex items-center gap-0.5 text-left group hover:opacity-80 transition-opacity"
              >
                <span className="material-symbols-outlined text-nexora-pink text-[14px]">location_on</span>
                <span className="font-metadata text-[12px] font-medium text-on-surface-variant group-hover:text-nexora-pink transition-colors truncate max-w-[140px] sm:max-w-[200px]">
                  {currentLocation}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-[14px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button 
            id="header-notifications-btn"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-nexora-pink hover:bg-surface-container transition-colors relative"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {hasUnreadNotifications && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-nexora-pink ring-2 ring-surface animate-pulse" />
            )}
          </button>

          <button 
            id="header-user-profile-btn"
            onClick={onOpenProfile}
            aria-label="User Profile"
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm overflow-hidden ring-2 ring-outline-variant/40 hover:ring-nexora-pink transition-all"
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
