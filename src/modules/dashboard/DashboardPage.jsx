import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/layout/PageHeader'
import Breadcrumb from '../../components/layout/Breadcrumb'
import KpiStrip from '../../components/layout/KpiStrip'
import { fmtBDT, todayISO } from '../../lib/helpers'
import { supabase } from '../../supabase'
import { DASHBOARD_SECTIONS } from './dashboard.config'
import QuickActions from './components/QuickActions'
import ExecutiveDashboard from './sections/ExecutiveDashboard'
import FrontOfficeSummary from './sections/FrontOfficeSummary'
import RestaurantSummary from './sections/RestaurantSummary'
import AccountingSummary from './sections/AccountingSummary'
import InventorySummary from './sections/InventorySummary'
import HrSummary from './sections/HrSummary'
import AlertsPanel from './sections/AlertsPanel'

const DEFAULT_METRICS = {
  occupancy: '0%',
  adr: fmtBDT(0),
  revpar: fmtBDT(0),
  todayRevenue: fmtBDT(0),
  monthlyRevenue: fmtBDT(0),
  arrivals: 0,
  departures: 0,
  inHouseGuests: 0,
  pendingPayments: fmtBDT(0),
  restaurantSales: fmtBDT(0),
  cashBankSummary: `${fmtBDT(0)} / ${fmtBDT(0)}`,
  lowStockAlerts: 0,
  pendingApprovals: 0,
}

export default function DashboardPage({ openReservation, userName, role, isAdmin, company }) {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS)
  const [loading, setLoading] = useState(false)
  const today = todayISO()
  const monthStart = `${today.slice(0, 7)}-01`

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const [
        roomsRes,
        inHouseRes,
        arrivalsRes,
        departuresRes,
        chargesRes,
        paymentsRes,
        invItemsRes,
        reqRes,
        leaveRes,
      ] = await Promise.all([
        supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('reservations').select('room_rate').eq('status', 'CHECKED_IN'),
        supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_in', today).in('status', ['QUERY', 'QUOTED', 'CONFIRMED']),
        supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_out', today).eq('status', 'CHECKED_IN'),
        supabase.from('folio_charges').select('charge_date,total,status,charge_type').gte('charge_date', monthStart),
        supabase.from('payments').select('amount,method,received_date').gte('received_date', monthStart),
        supabase.from('inv_items').select('id,reorder_level'),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('leave_applications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      ])

      const totalRooms = roomsRes.count || 0
      const inHouseRows = inHouseRes.data || []
      const inHouseGuests = inHouseRows.length
      const occupancyPct = totalRooms ? Math.round((inHouseGuests / totalRooms) * 100) : 0
      const adr = inHouseGuests
        ? inHouseRows.reduce((sum, row) => sum + Number(row.room_rate || 0), 0) / inHouseGuests
        : 0
      const revpar = adr * (occupancyPct / 100)

      const charges = chargesRes.data || []
      const todayRevenue = charges.filter((row) => row.charge_date === today).reduce((sum, row) => sum + Number(row.total || 0), 0)
      const monthlyRevenue = charges.reduce((sum, row) => sum + Number(row.total || 0), 0)
      const pendingPaymentsAmount = charges
        .filter((row) => row.status === 'DUE')
        .reduce((sum, row) => sum + Number(row.total || 0), 0)
      const restaurantSalesAmount = charges
        .filter((row) => row.charge_date === today && row.charge_type === 'RESTAURANT')
        .reduce((sum, row) => sum + Number(row.total || 0), 0)

      const payments = paymentsRes.data || []
      const cashAmount = payments
        .filter((row) => String(row.method || '').toUpperCase().includes('CASH'))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)
      const bankAmount = payments
        .filter((row) => !String(row.method || '').toUpperCase().includes('CASH'))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)

      const lowStockAlerts = (invItemsRes.data || []).filter((item) => Number(item.reorder_level || 0) > 0).length
      const pendingApprovals = (reqRes.count || 0) + (leaveRes.count || 0)

      setMetrics({
        occupancy: `${occupancyPct}%`,
        adr: fmtBDT(adr),
        revpar: fmtBDT(revpar),
        todayRevenue: fmtBDT(todayRevenue),
        monthlyRevenue: fmtBDT(monthlyRevenue),
        arrivals: arrivalsRes.count || 0,
        departures: departuresRes.count || 0,
        inHouseGuests,
        pendingPayments: fmtBDT(pendingPaymentsAmount),
        restaurantSales: fmtBDT(restaurantSalesAmount),
        cashBankSummary: `${fmtBDT(cashAmount)} / ${fmtBDT(bankAmount)}`,
        lowStockAlerts,
        pendingApprovals,
      })
    } catch {
      setMetrics(DEFAULT_METRICS)
    } finally {
      setLoading(false)
    }
  }, [monthStart, today])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const kpiItems = useMemo(() => ([
    { label: 'Occupancy', value: metrics.occupancy },
    { label: 'ADR', value: metrics.adr },
    { label: 'RevPAR', value: metrics.revpar },
    { label: "Today's Revenue", value: metrics.todayRevenue },
  ]), [metrics])

  const alerts = useMemo(() => {
    const nextAlerts = []
    if (metrics.pendingPayments !== fmtBDT(0)) {
      nextAlerts.push({ id: 'pending-payments', variant: 'destructive', title: 'Pending payments', description: `${metrics.pendingPayments} is still outstanding.` })
    }
    if (metrics.lowStockAlerts > 0) {
      nextAlerts.push({ id: 'low-stock', variant: 'default', title: 'Low stock alerts', description: `${metrics.lowStockAlerts} items are near reorder point.` })
    }
    if (metrics.pendingApprovals > 0) {
      nextAlerts.push({ id: 'pending-approvals', variant: 'default', title: 'Pending approvals', description: `${metrics.pendingApprovals} requests require attention.` })
    }
    return nextAlerts
  }, [metrics])

  const actions = useMemo(() => ([
    { label: 'Refresh', variant: 'outline', onClick: loadSummary },
  ]), [loadSummary])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Executive overview aligned to AEDS v2"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', current: true }]} />}
        actions={<QuickActions actions={actions} />}
        kpiStrip={<KpiStrip items={kpiItems} loading={loading} />}
      />

      <ExecutiveDashboard metrics={metrics} />
      <RestaurantSummary metrics={metrics} />
      <AccountingSummary metrics={metrics} />
      <InventorySummary metrics={metrics} />
      <HrSummary metrics={metrics} />
      <AlertsPanel alerts={alerts} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{DASHBOARD_SECTIONS.find((section) => section.id === 'front-office')?.title}</h2>
        <FrontOfficeSummary
          openReservation={openReservation}
          userName={userName}
          role={role}
          isAdmin={isAdmin}
          company={company}
        />
      </section>
    </div>
  )
}
