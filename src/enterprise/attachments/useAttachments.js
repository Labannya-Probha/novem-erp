import { useState } from 'react';

/**
 * useAttachments
 *
 * UI-shell state only. Does not perform any real upload — there is no
 * confirmed existing upload service to safely reuse yet. `isConfigured`
 * stays false until this hook is updated to call one.
 *
 * @param {string} entityType
 * @param {string} entityId
 */
export function useAttachments(entityType, entityId) {
  const [attachments] = useState([]);
  const isConfigured = false;

  function uploadFile(_file) {
    // Intentionally not implemented. Wire this to an existing upload
    // service (e.g. Supabase Storage) once one is confirmed safe to
    // reuse for this entity type.
  }

  return {
    entityType,
    entityId,
    attachments,
    isConfigured,
    uploadFile,
  };
}
