const DEFAULT_TIMEZONE = 'Asia/Dhaka'
const DEFAULT_CURRENCY = 'BDT'

export const POS_COPY_PROFILES = {
  CUSTOMER_COPY: {
    code: 'CUSTOMER_COPY',
    title: 'CUSTOMER COPY',
    watermark: 'CUSTOMER COPY',
    showPayment: true,
    showAudit: false,
    signatureLines: [],
  },
  MERCHANT_COPY: {
    code: 'MERCHANT_COPY',
    title: 'MERCHANT COPY',
    watermark: 'MERCHANT COPY',
    showPayment: true,
    showAudit: true,
    signatureLines: ['Customer Signature', 'Cashier'],
  },
  RESORT_COPY: {
    code: 'RESORT_COPY',
    title: 'RESORT COPY',
    watermark: 'RESORT COPY',
    showPayment: true,
    showAudit: true,
    signatureLines: ['Cashier', 'Outlet Manager', 'Accounts'],
  },
  DELIVERY_COPY: {
    code: 'DELIVERY_COPY',
    title: 'DELIVERY COPY',
    watermark: 'DELIVERY COPY',
    showPayment: true,
    showAudit: true,
    signatureLines: ['Rider', 'Customer'],
  },
  VOID_COPY: {
    code: 'VOID_COPY',
    title: 'VOID COPY',
    watermark: 'VOID COPY',
    showPayment: false,
    showAudit: true,
    signatureLines: ['Voided By', 'Approved By'],
  },
  REPRINT_COPY: {
    code: 'REPRINT_COPY',
    title: 'REPRINT COPY',
    watermark: 'REPRINT COPY',
    showPayment: true,
    showAudit: true,
    signatureLines: ['Printed By'],
  },
  AUDIT_COPY: {
    code: 'AUDIT_COPY',
    title: 'AUDIT COPY',
    watermark: 'AUDIT COPY',
    showPayment: true,
    showAudit: true,
    signatureLines: ['Auditor', 'Accounts'],
  },
  DRAFT_COPY: {
    code: 'DRAFT_COPY',
    title: 'DRAFT COPY',
    watermark: 'DRAFT COPY',
    showPayment: false,
    showAudit: false,
    signatureLines: [],
  },
  KITCHEN_COPY: {
    code: 'KITCHEN_COPY',
    title: 'KITCHEN ORDER TICKET',
    watermark: 'KOT',
    stationLabel: 'Kitchen Station',
  },
  BAR_COPY: {
    code: 'BAR_COPY',
    title: 'BAR ORDER TICKET',
    watermark: 'BOT',
    stationLabel: 'Bar Station',
  },
}

const COPY_ALIASES = {
  'guest copy': 'CUSTOMER_COPY',
  'customer copy': 'CUSTOMER_COPY',
  'merchant copy': 'MERCHANT_COPY',
  'resort copy': 'RESORT_COPY',
  'delivery copy': 'DELIVERY_COPY',
  'void copy': 'VOID_COPY',
  'reprint copy': 'REPRINT_COPY',
  'audit copy': 'AUDIT_COPY',
  'draft copy': 'DRAFT_COPY',
  kot: 'KITCHEN_COPY',
  'kitchen copy': 'KITCHEN_COPY',
  bot: 'BAR_COPY',
  'bar copy': 'BAR_COPY',
}

export function normalizeCopyCode(copyLabel) {
  if (!copyLabel) return 'CUSTOMER_COPY'
  const raw = String(copyLabel).trim()
  const upper = raw.toUpperCase().replaceAll(' ', '_')
  if (POS_COPY_PROFILES[upper]) return upper
  return COPY_ALIASES[raw.toLowerCase()] || 'CUSTOMER_COPY'
}

export function getCopyProfile(copyLabel) {
  return POS_COPY_PROFILES[normalizeCopyCode(copyLabel)] || POS_COPY_PROFILES.CUSTOMER_COPY
}

export function resolvePosBrand(company = {}, order = {}) {
  const tenantName = company?.name || company?.company_name || company?.tenant_name || order?.tenant_name || 'Tenant'
  return {
    tenantName,
    outletName: order?.outlet || order?.outlet_name || company?.outlet_name || tenantName,
    branchName: order?.property_name || company?.property_name || company?.branch_name || '',
    address: order?.outlet_address || company?.address || '',
    phone: order?.outlet_phone || company?.phone || '',
    email: company?.email || '',
    website: company?.website || '',
    logoUrl: company?.logo_url || company?.logo || '',
    bin: company?.bin || company?.bin_no || '',
    vatRegNo: company?.vat_reg_no || company?.vat_registration_no || '',
    footerMessage: company?.pos_footer_text || company?.receipt_footer || company?.invoice_footer || 'Thank you. Visit again.',
  }
}

export function resolvePosPrintSettings(company = {}, overrides = {}) {
  return {
    timezone: company?.timezone || DEFAULT_TIMEZONE,
    currency: company?.currency || DEFAULT_CURRENCY,
    printWidth: overrides.printWidth || company?.pos_print_width || '80mm',
    language: company?.print_language || 'en',
    showLogo: overrides.showLogo ?? company?.pos_show_logo ?? true,
    showQr: overrides.showQr ?? company?.pos_show_qr ?? true,
    showTaxInfo: overrides.showTaxInfo ?? company?.pos_show_tax ?? true,
    showPaymentDetails: overrides.showPaymentDetails ?? company?.pos_show_payment_details ?? true,
    showCashier: overrides.showCashier ?? company?.pos_show_cashier ?? true,
    showWaiter: overrides.showWaiter ?? company?.pos_show_waiter ?? true,
    showTerminal: overrides.showTerminal ?? company?.pos_show_terminal ?? true,
    showShift: overrides.showShift ?? company?.pos_show_shift ?? true,
    showAuditTrail: overrides.showAuditTrail ?? company?.pos_show_audit_trail ?? true,
    showDiscount: overrides.showDiscount ?? company?.pos_show_discount ?? true,
    showVat: overrides.showVat ?? company?.pos_show_vat ?? true,
    showServiceCharge: overrides.showServiceCharge ?? company?.pos_show_service_charge ?? true,
    showRoundOff: overrides.showRoundOff ?? company?.pos_show_round_off ?? true,
    loyaltyEnabled: overrides.loyaltyEnabled ?? company?.loyalty_enabled ?? company?.pos_loyalty_enabled ?? false,
    verifyBaseUrl: company?.verify_base_url || (typeof window !== 'undefined' ? window.location.origin : ''),
  }
}

export function formatPosDate(ts, timezone = DEFAULT_TIMEZONE) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  })
}

export function formatPosTime(ts, timezone = DEFAULT_TIMEZONE) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
}

export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  return `${currency} ${Number(value || 0).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatOrderType(value) {
  return String(value || 'DINE_IN')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

export function documentHash(parts = []) {
  const text = parts.filter(Boolean).join('|')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}

export function posVerifyUrl(settings, order, invoiceNo) {
  const base = settings.verifyBaseUrl || ''
  const id = encodeURIComponent(invoiceNo || order?.invoice_no || order?.order_no || '')
  return `${base}/verify/pos/${id}`
}

export function qrCodeUrl(value, size = 92) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value || '')}`
}

export function getReceiptCopies(order = {}, company = {}) {
  const configured = company?.pos_receipt_copies
  if (Array.isArray(configured) && configured.length) return configured.map(normalizeCopyCode)
  if (order?.status === 'VOID') return ['VOID_COPY', 'AUDIT_COPY']
  if (order?.reprint_count > 0) return ['REPRINT_COPY', 'RESORT_COPY']
  return ['CUSTOMER_COPY', 'MERCHANT_COPY', 'RESORT_COPY']
}

export function getItemModifiers(item = {}) {
  const modifiers = []
  if (Array.isArray(item.modifiers)) modifiers.push(...item.modifiers)
  if (item.variant) modifiers.push(`Variant: ${item.variant}`)
  if (item.note || item.notes) modifiers.push(`Note: ${item.note || item.notes}`)
  return modifiers.filter(Boolean)
}

export function splitKotBotItems(items = []) {
  const barHints = ['bar', 'beverage', 'drink', 'mocktail', 'cocktail', 'juice', 'coffee', 'tea']
  return items.reduce(
    (acc, item) => {
      const text = `${item.category || ''} ${item.department || ''} ${item.station || ''} ${item.item_name || ''}`.toLowerCase()
      if (barHints.some((hint) => text.includes(hint))) acc.bot.push(item)
      else acc.kot.push(item)
      return acc
    },
    { kot: [], bot: [] }
  )
}

export function buildEscPosText({ order = {}, items = [], company = {}, copyType = 'CUSTOMER_COPY' }) {
  const brand = resolvePosBrand(company, order)
  const settings = resolvePosPrintSettings(company)
  const profile = getCopyProfile(copyType)
  const issuedAt = order.settled_at || order.created_at || new Date().toISOString()
  const lines = [
    brand.outletName.toUpperCase(),
    brand.branchName,
    brand.address,
    profile.title,
    `INV: ${order.invoice_no || order.order_no || ''}`,
    `${formatPosDate(issuedAt, settings.timezone)} ${formatPosTime(issuedAt, settings.timezone)}`,
    '-'.repeat(32),
    ...items.map((item) => `${Number(item.qty || 0)} x ${item.item_name} ${Number(item.line_total || 0).toFixed(2)}`),
    '-'.repeat(32),
    `TOTAL ${formatMoney(order.total, settings.currency)}`,
    brand.footerMessage,
  ].filter(Boolean)
  return `${lines.join('\n')}\n\n\n`
}

export const ESC_POS_COMMANDS = {
  autoCut: '\x1D\x56\x00',
  openCashDrawer: '\x1B\x70\x00\x19\xFA',
}
