export const TENANT_ID = import.meta.env.VITE_TENANT_ID || null

// Runtime tenant — set after login from app_users.tenant_id.
// Stored in sessionStorage so it clears automatically on tab/browser close
// (consistent with the supabase.js auth session strategy).
const STORAGE_KEY = 'aura_tenant_id'

export function getTenantId() {
  try { return sessionStorage.getItem(STORAGE_KEY) || TENANT_ID || null } catch { return TENANT_ID || null }
}

export function setTenantId(id) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function withTenantInsert(row = {}) {
  const tid = getTenantId()
  return tid ? { ...row, tenant_id: row.tenant_id || tid } : row
}

export function withTenantInsertMany(rows = []) {
  const tid = getTenantId()
  if (!tid) return rows
  return rows.map((r) => ({ ...r, tenant_id: r.tenant_id || tid }))
}
