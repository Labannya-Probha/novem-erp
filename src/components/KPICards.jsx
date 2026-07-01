/**
 * KPICards.jsx — Shared KPI banner component for all Aura Stay ERP modules.
 *
 * Usage:
 *   import KPICards from '../components/KPICards.jsx'
 *   <KPICards module="reservations" />
 *
 * Supported modules:
 *   reservations | dashboard | pos | inventory | accounting | hr | housekeeping | nightaudit | tasks | facilities | vat | reports
 */

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, todayISO } from '../lib/helpers'
import {
  BedDouble, TrendingUp, TrendingDown, Users, Banknote, Clock,
  AlertTriangle, CheckCircle2, ShoppingCart, Boxes, Calculator, LogOut,
  CalendarCheck, FileText, Star, ArrowUpRight, Loader2, Truck,
} from 'lucide-react'

/* ── colour helpers ─────────────────────────────────────────────────────── */
const COLORS = {
  green:  { text: 'text-forest',     icon: 'text-forest',     tone: 'is-good' },
  amber:  { text: 'text-amber-900',  icon: 'text-amber-700',  tone: 'is-warn' },
  red:    { text: 'text-red-800',    icon: 'text-red-600',    tone: 'is-danger' },
  blue:   { text: 'text-sky-800',    icon: 'text-sky-600',    tone: 'is-info' },
  pine:   { text: 'text-pine',       icon: 'text-pine',       tone: 'is-brand' },
  purple: { text: 'text-violet-800', icon: 'text-violet-600', tone: 'is-brand' },
  stone:  { text: 'text-stone-700',  icon: 'text-stone-500',  tone: 'is-muted' },
}

/* ── single card ────────────────────────────────────────────────────────── */
function KPICard({ label, value, sub, icon: Icon, color = 'pine', loading }) {
  const c = COLORS[color] || COLORS.pine
  return (
    <div className={`erp-kpi-tile ${c.tone}`}>
      <div className={`erp-kpi-icon ${c.icon}`}>
        {loading ? <Loader2 size={16} className="animate-spin opacity-40" /> : <Icon size={17} />}
      </div>
      <div className="erp-kpi-copy">
        <div className="erp-kpi-label">{label}</div>
        <div className={`erp-kpi-value ${c.text}`}>
          {loading ? <span className="opacity-30">—</span> : value}
        </div>
        {sub && <div className="erp-kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

/* ── data fetchers per module ───────────────────────────────────────────── */
async function fetchKPIs(module, today) {
  switch (module) {

    case 'reservations': {
      const [{ data: rooms }, { data: res }] = await Promise.all([
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status, check_in, created_at, room_rate, source'),
      ])
      const all = res || []
      const totalRooms = (rooms || []).length
      const inhouse = all.filter(r => r.status === 'CHECKED_IN').length
      const occupancyRate = totalRooms ? (inhouse / totalRooms) * 100 : 0

      const occupiedRateRows = all.filter(r => r.status === 'CHECKED_IN')
      const adr = occupiedRateRows.length
        ? occupiedRateRows.reduce((s, r) => s + Number(r.room_rate || 0), 0) / occupiedRateRows.length
        : 0
      const revPar = adr * (occupancyRate / 100)

      const inquiryCount = all.filter(r => ['QUERY', 'QUOTED'].includes(r.status)).length
      const convertedCount = all.filter(r => ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED'].includes(r.status)).length
      const conversionRate = (inquiryCount + convertedCount) > 0 ? (convertedCount / (inquiryCount + convertedCount)) * 100 : 0

      const channelBookings = all.filter(r => !['QUERY', 'QUOTED'].includes(r.status))
      const isDirectSource = (source) => {
        const s = (source || '').toUpperCase()
        if (!s) return true
        const otaHints = ['OTA', 'BOOKING', 'EXPEDIA', 'AGODA', 'AIRBNB', 'TRIP', 'TRAVELOKA', 'GOIBIBO', 'MAKEMYTRIP']
        return !otaHints.some((h) => s.includes(h))
      }
      const directCount = channelBookings.filter(r => isDirectSource(r.source)).length
      const directRatio = channelBookings.length > 0 ? (directCount / channelBookings.length) * 100 : 0

      const cancellationBase = all.filter(r => ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED'].includes(r.status)).length
      const cancelledCount = all.filter(r => r.status === 'CANCELLED').length
      const cancellationRate = cancellationBase > 0 ? (cancelledCount / cancellationBase) * 100 : 0

      const leadRows = all.filter(r => ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED', 'NO_SHOW'].includes(r.status) && r.check_in && r.created_at)
      const avgLeadDays = leadRows.length > 0
        ? leadRows.reduce((sum, r) => {
          const created = new Date(r.created_at)
          const checkIn = new Date(r.check_in)
          const days = Math.floor((checkIn - created) / 86400000)
          return sum + Math.max(0, Number.isFinite(days) ? days : 0)
        }, 0) / leadRows.length
        : 0

      const pct = (n) => `${(Math.round(n * 10) / 10).toFixed(1)}%`
      return [
        { label: 'Occupancy Rate', value: pct(occupancyRate), sub: `${inhouse} of ${totalRooms} rooms occupied`, icon: BedDouble, color: occupancyRate >= 70 ? 'green' : occupancyRate >= 40 ? 'amber' : 'red' },
        { label: 'ADR', value: fmtBDT(adr), sub: 'Average daily room rate', icon: Banknote, color: adr > 0 ? 'green' : 'stone' },
        { label: 'RevPAR', value: fmtBDT(revPar), sub: 'Revenue per available room', icon: TrendingUp, color: revPar > 0 ? 'pine' : 'stone' },
        { label: 'Booking Conversion Rate', value: pct(conversionRate), sub: `${convertedCount} converted from ${inquiryCount + convertedCount} leads`, icon: ArrowUpRight, color: conversionRate >= 60 ? 'green' : conversionRate >= 35 ? 'amber' : 'red' },
        { label: 'Direct Booking Ratio', value: pct(directRatio), sub: `${directCount} direct of ${channelBookings.length} bookings`, icon: CalendarCheck, color: directRatio >= 60 ? 'green' : directRatio >= 40 ? 'amber' : 'red' },
        { label: 'Cancellation Rate', value: pct(cancellationRate), sub: `${cancelledCount} cancelled bookings`, icon: cancellationRate > 20 ? AlertTriangle : CheckCircle2, color: cancellationRate > 20 ? 'red' : cancellationRate > 10 ? 'amber' : 'green' },
        { label: 'Lead Time', value: `${Math.round(avgLeadDays)} days`, sub: leadRows.length > 0 ? `Avg booking window (${leadRows.length} bookings)` : 'No booking history', icon: Clock, color: avgLeadDays >= 10 ? 'blue' : avgLeadDays >= 3 ? 'pine' : 'stone' },
      ]
    }

    case 'dashboard': {
      const [{ data: rooms }, { data: fc }, { data: pay }, { data: res }] = await Promise.all([
        supabase.from('rooms').select('id, status, hk_status').eq('is_active', true),
        supabase.from('folio_charges').select('charge_date, total, status').gte('charge_date', today.slice(0, 7) + '-01'),
        supabase.from('payments').select('received_date, amount').gte('received_date', today.slice(0, 7) + '-01'),
        supabase.from('reservations').select('status, check_in, check_out').in('status', ['CHECKED_IN', 'CONFIRMED', 'QUOTED', 'NO_SHOW']),
      ])
      const totalRooms = (rooms || []).length
      const inhouse = (res || []).filter(r => r.status === 'CHECKED_IN').length
      const arrivalsToday = (res || []).filter(r => ['CONFIRMED','QUOTED'].includes(r.status) && r.check_in === today).length
      const depToday = (res || []).filter(r => r.status === 'CHECKED_IN' && r.check_out === today).length
      const occPct = totalRooms ? Math.round((inhouse / totalRooms) * 100) : 0
      const mtdRev = (fc || []).reduce((s, r) => s + +r.total, 0)
      const mtdCol = (pay || []).reduce((s, r) => s + +r.amount, 0)
      const todayRev = (fc || []).filter(r => r.charge_date === today).reduce((s, r) => s + +r.total, 0)
      const dueAmt = (fc || []).filter(r => r.status === 'DUE').reduce((s, r) => s + +r.total, 0)
      return [
        { label: 'In-house', value: inhouse, sub: `of ${totalRooms} rooms`, icon: BedDouble, color: inhouse > 0 ? 'green' : 'stone' },
        { label: 'Occupancy', value: `${occPct}%`, sub: `${inhouse} occupied`, icon: TrendingUp, color: occPct >= 70 ? 'green' : occPct >= 40 ? 'amber' : 'red' },
        { label: "Today's arrivals", value: arrivalsToday, sub: 'Check-ins today', icon: CalendarCheck, color: arrivalsToday > 0 ? 'blue' : 'stone' },
        { label: "Today's departures", value: depToday, sub: 'Due check-out', icon: LogOut, color: depToday > 0 ? 'amber' : 'stone' },
        { label: "Today's revenue", value: fmtBDT(todayRev), sub: `MTD: ${fmtBDT(mtdRev)}`, icon: Banknote, color: 'green' },
        { label: 'MTD collections', value: fmtBDT(mtdCol), sub: `Due: ${fmtBDT(dueAmt)}`, icon: TrendingUp, color: mtdCol > 0 ? 'pine' : 'stone' },
        { label: 'Outstanding due', value: fmtBDT(dueAmt), sub: dueAmt > 0 ? 'Unsettled charges' : 'All clear', icon: dueAmt > 0 ? AlertTriangle : CheckCircle2, color: dueAmt > 50000 ? 'red' : dueAmt > 0 ? 'amber' : 'green' },
      ]
    }

    case 'housekeeping': {
      const { data: rooms } = await supabase.from('rooms').select('status, hk_status').eq('is_active', true)
      const all = rooms || []
      const dirty = all.filter(r => ['DIRTY','CLEANING'].includes(r.hk_status)).length
      const clean = all.filter(r => r.hk_status === 'CLEAN').length
      const occupied = all.filter(r => r.status === 'OCCUPIED').length
      const vacant = all.filter(r => r.status === 'VACANT').length
      const outOfOrder = all.filter(r => r.status === 'OUT_OF_ORDER').length
      const cleanVacant = all.filter(r => r.hk_status === 'CLEAN' && r.status === 'VACANT').length
      return [
        { label: 'Dirty / Cleaning', value: dirty, sub: 'Needs attention', icon: AlertTriangle, color: dirty > 0 ? 'red' : 'green' },
        { label: 'Clean rooms', value: clean, sub: `${cleanVacant} ready to sell`, icon: CheckCircle2, color: 'green' },
        { label: 'Occupied', value: occupied, sub: `${vacant} vacant`, icon: BedDouble, color: 'pine' },
        { label: 'Out of order', value: outOfOrder, sub: outOfOrder > 0 ? 'Blocked' : 'None blocked', icon: AlertTriangle, color: outOfOrder > 0 ? 'red' : 'stone' },
      ]
    }

    case 'nightaudit': {
      const [{ data: na }, { data: res }, { data: fc }] = await Promise.all([
        supabase.from('night_audits').select('audit_date, summary').order('audit_date', { ascending: false }).limit(30),
        supabase.from('reservations').select('status').in('status', ['CHECKED_IN','NO_SHOW']),
        supabase.from('folio_charges').select('status, total').gte('charge_date', today.slice(0,7) + '-01'),
      ])
      const lastAudit = (na || [])[0]
      const daysSince = lastAudit ? Math.floor((new Date(today) - new Date(lastAudit.audit_date)) / 86400000) : null
      const auditedDays = (na || []).length
      const inhouse = (res || []).filter(r => r.status === 'CHECKED_IN').length
      const dueAmt = (fc || []).filter(r => r.status === 'DUE').reduce((s, r) => s + +r.total, 0)
      return [
        { label: 'Last night audit', value: lastAudit ? lastAudit.audit_date : 'Never', sub: daysSince === 0 ? 'Done today' : daysSince === 1 ? 'Yesterday' : daysSince !== null ? `${daysSince} days ago` : 'No audits yet', icon: CalendarCheck, color: daysSince === 0 ? 'green' : daysSince !== null && daysSince > 1 ? 'red' : 'amber' },
        { label: 'Audits this month', value: (na || []).filter(a => a.audit_date >= today.slice(0,7) + '-01').length, sub: `${auditedDays} total`, icon: FileText, color: 'pine' },
        { label: 'In-house tonight', value: inhouse, sub: 'Guests to audit', icon: BedDouble, color: inhouse > 0 ? 'blue' : 'stone' },
        { label: 'Outstanding due', value: fmtBDT(dueAmt), sub: dueAmt > 0 ? 'Unposted charges' : 'All clear', icon: dueAmt > 0 ? AlertTriangle : CheckCircle2, color: dueAmt > 0 ? 'amber' : 'green' },
      ]
    }

    case 'pos': {
      const [{ data: orders }, { data: fc }] = await Promise.all([
        supabase.from('pos_orders').select('status, total, settled_at, created_at'),
        supabase.from('folio_charges').select('charge_type, total, charge_date').eq('charge_type', 'RESTAURANT').gte('charge_date', today.slice(0,7) + '-01'),
      ])
      const all = orders || []
      const todayOrders = all.filter(o => (o.settled_at || o.created_at || '').slice(0,10) === today)
      const openOrders = all.filter(o => o.status === 'OPEN').length
      const chargedRoom = all.filter(o => o.status === 'CHARGED_TO_ROOM').length
      const todaySettled = todayOrders.filter(o => o.status === 'SETTLED').reduce((s, o) => s + +o.total, 0)
      const mtdRest = (fc || []).reduce((s, r) => s + +r.total, 0)
      const avgOrder = todayOrders.length > 0 ? todaySettled / todayOrders.filter(o => o.status === 'SETTLED').length || 0 : 0
      return [
        { label: 'Open orders', value: openOrders, sub: openOrders > 0 ? 'Pending settlement' : 'No open orders', icon: Clock, color: openOrders > 0 ? 'amber' : 'green' },
        { label: "Today's sales", value: fmtBDT(todaySettled), sub: `${todayOrders.filter(o=>o.status==='SETTLED').length} settled orders`, icon: Banknote, color: 'green' },
        { label: 'Charged to room', value: chargedRoom, sub: 'Pending check-out', icon: BedDouble, color: chargedRoom > 0 ? 'blue' : 'stone' },
        { label: 'MTD restaurant rev', value: fmtBDT(mtdRest), sub: `Avg: ${fmtBDT(avgOrder)} / order`, icon: TrendingUp, color: 'pine' },
      ]
    }

    case 'inventory': {
      const [{ data: items }, { data: reqs }, { data: pos }, { data: grns }] = await Promise.all([
        supabase.from('inv_items').select('id, reorder_level'),
        supabase.from('requisitions').select('status'),
        supabase.from('purchase_orders').select('status, po_items(qty, unit_cost)'),
        supabase.from('goods_receipts').select('grn_date, grn_items(qty, unit_cost)').gte('grn_date', today.slice(0,7) + '-01'),
      ])
      const totalItems = (items || []).length
      // Simple low-stock: items with reorder_level > 0 (real balance via v_stock_balance is complex here)
      const pendingReqs = (reqs || []).filter(r => r.status === 'PENDING').length
      const openPOs = (pos || []).filter(p => ['OPEN','PARTIAL'].includes(p.status)).length
      const openPOValue = (pos || []).filter(p => ['OPEN','PARTIAL'].includes(p.status)).reduce((s, p) => s + (p.po_items || []).reduce((a, l) => a + +l.qty * +l.unit_cost, 0), 0)
      const mtdPurchase = (grns || []).reduce((s, g) => s + (g.grn_items || []).reduce((a, l) => a + +l.qty * +l.unit_cost, 0), 0)
      return [
        { label: 'Pending requisitions', value: pendingReqs, sub: pendingReqs > 0 ? 'Awaiting approval' : 'All approved', icon: FileText, color: pendingReqs > 0 ? 'amber' : 'green' },
        { label: 'Open POs', value: openPOs, sub: `Value: ${fmtBDT(openPOValue)}`, icon: Truck, color: openPOs > 0 ? 'blue' : 'stone' },
        { label: 'MTD purchases', value: fmtBDT(mtdPurchase), sub: 'Goods received this month', icon: Boxes, color: 'pine' },
        { label: 'Total items', value: totalItems, sub: 'Active catalogue', icon: Boxes, color: 'stone' },
      ]
    }

    case 'accounting': {
      const [{ data: fc }, { data: pay }, { data: jv }] = await Promise.all([
        supabase.from('folio_charges').select('total, status, charge_date').gte('charge_date', today.slice(0,7) + '-01'),
        supabase.from('payments').select('amount, received_date').gte('received_date', today.slice(0,7) + '-01'),
        supabase.from('journal_entries').select('id, jv_date').gte('jv_date', today.slice(0,7) + '-01'),
      ])
      const mtdRev = (fc || []).reduce((s, r) => s + +r.total, 0)
      const mtdCol = (pay || []).reduce((s, r) => s + +r.amount, 0)
      const due = (fc || []).filter(r => r.status === 'DUE').reduce((s, r) => s + +r.total, 0)
      const jvCount = (jv || []).length
      const todayRev = (fc || []).filter(r => r.charge_date === today).reduce((s, r) => s + +r.total, 0)
      return [
        { label: 'MTD revenue', value: fmtBDT(mtdRev), sub: `Today: ${fmtBDT(todayRev)}`, icon: TrendingUp, color: 'green' },
        { label: 'MTD collections', value: fmtBDT(mtdCol), sub: 'Cash + bank received', icon: Banknote, color: 'pine' },
        { label: 'Total outstanding', value: fmtBDT(due), sub: due > 0 ? 'Uncollected dues' : 'Fully collected', icon: due > 0 ? AlertTriangle : CheckCircle2, color: due > 50000 ? 'red' : due > 0 ? 'amber' : 'green' },
        { label: 'Journal entries MTD', value: jvCount, sub: 'Posted to ledger', icon: FileText, color: 'stone' },
      ]
    }

    case 'vat': {
      const [{ data: sales }, { data: purch }] = await Promise.all([
        supabase.from('vat_sales_register').select('vat, sd, total, issue_date').gte('issue_date', today.slice(0,7) + '-01').eq('is_void', false),
        supabase.from('vat_purchase_register').select('vat_amount, total, entry_date').gte('entry_date', today.slice(0,7) + '-01'),
      ])
      const outVat = (sales || []).reduce((s, r) => s + +r.vat, 0)
      const outSd  = (sales || []).reduce((s, r) => s + +r.sd, 0)
      const inVat  = (purch || []).reduce((s, r) => s + +r.vat_amount, 0)
      const netVat = outVat + outSd - inVat
      const invoiceCount = (sales || []).length
      return [
        { label: 'Output VAT (MTD)', value: fmtBDT(outVat), sub: `SD: ${fmtBDT(outSd)}`, icon: TrendingUp, color: 'pine' },
        { label: 'Input VAT (MTD)', value: fmtBDT(inVat), sub: 'Rebateable purchases', icon: TrendingDown, color: 'blue' },
        { label: 'Net VAT payable', value: fmtBDT(netVat), sub: netVat > 0 ? 'Payable to NBR' : 'Credit balance', icon: Calculator, color: netVat > 0 ? 'amber' : 'green' },
        { label: 'Invoices issued', value: invoiceCount, sub: 'This month', icon: FileText, color: 'stone' },
      ]
    }

    case 'hr': {
      const [{ data: emp }, { data: leaves }, { data: att }] = await Promise.all([
        supabase.from('employees').select('status, department'),
        supabase.from('leave_applications').select('status'),
        supabase.from('attendance_records').select('status').eq('date', today),
      ])
      const active = (emp || []).filter(e => e.status === 'ACTIVE').length
      const total = (emp || []).length
      const pendingLeaves = (leaves || []).filter(l => l.status === 'PENDING').length
      const presentToday = (att || []).filter(a => a.status === 'PRESENT').length
      const absentToday = (att || []).filter(a => a.status === 'ABSENT').length
      const depts = [...new Set((emp || []).filter(e => e.status === 'ACTIVE').map(e => e.department))].length
      return [
        { label: 'Active employees', value: active, sub: `${total} total · ${depts} dept`, icon: Users, color: 'pine' },
        { label: 'Present today', value: presentToday, sub: `${absentToday} absent`, icon: CalendarCheck, color: presentToday > 0 ? 'green' : 'stone' },
        { label: 'Pending leave apps', value: pendingLeaves, sub: pendingLeaves > 0 ? 'Awaiting approval' : 'None pending', icon: Clock, color: pendingLeaves > 0 ? 'amber' : 'green' },
        { label: 'Attendance rate', value: (presentToday + absentToday) > 0 ? `${Math.round((presentToday/(presentToday+absentToday))*100)}%` : '—', sub: 'Today', icon: TrendingUp, color: 'blue' },
      ]
    }

    case 'tasks': {
      const { data: tasks } = await supabase.from('tasks').select('status, priority, due_date')
      const all = tasks || []
      const open = all.filter(t => !['DONE','CANCELLED'].includes(t.status)).length
      const overdue = all.filter(t => !['DONE','CANCELLED'].includes(t.status) && t.due_date && t.due_date < today).length
      const highPriority = all.filter(t => t.priority === 'HIGH' && !['DONE','CANCELLED'].includes(t.status)).length
      const doneToday = all.filter(t => t.status === 'DONE').length
      return [
        { label: 'Open tasks', value: open, sub: `${highPriority} high priority`, icon: Clock, color: open > 0 ? 'amber' : 'green' },
        { label: 'Overdue', value: overdue, sub: overdue > 0 ? 'Past due date' : 'All on track', icon: overdue > 0 ? AlertTriangle : CheckCircle2, color: overdue > 0 ? 'red' : 'green' },
        { label: 'High priority', value: highPriority, sub: 'Urgent tasks', icon: Star, color: highPriority > 0 ? 'red' : 'stone' },
        { label: 'Completed', value: doneToday, sub: 'Total done', icon: CheckCircle2, color: 'green' },
      ]
    }

    case 'facilities': {
      const [{ data: sales }, { data: items }] = await Promise.all([
        supabase.from('facility_sales').select('total, status, sale_date').gte('sale_date', today.slice(0,7) + '-01'),
        supabase.from('facility_items').select('id, is_active'),
      ])
      const mtd = (sales || []).filter(s => s.status === 'SETTLED').reduce((s, r) => s + +r.total, 0)
      const todaySales = (sales || []).filter(s => s.sale_date === today && s.status === 'SETTLED').reduce((s, r) => s + +r.total, 0)
      const count = (sales || []).filter(s => s.sale_date === today).length
      const activeItems = (items || []).filter(i => i.is_active).length
      return [
        { label: "Today's facility sales", value: fmtBDT(todaySales), sub: `${count} transactions`, icon: ShoppingCart, color: 'green' },
        { label: 'MTD facility revenue', value: fmtBDT(mtd), sub: 'This month total', icon: TrendingUp, color: 'pine' },
        { label: 'Active items', value: activeItems, sub: 'In catalogue', icon: Boxes, color: 'stone' },
      ]
    }

    case 'reports': {
      const [{ data: defs }, { data: fc }] = await Promise.all([
        supabase.from('report_definitions').select('status'),
        supabase.from('folio_charges').select('total').gte('charge_date', today.slice(0,7) + '-01'),
      ])
      const ready = (defs || []).filter(d => d.status === 'READY').length
      const total = (defs || []).length
      const mtdRev = (fc || []).reduce((s, r) => s + +r.total, 0)
      return [
        { label: 'Reports available', value: ready, sub: `${total} total`, icon: FileText, color: 'pine' },
        { label: 'MTD revenue', value: fmtBDT(mtdRev), sub: 'Quick snapshot', icon: TrendingUp, color: 'green' },
      ]
    }

    default:
      return []
  }
}

/* ── main export ────────────────────────────────────────────────────────── */
export default function KPICards({ module }) {
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const today = todayISO()

  useEffect(() => {
    setLoading(true)
    fetchKPIs(module, today)
      .then((data) => { setKpis(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [module])

  if (kpis.length === 0 && !loading) return null

  const cols = kpis.length <= 3 ? kpis.length : kpis.length <= 4 ? 4 : kpis.length <= 6 ? 3 : 4

  return (
    <div className={`erp-kpi-strip grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : cols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {(loading ? Array(4).fill({ label: '…', value: '—', icon: Loader2, color: 'stone' }) : kpis).map((kpi, i) => (
        <KPICard key={i} loading={loading} {...kpi} />
      ))}
    </div>
  )
}
