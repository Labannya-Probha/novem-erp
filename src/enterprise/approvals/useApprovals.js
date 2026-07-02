import { useMemo } from 'react';
import { APPROVAL_STATUS_LABELS } from './approvals.config';

/**
 * useApprovals
 *
 * Pure formatting helper for an approvals array passed in by the
 * caller. Performs no data fetching — the caller is responsible for
 * loading approval records (from wherever they eventually live) and
 * passing them in.
 *
 * @param {Array<{ id: string, status: string, stageLabel: string, actor?: string, timestamp?: string }>} approvals
 */
export function useApprovals(approvals = []) {
  const formatted = useMemo(
    () =>
      (approvals || []).map((a) => ({
        ...a,
        statusLabel: APPROVAL_STATUS_LABELS[a.status] || a.status,
      })),
    [approvals]
  );

  return { approvals: formatted, isEmpty: formatted.length === 0 };
}
