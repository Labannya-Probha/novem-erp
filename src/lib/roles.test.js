import { describe, it, expect } from 'vitest'
import { can, canCreate, canEdit, canDelete, ROLES, ROLE_LABELS } from './roles.js'

describe('ROLES / ROLE_LABELS', () => {
  it('exports all expected roles', () => {
    expect(ROLES).toContain('SUPERUSER')
    expect(ROLES).toContain('ADMIN')
    expect(ROLES).toContain('MANAGER')
    expect(ROLES).toContain('FRONT_OFFICE')
    expect(ROLES).toContain('RESTAURANT')
    expect(ROLES).toContain('HR')
  })

  it('provides a label for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy()
    }
  })
})

describe('can()', () => {
  it('SUPERUSER can access every page', () => {
    expect(can('SUPERUSER', 'reservations')).toBe(true)
    expect(can('SUPERUSER', 'settings')).toBe(true)
    expect(can('SUPERUSER', 'accounting')).toBe(true)
    expect(can('SUPERUSER', 'pos')).toBe(true)
    expect(can('SUPERUSER', 'hr')).toBe(true)
  })

  it('ADMIN can access every page', () => {
    expect(can('ADMIN', 'reservations')).toBe(true)
    expect(can('ADMIN', 'settings')).toBe(true)
  })

  it('reports page is always accessible regardless of role', () => {
    expect(can('FRONT_OFFICE', 'reports')).toBe(true)
    expect(can('RESTAURANT', 'reports')).toBe(true)
    expect(can('HOUSEKEEPING', 'reports')).toBe(true)
  })

  it('uses fallback map when no privileges array is provided', () => {
    // FRONT_OFFICE has access to reservations, calendar, nightaudit, housekeeping, facilities, pos
    expect(can('FRONT_OFFICE', 'reservations')).toBe(true)
    expect(can('FRONT_OFFICE', 'pos')).toBe(true)      // FRONT_OFFICE is in the pos fallback
    expect(can('FRONT_OFFICE', 'accounting')).toBe(false)
    expect(can('FRONT_OFFICE', 'inventory')).toBe(false)
    // RESTAURANT has access to pos and facilities but not reservations
    expect(can('RESTAURANT', 'pos')).toBe(true)
    expect(can('RESTAURANT', 'reservations')).toBe(false)
    expect(can('RESTAURANT', 'accounting')).toBe(false)
    // HR role
    expect(can('HR', 'hr')).toBe(true)
    expect(can('HR', 'accounting')).toBe(false)
    // STORE role
    expect(can('STORE', 'inventory')).toBe(true)
    expect(can('STORE', 'reservations')).toBe(false)
    // ACCOUNTS role
    expect(can('ACCOUNTS', 'accounting')).toBe(true)
    expect(can('ACCOUNTS', 'hr')).toBe(false)
    // settings is admin/superuser only in fallback
    expect(can('MANAGER', 'settings')).toBe(false)
    expect(can('FRONT_OFFICE', 'settings')).toBe(false)
  })

  it('uses privileges array when provided', () => {
    const privileges = [
      { module: 'reservations', can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
      { module: 'pos',          can_view: false, can_create: false, can_edit: false, can_delete: false },
      { module: 'accounting',   can_view: true,  can_create: false, can_edit: false, can_delete: false },
    ]
    expect(can('MANAGER', 'reservations', privileges)).toBe(true)
    expect(can('MANAGER', 'pos', privileges)).toBe(false)
    expect(can('MANAGER', 'accounting', privileges)).toBe(true)
  })

  it('denies access if privileges row is missing for the module (explicit deny)', () => {
    const privileges = [
      { module: 'reservations', can_view: true, can_create: false, can_edit: false, can_delete: false },
    ]
    expect(can('MANAGER', 'inventory', privileges)).toBe(false)
  })
})

describe('canCreate()', () => {
  it('SUPERUSER can always create', () => {
    expect(canCreate('SUPERUSER', 'reservations')).toBe(true)
  })

  it('respects privileges.can_create', () => {
    const priv = [{ module: 'pos', can_view: true, can_create: true, can_edit: false, can_delete: false }]
    expect(canCreate('MANAGER', 'pos', priv)).toBe(true)

    const priv2 = [{ module: 'pos', can_view: true, can_create: false, can_edit: false, can_delete: false }]
    expect(canCreate('MANAGER', 'pos', priv2)).toBe(false)
  })
})

describe('canEdit()', () => {
  it('SUPERUSER can always edit', () => {
    expect(canEdit('SUPERUSER', 'hr')).toBe(true)
  })

  it('respects privileges.can_edit', () => {
    const priv = [{ module: 'hr', can_view: true, can_create: false, can_edit: true, can_delete: false }]
    expect(canEdit('HR', 'hr', priv)).toBe(true)

    const priv2 = [{ module: 'hr', can_view: true, can_create: false, can_edit: false, can_delete: false }]
    expect(canEdit('HR', 'hr', priv2)).toBe(false)
  })
})

describe('canDelete()', () => {
  it('SUPERUSER can always delete', () => {
    expect(canDelete('SUPERUSER', 'inventory')).toBe(true)
  })

  it('never assumes delete access during fallback window (no privileges)', () => {
    expect(canDelete('MANAGER', 'inventory')).toBe(false)
    expect(canDelete('ADMIN', 'settings')).toBe(true) // ADMIN bypasses
  })

  it('respects privileges.can_delete', () => {
    const priv = [{ module: 'inventory', can_view: true, can_create: false, can_edit: false, can_delete: true }]
    expect(canDelete('STORE', 'inventory', priv)).toBe(true)

    const priv2 = [{ module: 'inventory', can_view: true, can_create: false, can_edit: false, can_delete: false }]
    expect(canDelete('STORE', 'inventory', priv2)).toBe(false)
  })
})
