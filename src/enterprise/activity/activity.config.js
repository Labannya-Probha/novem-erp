/**
 * Activity Timeline — display config only.
 *
 * Future integration: feed this component from the existing
 * `audit_log` table (if one exists in the schema) via a normal
 * data-fetching hook elsewhere in the app — this component itself
 * stays database-agnostic.
 */

export const ACTIVITY_CONFIG = {
  emptyMessage: 'No activity recorded yet.',
};
