import { getTenantId } from './tenant'

const STORAGE_PREFIX = 'aura_reservation_config'

function keyForTenant() {
  return `${STORAGE_PREFIX}:${getTenantId() || 'default'}`
}

function normalizePolicy(policy, fallbackIndex = 0) {
  const type = policy?.type === 'fixed' ? 'fixed' : 'percentage'
  const value = Number(policy?.value) || 0
  return {
    id: policy?.id || `policy-${Date.now()}-${fallbackIndex}`,
    name: (policy?.name || '').toString().trim(),
    type,
    value: type === 'percentage' ? Math.min(100, Math.max(0, value)) : Math.max(0, value),
    note: (policy?.note || '').toString(),
    active: policy?.active !== false,
  }
}

function normalizeConfig(raw) {
  const blackoutDays = Array.isArray(raw?.blackoutDays)
    ? Array.from(new Set(raw.blackoutDays.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))))
    : []
  const discountPolicies = Array.isArray(raw?.discountPolicies)
    ? raw.discountPolicies.map((item, index) => normalizePolicy(item, index)).filter((item) => item.name)
    : []

  return { blackoutDays, discountPolicies }
}

export function loadReservationConfig() {
  try {
    const raw = localStorage.getItem(keyForTenant())
    if (!raw) return { blackoutDays: [], discountPolicies: [] }
    return normalizeConfig(JSON.parse(raw))
  } catch {
    return { blackoutDays: [], discountPolicies: [] }
  }
}

export function saveReservationConfig(config) {
  const normalized = normalizeConfig(config)
  localStorage.setItem(keyForTenant(), JSON.stringify(normalized))
  return normalized
}
