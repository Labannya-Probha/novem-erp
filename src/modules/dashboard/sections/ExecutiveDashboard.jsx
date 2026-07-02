import DashboardKpiCard from '../components/DashboardKpiCard'

export default function ExecutiveDashboard({ metrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardKpiCard label="Occupancy" value={metrics.occupancy} hint={`${metrics.inHouseGuests} in-house`} />
      <DashboardKpiCard label="ADR" value={metrics.adr} hint="Average daily room rate" />
      <DashboardKpiCard label="RevPAR" value={metrics.revpar} hint="Revenue per available room" />
      <DashboardKpiCard label="Today Revenue" value={metrics.todayRevenue} hint="All departments" />
      <DashboardKpiCard label="Monthly Revenue" value={metrics.monthlyRevenue} hint="Month to date" />
      <DashboardKpiCard label="In-house guests" value={metrics.inHouseGuests} hint="Currently checked in" />
      <DashboardKpiCard label="Arrivals" value={metrics.arrivals} hint="Expected today" />
      <DashboardKpiCard label="Departures" value={metrics.departures} hint="Due today" />
    </section>
  )
}
