import React, { useState } from 'react';
import { Salon } from '../types';

interface StaticMapPreviewProps {
  salon: Salon;
  userLocation?: string;
  className?: string;
}

/**
 * A truthful map hand-off. The previous component drew an illustrative SVG,
 * invented route times, traffic, and a fallback distance. A customer-facing
 * map must use the salon coordinates returned by the canonical catalog; until
 * a map-tile provider is configured, we show those coordinates and link to a
 * real map instead of presenting a fake route.
 */
export const StaticMapPreview: React.FC<StaticMapPreviewProps> = ({
  salon,
  userLocation = '',
  className = '',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { latitude, longitude } = salon.location;
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const mapsUrl = salon.location.mapsUrl ||
    (hasCoordinates
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.name} ${salon.location.address}`)}`);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(`${salon.name}, ${salon.location.address}`);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2500);
    } catch (error) {
      console.warn('[Nexora] Could not copy salon address:', error);
    }
  };

  return (
    <section
      id="salon-map-preview"
      className={`rounded-2xl bg-surface-container-lowest border border-outline-variant/40 overflow-hidden shadow-sm ${className}`}
    >
      <div className="p-4 bg-surface-container-low border-b border-outline-variant/30 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">map</span>
        </div>
        <div className="min-w-0">
          <h4 className="font-card-title text-[14px] font-bold text-on-surface">Salon location</h4>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {userLocation ? `Directions from ${userLocation.split(',')[0]}` : 'Coordinates from the salon catalog'}
          </p>
        </div>
      </div>

      <div className="p-5 bg-surface-container-lowest">
        <div className="min-h-36 rounded-xl border border-dashed border-outline-variant bg-surface-container-low flex flex-col items-center justify-center text-center p-4">
          <span className="material-symbols-outlined text-[36px] text-primary mb-2">location_on</span>
          <p className="text-[13px] font-bold text-on-surface">Verified map hand-off</p>
          {hasCoordinates ? (
            <p className="mt-1 text-[11px] font-mono text-on-surface-variant">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-amber-800">This salon has no valid coordinates yet.</p>
          )}
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-on-surface">{salon.location.address}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {salon.location.area}{salon.location.city ? `, ${salon.location.city}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyAddress}
            className="shrink-0 p-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface"
            title="Copy address"
            aria-label="Copy salon address"
          >
            <span className="material-symbols-outlined text-[17px]">{isCopied ? 'check' : 'content_copy'}</span>
          </button>
        </div>

        <a
          id="open-google-maps-directions-btn"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 w-full py-2.5 px-3.5 bg-primary text-white rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-nexora-pink transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">directions</span>
          <span>Open verified location in Google Maps</span>
          <span className="material-symbols-outlined text-[13px] opacity-80">open_in_new</span>
        </a>
      </div>
    </section>
  );
};
