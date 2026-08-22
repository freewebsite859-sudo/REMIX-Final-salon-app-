import React from 'react';

interface NexoraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const NexoraLogo: React.FC<NexoraLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeMap = {
    sm: { icon: 'w-9 h-9', monogram: 'text-[18px]', title: 'text-[16px]', subtitle: 'text-[8px]' },
    md: { icon: 'w-12 h-12', monogram: 'text-[22px]', title: 'text-[20px]', subtitle: 'text-[9px]' },
    lg: { icon: 'w-14 h-14', monogram: 'text-[26px]', title: 'text-[24px]', subtitle: 'text-[10px]' },
  }[size];

  return (
    <div
      className={`group flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${className}`}
      style={{
        transition: 'transform 300ms ease, filter 300ms ease',
      }}
    >
      {/* Refined Geometric Monogram */}
      <div
        className={`relative ${sizeMap.icon} rounded-2xl bg-gradient-to-tr from-[#b90064] via-[#d60074] to-[#e6007e] p-0.5 shadow-md flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_8px_25px_rgba(185,0,100,0.25)]`}
      >
        <div className="w-full h-full bg-gradient-to-b from-white/20 to-transparent rounded-[14px] flex items-center justify-center relative overflow-hidden backdrop-blur-xs">
          {/* Subtle light sheen highlight */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-60 pointer-events-none" />

          <svg
            className="w-3/5 h-3/5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Elegant Serif-Styled Geometric N */}
            <path d="M5 4v16M19 4v16M5 6l14 12" />
          </svg>
        </div>
      </div>

      {/* Brand Wordmark */}
      <div className="mt-2.5 text-center flex flex-col items-center">
        <h1
          className={`font-extrabold tracking-[0.22em] text-[#1c1b1b] ${sizeMap.title} leading-none font-sans`}
          style={{ letterSpacing: '0.22em' }}
        >
          NEXORA
        </h1>
        <span
          className={`font-semibold tracking-[0.28em] text-[#594047] uppercase ${sizeMap.subtitle} mt-1 opacity-85`}
          style={{ letterSpacing: '0.28em' }}
        >
          LUXURY MANAGEMENT
        </span>
      </div>
    </div>
  );
};
