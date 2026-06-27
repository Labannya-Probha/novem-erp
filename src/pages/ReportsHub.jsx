import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { exportXLSX, fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import { getTenantId } from '../lib/tenant'
import {
  BarChart3,
  RefreshCw,
  LayoutDashboard,
  Landmark,
  HandCoins,
  BedDouble,
  CalendarCheck2,
  TrendingUp,
  AlertCircle,
  Download,
  Building2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'

const REPORT_SECTIONS = [
  { id: 'executive', label: 'Executive Dashboard', desc: 'Consolidated KPI snapshot', icon: LayoutDashboard },
  { id: 'finance', label: 'Financial Intelligence', desc: 'Revenue & collection analytics', icon: Landmark },
  { id: 'operations', label: 'Operational Control', desc: 'Occupancy and closure health', icon: BedDouble },
  { id: 'receivables', label: 'Receivables Desk', desc: 'Outstanding invoice priorities', icon: HandCoins },
]

const money = (v) => Number(v || 0)
const dayStart = (d) => `${d}T00:00:00`
const dayEnd = (d) => `${d}T23:59:59`
const monthStart = (d) => `${d.slice(0, 8)}01`

function emptySnapshot() {
  return {
    generatedAt: null,
    kpis: {
      totalRevenue: 0,
      totalReceipts: 0,
      outstandingDue: 0,
      occupancyRate: 0,
      collectionRate: 0,
      closeCoverage: 0,
      closedDays: 0,
      rangeDays: 0,
    },
    revenueLines: [],
    receiptLines: [],
    reservationLines: [],
    topReceivables: [],
  }
}

function daysBetweenInclusive(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1
}

function normalizeMethod(method) {
  return (method || 'UNSPECIFIED').toString().trim().toUpperCase()
}

function KPIBox({ title, value, note, icon: Icon, variant = 'default' }) {
  const variantClass = variant === 'success'
    ? 'border-forest/30 bg-forest/[0.08]'
    : variant === 'warning'
      ? 'border-amber/40 bg-amber/[0.10]'
      : 'border-[--border-color] bg-white'

  return (
    <div className={`rounded-xl border p-4 ${variantClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-pine/60">{title}</p>
          <p className="mt-1 text-xl font-semibold text-pine">{value}</p>
          <p className="mt-1 text-xs text-pine/60">{note}</p>
        </div>
        <div className="rounded-lg bg-white p-2 border border-[--border-color]">
          <Icon size={16} className="text-pine" />
        </div>
      </div>
    </div>
  )
}

export default function ReportsHub() {
  const today = useMemo(() => todayISO(), [])
  const tenantId = useMemo(() => getTenantId(), [])
  const [activeSection, setActiveSection] = useState('executive')
  const [fromDate, setFromDate] = useState(monthStart(today))
  const [toDate, setToDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(emptySnapshot)

  const loadSnapshot = useCallback(async () => {
    if (!fromDate || !toDate || toDate < fromDate) {
      setError('Invalid date range. Please provide a valid From and To date.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const [
        folioRes,
        paymentRes,
        posRes,
        facilityRes,
        invoiceRes,
        reservationRes,
        roomsRes,
        inHouseRes,
        closeRes,
      ] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,charge_date').gte('charge_date', fromDate).lte('charge_date', toDate),
        supabase.from('payments').select('method,amount,received_date').gte('received_date', fromDate).lte('received_date', toDate),
        supabase.from('pos_orders').select('status,total,payment_method,created_at').gte('created_at', dayStart(fromDate)).lte('created_at', dayEnd(toDate)),
        supabase.from('facility_sales').select('status,total,payment_method,sale_date,item_name').gte('sale_date', fromDate).lte('sale_date', toDate),
        supabase.from('invoices').select('id,invoice_no,reservation_id,issued_at,due,paid,status,is_void,totals').eq('is_void', false).order('issued_at', { ascending: false }).limit(300),
        supabase.from('reservations').select('id,status,check_in,check_out').gte('check_in', fromDate).lte('check_in', toDate),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('id').eq('status', 'CHECKED_IN').lte('check_in', today).gt('check_out', today),
        supabase.from('day_closes').select('close_date').gte('close_date', fromDate).lte('close_date', toDate),
      ])

      const queryError = [
        folioRes.error,
        paymentRes.error,
        posRes.error,
        facilityRes.error,
        invoiceRes.error,
        reservationRes.error,
        roomsRes.error,
        inHouseRes.error,
        closeRes.error,
      ].find(Boolean)
      if (queryError) throw queryError

      const folio = folioRes.data || []
      const payments = paymentRes.data || []
      const posOrders = (posRes.data || []).filter((x) => x.status === 'SETTLED')
      const facilitySales = (facilityRes.data || []).filter((x) => x.status === 'SETTLED')
      const invoices = invoiceRes.data || []
      const reservations = reservationRes.data || []
      const activeRooms = roomsRes.data || []
      const inHouse = inHouseRes.data || []
      const dayCloses = closeRes.data || []

      const revenueMap = {}
      for (const row of folio) {
        const key = row.charge_type || 'OTHER'
        revenueMap[key] = (revenueMap[key] || 0) + money(row.total)
      }
      revenueMap.RESTAURANT_POS = (revenueMap.RESTAURANT_POS || 0) + posOrders.reduce((a, r) => a + money(r.total), 0)
      revenueMap.FACILITY = (revenueMap.FACILITY || 0) + facilitySales.reduce((a, r) => a + money(r.total), 0)

      const receiptMap = {}
      for (const row of payments) {
        const key = normalizeMethod(row.method)
        receiptMap[key] = (receiptMap[key] || 0) + money(row.amount)
      }
      for (const row of posOrders) {
        const key = normalizeMethod(row.payment_method)
        receiptMap[key] = (receiptMap[key] || 0) + money(row.total)
      }
      for (const row of facilitySales) {
        const key = normalizeMethod(row.payment_method)
        receiptMap[key] = (receiptMap[key] || 0) + money(row.total)
      }

      const revenueLines = Object.entries(revenueMap)
        .map(([label, amount]) => ({ label: label.replaceAll('_', ' '), amount }))
        .sort((a, b) => b.amount - a.amount)

      const receiptLines = Object.entries(receiptMap)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount)

      const totalRevenue = revenueLines.reduce((a, r) => a + r.amount, 0)
      const totalReceipts = receiptLines.reduce((a, r) => a + r.amount, 0)

      const receivableRows = invoices.map((inv) => {
        const fallbackDue = money(inv?.totals?.grand_total) - money(inv.paid)
        const due = Math.max(money(inv.due), fallbackDue, 0)
        return {
          invoiceNo: inv.invoice_no || `INV-${inv.id}`,
          issueDate: inv.issued_at,
          status: inv.status || 'OPEN',
          due,
        }
      }).filter((x) => x.due > 0)

      const outstandingDue = receivableRows.reduce((a, r) => a + r.due, 0)
      const topReceivables = receivableRows.sort((a, b) => b.due - a.due).slice(0, 12)

      const statusMap = {}
      for (const row of reservations) {
        const key = row.status || 'UNSPECIFIED'
        statusMap[key] = (statusMap[key] || 0) + 1
      }
      const reservationLines = Object.entries(statusMap)
        .map(([status, count]) => ({ status: status.replaceAll('_', ' '), count }))
        .sort((a, b) => b.count - a.count)

      const closeDays = new Set((dayCloses || []).map((x) => x.close_date)).size
      const rangeDays = daysBetweenInclusive(fromDate, toDate)
      const occupancyRate = activeRooms.length ? (inHouse.length / activeRooms.length) * 100 : 0
      const collectionRate = totalRevenue > 0 ? (totalReceipts / totalRevenue) * 100 : 0
      const closeCoverage = rangeDays > 0 ? (closeDays / rangeDays) * 100 : 0

      setSnapshot({
        generatedAt: new Date().toISOString(),
        kpis: {
          totalRevenue,
          totalReceipts,
          outstandingDue,
          occupancyRate,
          collectionRate,
          closeCoverage,
          closedDays: closeDays,
          rangeDays,
        },
        revenueLines,
        receiptLines,
        reservationLines,
        topReceivables,
      })
    } catch (e) {
      setError(e.message || 'Failed to load enterprise reporting snapshot.')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, today])

  useEffect(() => { loadSnapshot() }, [loadSnapshot])

  const exportWorkbook = useCallback(() => {
    const revRows = [
      ['Revenue Stream', 'Amount'],
      ...snapshot.revenueLines.map((r) => [r.label, r.amount]),
      ['TOTAL', snapshot.kpis.totalRevenue],
    ]
    const recRows = [
      ['Receipt Method', 'Amount'],
      ...snapshot.receiptLines.map((r) => [r.label, r.amount]),
      ['TOTAL', snapshot.kpis.totalReceipts],
    ]
    const opsRows = [
      ['Metric', 'Value'],
      ['Occupancy Rate (%)', snapshot.kpis.occupancyRate.toFixed(2)],
      ['Collection Rate (%)', snapshot.kpis.collectionRate.toFixed(2)],
      ['Night Close Coverage (%)', snapshot.kpis.closeCoverage.toFixed(2)],
      ['Closed Days', snapshot.kpis.closedDays],
      ['Range Days', snapshot.kpis.rangeDays],
      [],
      ['Reservation Status', 'Count'],
      ...snapshot.reservationLines.map((r) => [r.status, r.count]),
    ]
    const arRows = [
      ['Invoice', 'Issue Date', 'Status', 'Due'],
      ...snapshot.topReceivables.map((r) => [r.invoiceNo, r.issueDate ? fmtDate(r.issueDate.slice(0, 10)) : '—', r.status, r.due]),
      ['TOTAL DUE', '', '', snapshot.kpis.outstandingDue],
    ]

    exportXLSX(`Enterprise_Reports_${fromDate}_to_${toDate}.xlsx`, [
      { name: 'Revenue', rows: revRows },
      { name: 'Receipts', rows: recRows },
      { name: 'Operations', rows: opsRows },
      { name: 'Receivables', rows: arRows },
    ])
  }, [fromDate, toDate, snapshot])

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 size={23} className="text-forest" /> Enterprise Reporting Center
              </CardTitle>
              <CardDescription className="mt-1">
                Professional ERP-grade analytics for management, finance, and operations.
              </CardDescription>
              <div className="mt-2 flex items-center gap-2 text-xs text-pine/60">
                <Building2 size={14} />
                <span>Tenant Scope: {tenantId || 'RLS-managed tenant context'}</span>
              </div>
            </div>
            <Badge variant="info" className="whitespace-nowrap">
              Last refresh: {snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleString() : 'Not generated'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="label">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
            </div>
            <div>
              <label className="label">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={today} />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={loadSnapshot} disabled={loading}>
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
              </Button>
              <Button className="w-full sm:w-auto" onClick={exportWorkbook} disabled={loading}>
                <Download size={15} /> Export XLSX
              </Button>
            </div>
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {REPORT_SECTIONS.map((s) => {
          const Icon = s.icon
          const active = activeSection === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`text-left rounded-xl border p-4 transition ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-[--border-color] bg-white hover:border-primary/40'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon size={18} className={active ? 'text-primary' : 'text-pine'} />
                {active && <Badge variant="success">Active</Badge>}
              </div>
              <div className="mt-3 font-semibold text-pine">{s.label}</div>
              <div className="text-xs text-pine/60 mt-1">{s.desc}</div>
            </button>
          )
        })}
      </div>

      {activeSection === 'executive' && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Executive KPI Summary</CardTitle>
            <CardDescription>High-level ERP control metrics for leadership and board reporting.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <KPIBox title="Total Revenue" value={fmtBDT(snapshot.kpis.totalRevenue)} note="Accrual + settled transactional streams" icon={TrendingUp} variant="success" />
            <KPIBox title="Total Receipts" value={fmtBDT(snapshot.kpis.totalReceipts)} note="Cash and digital collection volume" icon={HandCoins} variant="success" />
            <KPIBox title="Outstanding A/R" value={fmtBDT(snapshot.kpis.outstandingDue)} note="Uncollected invoice balances" icon={AlertCircle} variant="warning" />
            <KPIBox title="Occupancy Rate" value={`${snapshot.kpis.occupancyRate.toFixed(2)}%`} note="Current in-house vs active rooms" icon={BedDouble} />
            <KPIBox title="Collection Efficiency" value={`${snapshot.kpis.collectionRate.toFixed(2)}%`} note="Receipts as % of recognized revenue" icon={CalendarCheck2} />
            <KPIBox title="Night Close Coverage" value={`${snapshot.kpis.closeCoverage.toFixed(2)}%`} note={`${snapshot.kpis.closedDays}/${snapshot.kpis.rangeDays} days closed`} icon={BarChart3} />
          </CardContent>
        </Card>
      )}

      {activeSection === 'finance' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Revenue Stream Analysis</CardTitle>
              <CardDescription>Department-wise gross contribution for the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.revenueLines.length === 0 && <p className="text-sm text-pine/60">No revenue data for the selected period.</p>}
              {snapshot.revenueLines.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg border border-[--border-color] px-3 py-2 bg-white">
                  <span className="text-sm text-pine/80">{row.label}</span>
                  <span className="text-sm font-semibold money">{fmtBDT(row.amount)}</span>
                </div>
              ))}
              {snapshot.revenueLines.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-semibold text-pine">Total</span>
                  <span className="text-sm font-semibold money">{fmtBDT(snapshot.kpis.totalRevenue)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Receipts by Payment Method</CardTitle>
              <CardDescription>Collection distribution across payment channels.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.receiptLines.length === 0 && <p className="text-sm text-pine/60">No collection data for the selected period.</p>}
              {snapshot.receiptLines.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg border border-[--border-color] px-3 py-2 bg-white">
                  <span className="text-sm text-pine/80">{row.label}</span>
                  <span className="text-sm font-semibold money">{fmtBDT(row.amount)}</span>
                </div>
              ))}
              {snapshot.receiptLines.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-semibold text-pine">Total</span>
                  <span className="text-sm font-semibold money">{fmtBDT(snapshot.kpis.totalReceipts)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'operations' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Reservation Status Mix</CardTitle>
              <CardDescription>Operational booking load distribution in this period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.reservationLines.length === 0 && <p className="text-sm text-pine/60">No reservation activity in selected date range.</p>}
              {snapshot.reservationLines.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-lg border border-[--border-color] px-3 py-2 bg-white">
                  <span className="text-sm text-pine/80">{row.status}</span>
                  <Badge variant="outline" className="font-semibold">{row.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Day-Close Governance</CardTitle>
              <CardDescription>Controls health derived from operational day-closing entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-lg border border-[--border-color] px-3 py-2 bg-white flex items-center justify-between">
                <span className="text-sm text-pine/80">Closed Days</span>
                <span className="font-semibold">{snapshot.kpis.closedDays}</span>
              </div>
              <div className="rounded-lg border border-[--border-color] px-3 py-2 bg-white flex items-center justify-between">
                <span className="text-sm text-pine/80">Planned Days</span>
                <span className="font-semibold">{snapshot.kpis.rangeDays}</span>
              </div>
              <div className="rounded-lg border border-[--border-color] px-3 py-2 bg-white flex items-center justify-between">
                <span className="text-sm text-pine/80">Compliance Coverage</span>
                <span className="font-semibold">{snapshot.kpis.closeCoverage.toFixed(2)}%</span>
              </div>
              <div className="rounded-lg border border-[--border-color] px-3 py-2 bg-white flex items-center justify-between">
                <span className="text-sm text-pine/80">Live Occupancy</span>
                <span className="font-semibold">{snapshot.kpis.occupancyRate.toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'receivables' && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Receivables Action Queue</CardTitle>
            <CardDescription>Prioritized overdue invoices for collection follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Invoice No</th>
                    <th className="th">Issue Date</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.topReceivables.map((row) => (
                    <tr key={`${row.invoiceNo}-${row.issueDate || 'na'}`}>
                      <td className="td font-semibold text-xs">{row.invoiceNo}</td>
                      <td className="td text-xs text-pine/60">{row.issueDate ? fmtDate(row.issueDate.slice(0, 10)) : '—'}</td>
                      <td className="td"><Badge variant="warning">{row.status}</Badge></td>
                      <td className="td text-right money font-semibold">{fmtBDT(row.due)}</td>
                    </tr>
                  ))}
                  {snapshot.topReceivables.length === 0 && (
                    <tr>
                      <td className="td text-center text-pine/60" colSpan={4}>No outstanding invoices in current data snapshot.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="td font-semibold" colSpan={3}>Total Outstanding Due</td>
                    <td className="td text-right money font-bold text-red-700">{fmtBDT(snapshot.kpis.outstandingDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
