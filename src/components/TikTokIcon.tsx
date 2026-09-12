import React from 'react';

interface TikTokIconProps {
  className?: string;
  size?: number;
}

export const TikTokIcon: React.FC<TikTokIconProps> = ({ className = 'w-4 h-4', size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74l-.06-.1a2.89 2.89 0 0 1 2.37-4.52c.32 0 .63.05.93.15V9.42a6.34 6.34 0 0 0-.93-.07 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72a8.21 8.21 0 0 0 4.77 1.53V6.8a4.84 4.84 0 0 1-1-.11z" />
    </svg>
  );
};
