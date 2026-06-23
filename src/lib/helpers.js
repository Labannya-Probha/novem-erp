import * as XLSX from 'xlsx'

let CUR = '৳'
export const setCurrency = (c) => { CUR = (c || '৳').toString().trim() }
export const getCurrency = () => CUR

export const fmtBDT = (n) =>
  CUR + ' ' + Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtDate = (d) => {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const todayISO = () => {
  const now = new Date()
  const dhaka = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }))
  return `${dhaka.getFullYear()}-${String(dhaka.getMonth() + 1).padStart(2, '0')}-${String(dhaka.getDate()).padStart(2, '0')}`
}

export const nightsBetween = (ci, co) => {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000))
}

export const eachNight = (ci, co) => {
  const out = []
  let d = new Date(ci + 'T00:00:00')
  const end = new Date(co + 'T00:00:00')
  while (d < end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

// Latest tax config row for a charge type (req. 8 — every component separate)
export const rateFor = (taxConfig, chargeType, onDate) => {
  const rows = (taxConfig || [])
    .filter((t) => t.charge_type === chargeType && t.effective_from <= (onDate || todayISO()))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  return rows[0] || { vat_pct: 0, service_charge_pct: 0 }
}

// Hotel practice: discount on base → SC on net → VAT on (net + SC)
export const computeCharge = (base, discount, rate) => {
  const b = Number(base) || 0
  let discountAmt
  if (discount && typeof discount === 'object') {
    if (discount.type === 'fixed') discountAmt = Math.min(Number(discount.value) || 0, b)
    else discountAmt = b * (Number(discount.value) || 0) / 100
  } else {
    discountAmt = b * (Number(discount) || 0) / 100
  }
  const disc = +discountAmt.toFixed(2)
  const net = +(b - disc).toFixed(2)
  const service_charge = +(net * (Number(rate.service_charge_pct) || 0) / 100).toFixed(2)
  const vat = +((net + service_charge) * (Number(rate.vat_pct) || 0) / 100).toFixed(2)
  const total = +(net + service_charge + vat).toFixed(2)
  return { base_amount: b, discount: disc, service_charge, vat, total }
}

export const sumCharges = (charges) =>
  (charges || []).reduce(
    (a, c) => ({
      base: a.base + Number(c.base_amount),
      discount: a.discount + Number(c.discount),
      taxable_value: a.taxable_value + Number(c.base_amount) - Number(c.discount),
      service_charge: a.service_charge + Number(c.service_charge),
      vat: a.vat + Number(c.vat),
      grand_total: a.grand_total + Number(c.total),
    }),
    { base: 0, discount: 0, taxable_value: 0, service_charge: 0, vat: 0, grand_total: 0 }
  )

// Amount in words — Taka
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''))
const three = (n) => (n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n))

export const takaInWords = (amount) => {
  let n = Math.floor(Number(amount) || 0)
  const paisa = Math.round(((Number(amount) || 0) - n) * 100)
  if (n === 0) return 'Zero Taka Only'
  let out = ''
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  if (crore) out += three(crore) + ' Crore '
  if (lakh) out += two(lakh) + ' Lakh '
  if (thousand) out += two(thousand) + ' Thousand '
  if (n) out += three(n)
  out = out.trim() + ' Taka'
  if (paisa) out += ' and ' + two(paisa) + ' Paisa'
  return out + ' Only'
}

export const exportXLSX = (filename, sheets) => {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0]?.map((_, i) => ({ wch: Math.max(12, ...rows.map((r) => String(r[i] ?? '').length + 2)) }))
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  })
  XLSX.writeFile(wb, filename)
}

export const STATUS_COLORS = {
  QUERY: 'bg-stone-200 text-stone-700',
  QUOTED: 'bg-amber/20 text-amber',
  CONFIRMED: 'bg-forest/15 text-forest',
  CHECKED_IN: 'bg-forest text-white',
  CHECKED_OUT: 'bg-orange-100 text-orange-600',
  SETTLED: 'bg-leaf text-pine',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-red-100 text-red-600',
}

export const roundGrand = (amount, mode = 'NEAREST_1') => {
  const a = Number(amount) || 0
  switch (mode) {
    case 'NONE': return a
    case 'NEAREST_5': return Math.round(a / 5) * 5
    case 'NEAREST_10': return Math.round(a / 10) * 10
    case 'NEAREST_1':
    default: return Math.round(a)
  }
}

export const applyRounding = (totals, mode = 'NEAREST_1') => {
  const raw = +(Number(totals.grand_total) || 0).toFixed(2)
  const rounded = roundGrand(raw, mode)
  return { ...totals, grand_total_raw: raw, rounding: +(rounded - raw).toFixed(2), grand_total: rounded }
}

// Helper to auto-generate a full Quotation snapshot
export const createQuoteSnapshot = (res, rooms, taxConfig) => {
  const nights = nightsBetween(res.check_in, res.check_out)
  const qRate = rateFor(taxConfig, 'ROOM', res.check_in)
  
  const roomTotal = rooms.reduce((sum, rm) => sum + Number(rm.rate), 0)
  
  const disc = res.discount_type === 'fixed' 
    ? { type: 'fixed', value: Number(res.discount_val) || 0 } 
    : Number(res.discount_pct) || 0

  const perNight = computeCharge(roomTotal, disc, qRate)
  
  return {
    reservation_id: res.id,
    total_amount: +(perNight.total * (nights || 1)).toFixed(2),
    valid_until: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    room_rate: rooms.length > 0 ? rooms[0].rate : 0,
    room_count: rooms.length,
    discount_pct: res.discount_type === 'percentage' ? Number(res.discount_pct) : 0,
    status: 'DRAFT'
  }
}

const DEPARTMENT_WORKFLOWS = {
  RESTAURANT: ['REQUESTED', 'CONFIRMED', 'ACCEPTED', 'KOT_GENERATED', 'PREPARING', 'READY', 'SERVED'],
  HOUSEKEEPING: ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'INSPECTED', 'COMPLETED'],
  FRONT_OFFICE: ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'],
  MAINTENANCE: ['REQUESTED', 'TRIAGED', 'IN_PROGRESS', 'FIXED', 'COMPLETED'],
}

const KEYWORDS = {
  RESTAURANT: ['food', 'order', 'restaurant', 'menu', 'meal', 'breakfast', 'lunch', 'dinner', 'kot'],
  HOUSEKEEPING: ['housekeeping', 'clean', 'cleaning', 'towel', 'linen', 'bed', 'bathroom', 'laundry'],
  MAINTENANCE: ['maintenance', 'repair', 'ac', 'air condition', 'plumbing', 'electric', 'light', 'water leakage', 'generator'],
  FRONT_OFFICE: ['front office', 'checkout', 'check out', 'check-in', 'reservation', 'invoice', 'billing', 'key', 'late checkout'],
}

const PRIORITY_HINTS = {
  URGENT: ['urgent', 'immediately', 'emergency', 'asap'],
  HIGH: ['high', 'today', 'now', 'quick'],
  LOW: ['low', 'later', 'whenever'],
}

export const detectDepartment = (rawText = '') => {
  const text = rawText.toLowerCase()
  const hitScores = Object.keys(KEYWORDS).map((dept) => {
    const score = KEYWORDS[dept].reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0)
    return { dept, score }
  })
  hitScores.sort((a, b) => b.score - a.score)
  return hitScores[0]?.score > 0 ? hitScores[0].dept : 'FRONT_OFFICE'
}

export const detectPriority = (rawText = '') => {
  const text = rawText.toLowerCase()
  if (PRIORITY_HINTS.URGENT.some((k) => text.includes(k))) return 'URGENT'
  if (PRIORITY_HINTS.HIGH.some((k) => text.includes(k))) return 'HIGH'
  if (PRIORITY_HINTS.LOW.some((k) => text.includes(k))) return 'LOW'
  return 'MEDIUM'
}

export const routeAiIntent = (rawText = '') => {
  const clean = rawText.trim()
  const department = detectDepartment(clean)
  const workflow = DEPARTMENT_WORKFLOWS[department] || DEPARTMENT_WORKFLOWS.FRONT_OFFICE
  const priority = detectPriority(clean)
  return {
    department,
    priority,
    stage: workflow[0],
    workflow,
    title: clean.length > 72 ? `${clean.slice(0, 72).trim()}...` : clean || 'Guest assistance request',
  }
}

export const buildWorkflowDescription = (baseDescription = '', meta = {}) => {
  const lines = []
  if (baseDescription && baseDescription.trim()) lines.push(baseDescription.trim())
  if (meta.department) lines.push(`Department: ${meta.department}`)
  if (meta.stage) lines.push(`Workflow Stage: ${meta.stage}`)
  if (meta.workflow && meta.workflow.length) lines.push(`Workflow Path: ${meta.workflow.join(' > ')}`)
  if (meta.intent && meta.intent.trim()) lines.push(`Intent: ${meta.intent.trim()}`)
  if (meta.reference && meta.reference.trim()) lines.push(`Reference: ${meta.reference.trim()}`)
  return lines.join('\n')
}

export const parseWorkflowMeta = (task) => {
  const description = task?.description || ''
  const lines = description.split('\n').map((line) => line.trim())
  const byPrefix = (prefix) => {
    const row = lines.find((line) => line.startsWith(prefix))
    return row ? row.slice(prefix.length).trim() : ''
  }
  const sourceFallbackDept = task?.source === 'CHECKOUT_CLEARANCE'
    ? 'HOUSEKEEPING'
    : task?.source === 'GUEST_POS_ORDER'
      ? 'RESTAURANT'
      : 'FRONT_OFFICE'
  const department = byPrefix('Department:') || sourceFallbackDept
  const stage = byPrefix('Workflow Stage:') || 'REQUESTED'
  const pathRaw = byPrefix('Workflow Path:')
  const workflow = pathRaw
    ? pathRaw.split('>').map((s) => s.trim()).filter(Boolean)
    : (DEPARTMENT_WORKFLOWS[department] || DEPARTMENT_WORKFLOWS.FRONT_OFFICE)
  return { department, stage, workflow }
}

export const updateDescriptionStage = (description = '', nextStage) => {
  const lines = description.split('\n')
  const stageLineIndex = lines.findIndex((line) => line.trim().startsWith('Workflow Stage:'))
  if (stageLineIndex >= 0) {
    lines[stageLineIndex] = `Workflow Stage: ${nextStage}`
    return lines.join('\n')
  }
  return [description.trim(), `Workflow Stage: ${nextStage}`].filter(Boolean).join('\n')
}
