import { useState } from 'react';
import { NOTIFICATION_CHANNELS } from './notifications.config';

/**
 * useNotifications
 *
 * UI-shell state only — no notification service is wired up yet.
 * `notifications` always resolves to an empty array until a real
 * backend (table + realtime subscription, or external service) is
 * connected.
 *
 * @returns {{
 *   notifications: any[],
 *   unreadCount: number,
 *   isConfigured: boolean,
 *   channels: typeof NOTIFICATION_CHANNELS,
 *   markAllRead: () => void,
 * }}
 */
export function useNotifications() {
  const [notifications] = useState([]);
  const isConfigured = false;

  function markAllRead() {
    // No-op until a real notification service exists.
  }

  return {
    notifications,
    unreadCount: 0,
    isConfigured,
    channels: NOTIFICATION_CHANNELS,
    markAllRead,
  };
}
