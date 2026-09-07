import React, { useCallback, useEffect, useState } from 'react';
import {
  describeLocationFailure,
  getGeolocationPermissionState,
  isEmbeddedFrame,
  requestDeviceLocation,
  type DeviceLocationFailure,
} from '../lib/deviceLocation';
import {
  JAIPUR_AREA_CHIPS,
  formatAreaLabel,
  isInsideJaipur,
  nearestJaipurArea,
  type JaipurArea,
} from '../lib/jaipurAreas';
import {
  persistCustomerLocation,
  preferenceFromChip,
  type CustomerLocationPreference,
} from '../lib/customerLocation';
import { NexoraLogo } from './auth/NexoraLogo';

export interface FirstLoginLocationScreenProps {
  userId: string;
  userName?: string;
  /**
   * Called after a location is chosen and persisted (GPS or manual chip).
   * The parent updates header state and dismisses this screen.
   */
  onComplete: (preference: CustomerLocationPreference) => void;
  /** Optional skip — still marks setup complete so we do not re-prompt. */
  onSkip?: () => void;
}

type Step = 'permission' | 'manual';

/**
 * First-login location permission flow.
 *
 * 1. Full-screen prompt: "Find best salons near you"
 * 2. Primary CTA: "Use My Current Location" (GPS)
 * 3. Secondary: "Select Area Manually" → Jaipur area chips
 * 4. On GPS denied / failure → auto-open the Jaipur area selector
 *
 * Saves latitude, longitude, city, area, and pincode (when known).
 */
export const FirstLoginLocationScreen: React.FC<FirstLoginLocationScreenProps> = ({
  userId,
  userName,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<Step>('permission');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectAttempt, setDetectAttempt] = useState(0);
  const [gpsFailure, setGpsFailure] = useState<DeviceLocationFailure | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  const embedded = isEmbeddedFrame();
  const firstName = userName?.trim().split(/\s+/)[0] || '';

  // Pre-flight: if the browser already denied location, go straight to chips.
  useEffect(() => {
    let cancelled = false;
    void getGeolocationPermissionState().then((state) => {
      if (cancelled) return;
      if (state === 'denied') {
        setGpsFailure(
          describeLocationFailure('denied', { isEmbedded: isEmbeddedFrame() })
        );
        setStep('manual');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishWithPreference = useCallback(
    async (
      preference: Omit<CustomerLocationPreference, 'updatedAt' | 'label'> & {
        label?: string;
      }
    ) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const saved = await persistCustomerLocation(userId, preference);
        if (!saved) {
          setSaveError('Could not save your location. Please try again.');
          setIsSaving(false);
          return;
        }
        onComplete(saved);
      } catch (err) {
        console.warn('[Nexora] First-login location save failed:', err);
        setSaveError('Could not save your location. Please try again.');
        setIsSaving(false);
      }
    },
    [onComplete, userId]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setGpsFailure(null);
    setSaveError(null);
    setIsDetecting(true);
    setDetectAttempt(1);

    const result = await requestDeviceLocation({ onAttempt: setDetectAttempt });
    setIsDetecting(false);
    setDetectAttempt(0);

    if (result.status !== 'ok') {
      console.warn(
        `[Nexora] First-login GPS failed (${result.code}): ${result.detail || 'no detail'}`
      );
      setGpsFailure(result);
      // Spec: if GPS denied (or any failure), show the Jaipur area selector.
      setStep('manual');
      return;
    }

    const { latitude, longitude } = result;
    const nearest = nearestJaipurArea(latitude, longitude);
    const inJaipur = isInsideJaipur(latitude, longitude);

    if (nearest) {
      await finishWithPreference({
        latitude,
        longitude,
        city: nearest.city,
        area: nearest.area,
        pincode: nearest.pincode,
        label: formatAreaLabel(nearest),
        source: 'gps',
      });
      return;
    }

    // GPS fix outside chip radius — still save raw coords with a sensible label.
    await finishWithPreference({
      latitude,
      longitude,
      city: inJaipur ? 'Jaipur' : 'Nearby',
      area: inJaipur ? 'Current location' : 'Current location',
      label: inJaipur
        ? `Current location, Jaipur`
        : `Current Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
      source: 'gps',
    });
  }, [finishWithPreference]);

  const handleSelectChip = useCallback(
    async (chip: JaipurArea) => {
      setSelectedChip(chip.name);
      setSaveError(null);
      await finishWithPreference(preferenceFromChip(chip, 'chip'));
    },
    [finishWithPreference]
  );

  const openInNewTab = () => {
    if (typeof window === 'undefined') return;
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <main
      id="first-login-location-screen"
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#fcf9f8] font-sans"
      style={{ backgroundColor: '#fcf9f8' }}
    >
      {/* Ambient luxury glows */}
      <div
        className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full pointer-events-none opacity-35 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, #b90064 0%, rgba(230, 0, 126, 0.35) 55%, transparent 80%)',
        }}
      />
      <div
        className="absolute -bottom-36 -right-36 w-[520px] h-[520px] rounded-full pointer-events-none opacity-25 blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, #e6007e 0%, rgba(89, 64, 71, 0.25) 55%, transparent 80%)',
        }}
      />

      <div
        className="w-full max-w-[440px] rounded-[24px] p-6 sm:p-8 relative z-10"
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.7)',
          boxShadow: '0 20px 60px rgba(89, 64, 71, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)',
        }}
      >
        <header className="flex flex-col items-center text-center mb-6">
          <NexoraLogo size="md" className="mb-4" />
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px]">near_me</span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1c1b1b] tracking-[-0.02em] leading-tight">
            Find best salons near you
          </h1>
          <p className="text-[14px] text-[#594047] mt-2 leading-relaxed max-w-[320px]">
            {firstName
              ? `${firstName}, share your location so we can show salons, offers and ETAs around you.`
              : 'Share your location so we can show salons, offers and ETAs around you.'}
          </p>
        </header>

        {step === 'permission' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <button
              type="button"
              id="first-login-use-location-btn"
              onClick={handleUseCurrentLocation}
              disabled={isDetecting || isSaving}
              className="w-full h-[52px] bg-[#b90064] hover:bg-[#a00056] text-white font-bold rounded-xl text-[15px] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isDetecting ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                  <span>
                    {detectAttempt > 1
                      ? 'Still locating… (Wi-Fi & network)'
                      : 'Detecting your location…'}
                  </span>
                </>
              ) : isSaving ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">my_location</span>
                  <span>Use My Current Location</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="first-login-select-area-btn"
              onClick={() => {
                setGpsFailure(null);
                setStep('manual');
              }}
              disabled={isDetecting || isSaving}
              className="w-full h-[48px] bg-white/80 border border-[#e8e8e8] hover:border-[#b90064]/40 text-[#1c1b1b] font-semibold rounded-xl text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px] text-[#b90064]">
                location_on
              </span>
              <span>Select Area Manually</span>
            </button>

            {onSkip && (
              <button
                type="button"
                id="first-login-location-skip-btn"
                onClick={onSkip}
                disabled={isDetecting || isSaving}
                className="text-[12px] font-semibold text-[#594047]/80 hover:text-[#b90064] py-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {step === 'manual' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            {/* GPS failure / denied banner */}
            {gpsFailure && (
              <div
                id="first-login-location-error"
                role="alert"
                className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5"
              >
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-[18px] leading-tight">
                    {gpsFailure.code === 'denied' || gpsFailure.code === 'blocked'
                      ? 'location_off'
                      : 'error_outline'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-amber-900 font-medium leading-snug">
                      {gpsFailure.code === 'denied' || gpsFailure.code === 'blocked'
                        ? 'Location access was denied. Pick a Jaipur area below to continue.'
                        : gpsFailure.message}
                    </p>
                    {(gpsFailure.canRetry ||
                      gpsFailure.code === 'blocked' ||
                      (embedded && gpsFailure.code === 'denied')) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {gpsFailure.canRetry && (
                          <button
                            type="button"
                            id="first-login-location-retry-btn"
                            onClick={handleUseCurrentLocation}
                            disabled={isDetecting || isSaving}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                          >
                            {isDetecting ? 'Locating…' : 'Try GPS again'}
                          </button>
                        )}
                        {(gpsFailure.code === 'blocked' ||
                          (embedded && gpsFailure.code === 'denied')) && (
                          <button
                            type="button"
                            onClick={openInNewTab}
                            className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-[11px] font-semibold hover:bg-surface-container transition-colors cursor-pointer"
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

            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#594047]">
                Popular areas in Jaipur
              </h2>
              <button
                type="button"
                id="first-login-back-to-gps-btn"
                onClick={() => {
                  setStep('permission');
                  setGpsFailure(null);
                  setSaveError(null);
                }}
                disabled={isSaving}
                className="text-[12px] font-semibold text-[#b90064] hover:underline cursor-pointer disabled:opacity-50"
              >
                Use GPS instead
              </button>
            </div>

            <div
              id="first-login-jaipur-area-chips"
              className="grid grid-cols-2 gap-2 max-h-[42vh] overflow-y-auto pr-0.5"
            >
              {JAIPUR_AREA_CHIPS.map((chip) => {
                const isSelected = selectedChip === chip.name;
                return (
                  <button
                    key={chip.name}
                    type="button"
                    id={`area-chip-${chip.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleSelectChip(chip)}
                    disabled={isSaving}
                    className={`p-3 rounded-xl text-left border transition-all flex flex-col gap-0.5 cursor-pointer disabled:opacity-60 ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/30'
                        : 'bg-white/90 text-on-surface border-outline-variant/50 hover:border-primary/40 hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          isSelected ? 'text-white' : 'text-nexora-pink'
                        }`}
                      >
                        location_on
                      </span>
                      <span className="text-[13px] font-bold truncate">{chip.name}</span>
                    </div>
                    <span
                      className={`text-[10px] pl-5 ${
                        isSelected ? 'text-white/85' : 'text-on-surface-variant'
                      }`}
                    >
                      {chip.city}
                      {chip.pincode ? ` · ${chip.pincode}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {isSaving && (
              <p className="text-[12px] text-center text-[#594047] flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                Saving your area…
              </p>
            )}

            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={isSaving}
                className="text-[12px] font-semibold text-[#594047]/80 hover:text-[#b90064] py-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {saveError && (
          <p
            role="alert"
            className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
          >
            {saveError}
          </p>
        )}

        <p className="mt-5 text-[11px] text-center text-[#594047]/70 leading-relaxed">
          We only use your location to rank nearby salons. You can change it anytime from the
          header.
        </p>
      </div>
    </main>
  );
};
