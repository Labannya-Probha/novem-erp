import { useMemo } from 'react';

/**
 * useActivityTimeline
 *
 * Pure formatting/sorting helper for an activity array passed in by
 * the caller. No database dependency — does not query `audit_log` or
 * any other table itself.
 *
 * @param {Array<{ id: string, actor?: string, action: string, timestamp: string }>} activity
 */
export function useActivityTimeline(activity = []) {
  const sorted = useMemo(
    () =>
      [...(activity || [])].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
    [activity]
  );

  return { activity: sorted, isEmpty: sorted.length === 0 };
}
