import React, { useCallback, useEffect, useState } from 'react';
import {
  describeLocationFailure,
  getGeolocationPermissionState,
  isEmbeddedFrame,
  requestDeviceLocation,
  type DeviceLocationFailure,
} from '../lib/deviceLocation';
import { formatCoordsLabel } from '../lib/locationService';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: string;
  onSelectLocation: (area: string, lat?: number, lng?: number) => void;
  /** True while Nexora live-location sync is streaming for a signed-in user. */
  isLiveSyncActive?: boolean;
  /** True when the background live sync cannot run because access was denied/blocked. */
  isLiveSyncBlocked?: boolean;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  isLiveSyncActive = false,
  isLiveSyncBlocked = false,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [detectAttempt, setDetectAttempt] = useState(0);
  const [gpsFailure, setGpsFailure] = useState<DeviceLocationFailure | null>(null);

  const embedded = isEmbeddedFrame();

  /**
   * Reset on every open *and* close so a stale error from a previous visit
   * (or a visit in a different frame/tab context) never greets the user.
   */
  useEffect(() => {
    if (!isOpen) {
      setGpsFailure(null);
      setIsDetectingGps(false);
      setDetectAttempt(0);
      return;
    }

    setGpsFailure(null);
    setDetectAttempt(0);
    let cancelled = false;

    /**
     * Pre-flight check: if the browser already knows location access is denied,
     * say so up front instead of firing a prompt that cannot succeed. This is
     * what turns the old catch-all error into an instruction the user can act on.
     */

    void getGeolocationPermissionState().then((state) => {
      if (cancelled || state !== 'denied') return;
      setGpsFailure(describeLocationFailure('denied', { isEmbedded: isEmbeddedFrame() }));
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleDetectGPS = useCallback(async () => {
    setGpsFailure(null);
    setIsDetectingGps(true);
    setDetectAttempt(1);

    // Defaults: 8s high-accuracy pass, then 15s low-accuracy fallback.
    const result = await requestDeviceLocation({ onAttempt: setDetectAttempt });

    setIsDetectingGps(false);
    setDetectAttempt(0);

    if (result.status === 'ok') {
      onSelectLocation(
        formatCoordsLabel(result.latitude, result.longitude),
        result.latitude,
        result.longitude
      );
      onClose();
      return;
    }

    console.warn(
      `[Nexora] Device location failed (${result.code}): ${result.detail || 'no detail'}`
    );
    setGpsFailure(result);
  }, [onClose, onSelectLocation]);

  const openInNewTab = () => {
    if (typeof window === 'undefined') return;
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const popularAreas = [
    { name: 'Mansarovar, Jaipur', lat: 26.8533, lng: 75.7681 },
    { name: 'Vaishali Nagar, Jaipur', lat: 26.9075, lng: 75.7423 },
    { name: 'Malviya Nagar, Jaipur', lat: 26.8529, lng: 75.8055 },
    { name: 'C-Scheme, Jaipur', lat: 26.9124, lng: 75.8035 },
    { name: 'Raja Park, Jaipur', lat: 26.8967, lng: 75.8304 },
    { name: 'Tonk Road, Jaipur', lat: 26.8628, lng: 75.8000 },
    { name: 'Civil Lines, Jaipur', lat: 26.9080, lng: 75.7878 },
    { name: 'Jagatpura, Jaipur', lat: 26.8202, lng: 75.8576 },
  ];

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectLocation(customInput.trim());
      setCustomInput('');
      onClose();
    }
  };

  const gpsBlocked = gpsFailure?.code === 'blocked';
  const gpsUnavailable = gpsFailure?.code === 'unsupported' || gpsFailure?.code === 'insecure';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        id="location-picker-modal"
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-outline-variant/30 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-nexora-pink text-[24px]">location_on</span>
            <h2 className="font-section-heading text-[18px] text-on-surface">Select Your Location</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* GPS Button */}
        <button
          id="detect-gps-button"
          onClick={handleDetectGPS}
          disabled={isDetectingGps || gpsUnavailable}
          className="w-full py-3 px-4 mb-3 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-center gap-2 text-nexora-pink font-button-text hover:bg-surface-container transition-colors shadow-sm disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[20px] ${isDetectingGps ? 'animate-spin' : ''}`}>
            {isDetectingGps ? 'sync' : 'my_location'}
          </span>
          <span>
            {isDetectingGps
              ? detectAttempt > 1
                ? 'Still locating… (trying Wi-Fi & network)'
                : 'Detecting GPS...'
              : 'Use Current Device Location'}
          </span>
        </button>

        {/* Actionable failure panel — replaces the old one-line catch-all. */}
        {gpsFailure && (
          <div
            id="location-error"
            role="alert"
            className="mb-4 rounded-xl border border-error/30 bg-error/5 px-3 py-2.5"
          >
            <div className="flex gap-2">
              <span className="material-symbols-outlined text-error text-[18px] leading-tight">
                {gpsBlocked ? 'tab' : 'error_outline'}
              </span>
              <div className="flex-1 min-w-0">
                <p id="location-error-message" className="text-[12px] text-error font-medium leading-snug">
                  {gpsFailure.message}
                </p>
                {gpsFailure.detail && (
                  <p className="mt-1 text-[10px] text-on-surface-variant break-words">
                    Browser reported: {gpsFailure.detail}
                  </p>
                )}
                {(gpsFailure.canRetry || gpsBlocked || (embedded && gpsFailure.code === 'denied')) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {gpsFailure.canRetry && (
                      <button
                        type="button"
                        id="location-retry-button"
                        onClick={handleDetectGPS}
                        disabled={isDetectingGps}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-50"
                      >
                        {isDetectingGps ? 'Locating…' : 'Try again'}
                      </button>
                    )}
                    {(gpsBlocked || (embedded && gpsFailure.code === 'denied')) && (
                      <button
                        type="button"
                        id="location-open-new-tab-button"
                        onClick={openInNewTab}
                        className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-[11px] font-semibold hover:bg-surface-container transition-colors"
                      >
                        Open in new tab
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nexora live-location sync indicator (authenticated users only) */}
        {isLiveSyncActive && (
          <div
            id="nexora-live-sync-indicator"
            className="flex items-center gap-2 mb-3 px-1"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nexora-pink opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-nexora-pink" />
            </span>
            <p className="text-[12px] text-on-surface-variant font-medium">
              Live location sync active — securely synced to your Nexora account.
            </p>
          </div>
        )}

        {/* Live sync is running but cannot see the device — say so, silently
            failing here is what made the location state feel random. */}
        {isLiveSyncBlocked && !gpsFailure && (
          <p
            id="live-sync-blocked-hint"
            className="text-[11px] text-on-surface-variant mb-3 px-1"
          >
            Live location sync is paused because this site does not have location
            access. Allow Location in your browser settings to resume it.
          </p>
        )}

        {/* Search custom input */}
        <form onSubmit={handleCustomSubmit} className="mb-5">
          <div className="relative">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Search city, area or street..."
              className="w-full h-11 pl-10 pr-16 bg-surface-container-highest text-on-surface rounded-xl text-[14px] focus:outline-none focus:ring-1 focus:ring-nexora-pink"
            />
            <span className="material-symbols-outlined absolute left-3 top-3 text-[20px] text-on-surface-variant">
              search
            </span>
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="absolute right-2 top-2 px-3 py-1 bg-primary text-white rounded-lg text-[12px] font-semibold disabled:opacity-40"
            >
              Set
            </button>
          </div>
        </form>

        {/* Popular Areas in Jaipur */}
        <h3 className="font-metadata text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
          Popular Localities in Jaipur
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {popularAreas.map((area) => {
            const isSelected = currentLocation.includes(area.name.split(',')[0]);
            return (
              <button
                key={area.name}
                onClick={() => {
                  onSelectLocation(area.name, area.lat, area.lng);
                  onClose();
                }}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-primary-container text-on-primary-container border-primary font-semibold shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-white' : 'text-nexora-pink'}`}>
                    location_on
                  </span>
                  <span className="text-[13px] truncate font-medium">{area.name.split(',')[0]}</span>
                </div>
                <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                  Jaipur
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
