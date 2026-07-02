import React from 'react';
import { useComments } from './useComments';
import { COMMENTS_CONFIG } from './comments.config';

/**
 * CommentsPanel
 *
 * Component shell for per-record comments. Shows a placeholder empty
 * state until a comment service exists. Real-time comments are
 * intentionally not implemented yet.
 *
 * @param {{ entityType: string, entityId: string, className?: string }} props
 */
export default function CommentsPanel({ entityType, entityId, className = '' }) {
  const { comments, isConfigured } = useComments(entityType, entityId);

  return (
    <div
      className={`aera-comments-panel ${className}`}
      role="region"
      aria-label={`Comments for ${entityType}`}
    >
      {!isConfigured ? (
        <p className="aera-empty-state" role="status">
          {COMMENTS_CONFIG.notConfiguredMessage}
        </p>
      ) : comments.length === 0 ? (
        <p className="aera-empty-state" role="status">
          {COMMENTS_CONFIG.emptyMessage}
        </p>
      ) : (
        <ul>
          {comments.map((c) => (
            <li key={c.id}>{c.text}</li>
          ))}
        </ul>
      )}

      <label htmlFor="aera-comments-input" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="aera-comments-input"
        disabled
        placeholder="Comments are not connected yet."
        aria-label="Add a comment (not yet available)"
      />
    </div>
  );
}
