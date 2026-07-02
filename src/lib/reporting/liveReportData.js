import { supabase } from '../../supabase'
import { getTenantId } from '../tenant'

const n = (value) => Number(value || 0)
const dateOnly = (value) => value ? String(value).slice(0, 10) : ''
const shortId = (value, prefix = 'DOC') => value ? `${prefix}-${String(value).slice(0, 8).toUpperCase()}` : ''
const allValue = (value) => !value || String(value).startsWith('All ')
const optionList = (label, values) => [label, ...[...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b))]

function tenantQuery(table, select = '*') {
  let query = supabase.from(table).select(select)
  const tenantId = getTenantId()
  if (tenantId) query = query.eq('tenant_id', tenantId)
  return query
}

async function safeQuery(label, query) {
  const { data, error } = await query
  if (error) {
    console.warn(`Report data source unavailable: ${label}`, error.message)
    return []
  }
  return data || []
}

function inRange(date, filters) {
  if (!date) return true
  if (filters.dateFrom && date < filters.dateFrom) return false
  if (filters.dateTo && date > filters.dateTo) return false
  return true
}

function nights(start, end) {
  const from = new Date(start)
  const to = new Date(end)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1
  return Math.max(1, Math.round((to - from) / 86400000))
}

function buildLookups(data) {
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]))
  const roomsById = byId(data.rooms)
  const guestsById = byId(data.guests)
  const reservationsById = byId(data.reservations)
  const reservationRooms = data.reservationRooms.reduce((acc, row) => {
    if (!acc[row.reservation_id]) acc[row.reservation_id] = []
    acc[row.reservation_id].push(row)
    return acc
  }, {})
  return { roomsById, guestsById, reservationsById, reservationRooms }
}

function reservationContext(reservationId, lookups) {
  const reservation = lookups.reservationsById.get(reservationId) || {}
  const guest = lookups.guestsById.get(reservation.primary_guest_id) || {}
  const roomRows = lookups.reservationRooms[reservationId] || []
  const firstRoom = roomRows[0] ? lookups.roomsById.get(roomRows[0].room_id) : null
  return { reservation, guest, roomRows, room: firstRoom || {} }
}

function chargeDepartment(charge) {
  const type = String(charge.charge_type || '').toUpperCase()
  if (['POS', 'FOOD', 'F&B', 'RESTAURANT'].some((token) => type.includes(token))) return 'Restaurant'
  if (type.includes('ROOM')) return 'Rooms'
  return type ? type.replaceAll('_', ' ') : 'Other'
}

function chargeToRow(charge, lookups) {
  const { reservation, guest, room } = reservationContext(charge.reservation_id, lookups)
  const department = chargeDepartment(charge)
  return {
    sourceTable: 'folio_charges',
    transactionDate: dateOnly(charge.charge_date || charge.created_at),
    documentNo: shortId(charge.id, 'FC'),
    voucherNo: '',
    reservationNo: reservation.res_no || '',
    guestId: guest.customer_id || guest.id || '',
    guestName: reservation.reservation_name || guest.full_name || '',
    roomNo: room.room_no || '',
    roomType: room.room_type || '',
    department,
    costCenter: department === 'Restaurant' ? 'F&B' : department === 'Rooms' ? 'ROOMS' : department.toUpperCase(),
    accountCode: department === 'Restaurant' ? '4010' : department === 'Rooms' ? '4001' : '4090',
    accountName: `${department} Revenue`,
    description: charge.description || charge.charge_type || 'Folio charge',
    quantity: 1,
    rate: n(charge.base_amount),
    grossAmount: n(charge.base_amount),
    discount: n(charge.discount),
    vat: n(charge.vat),
    serviceCharge: n(charge.service_charge),
    netAmount: n(charge.total),
    debit: 0,
    credit: n(charge.total),
    balance: n(charge.total),
    paymentMethod: '',
    createdBy: charge.created_by || '',
    approvedBy: '',
    status: charge.status || 'Posted',
    remarks: charge.invoice_type || '',
  }
}

function posToRow(order) {
  return {
    sourceTable: 'pos_orders',
    transactionDate: dateOnly(order.settled_at || order.created_at),
    documentNo: order.order_no || shortId(order.id, 'POS'),
    voucherNo: '',
    reservationNo: '',
    guestId: '',
    guestName: order.guest_name || '',
    roomNo: order.room_no || order.table_no || '',
    roomType: '',
    outlet: order.outlet || '',
    department: 'Restaurant',
    costCenter: 'F&B',
    accountCode: '4010',
    accountName: 'Restaurant Revenue',
    description: `${order.outlet || 'Restaurant'} ${order.order_type || 'POS order'}`,
    quantity: 1,
    rate: n(order.base_amount),
    grossAmount: n(order.base_amount),
    discount: n(order.discount),
    vat: n(order.vat),
    serviceCharge: n(order.service_charge),
    netAmount: n(order.total),
    debit: 0,
    credit: n(order.total),
    balance: n(order.total),
    paymentMethod: order.payment_method || '',
    createdBy: order.created_by || '',
    approvedBy: '',
    status: order.status || 'Open',
    remarks: order.notes || order.outlet || '',
  }
}

function paymentToRow(payment, lookups) {
  const { reservation, guest, room } = reservationContext(payment.reservation_id, lookups)
  return {
    sourceTable: 'payments',
    transactionDate: dateOnly(payment.received_date || payment.created_at),
    documentNo: payment.payment_id || shortId(payment.id, 'PAY'),
    voucherNo: '',
    reservationNo: reservation.res_no || '',
    guestId: guest.customer_id || guest.id || '',
    guestName: payment.paid_by_party || reservation.reservation_name || guest.full_name || '',
    roomNo: room.room_no || '',
    roomType: room.room_type || '',
    department: 'Accounting',
    costCenter: 'CASHIER',
    accountCode: payment.method === 'Cash' ? '1010' : '1020',
    accountName: `${payment.method || 'Payment'} Collection`,
    description: payment.notes || payment.reference || 'Guest payment',
    quantity: 1,
    rate: n(payment.amount),
    grossAmount: n(payment.amount),
    discount: 0,
    vat: 0,
    serviceCharge: 0,
    netAmount: n(payment.amount),
    debit: n(payment.amount),
    credit: 0,
    balance: n(payment.amount),
    paymentMethod: payment.method || '',
    createdBy: payment.received_by || '',
    approvedBy: '',
    status: payment.payment_class || 'Received',
    remarks: payment.reference || '',
  }
}

function reservationToRow(reservation, lookups, reportCode) {
  const guest = lookups.guestsById.get(reservation.primary_guest_id) || {}
  const roomRows = lookups.reservationRooms[reservation.id] || []
  const firstRoom = roomRows[0] ? lookups.roomsById.get(roomRows[0].room_id) : null
  const roomRate = roomRows.reduce((sum, row) => sum + n(row.rate), 0) || n(reservation.room_rate)
  const stayNights = nights(reservation.check_in, reservation.check_out)
  const dateByReport = {
    'CHECKIN-RPT': reservation.check_in,
    'CHECKOUT-RPT': reservation.check_out,
    'NOSHOW-RPT': reservation.check_in,
    'CANCEL-RPT': reservation.updated_at || reservation.created_at,
  }
  return {
    sourceTable: 'reservations',
    transactionDate: dateOnly(dateByReport[reportCode] || reservation.created_at || reservation.check_in),
    documentNo: reservation.res_no || shortId(reservation.id, 'RES'),
    voucherNo: '',
    reservationNo: reservation.res_no || '',
    guestId: guest.customer_id || guest.id || '',
    guestName: reservation.reservation_name || guest.full_name || '',
    roomNo: firstRoom?.room_no || '',
    roomType: firstRoom?.room_type || '',
    department: 'Rooms',
    costCenter: 'ROOMS',
    accountCode: '4001',
    accountName: 'Room Revenue',
    description: `${reservation.source || 'Reservation'} stay`,
    quantity: stayNights,
    rate: roomRate,
    grossAmount: roomRate * stayNights,
    discount: 0,
    vat: 0,
    serviceCharge: 0,
    netAmount: roomRate * stayNights,
    debit: 0,
    credit: roomRate * stayNights,
    balance: roomRate * stayNights,
    paymentMethod: '',
    createdBy: reservation.created_by || '',
    approvedBy: reservation.checkin_by || '',
    status: reservation.status || 'Open',
    remarks: reservation.notes || reservation.special_instructions || '',
    reservationSource: reservation.source || '',
    guestType: reservation.guest_type || '',
    checkIn: dateOnly(reservation.check_in),
    checkOut: dateOnly(reservation.check_out),
    pax: n(reservation.pax_adults) + n(reservation.pax_children) + n(reservation.extra_pax),
  }
}

function roomToRow(room) {
  return {
    sourceTable: 'rooms',
    transactionDate: dateOnly(room.created_at),
    documentNo: room.room_no || shortId(room.id, 'ROOM'),
    voucherNo: '',
    reservationNo: '',
    guestId: '',
    guestName: '',
    roomNo: room.room_no || '',
    roomType: room.room_type || '',
    department: 'Housekeeping',
    costCenter: 'HK',
    accountCode: '',
    accountName: 'Room Inventory',
    description: room.room_name || room.notes || 'Room status',
    quantity: 1,
    rate: n(room.base_rate),
    grossAmount: n(room.base_rate),
    discount: 0,
    vat: 0,
    serviceCharge: 0,
    netAmount: n(room.base_rate),
    debit: 0,
    credit: 0,
    balance: 0,
    paymentMethod: '',
    createdBy: '',
    approvedBy: '',
    status: room.hk_status || room.status || (room.is_active ? 'Available' : 'Inactive'),
    remarks: room.is_active ? 'Active room' : 'Inactive room',
  }
}

function enrichRowMetadata(row) {
  return {
    ...row,
    outlet: row.outlet || '',
    businessUnit: row.businessUnit || 'Hospitality',
    segment: row.segment || row.guestType || row.department || 'General',
    tags: row.tags || row.sourceTable || 'General',
    user: row.user || row.createdBy || '',
  }
}

function journalToRows(entry, lines, accountMap) {
  const entryLines = lines.filter((line) => line.entry_id === entry.id)
  if (entryLines.length === 0) {
    return [{
      sourceTable: 'journal_entries',
      transactionDate: dateOnly(entry.jv_date || entry.created_at),
      documentNo: entry.jv_no || shortId(entry.id, 'JV'),
      voucherNo: entry.jv_no || '',
      reservationNo: '',
      guestId: '',
      guestName: '',
      roomNo: '',
      roomType: '',
      department: 'Accounting',
      costCenter: 'ADMIN',
      accountCode: '',
      accountName: entry.source || 'Journal Entry',
      description: entry.narration || 'Journal entry',
      quantity: 1,
      rate: 0,
      grossAmount: 0,
      discount: 0,
      vat: 0,
      serviceCharge: 0,
      netAmount: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      paymentMethod: '',
      createdBy: entry.posted_by || '',
      approvedBy: '',
      status: entry.is_locked ? 'Posted' : 'Open',
      remarks: entry.source || '',
    }]
  }

  return entryLines.map((line) => {
    const account = accountMap.get(line.account_id) || {}
    return {
      sourceTable: 'journal_lines',
      transactionDate: dateOnly(entry.jv_date || line.created_at),
      documentNo: entry.jv_no || shortId(line.id, 'JV'),
      voucherNo: entry.jv_no || '',
      reservationNo: '',
      guestId: '',
      guestName: '',
      roomNo: '',
      roomType: '',
      department: 'Accounting',
      costCenter: 'ADMIN',
      accountCode: account.code || '',
      accountName: account.name || 'Account',
      description: line.line_note || entry.narration || '',
      quantity: 1,
      rate: 0,
      grossAmount: 0,
      discount: 0,
      vat: 0,
      serviceCharge: 0,
      netAmount: n(line.credit) - n(line.debit),
      debit: n(line.debit),
      credit: n(line.credit),
      balance: n(line.debit) - n(line.credit),
      paymentMethod: '',
      createdBy: entry.posted_by || '',
      approvedBy: '',
      status: entry.is_locked ? 'Posted' : 'Open',
      remarks: account.type || entry.source || '',
    }
  })
}

function accountRowsFromActual(rows) {
  const grouped = rows.reduce((acc, row) => {
    const key = `${row.accountCode || '0000'}|${row.accountName || 'Unmapped'}`
    if (!acc[key]) acc[key] = { ...row, debit: 0, credit: 0, balance: 0, grossAmount: 0, netAmount: 0, discount: 0, vat: 0, serviceCharge: 0 }
    acc[key].debit += n(row.debit)
    acc[key].credit += n(row.credit)
    acc[key].balance += n(row.balance || row.credit - row.debit)
    acc[key].grossAmount += n(row.grossAmount)
    acc[key].netAmount += n(row.netAmount)
    acc[key].discount += n(row.discount)
    acc[key].vat += n(row.vat)
    acc[key].serviceCharge += n(row.serviceCharge)
    return acc
  }, {})
  return Object.values(grouped).map((row) => ({
    ...row,
    transactionDate: '',
    documentNo: '',
    voucherNo: '',
    reservationNo: '',
    guestName: '',
    roomNo: '',
    description: row.accountName,
    status: 'Actual',
  }))
}

function applyReportScope(report, data, lookups) {
  const code = report.code
  const chargeRows = data.folioCharges.map((row) => chargeToRow(row, lookups))
  const posRows = data.posOrders.map(posToRow)
  const paymentRows = data.payments.map((row) => paymentToRow(row, lookups))
  const reservationRows = data.reservations.map((row) => reservationToRow(row, lookups, code))
  const roomRows = data.rooms.map(roomToRow)
  const accountMap = new Map(data.accounts.map((account) => [account.id, account]))
  const journalRows = data.journalEntries.flatMap((entry) => journalToRows(entry, data.journalLines, accountMap))

  if (code === 'REST-SALES' || code === 'POS-COLL') return posRows.map(enrichRowMetadata)
  if (code === 'PAY-SUM') return paymentRows.map(enrichRowMetadata)
  if (code === 'ROOM-AVAIL' || code === 'HK-STATUS') return roomRows.map(enrichRowMetadata)
  if (['OCC-RPT', 'ADR-RPT', 'REVPAR-RPT', 'ROOM-REV', 'GUEST-LEDGER', 'RES-RPT', 'CHECKIN-RPT', 'CHECKOUT-RPT', 'NOSHOW-RPT', 'CANCEL-RPT'].includes(code)) {
    const statusNeedle = {
      'CHECKIN-RPT': 'CHECKED_IN',
      'CHECKOUT-RPT': 'CHECKED_OUT',
      'NOSHOW-RPT': 'NO_SHOW',
      'CANCEL-RPT': 'CANCEL',
    }[code]
    if (!statusNeedle) return reservationRows.concat(chargeRows.filter((row) => row.department === 'Rooms')).map(enrichRowMetadata)
    return reservationRows.filter((row) => String(row.status).toUpperCase().includes(statusNeedle)).map(enrichRowMetadata)
  }
  if (['IFRS-PNL', 'IFRS-REV-REC', 'IFRS-DEF-REV', 'DAILY-SALES', 'NIGHT-AUDIT'].includes(code)) return chargeRows.concat(posRows).map(enrichRowMetadata)
  if (['IFRS-SFP', 'IFRS-CFS', 'IFRS-SCE', 'AR-AGING', 'AP-AGING', 'INV-MOV', 'FA-REG', 'FA-DEP', 'LEASE-LIAB'].includes(code)) {
    return accountRowsFromActual(journalRows.concat(chargeRows, paymentRows)).map(enrichRowMetadata)
  }
  return chargeRows.concat(posRows, paymentRows, reservationRows).map(enrichRowMetadata)
}

function applyFilters(rows, filters, report) {
  return rows.filter((row) => {
    if (!inRange(row.transactionDate, filters)) return false
    if (!allValue(filters.outlet) && row.outlet !== filters.outlet) return false
    if (!allValue(filters.department) && row.department !== filters.department) return false
    if (!allValue(filters.costCenter) && row.costCenter !== filters.costCenter) return false
    if (!allValue(filters.roomType) && row.roomType !== filters.roomType) return false
    if (!allValue(filters.paymentMethod) && row.paymentMethod !== filters.paymentMethod) return false
    if (!allValue(filters.status) && row.status !== filters.status) return false
    if (!allValue(filters.reservationSource) && row.reservationSource !== filters.reservationSource) return false
    if (!allValue(filters.guestType) && row.guestType !== filters.guestType) return false
    if (!allValue(filters.user) && row.user !== filters.user) return false
    if (!allValue(filters.businessUnit) && row.businessUnit !== filters.businessUnit) return false
    if (!allValue(filters.segment) && row.segment !== filters.segment) return false
    if (!allValue(filters.tags) && row.tags !== filters.tags) return false
    if (report.category === 'POS' && row.department !== 'Restaurant' && row.costCenter !== 'F&B') return false
    return true
  }).map((row, index) => ({ ...row, slNo: index + 1 }))
}

export function calculateReportKpis(rows, data) {
  const totalRevenue = rows.reduce((sum, row) => sum + n(row.netAmount), 0)
  const roomRevenue = rows.filter((row) => row.department === 'Rooms').reduce((sum, row) => sum + n(row.netAmount), 0)
  const restaurantRevenue = rows.filter((row) => row.department === 'Restaurant').reduce((sum, row) => sum + n(row.netAmount), 0)
  const cashCollection = rows.filter((row) => row.paymentMethod === 'Cash').reduce((sum, row) => sum + n(row.netAmount || row.debit), 0)
  const cardCollection = rows.filter((row) => String(row.paymentMethod).toLowerCase().includes('card')).reduce((sum, row) => sum + n(row.netAmount || row.debit), 0)
  const mobileCollection = rows.filter((row) => String(row.paymentMethod).toLowerCase().includes('mobile')).reduce((sum, row) => sum + n(row.netAmount || row.debit), 0)
  const occupiedRooms = data.rooms.filter((room) => ['OCCUPIED', 'IN_HOUSE'].includes(String(room.status || '').toUpperCase())).length
  const totalRooms = data.rooms.filter((room) => room.is_active !== false).length
  const roomNights = data.reservationRooms.reduce((sum, row) => sum + nights(row.from_date, row.to_date), 0)
  const adr = roomNights ? roomRevenue / roomNights : 0
  const occupancy = totalRooms ? (occupiedRooms / totalRooms) * 100 : 0
  return {
    totalRevenue,
    roomRevenue,
    restaurantRevenue,
    otherRevenue: Math.max(0, totalRevenue - roomRevenue - restaurantRevenue),
    occupancy,
    adr,
    revpar: totalRooms ? roomRevenue / totalRooms : 0,
    totalGuests: data.guests.length,
    checkIns: data.reservations.filter((row) => row.checked_in_at || String(row.status || '').toUpperCase().includes('CHECKED_IN')).length,
    checkOuts: data.reservations.filter((row) => row.checked_out_at || String(row.status || '').toUpperCase().includes('CHECKED_OUT')).length,
    cancellations: data.reservations.filter((row) => String(row.status || '').toUpperCase().includes('CANCEL')).length,
    noShows: data.reservations.filter((row) => String(row.status || '').toUpperCase().includes('NO_SHOW')).length,
    cashCollection,
    cardCollection,
    mobileCollection,
    outstandingReceivable: Math.max(0, rows.reduce((sum, row) => sum + n(row.credit) - n(row.debit), 0)),
    vatPayable: rows.reduce((sum, row) => sum + n(row.vat), 0),
    netProfit: totalRevenue,
    gop: totalRevenue,
    ebitdaMargin: totalRevenue ? 100 : 0,
  }
}

function buildFilterOptions(rows, data) {
  return {
    property: optionList('All Properties', data.properties.map((row) => row.name)),
    outlet: optionList('All Outlets', data.posOrders.map((row) => row.outlet)),
    department: optionList('All Departments', rows.map((row) => row.department)),
    costCenter: optionList('All Cost Centers', rows.map((row) => row.costCenter)),
    roomType: optionList('All Room Types', data.rooms.map((row) => row.room_type).concat(rows.map((row) => row.roomType))),
    guestType: optionList('All Guest Types', data.reservations.map((row) => row.guest_type)),
    reservationSource: optionList('All Sources', data.reservations.map((row) => row.source)),
    paymentMethod: optionList('All Methods', data.payments.map((row) => row.method).concat(data.posOrders.map((row) => row.payment_method))),
    status: optionList('All Status', rows.map((row) => row.status)),
    user: optionList('All Users', rows.map((row) => row.createdBy).concat(data.reservations.map((row) => row.created_by))),
    businessUnit: optionList('All Business Units', rows.map((row) => row.businessUnit)),
    segment: optionList('All Segments', rows.map((row) => row.segment)),
    tags: optionList('All Tags', rows.map((row) => row.tags)),
    currency: ['BDT', 'USD'],
  }
}

export async function loadLiveReportData(report, filters) {
  if (!supabase) return { rows: [], kpis: {}, sourceCounts: {}, errors: ['Supabase is not configured.'] }

  const data = {
    properties: await safeQuery('properties', tenantQuery('properties').limit(100)),
    reservations: await safeQuery('reservations', tenantQuery('reservations').gte('check_out', filters.dateFrom).lte('check_in', filters.dateTo).order('created_at', { ascending: false }).limit(1000)),
    reservationRooms: await safeQuery('reservation_rooms', tenantQuery('reservation_rooms').limit(2000)),
    guests: await safeQuery('guests', tenantQuery('guests').limit(2000)),
    rooms: await safeQuery('rooms', tenantQuery('rooms').order('room_no', { ascending: true }).limit(1000)),
    folioCharges: await safeQuery('folio_charges', tenantQuery('folio_charges').gte('charge_date', filters.dateFrom).lte('charge_date', filters.dateTo).order('charge_date', { ascending: false }).limit(2000)),
    payments: await safeQuery('payments', tenantQuery('payments').gte('received_date', filters.dateFrom).lte('received_date', filters.dateTo).order('received_date', { ascending: false }).limit(2000)),
    posOrders: await safeQuery('pos_orders', tenantQuery('pos_orders').gte('created_at', `${filters.dateFrom}T00:00:00`).lte('created_at', `${filters.dateTo}T23:59:59`).order('created_at', { ascending: false }).limit(2000)),
    journalEntries: await safeQuery('journal_entries', tenantQuery('journal_entries').gte('jv_date', filters.dateFrom).lte('jv_date', filters.dateTo).order('jv_date', { ascending: false }).limit(1000)),
    journalLines: await safeQuery('journal_lines', tenantQuery('journal_lines').limit(3000)),
    accounts: await safeQuery('chart_of_accounts', tenantQuery('chart_of_accounts').limit(1000)),
  }

  const sourceCounts = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length]))
  const lookups = buildLookups(data)
  const scopedRows = applyReportScope(report, data, lookups)
  const rows = applyFilters(scopedRows, filters, report)
  return {
    rows,
    kpis: calculateReportKpis(rows, data),
    filterOptions: buildFilterOptions(rows, data),
    sourceCounts,
    errors: [],
  }
}
