import DashboardWidget from '../components/DashboardWidget'

export default function RestaurantSummary({ metrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <DashboardWidget title="Restaurant sales" value={metrics.restaurantSales} subtitle="Today" />
    </section>
  )
}
