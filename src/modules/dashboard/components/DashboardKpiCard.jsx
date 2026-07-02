import DashboardWidget from './DashboardWidget'

export default function DashboardKpiCard({ label, value, hint }) {
  return <DashboardWidget title={label} value={value} subtitle={hint} />
}
