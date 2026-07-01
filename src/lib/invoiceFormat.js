/* ------------------------------------------------------------------ */
/*  invoiceFormat.js — shared dual-format invoice helpers               */
/*                                                                      */
/*  Live invoices store full line-item breakdowns in `charges`         */
/*  (base_amount, discount, service_charge, vat, total — per line).    */
/*  Older invoices were saved before that shape existed and only have  */
/*  a simple `line_snapshot` ([{amount, description}]) with the real   */
/*  tax breakdown surviving only in the invoice-level `totals` object. */
/*                                                                      */
/*  These helpers let GuestBill.jsx / Mushak63.jsx safely render both  */
/*  formats without guessing or fabricating numbers.                   */
/* ------------------------------------------------------------------ */

/**
 * Turn either `charges` (new, rich format) or `line_snapshot` (old,
 * simple format) into one consistent array of line items.
 *
 * For legacy items, only `description`, `base_amount` and `total` are
 * real numbers (taken from the snapshot's `amount`). `discount`,
 * `service_charge` and `vat` default to 0 *purely so downstream math
 * stays safe* — every legacy item carries `_legacy: true` so the UI
 * can render those specific cells as "—" instead of implying the
 * historical charge truly had zero VAT/SC/discount.
 */
export function normalizeInvoiceItems(charges, lineSnapshot) {
  if (Array.isArray(charges) && charges.length > 0) {
    return { items: charges, isLegacy: false }
  }
  if (Array.isArray(lineSnapshot) && lineSnapshot.length > 0) {
    const items = lineSnapshot.map((l, i) => ({
      id: l.id || `legacy-${i}`,
      charge_date: l.charge_date || null,
      charge_type: l.charge_type || null,
      description: l.description || '',
      base_amount: Number(l.amount ?? l.base_amount ?? 0),
      discount: 0,
      service_charge: 0,
      vat: 0,
      total: Number(l.amount ?? l.total ?? 0),
      _legacy: true,
    }))
    return { items, isLegacy: true }
  }
  return { items: [], isLegacy: false }
}

/**
 * Normalize an invoice's `totals` JSON regardless of which schema
 * version it was saved under:
 *   new:      { base, discount, service_charge, vat, rounding, grand_total, grand_total_raw }
 *   old (A):  { subtotal, vat, total }
 *   old (B):  { subtotal, vat, total, service_charge }
 */
export function normalizeInvoiceTotals(totals) {
  const t = totals || {}
  const base           = Number(t.base ?? t.subtotal ?? 0)
  const discount        = Number(t.discount ?? 0)
  const service_charge  = Number(t.service_charge ?? 0)
  const vat             = Number(t.vat ?? 0)
  const rounding        = Number(t.rounding ?? 0)
  const grand_total_raw = Number(t.grand_total_raw ?? t.total ?? (base - discount + service_charge + vat))
  const grand_total     = Number(t.grand_total ?? t.total ?? (grand_total_raw + rounding))
  return { base, discount, service_charge, vat, rounding, grand_total, grand_total_raw }
}

/**
 * Resolve who the bill/invoice is addressed to.
 *
 * Priority:
 *   1. Explicit buyer_name/address/bin (only set on saved historical
 *      invoice rows — the record of who it was actually billed to).
 *   2. Live data: the guest's linked company (when guest_type is
 *      'Company') or the guest themself.
 */
export function resolveBuyerInfo({ res, guest, guestCompany, buyer_name, buyer_address, buyer_bin }) {
  const isCompany = res?.guest_type === 'Company'
  const name = buyer_name
    || (isCompany ? guestCompany?.name : null)
    || guest?.full_name
    || res?.reservation_name
    || '—'
  const address = buyer_address
    || (isCompany ? guestCompany?.address : null)
    || guest?.address
    || '—'
  const bin = buyer_bin || (isCompany ? guestCompany?.bin : null) || ''
  return { name, address, bin, isCompany, companyName: isCompany ? (guestCompany?.name || null) : null }
}
