import React from 'react';

export type LegalDocument = 'privacy' | 'terms';

interface ProfileLegalModalProps {
  document: LegalDocument | null;
  onClose: () => void;
  /** Last-updated label shown under the title. Pass the real date when known. */
  lastUpdated?: string;
}

interface LegalSection {
  heading: string;
  body: string;
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body:
      'Account details you enter (name, email, mobile number, date of birth, gender preference, profile photo and preferred location), your bookings and payment records, and — only with your permission — your device location so we can show nearby salons.',
  },
  {
    heading: 'Why we collect it',
    body:
      'To create and secure your account, confirm and remind you about appointments, process payments, apply rewards and referrals, and personalise salon recommendations. Location data is used only to sort and distance-match salons.',
  },
  {
    heading: 'Where it is stored',
    body:
      'Your account and bookings live in our Supabase database behind row-level security, so a signed-in user can only read their own rows. Profile photos and editable preferences are cached on your device per account so the app stays responsive offline.',
  },
  {
    heading: 'Who we share it with',
    body:
      'The salon you book needs your name and contact details to fulfil the appointment. Payment processors receive only what is required to authorise a transaction. We do not sell personal data.',
  },
  {
    heading: 'Notifications',
    body:
      'In-app, email, WhatsApp and push messages are sent only for the categories you have enabled in Notification Preferences. A WhatsApp message is recorded as delivered only when the provider confirms delivery.',
  },
  {
    heading: 'Your choices',
    body:
      'You can correct your personal information at any time in Personal Information, change notification preferences in App Settings, clear cached data in Account & Storage, and sign out or request account deletion from the same section.',
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Your account',
    body:
      'You are responsible for keeping your sign-in credentials secure and for the accuracy of the contact details on your profile. One person per account.',
  },
  {
    heading: 'Bookings',
    body:
      'A booking is created when you confirm it in the app. It becomes confirmed once the salon accepts it; you will see that status change in My Bookings and receive a notification. Availability shown by the app reflects the salon’s own schedule at the time you looked.',
  },
  {
    heading: 'Payments and advances',
    body:
      'Where an advance is required, the amount and the balance payable at the salon are shown before you confirm. Refunds follow the individual salon’s cancellation policy, which is displayed on the booking summary.',
  },
  {
    heading: 'Cancellations and rescheduling',
    body:
      'You can cancel or request a reschedule from My Bookings. Whether a cancellation is free depends on the salon’s policy and how much notice you give.',
  },
  {
    heading: 'Rewards, referrals and membership',
    body:
      'Reward points and referral benefits are credited when the qualifying action is recorded in our database — not when a link is merely opened. One referral relationship is stored per account and the first valid referral stands. Membership benefits apply only while the membership is active.',
  },
  {
    heading: 'Acceptable use',
    body:
      'Do not misuse the service, attempt to access other users’ data, or submit false bookings. We may suspend an account that does so.',
  },
  {
    heading: 'Changes to these terms',
    body:
      'If these terms change materially we will tell you in the app before the change takes effect.',
  },
];

/**
 * Privacy Policy / Terms viewer.
 *
 * The copy describes what this application actually does (Supabase storage,
 * RLS-scoped rows, provider-confirmed WhatsApp delivery, first-valid-referral
 * rule). It makes no claims about certifications or guarantees the product
 * does not have.
 */
export const ProfileLegalModal: React.FC<ProfileLegalModalProps> = ({
  document,
  onClose,
  lastUpdated,
}) => {
  if (!document) return null;

  const isPrivacy = document === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-label={isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
    >
      <div
        id={`legal-modal-${document}`}
        className="w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-outline-variant/40 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                {isPrivacy ? 'privacy_tip' : 'description'}
              </span>
            </div>
            <div>
              <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
              </h3>
              <p className="text-[10px] text-on-surface-variant">
                {lastUpdated ? `Last updated ${lastUpdated}` : 'Nexora Salon & Spa'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-3.5">
          {sections.map((section) => (
            <div key={section.heading}>
              <h4 className="text-[13px] font-bold text-on-surface mb-1">{section.heading}</h4>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">{section.body}</p>
            </div>
          ))}

          <p className="text-[11px] text-on-surface-variant/80 pt-2 border-t border-outline-variant/30">
            Questions about this document? Use Support in your profile menu and our team will
            respond.
          </p>
        </div>

        <div className="p-4 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-[#a00056] transition-colors cursor-pointer shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
