import { useState } from 'react';

/**
 * useComments
 *
 * UI-shell state only. No comment service exists yet, so `comments`
 * always resolves empty and `postComment` is a no-op. Intended future
 * shape: a `comments` table keyed by (entity_type, entity_id) with a
 * Supabase realtime subscription.
 *
 * @param {string} entityType
 * @param {string} entityId
 */
export function useComments(entityType, entityId) {
  const [comments] = useState([]);
  const isConfigured = false;

  function postComment(_text) {
    // Intentionally not implemented until a comment service exists.
  }

  return {
    entityType,
    entityId,
    comments,
    isConfigured,
    postComment,
  };
}
