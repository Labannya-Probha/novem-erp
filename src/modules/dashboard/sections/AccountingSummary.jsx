import DashboardWidget from '../components/DashboardWidget'

export default function AccountingSummary({ metrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <DashboardWidget title="Pending payments" value={metrics.pendingPayments} subtitle="Outstanding dues" />
      <DashboardWidget title="Cash/Bank summary" value={metrics.cashBankSummary} subtitle="Month to date collections" />
    </section>
  )
}
