import DashboardWidget from '../components/DashboardWidget'

export default function HrSummary({ metrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <DashboardWidget title="Pending approvals" value={metrics.pendingApprovals} subtitle="Leave and requisitions" />
    </section>
  )
}
