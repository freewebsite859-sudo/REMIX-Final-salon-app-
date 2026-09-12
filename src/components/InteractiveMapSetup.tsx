import React from 'react';
import { SalonProfile } from '../types';

interface InteractiveMapSetupProps {
  profile: SalonProfile;
  setProfile?: React.Dispatch<React.SetStateAction<SalonProfile>>;
  themePrimaryColor?: string;
  onChange?: (updatedProfile: SalonProfile) => void;
  onSave?: (updatedProfile: SalonProfile) => void;
  onClose?: () => void;
}

export const InteractiveMapSetup: React.FC<InteractiveMapSetupProps> = ({ profile }) => {
  return (
    <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Location & Map Details</h4>
      <p className="text-sm text-gray-600 dark:text-zinc-400">
        {profile.address || 'Location details configured'} - {profile.city}
      </p>
    </div>
  );
};
