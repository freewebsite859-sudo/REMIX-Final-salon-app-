import React, { useState } from 'react';
import { Salon } from '../types';

interface StaticMapPreviewProps {
  salon: Salon;
  userLocation?: string;
  className?: string;
}

type TravelMode = 'driving' | 'two_wheeler' | 'walking' | 'transit';
type MapTheme = 'light' | 'dark' | 'satellite';

export const StaticMapPreview: React.FC<StaticMapPreviewProps> = ({
  salon,
  userLocation = 'Vaishali Nagar, Jaipur',
  className = '',
}) => {
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapTheme, setMapTheme] = useState<MapTheme>('light');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const numericDistance = parseFloat(salon.distance.replace(/[^0-9.]/g, '')) || 1.5;

  // Compute realistic travel times based on travel mode
  const travelStats = {
    driving: {
      time: Math.max(3, Math.round(numericDistance * 3.5)),
      icon: 'directions_car',
      label: 'Drive',
      traffic: 'Light Traffic',
      trafficColor: 'text-success-emerald',
    },
    two_wheeler: {
      time: Math.max(2, Math.round(numericDistance * 2.8)),
      icon: 'two_wheeler',
      label: 'Scooter / Bike',
      traffic: 'Fastest Route',
      trafficColor: 'text-success-emerald',
    },
    walking: {
      time: Math.max(8, Math.round(numericDistance * 12)),
      icon: 'directions_walk',
      label: 'Walk',
      traffic: 'Pedestrian Path',
      trafficColor: 'text-primary',
    },
    transit: {
      time: Math.max(6, Math.round(numericDistance * 5.5)),
      icon: 'directions_transit',
      label: 'Metro / Bus',
      traffic: 'Direct Route',
      trafficColor: 'text-primary',
    },
  };

  const currentStat = travelStats[travelMode];

  // Construct direct Google Maps navigation URL
  const googleMapsDirectionsUrl = salon.location.mapsUrl
    ? salon.location.mapsUrl
    : `https://www.google.com/maps/dir/?api=1&destination=${salon.location.latitude},${salon.location.longitude}`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(`${salon.name}, ${salon.location.address}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 1.75));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));

  // Determine theme styling colors
  const themeColors = {
    light: {
      bg: '#EAF0E8',
      roadColor: '#FFFFFF',
      roadBorder: '#D2DBCF',
      waterColor: '#C4E0E5',
      parkColor: '#D8EBD4',
      buildingColor: '#E1E8DF',
      textPrimary: '#2D3748',
      routeStroke: '#a30046', // nexora-pink
    },
    dark: {
      bg: '#1E242B',
      roadColor: '#2D3748',
      roadBorder: '#1A202C',
      waterColor: '#1A365D',
      parkColor: '#23382B',
      buildingColor: '#28313E',
      textPrimary: '#F7FAFC',
      routeStroke: '#ff7597',
    },
    satellite: {
      bg: '#3A4438',
      roadColor: '#5C6B58',
      roadBorder: '#2E382C',
      waterColor: '#2B4C5F',
      parkColor: '#4F614C',
      buildingColor: '#455243',
      textPrimary: '#FFFFFF',
      routeStroke: '#00E5FF',
    },
  }[mapTheme];

  return (
    <div 
      id="salon-static-map-preview"
      className={`rounded-2xl bg-surface-container-lowest border border-outline-variant/40 overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      {/* Top Header Bar */}
      <div className="p-3.5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">map</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-card-title text-[13px] font-bold text-on-surface truncate">
              Location & Proximity Map
            </h4>
            <p className="text-[11px] text-on-surface-variant truncate">
              {salon.distance} from {userLocation.split(',')[0]}
            </p>
          </div>
        </div>

        {/* Theme Selector Pill */}
        <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/30 shrink-0">
          <button
            onClick={() => setMapTheme('light')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
              mapTheme === 'light' ? 'bg-primary text-white shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Standard Map View"
          >
            Map
          </button>
          <button
            onClick={() => setMapTheme('dark')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
              mapTheme === 'dark' ? 'bg-primary text-white shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Night Mode"
          >
            Night
          </button>
          <button
            onClick={() => setMapTheme('satellite')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
              mapTheme === 'satellite' ? 'bg-primary text-white shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Satellite"
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Travel Modes Selector Bar */}
      <div className="px-3 py-2 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
        {(Object.keys(travelStats) as TravelMode[]).map((mode) => {
          const stat = travelStats[mode];
          const isSelected = travelMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setTravelMode(mode)}
              className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{stat.icon}</span>
              <span>{stat.time}m</span>
            </button>
          );
        })}
      </div>

      {/* The Visual Static Map Canvas Stage */}
      <div className="relative w-full h-56 sm:h-64 overflow-hidden select-none bg-[#EAF0E8]">
        {/* Scalable Container for Vector Map Tiles */}
        <div 
          className="absolute inset-0 transition-transform duration-300 ease-out origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Map Base Canvas SVG with realistic city block geography */}
          <svg 
            className="w-full h-full" 
            viewBox="0 0 500 300" 
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background base */}
            <rect width="500" height="300" fill={themeColors.bg} />

            {/* Park / Greenery Zone */}
            <path
              d="M 20 20 Q 80 10 120 40 T 160 100 T 80 140 T 20 80 Z"
              fill={themeColors.parkColor}
            />
            <path
              d="M 360 180 Q 440 160 480 200 T 490 280 T 400 290 T 350 240 Z"
              fill={themeColors.parkColor}
            />
            <text x="50" y="80" fill={themeColors.textPrimary} opacity="0.4" fontSize="10" fontWeight="600" fontFamily="sans-serif">
              Central Park
            </text>

            {/* Water Canal / Lake */}
            <path
              d="M 0 240 C 120 230 180 280 300 270 C 400 260 460 300 500 290 L 500 300 L 0 300 Z"
              fill={themeColors.waterColor}
            />

            {/* City Blocks (Buildings / Urban Parcels) */}
            <g fill={themeColors.buildingColor} opacity="0.75">
              <rect x="50" y="160" width="60" height="45" rx="4" />
              <rect x="125" y="160" width="70" height="45" rx="4" />
              <rect x="210" y="30" width="80" height="50" rx="4" />
              <rect x="310" y="30" width="70" height="50" rx="4" />
              <rect x="210" y="95" width="80" height="45" rx="4" />
              <rect x="310" y="95" width="85" height="45" rx="4" />
              <rect x="250" y="160" width="75" height="55" rx="4" />
              <rect x="340" y="160" width="60" height="55" rx="4" />
            </g>

            {/* Secondary Street Grid */}
            <g stroke={themeColors.roadBorder} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M 0 150 L 500 150" />
              <path d="M 0 90 L 500 90" />
              <path d="M 0 220 L 500 220" />
              <path d="M 120 0 L 120 300" />
              <path d="M 200 0 L 200 300" />
              <path d="M 330 0 L 330 300" />
              <path d="M 410 0 L 410 300" />
            </g>

            {/* Main Road Surfacing */}
            <g stroke={themeColors.roadColor} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M 0 150 L 500 150" />
              <path d="M 0 90 L 500 90" />
              <path d="M 0 220 L 500 220" />
              <path d="M 120 0 L 120 300" />
              <path d="M 200 0 L 200 300" />
              <path d="M 330 0 L 330 300" />
              <path d="M 410 0 L 410 300" />
            </g>

            {/* Primary Highway / Diagonal Boulevard */}
            <path
              d="M 30 280 Q 140 180 230 150 T 460 40"
              stroke={themeColors.roadBorder}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 30 280 Q 140 180 230 150 T 460 40"
              stroke={themeColors.roadColor}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
            />

            {/* Street Names Labels */}
            <text x="210" y="85" fill={themeColors.textPrimary} opacity="0.5" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
              Main Avenue
            </text>
            <text x="20" y="145" fill={themeColors.textPrimary} opacity="0.5" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
              Queens Blvd
            </text>
            <text x="340" y="215" fill={themeColors.textPrimary} opacity="0.5" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
              Salon Galleria Walk
            </text>

            {/* Dynamic Connecting Route Polyline between User and Salon */}
            {/* Route Outer Shadow/Glow */}
            <path
              d="M 90 210 L 120 210 L 120 150 L 330 150 L 330 80 L 380 80"
              stroke={themeColors.routeStroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.25"
              fill="none"
            />
            {/* Route Core Line */}
            <path
              d="M 90 210 L 120 210 L 120 150 L 330 150 L 330 80 L 380 80"
              stroke={themeColors.routeStroke}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={travelMode === 'walking' ? '4 3' : undefined}
              fill="none"
            />

            {/* Route Waypoint arrows */}
            <circle cx="120" cy="150" r="3" fill={themeColors.routeStroke} />
            <circle cx="330" cy="150" r="3" fill={themeColors.routeStroke} />
            <circle cx="330" cy="80" r="3" fill={themeColors.routeStroke} />
          </svg>
        </div>

        {/* 1. START PIN: User's Current Location */}
        <div 
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ top: '70%', left: '18%' }}
        >
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-blue-500/25 animate-ping absolute" />
              <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-white">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="mt-1 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-on-surface shadow-xs border border-outline-variant/30 text-[10px] font-bold whitespace-nowrap flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              <span>You ({userLocation.split(',')[0]})</span>
            </div>
          </div>
        </div>

        {/* 2. ROUTE DISTANCE BADGE (Middle of Path) */}
        <div 
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ top: '50%', left: '46%' }}
        >
          <div className="px-2.5 py-1 rounded-full bg-surface-container-lowest/95 backdrop-blur-md shadow-md border border-outline-variant/40 flex items-center gap-1 text-[10px] font-bold text-primary animate-bounce duration-1000">
            <span className="material-symbols-outlined text-[13px]">{currentStat.icon}</span>
            <span>{salon.distance}</span>
            <span className="text-on-surface-variant font-normal">· {currentStat.time}m</span>
          </div>
        </div>

        {/* 3. DESTINATION PIN: The Salon Location */}
        <div 
          className="absolute z-20 -translate-x-1/2 -translate-y-full"
          style={{ top: '27%', left: '76%' }}
        >
          <div className="flex flex-col items-center group cursor-pointer">
            {/* Salon Info Pill */}
            <div className="mb-1 px-2.5 py-1 rounded-xl bg-primary text-white shadow-lg border border-white/40 text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transform -translate-y-1 transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-[14px] text-white">content_cut</span>
              <span className="truncate max-w-[120px]">{salon.name}</span>
              <span className="bg-white/20 text-white text-[9px] px-1 py-0.2 rounded">
                ★ {salon.rating}
              </span>
            </div>

            {/* Custom Glowing Drop Pin */}
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white shadow-lg border-2 border-white">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
              </div>
              <div className="w-2.5 h-1 bg-black/40 rounded-full blur-[1px] absolute -bottom-1" />
            </div>
          </div>
        </div>

        {/* Canvas Floating Controls */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-20">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface border border-outline-variant/30 flex items-center justify-center shadow-sm hover:bg-surface-container font-bold text-[14px]"
            title="Zoom in map"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface border border-outline-variant/30 flex items-center justify-center shadow-sm hover:bg-surface-container font-bold text-[14px]"
            title="Zoom out map"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Live Traffic / GPS Status pill */}
        <div className="absolute bottom-2.5 left-2.5 z-20">
          <div className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9px] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-emerald animate-pulse" />
            <span>{currentStat.traffic}</span>
          </div>
        </div>
      </div>

      {/* Bottom Proximity Details & Turn-by-Turn Actions */}
      <div className="p-3.5 bg-surface-container-low flex flex-col gap-3">
        {/* Address & Landmark Row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">
              pin_drop
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-on-surface leading-tight">
                {salon.location.address}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px] text-success-emerald">local_parking</span>
                  Dedicated Parking
                </span>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px] text-primary">navigation</span>
                  {salon.location.area}, {salon.location.city}
                </span>
              </div>
            </div>
          </div>

          {/* Copy Address Button */}
          <button
            onClick={handleCopyAddress}
            className="p-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:text-on-surface shrink-0 text-[11px] flex items-center gap-1 transition-colors"
            title="Copy address"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isCopied ? 'check' : 'content_copy'}
            </span>
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Turn-by-Turn Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/25">
          <a
            id="open-google-maps-directions-btn"
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 px-3.5 bg-primary text-white rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-nexora-pink transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">directions</span>
            <span>Get Directions</span>
            <span className="material-symbols-outlined text-[13px] opacity-80">open_in_new</span>
          </a>

          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="py-2 px-3 bg-surface-container-lowest border border-outline-variant/40 text-on-surface rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1 hover:bg-surface-container transition-colors shrink-0"
              title="Call Salon"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">call</span>
              <span className="hidden sm:inline">Call Salon</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
