import React from 'react';
import { useNotifications } from './useNotifications';
import { NOTIFICATIONS_CONFIG } from './notifications.config';

/**
 * NotificationCenter
 *
 * UI shell only. Shows a placeholder empty state until a notification
 * service (in_app / email / sms / whatsapp) is wired up. Sending is
 * intentionally not implemented.
 *
 * @param {{ className?: string }} props
 */
export default function NotificationCenter({ className = '' }) {
  const { notifications, isConfigured } = useNotifications();

  return (
    <div className={`aera-notification-center ${className}`} role="region" aria-label="Notifications">
      {!isConfigured || notifications.length === 0 ? (
        <p className="aera-empty-state" role="status">
          {!isConfigured
            ? NOTIFICATIONS_CONFIG.notConfiguredMessage
            : NOTIFICATIONS_CONFIG.emptyMessage}
        </p>
      ) : (
        <ul>
          {notifications.map((n) => (
            <li key={n.id}>{n.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
