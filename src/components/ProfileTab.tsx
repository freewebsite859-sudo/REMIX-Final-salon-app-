import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';

interface ProfileTabProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onOpenAIAdvisor: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  onUpdateUser,
  onOpenAIAdvisor,
}) => {
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Personal information updated successfully!');

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone);
  }, [user]);

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...user,
      name,
      phone,
    });
    setIsEditingPersonal(false);
    setSuccessMsg('Personal information updated successfully!');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3">
      {/* Header Profile Card */}
      <div className="bg-gradient-to-r from-primary via-nexora-pink to-primary-container rounded-3xl p-5 text-white shadow-md mb-4 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-full object-cover ring-3 ring-white/50 shadow-md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-card-title text-[20px] font-bold truncate">{user.name}</h2>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                VIP Member
              </span>
            </div>
            <p className="text-[12px] opacity-90">{user.email}</p>
            <p className="text-[12px] opacity-80">{user.phone} · {user.locationArea}, {user.city}</p>
          </div>
        </div>

        {/* Loyalty Points Strip */}
        <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between relative z-10 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">stars</span>
            <span>Beauty Rewards: <strong>{user.loyaltyPoints} Points</strong></span>
          </div>
          <span className="text-[11px] bg-white text-primary px-2.5 py-0.5 rounded-full font-bold">
            ₹{user.loyaltyPoints} Value
          </span>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 text-emerald-800 text-[13px] font-semibold flex items-center gap-2 border border-emerald-500/30 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* AI Style Quiz Promo Card */}
      <div className="bg-gradient-to-r from-primary-fixed/40 via-surface-container to-primary-fixed/20 border border-primary-fixed rounded-2xl p-4 shadow-xs mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#b00055] text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-card-title text-[14px] font-bold text-on-surface">AI Style & Face Shape Quiz</h4>
              <span className="text-[10px] bg-[#b00055] text-white font-bold px-1.5 py-0.2 rounded-full uppercase">
                Interactive
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Match personalized haircuts & salon services to your {user.faceShape || 'Oval'} face and {user.hairType || 'Wavy'} hair.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAIAdvisor}
          className="px-3.5 py-2 bg-[#b00055] hover:bg-[#900045] text-white font-bold rounded-xl text-[12px] transition-all flex items-center gap-1.5 flex-shrink-0 shadow-xs cursor-pointer"
        >
          <span>Take Quiz</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>

      {/* Edit Personal Profile Form */}
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-xs mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">manage_accounts</span>
            <h3 className="font-card-title text-[15px] font-bold text-on-surface">Personal Information</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingPersonal(!isEditingPersonal)}
            className="text-[12px] font-semibold text-[#b00055] cursor-pointer"
          >
            {isEditingPersonal ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {isEditingPersonal ? (
          <form onSubmit={handleSavePersonal} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-on-surface-variant block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 bg-white rounded-xl text-[13px] border border-outline-variant"
              />
            </div>
            <div>
              <label className="text-[11px] text-on-surface-variant block mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 bg-white rounded-xl text-[13px] border border-outline-variant"
              />
            </div>
            <button
              type="submit"
              className="py-2.5 bg-primary text-white font-button-text rounded-xl text-[13px] hover:bg-nexora-pink transition-colors mt-1 cursor-pointer"
            >
              Save Changes
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between py-1 border-b border-outline-variant/30">
              <span className="text-on-surface-variant">Name</span>
              <span className="font-semibold text-on-surface">{user.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-outline-variant/30">
              <span className="text-on-surface-variant">Email</span>
              <span className="font-semibold text-on-surface">{user.email}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-on-surface-variant">Phone</span>
              <span className="font-semibold text-on-surface">{user.phone}</span>
            </div>
          </div>
        )}
      </div>

      {/* App Info Footer */}
      <div className="text-center py-4 text-on-surface-variant text-[11px] flex flex-col gap-1">
        <p className="font-semibold">Nexora SalonOS · v2.5</p>
        <p>AI Style Quiz Powered by Gemini 3.7 & Google Maps Data</p>
      </div>
    </div>
  );
};
