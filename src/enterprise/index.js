/**
 * src/enterprise/index.js
 *
 * Barrel export for all AEDS v2.1 enterprise extension points.
 * These are safe UI shells / config placeholders — see each module's
 * JSDoc for what is and is not implemented.
 */

// Universal Search
export { default as UniversalSearch } from './search/UniversalSearch';
export { useUniversalSearch } from './search/useUniversalSearch';
export { SEARCH_ENTITIES, SEARCH_CONFIG } from './search/search.config';

// Command Palette
export { default as CommandPalette } from './command-palette/CommandPalette';
export { useCommandPalette } from './command-palette/useCommandPalette';
export { COMMANDS, COMMAND_PALETTE_CONFIG } from './command-palette/commands.config';

// Favorites
export { default as FavoritesMenu } from './favorites/FavoritesMenu';
export { useFavorites } from './favorites/useFavorites';

// Recent Pages
export { default as RecentPagesMenu } from './recent/RecentPagesMenu';
export { useRecentPages } from './recent/useRecentPages';

// Notification Center
export { default as NotificationCenter } from './notifications/NotificationCenter';
export { useNotifications } from './notifications/useNotifications';
export { NOTIFICATION_CHANNELS, NOTIFICATIONS_CONFIG } from './notifications/notifications.config';

// Workflow Engine
export {
  default as WorkflowEngineProvider,
  useWorkflowEngineContext,
} from './workflow/WorkflowEngineProvider';
export { useWorkflow } from './workflow/useWorkflow';
export { WORKFLOW_DEFINITIONS } from './workflow/workflow.config';

// Approval Timeline
export { default as ApprovalTimeline } from './approvals/ApprovalTimeline';
export { useApprovals } from './approvals/useApprovals';

// Activity Timeline
export { default as ActivityTimeline } from './activity/ActivityTimeline';
export { useActivityTimeline } from './activity/useActivityTimeline';

// Global Attachment System
export { default as AttachmentPanel } from './attachments/AttachmentPanel';
export { useAttachments } from './attachments/useAttachments';

// Comment System
export { default as CommentsPanel } from './comments/CommentsPanel';
export { useComments } from './comments/useComments';

// Dashboard Personalization
export {
  default as DashboardPersonalizationProvider,
} from './dashboard/DashboardPersonalizationProvider';
export { useDashboardLayout } from './dashboard/useDashboardLayout';
export { AVAILABLE_WIDGETS } from './dashboard/dashboard.widgets.config';

// Report Builder
export { default as ReportBuilderShell } from './report-builder/ReportBuilderShell';
export { useReportBuilder } from './report-builder/useReportBuilder';
