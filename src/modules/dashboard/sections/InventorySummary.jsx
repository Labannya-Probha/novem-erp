import DashboardWidget from '../components/DashboardWidget'

export default function InventorySummary({ metrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <DashboardWidget title="Low stock alerts" value={metrics.lowStockAlerts} subtitle="Items near reorder point" />
    </section>
  )
}
