import React from 'react';
import { useAttachments } from './useAttachments';
import { ATTACHMENTS_CONFIG } from './attachments.config';

/**
 * AttachmentPanel
 *
 * Component shell for a global "attach a file to any record" system.
 * Shows an upload placeholder only — real upload is intentionally not
 * implemented until an existing, confirmed-safe upload service can be
 * reused.
 *
 * @param {{ entityType: string, entityId: string, className?: string }} props
 */
export default function AttachmentPanel({ entityType, entityId, className = '' }) {
  const { attachments, isConfigured } = useAttachments(entityType, entityId);

  return (
    <div
      className={`aera-attachment-panel ${className}`}
      role="region"
      aria-label={`Attachments for ${entityType}`}
    >
      {!isConfigured ? (
        <p className="aera-empty-state" role="status">
          {ATTACHMENTS_CONFIG.notConfiguredMessage}
        </p>
      ) : attachments.length === 0 ? (
        <p className="aera-empty-state" role="status">
          {ATTACHMENTS_CONFIG.emptyMessage}
        </p>
      ) : (
        <ul>
          {attachments.map((a) => (
            <li key={a.id}>{a.filename}</li>
          ))}
        </ul>
      )}

      <button type="button" disabled aria-label="Upload attachment (not yet available)">
        Upload file
      </button>
    </div>
  );
}
