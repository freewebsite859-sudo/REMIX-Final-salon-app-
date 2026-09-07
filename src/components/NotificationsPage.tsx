import React, { useMemo, useState } from 'react';
import type { UserProfile } from '../types.ts';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../lib/notificationService.ts';

export type CustomerNotificationType =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'reward_credited'
  | 'referral_reward_pending'
  | 'membership_update'
  | 'offer_available'
  | 'review_reminder';

export interface CustomerNotificationItem {
  id: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  time: string;
  createdAt: string; // ISO string
  isRead: boolean;
  actionRoute?: 'bookings' | 'rewards' | 'membership' | 'referral' | 'reviews' | 'search';
  metadata?: Record<string, unknown>;
}

export const NOTIFICATION_TYPE_CONFIG: Record<
  CustomerNotificationType,
  { icon: string; badgeColor: string; defaultTitle: string; defaultRoute: 'bookings' | 'rewards' | 'membership' | 'referral' | 'reviews' | 'search' }
> = {
  booking_confirmed: {
    icon: 'check_circle',
    badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
    defaultTitle: 'Booking Confirmed',
    defaultRoute: 'bookings',
  },
  booking_reminder: {
    icon: 'alarm',
    badgeColor: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
    defaultTitle: 'Booking Reminder',
    defaultRoute: 'bookings',
  },
  booking_cancelled: {
    icon: 'cancel',
    badgeColor: 'bg-rose-500/15 text-rose-800 border-rose-500/30',
    defaultTitle: 'Booking Cancelled',
    defaultRoute: 'bookings',
  },
  reward_credited: {
    icon: 'stars',
    badgeColor: 'bg-[#b00055]/15 text-[#b00055] border-[#b00055]/30',
    defaultTitle: 'Reward Credited',
    defaultRoute: 'rewards',
  },
  referral_reward_pending: {
    icon: 'hourglass_top',
    badgeColor: 'bg-orange-500/15 text-orange-800 border-orange-500/30',
    defaultTitle: 'Referral Reward Pending',
    defaultRoute: 'referral',
  },
  membership_update: {
    icon: 'card_membership',
    badgeColor: 'bg-indigo-500/15 text-indigo-800 border-indigo-500/30',
    defaultTitle: 'Membership Update',
    defaultRoute: 'membership',
  },
  offer_available: {
    icon: 'local_offer',
    badgeColor: 'bg-primary/15 text-primary border-primary/30',
    defaultTitle: 'Offer Available',
    defaultRoute: 'search',
  },
  review_reminder: {
    icon: 'rate_review',
    badgeColor: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/30',
    defaultTitle: 'Review Reminder',
    defaultRoute: 'reviews',
  },
};

export const DEFAULT_CUSTOMER_NOTIFICATIONS: CustomerNotificationItem[] = [
  {
    id: 'notif-1',
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    message: 'Your booking at Scissors & Shears Salon for Signature Hair Cut is confirmed for 02:30 PM.',
    time: '10 mins ago',
    createdAt: '2026-09-07T17:00:00.000Z',
    isRead: false,
    actionRoute: 'bookings',
  },
  {
    id: 'notif-2',
    type: 'booking_reminder',
    title: 'Booking Reminder',
    message: 'Your appointment at Luxe Beauty Lounge starts in 2 hours. See you soon!',
    time: '1 hour ago',
    createdAt: '2026-09-07T16:00:00.000Z',
    isRead: false,
    actionRoute: 'bookings',
  },
  {
    id: 'notif-3',
    type: 'reward_credited',
    title: 'Reward Credited',
    message: '₹80 (80 pts) 10% cashback added to your Rewards Wallet for your in-shop QR payment.',
    time: '3 hours ago',
    createdAt: '2026-09-07T14:00:00.000Z',
    isRead: false,
    actionRoute: 'rewards',
  },
  {
    id: 'notif-4',
    type: 'offer_available',
    title: 'Offer Available',
    message: 'Flash Festive Deal: Get 20% off all Hydra Facials & Scalp Spas this weekend at partner salons.',
    time: 'Yesterday',
    createdAt: '2026-09-06T12:00:00.000Z',
    isRead: true,
    actionRoute: 'search',
  },
  {
    id: 'notif-5',
    type: 'referral_reward_pending',
    title: 'Referral Reward Pending',
    message: 'Your friend Rahul joined using your code! 150 pts will be unlocked when they make their first ₹100+ QR payment.',
    time: '2 days ago',
    createdAt: '2026-09-05T09:30:00.000Z',
    isRead: true,
    actionRoute: 'referral',
  },
  {
    id: 'notif-6',
    type: 'membership_update',
    title: 'Membership Update',
    message: "Congratulations! You've reached Gold Tier. Enjoy 10% off and priority salon slots at all partner shops.",
    time: '3 days ago',
    createdAt: '2026-09-04T10:00:00.000Z',
    isRead: true,
    actionRoute: 'membership',
  },
  {
    id: 'notif-7',
    type: 'review_reminder',
    title: 'Review Reminder',
    message: 'How was your visit with Aarav Sharma at Scissors & Shears Salon? Rate your visit and share your feedback!',
    time: '4 days ago',
    createdAt: '2026-09-03T18:00:00.000Z',
    isRead: true,
    actionRoute: 'reviews',
  },
  {
    id: 'notif-8',
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: 'Your booking NX-1002 has been cancelled as requested. Any advance amount has been credited back.',
    time: '5 days ago',
    createdAt: '2026-09-02T11:00:00.000Z',
    isRead: true,
    actionRoute: 'bookings',
  },
];

interface NotificationsPageProps {
  user: UserProfile;
  userId?: string | null;
  onBack?: () => void;
  onOpenBookings?: () => void;
  onOpenRewards?: () => void;
  onOpenMembership?: () => void;
  onOpenReferral?: () => void;
  onOpenReviews?: () => void;
  onExploreSalons?: () => void;
  onNotificationsChanged?: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  user,
  userId,
  onBack,
  onOpenBookings,
  onOpenRewards,
  onOpenMembership,
  onOpenReferral,
  onOpenReviews,
  onExploreSalons,
  onNotificationsChanged,
}) => {
  const [notifications, setNotifications] = useState<CustomerNotificationItem[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CUSTOMER_NOTIFICATIONS;
    try {
      const key = `nexora_notifications_${user.email || user.phone || 'guest'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CUSTOMER_NOTIFICATIONS;
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const saveToStorage = (updated: CustomerNotificationItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      const key = `nexora_notifications_${user.email || user.phone || 'guest'}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const visibleNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeFilter]);

  const handleToggleRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    const nextIsRead = target ? !target.isRead : true;

    const updated = notifications.map((n) =>
      n.id === id ? { ...n, isRead: nextIsRead } : n
    );
    setNotifications(updated);
    saveToStorage(updated);

    if (userId) {
      if (nextIsRead) {
        await markNotificationRead(id, { userId });
      } else {
        await markNotificationUnread(id, { userId });
      }
      onNotificationsChanged?.();
    }
  };

  const handleMarkAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    saveToStorage(updated);
    showToast('All notifications marked as read');

    if (userId) {
      await markAllNotificationsRead(userId);
      onNotificationsChanged?.();
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveToStorage(updated);
    showToast('Notification deleted');

    if (userId) {
      await deleteNotification(id, { userId });
      onNotificationsChanged?.();
    }
  };

  const handleNotificationClick = async (item: CustomerNotificationItem) => {
    // Mark as read on click
    if (!item.isRead) {
      const updated = notifications.map((n) =>
        n.id === item.id ? { ...n, isRead: true } : n
      );
      setNotifications(updated);
      saveToStorage(updated);

      if (userId) {
        await markNotificationRead(item.id, { userId });
        onNotificationsChanged?.();
      }
    }

    // Deep-link navigation based on route
    const route = item.actionRoute || NOTIFICATION_TYPE_CONFIG[item.type]?.defaultRoute;
    if (route === 'bookings' && onOpenBookings) {
      onOpenBookings();
    } else if (route === 'rewards' && onOpenRewards) {
      onOpenRewards();
    } else if (route === 'membership' && onOpenMembership) {
      onOpenMembership();
    } else if (route === 'referral' && onOpenReferral) {
      onOpenReferral();
    } else if (route === 'reviews' && onOpenReviews) {
      onOpenReviews();
    } else if (route === 'search' && onExploreSalons) {
      onExploreSalons();
    }
  };

  return (
    <div
      id="customer-notifications-page"
      data-route="/customer/notifications"
      className="flex flex-col w-full pb-28 max-w-3xl mx-auto px-page-margin pt-2"
    >
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 px-4 bg-surface-container-highest/95 backdrop-blur-md text-on-surface rounded-2xl shadow-xl border border-[#b00055]/30 flex items-center gap-2.5 text-[13px] font-semibold">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              id="btn-notifications-back"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shadow-xs transition-colors"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-extrabold text-on-surface tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span
                  id="badge-notifications-unread-count"
                  className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-extrabold shadow-xs"
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[12px] text-on-surface-variant">Booking updates, rewards, offers and salon alerts</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            id="btn-notifications-mark-all-read"
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/40 w-fit text-[12px] font-semibold">
        <button
          type="button"
          id="tab-filter-all"
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-primary text-white font-bold shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          id="tab-filter-unread"
          onClick={() => setActiveFilter('unread')}
          className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeFilter === 'unread'
              ? 'bg-primary text-white font-bold shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <section id="section-notifications-list" className="space-y-3">
        {visibleNotifications.map((item) => {
          const config = NOTIFICATION_TYPE_CONFIG[item.type] || {
            icon: 'notifications',
            badgeColor: 'bg-primary/10 text-primary border-primary/20',
            defaultTitle: item.title,
            defaultRoute: 'bookings' as const,
          };

          return (
            <article
              key={item.id}
              id={`notification-card-${item.id}`}
              onClick={() => handleNotificationClick(item)}
              className={`notification-card p-4 rounded-3xl border transition-all cursor-pointer relative group ${
                item.isRead
                  ? 'bg-surface-container-low/70 border-outline-variant/40 hover:bg-surface-container'
                  : 'bg-surface-container border-primary/40 shadow-xs hover:border-primary/70 ring-1 ring-primary/10'
              }`}
            >
              <div className="flex items-start gap-3.5">
                {/* 1. Icon */}
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${config.badgeColor}`}
                >
                  <span className="notification-icon material-symbols-outlined text-[22px]">
                    {config.icon}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {/* 2. Title */}
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="notification-title text-[14px] font-extrabold text-on-surface truncate">
                        {item.title}
                      </h2>
                      {/* 5. Read/unread state */}
                      {!item.isRead && (
                        <span
                          id={`notification-unread-dot-${item.id}`}
                          className="notification-read-status w-2 h-2 rounded-full bg-primary shrink-0"
                          title="Unread notification"
                        />
                      )}
                    </div>

                    {/* 4. Time */}
                    <time className="notification-time text-[11px] text-on-surface-variant shrink-0 font-medium">
                      {item.time}
                    </time>
                  </div>

                  {/* 3. Message */}
                  <p className="notification-message text-[12.5px] text-on-surface-variant leading-relaxed">
                    {item.message}
                  </p>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-outline-variant/20">
                    <span className="text-[11px] font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>View details</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>

                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        id={`btn-toggle-read-${item.id}`}
                        onClick={(e) => handleToggleRead(item.id, e)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                        title={item.isRead ? 'Mark as unread' : 'Mark as read'}
                      >
                        {item.isRead ? 'Mark unread' : 'Mark read'}
                      </button>

                      <button
                        type="button"
                        id={`btn-delete-notification-${item.id}`}
                        onClick={(e) => handleDeleteNotification(item.id, e)}
                        className="p-1 rounded-lg text-on-surface-variant hover:text-rose-700 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete notification"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {visibleNotifications.length === 0 && (
          <div className="text-center py-12 rounded-3xl bg-surface-container-low border border-outline-variant/40 p-6">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant opacity-40 mb-2">notifications_off</span>
            <h3 className="text-[16px] font-bold text-on-surface">No notifications</h3>
            <p className="text-[12px] text-on-surface-variant mt-1">
              {activeFilter === 'unread' ? 'You have caught up with all updates!' : 'You have no notifications right now.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};