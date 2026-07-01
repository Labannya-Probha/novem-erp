import { describe, it, expect } from 'vitest'
import {
  normalizeInvoiceItems,
  normalizeInvoiceTotals,
  resolveBuyerInfo,
} from './invoiceFormat.js'

// ─── normalizeInvoiceItems ────────────────────────────────────────────────────

describe('normalizeInvoiceItems()', () => {
  it('returns new-format charges as-is when charges array is non-empty', () => {
    const charges = [
      { id: '1', charge_type: 'ROOM', description: 'Deluxe Room', base_amount: 5000, discount: 0, service_charge: 250, vat: 262.5, total: 5512.5 },
    ]
    const { items, isLegacy } = normalizeInvoiceItems(charges, [])
    expect(isLegacy).toBe(false)
    expect(items).toBe(charges)
  })

  it('maps legacy line_snapshot to normalised shape with _legacy flag', () => {
    const snapshot = [
      { description: 'Room charge', amount: 4000 },
      { description: 'Extra bed', amount: 500 },
    ]
    const { items, isLegacy } = normalizeInvoiceItems([], snapshot)
    expect(isLegacy).toBe(true)
    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(item._legacy).toBe(true)
      expect(item.discount).toBe(0)
      expect(item.service_charge).toBe(0)
      expect(item.vat).toBe(0)
    }
    expect(items[0].base_amount).toBe(4000)
    expect(items[1].base_amount).toBe(500)
  })

  it('returns empty items when both arrays are empty', () => {
    const { items, isLegacy } = normalizeInvoiceItems([], [])
    expect(items).toHaveLength(0)
    expect(isLegacy).toBe(false)
  })

  it('returns empty items when both args are undefined/null', () => {
    const { items } = normalizeInvoiceItems(undefined, undefined)
    expect(items).toHaveLength(0)
  })

  it('prefers charges over line_snapshot when both are provided', () => {
    const charges  = [{ id: 'x', description: 'New', base_amount: 100 }]
    const snapshot = [{ description: 'Old', amount: 50 }]
    const { items, isLegacy } = normalizeInvoiceItems(charges, snapshot)
    expect(isLegacy).toBe(false)
    expect(items).toBe(charges)
  })
})

// ─── normalizeInvoiceTotals ───────────────────────────────────────────────────

describe('normalizeInvoiceTotals()', () => {
  it('handles new-format totals correctly', () => {
    const t = normalizeInvoiceTotals({
      base: 5000, discount: 200, service_charge: 240, vat: 252,
      rounding: -0.5, grand_total_raw: 5292, grand_total: 5291.5,
    })
    expect(t.base).toBe(5000)
    expect(t.discount).toBe(200)
    expect(t.service_charge).toBe(240)
    expect(t.vat).toBe(252)
    expect(t.rounding).toBe(-0.5)
    expect(t.grand_total_raw).toBe(5292)
    expect(t.grand_total).toBe(5291.5)
  })

  it('handles old-format totals (subtotal/vat/total)', () => {
    const t = normalizeInvoiceTotals({ subtotal: 4000, vat: 600, total: 4600 })
    expect(t.base).toBe(4000)
    expect(t.vat).toBe(600)
    expect(t.grand_total).toBe(4600)
  })

  it('handles totals with service_charge in old format', () => {
    const t = normalizeInvoiceTotals({ subtotal: 4000, service_charge: 200, vat: 420, total: 4620 })
    expect(t.service_charge).toBe(200)
    expect(t.vat).toBe(420)
    expect(t.grand_total).toBe(4620)
  })

  it('returns zeroed totals for null/empty input', () => {
    const t = normalizeInvoiceTotals(null)
    expect(t.base).toBe(0)
    expect(t.vat).toBe(0)
    expect(t.grand_total).toBe(0)
  })

  it('derives grand_total from base - discount + sc + vat when not provided', () => {
    const t = normalizeInvoiceTotals({ base: 1000, discount: 100, service_charge: 45, vat: 94.5 })
    // grand_total_raw = 1000 - 100 + 45 + 94.5 = 1039.5
    // grand_total = grand_total_raw + rounding (0) = 1039.5
    expect(t.grand_total_raw).toBeCloseTo(1039.5, 2)
    expect(t.grand_total).toBeCloseTo(1039.5, 2)
  })

  it('VAT 15% on base 1000 → vat = 150, grand_total = 1150', () => {
    const base = 1000
    const vat = base * 0.15
    const t = normalizeInvoiceTotals({ base, vat, total: base + vat })
    expect(t.vat).toBe(150)
    expect(t.grand_total).toBe(1150)
  })

  it('VAT 15% with service charge 5% on base 2000', () => {
    // BD VAT on hospitality: VAT is applied on (base + service_charge)
    // base=2000, sc=100 (5%), vat=(2000+100)*0.15=315, total=2415
    const t = normalizeInvoiceTotals({ base: 2000, service_charge: 100, vat: 315, total: 2415 })
    expect(t.base).toBe(2000)
    expect(t.service_charge).toBe(100)
    expect(t.vat).toBe(315)
    expect(t.grand_total).toBe(2415)
  })
})

// ─── resolveBuyerInfo ─────────────────────────────────────────────────────────

describe('resolveBuyerInfo()', () => {
  it('uses explicit buyer fields when provided (saved invoice)', () => {
    const info = resolveBuyerInfo({
      buyer_name: 'ABC Corp', buyer_address: 'Dhaka', buyer_bin: '123456789',
      res: {}, guest: {}, guestCompany: null,
    })
    expect(info.name).toBe('ABC Corp')
    expect(info.address).toBe('Dhaka')
    expect(info.bin).toBe('123456789')
  })

  it('falls back to company name for Company-type guest', () => {
    const info = resolveBuyerInfo({
      res: { guest_type: 'Company' },
      guest: { full_name: 'John' },
      guestCompany: { name: 'XYZ Ltd', address: 'Chittagong', bin: '987654321' },
      buyer_name: null, buyer_address: null, buyer_bin: null,
    })
    expect(info.name).toBe('XYZ Ltd')
    expect(info.address).toBe('Chittagong')
    expect(info.bin).toBe('987654321')
  })

  it('falls back to guest full_name for individual guests', () => {
    const info = resolveBuyerInfo({
      res: { guest_type: 'Individual' },
      guest: { full_name: 'Jane Doe' },
      guestCompany: null,
      buyer_name: null, buyer_address: null, buyer_bin: null,
    })
    expect(info.name).toBe('Jane Doe')
  })

  it('uses reservation_name as final fallback', () => {
    const info = resolveBuyerInfo({
      res: { guest_type: null, reservation_name: 'Walk-in Guest' },
      guest: null,
      guestCompany: null,
      buyer_name: null, buyer_address: null, buyer_bin: null,
    })
    expect(info.name).toBe('Walk-in Guest')
  })

  it('returns fallback "—" when all sources are null', () => {
    const info = resolveBuyerInfo({
      res: null, guest: null, guestCompany: null,
      buyer_name: null, buyer_address: null, buyer_bin: null,
    })
    expect(info.name).toBe('—')
  })
})
