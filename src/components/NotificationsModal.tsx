import React from 'react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNotification?: (action: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'Appointment in 2 hours!',
      message: 'Your haircut with Aarav at Scissors & Shears Salon is today at 5:30 PM.',
      time: '10 mins ago',
      icon: 'schedule',
      type: 'reminder',
      unread: true,
    },
    {
      id: 'notif-2',
      title: '20% OFF Promo Code Unlocked',
      message: 'Use code NEXORA20 on your next Hydra Facial or Hair Spa package.',
      time: '2 hours ago',
      icon: 'local_offer',
      type: 'promo',
      unread: true,
    },
    {
      id: 'notif-3',
      title: '450 Beauty Reward Points Added',
      message: 'Points credited for completing your previous spa appointment.',
      time: 'Yesterday',
      icon: 'stars',
      type: 'rewards',
      unread: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="notifications-modal-container"
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-outline-variant/30 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-nexora-pink text-[22px]">notifications</span>
            <h2 className="font-card-title text-[17px] font-bold text-on-surface">Notifications</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                n.unread
                  ? 'bg-surface-container-low border-outline-variant'
                  : 'bg-surface-container-lowest border-outline-variant/30 opacity-80'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink shrink-0">
                <span className="material-symbols-outlined text-[18px]">{n.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h4 className="font-semibold text-[13px] text-on-surface truncate">{n.title}</h4>
                  <span className="text-[10px] text-on-surface-variant shrink-0">{n.time}</span>
                </div>
                <p className="text-[12px] text-on-surface-variant leading-snug">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
