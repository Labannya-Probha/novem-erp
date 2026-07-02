import React from 'react';
import { useApprovals } from './useApprovals';
import { APPROVALS_CONFIG } from './approvals.config';

/**
 * ApprovalTimeline
 *
 * Reusable, purely presentational timeline. Accepts an `approvals`
 * array as props — makes no Supabase calls itself. Intended to later
 * be fed by workflow/approval records once that backend exists.
 *
 * @param {{
 *   approvals?: Array<{ id: string, status: string, stageLabel: string, actor?: string, timestamp?: string }>,
 * }} props
 */
export default function ApprovalTimeline({ approvals = [] }) {
  const { approvals: items, isEmpty } = useApprovals(approvals);

  if (isEmpty) {
    return (
      <p className="aera-empty-state" role="status">
        {APPROVALS_CONFIG.emptyMessage}
      </p>
    );
  }

  return (
    <ol className="aera-approval-timeline" aria-label="Approval timeline">
      {items.map((item) => (
        <li key={item.id} data-status={item.status}>
          <span className="aera-approval-stage">{item.stageLabel}</span>
          <span className="aera-approval-status">{item.statusLabel}</span>
          {item.actor && <span className="aera-approval-actor">{item.actor}</span>}
          {item.timestamp && (
            <time className="aera-approval-timestamp" dateTime={item.timestamp}>
              {item.timestamp}
            </time>
          )}
        </li>
      ))}
    </ol>
  );
}
