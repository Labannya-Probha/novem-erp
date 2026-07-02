import React from 'react';
import { useActivityTimeline } from './useActivityTimeline';
import { ACTIVITY_CONFIG } from './activity.config';

/**
 * ActivityTimeline
 *
 * Reusable, purely presentational component. Accepts an `activity`
 * array as props — no direct database dependency. Can later be
 * connected to an `audit_log` table by a data-fetching hook elsewhere
 * in the app that passes results in as props.
 *
 * @param {{
 *   activity?: Array<{ id: string, actor?: string, action: string, timestamp: string }>,
 * }} props
 */
export default function ActivityTimeline({ activity = [] }) {
  const { activity: items, isEmpty } = useActivityTimeline(activity);

  if (isEmpty) {
    return (
      <p className="aera-empty-state" role="status">
        {ACTIVITY_CONFIG.emptyMessage}
      </p>
    );
  }

  return (
    <ol className="aera-activity-timeline" aria-label="Activity timeline">
      {items.map((item) => (
        <li key={item.id}>
          {item.actor && <span className="aera-activity-actor">{item.actor}</span>}
          <span className="aera-activity-action">{item.action}</span>
          <time className="aera-activity-timestamp" dateTime={item.timestamp}>
            {item.timestamp}
          </time>
        </li>
      ))}
    </ol>
  );
}
