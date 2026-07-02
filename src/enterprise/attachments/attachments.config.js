/**
 * Global Attachment System — config only.
 *
 * No upload implementation exists here. If the codebase already has a
 * safe upload service (e.g. a Supabase Storage helper used elsewhere,
 * such as the tenant logo upload flow), wire useAttachments.js to call
 * it. Otherwise this stays a placeholder.
 */

export const ATTACHMENTS_CONFIG = {
  notConfiguredMessage: 'Attachment upload is not connected yet.',
  emptyMessage: 'No attachments.',
  /** Entity types this panel is expected to support once wired up. */
  supportedEntityTypes: [
    'reservation',
    'invoice',
    'voucher',
    'purchase_request',
    'employee',
    'guest',
  ],
};
