/**
 * Notification Center — config only. No sending is implemented.
 *
 * Future integration: implement a `notifications` table + Supabase
 * realtime subscription, or an external notification service, and
 * populate useNotifications.js from it.
 */

/** @typedef {'in_app'|'email'|'sms'|'whatsapp'} NotificationChannel */

/** @type {NotificationChannel[]} */
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'whatsapp'];

export const NOTIFICATIONS_CONFIG = {
  notConfiguredMessage: 'No notification service configured yet.',
  emptyMessage: 'No notifications.',
};
