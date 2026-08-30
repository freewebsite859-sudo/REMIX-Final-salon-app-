import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NOTIFICATION_META,
  deleteNotification,
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type AppNotification,
} from '../lib/notificationService';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  notifications: AppNotification[];
  isLoading?: boolean;
  isDisabled?: boolean;
  errorMessage?: string | null;
  /** Called with the notification the user opened, so the app can deep-link. */
  onSelectNotification?: (notification: AppNotification) => void;
  /** Re-read from the database (opening the panel always refreshes). */
  onRefresh?: () => Promise<void> | void;
  /** Notify the parent so the header badge stays in sync. */
  onNotificationsChanged?: () => void;
  onShowToast?: (message: string) => void;
}

type FilterTab = 'all' | 'unread';

/**
 * Notification centre.
 *
 * Every row comes from the database through `notificationService` — this
 * component renders no sample content. Read/unread, mark-all-read, delete and
 * deep-linking all write through to the backend; the local list is only a cache
 * of what the server returned.
 */
export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  userId,
  notifications,
  isLoading = false,
  isDisabled = false,
  errorMessage = null,
  onSelectNotification,
  onRefresh,
  onNotificationsChanged,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Opening the panel pulls the latest rows from the database.
  useEffect(() => {
    if (isOpen && userId) void onRefresh?.();
  }, [isOpen, userId, onRefresh]);

  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications),
    [filter, notifications]
  );
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const handleOpenNotification = useCallback(
    async (notification: AppNotification) => {
      if (!notification.isRead) {
        if (userId) {
          setBusyId(notification.id);
          const result = await markNotificationRead(notification.id, { userId });
          setBusyId(null);
          if (!result.ok) {
            onShowToast?.('Could not mark this notification as read.');
          }
          onNotificationsChanged?.();
        }
      }
      onSelectNotification?.(notification);
      onClose();
    },
    [onClose, onNotificationsChanged, onSelectNotification, onShowToast, userId]
  );

  const handleToggleRead = useCallback(
    async (event: React.MouseEvent, notification: AppNotification) => {
      event.stopPropagation();
      if (!userId) return;
      setBusyId(notification.id);
      const result = notification.isRead
        ? await markNotificationUnread(notification.id, { userId })
        : await markNotificationRead(notification.id, { userId });
      setBusyId(null);
      if (!result.ok) {
        onShowToast?.('Could not update this notification.');
        return;
      }
      onNotificationsChanged?.();
    },
    [onNotificationsChanged, onShowToast, userId]
  );

  const handleDelete = useCallback(
    async (event: React.MouseEvent, notification: AppNotification) => {
      event.stopPropagation();
      if (!userId) return;
      setBusyId(notification.id);
      const result = await deleteNotification(notification.id, { userId });
      setBusyId(null);
      if (!result.ok) {
        onShowToast?.('Could not delete this notification.');
        return;
      }
      onShowToast?.('Notification deleted');
      onNotificationsChanged?.();
    },
    [onNotificationsChanged, onShowToast, userId]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || unreadCount === 0) return;
    setIsMarkingAll(true);
    const result = await markAllNotificationsRead(userId);
    setIsMarkingAll(false);
    if (!result.ok) {
      onShowToast?.('Could not mark notifications as read.');
      return;
    }
    onShowToast?.('All notifications marked as read');
    onNotificationsChanged?.();
  }, [onNotificationsChanged, onShowToast, unreadCount, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        id="notifications-modal-container"
        role="dialog"
        aria-label="Notifications"
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-outline-variant/30 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-nexora-pink text-[22px]">notifications</span>
            <h2 className="font-card-title text-[17px] font-bold text-on-surface">Notifications</h2>
            {unreadCount > 0 && (
              <span
                id="notifications-unread-badge"
                className="text-[10px] font-bold bg-nexora-pink text-white px-2 py-0.5 rounded-full"
              >
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Toolbar: filter + mark all as read */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              id="notifications-filter-all"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              id="notifications-filter-unread"
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'unread'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <button
            type="button"
            id="notifications-mark-all-read"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || unreadCount === 0 || !userId}
            className="text-[11px] font-bold text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[15px]">done_all</span>
            <span>{isMarkingAll ? 'Marking…' : 'Mark all as read'}</span>
          </button>
        </div>

        {/* States */}
        {errorMessage && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-800 font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
            <div className="leading-snug">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => void onRefresh?.()}
                className="block mt-1 font-bold underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoading && notifications.length === 0 && (
          <div className="py-10 flex flex-col items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[26px] animate-pulse">progress_activity</span>
            <p className="text-[12px]">Loading your notifications…</p>
          </div>
        )}

        {!isLoading && isDisabled && (
          <div className="py-10 flex flex-col items-center gap-2 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[28px]">cloud_off</span>
            <p className="text-[12px] font-semibold">Notifications are unavailable</p>
            <p className="text-[11px] max-w-[260px] leading-snug">
              The notification backend could not be reached, so nothing is shown here rather than
              placeholder content.
            </p>
          </div>
        )}

        {!isLoading && !isDisabled && visible.length === 0 && (
          <div className="py-10 flex flex-col items-center gap-2 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[30px]">notifications_none</span>
            <p className="text-[12px] font-semibold">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-[11px] max-w-[260px] leading-snug">
              {filter === 'unread'
                ? 'You are all caught up.'
                : 'Booking updates, rewards, referrals and offers will appear here.'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {visible.map((n) => {
            const meta = NOTIFICATION_META[n.type];
            const isBusy = busyId === n.id;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleOpenNotification(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleOpenNotification(n);
                  }
                }}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  n.isRead
                    ? 'bg-surface-container-lowest border-outline-variant/30 opacity-85'
                    : 'bg-surface-container-low border-outline-variant'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink shrink-0 relative">
                  <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                  {!n.isRead && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-nexora-pink ring-2 ring-surface" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className="font-semibold text-[13px] text-on-surface truncate">{n.title}</h4>
                    <span className="text-[10px] text-on-surface-variant shrink-0">
                      {formatNotificationTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] text-on-surface-variant leading-snug">{n.body}</p>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] uppercase tracking-wide font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                      {meta.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => void handleToggleRead(e, n)}
                      disabled={isBusy || !userId}
                      className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {n.isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void handleDelete(e, n)}
                      disabled={isBusy || !userId}
                      aria-label="Delete notification"
                      className="text-[10px] font-bold text-on-surface-variant hover:text-rose-700 transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
