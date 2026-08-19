import React, { useState } from 'react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: string;
  onSelectLocation: (area: string, lat?: number, lng?: number) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

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

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const formatted = `Current Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        onSelectLocation(formatted, lat, lng);
        onClose();
      },
      (err) => {
        setIsDetectingGps(false);
        setGpsError('Unable to detect location. Please select an area below.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectLocation(customInput.trim());
      setCustomInput('');
      onClose();
    }
  };

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
          disabled={isDetectingGps}
          className="w-full py-3 px-4 mb-4 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-center gap-2 text-nexora-pink font-button-text hover:bg-surface-container transition-colors shadow-sm"
        >
          <span className={`material-symbols-outlined text-[20px] ${isDetectingGps ? 'animate-spin' : ''}`}>
            {isDetectingGps ? 'sync' : 'my_location'}
          </span>
          <span>{isDetectingGps ? 'Detecting GPS...' : 'Use Current Device Location'}</span>
        </button>

        {gpsError && (
          <p className="text-[12px] text-error font-medium mb-3 px-1">{gpsError}</p>
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
