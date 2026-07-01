import { DASHBOARD_KPIS } from '../../lib/reporting/reportConfig'
import { fmtBDT } from '../../lib/helpers'

const formatKpi = (value, type) => {
  if (type === 'currency') return fmtBDT(value)
  if (type === 'percent') return `${Number(value || 0).toFixed(2)}%`
  return Number(value || 0).toLocaleString('en-BD')
}

export default function ReportKpiCards({ values, activeKeys }) {
  const cards = DASHBOARD_KPIS.filter((kpi) => !activeKeys || activeKeys.includes(kpi.key))
  return (
    <section className="erp-kpi-grid">
      {cards.map((kpi) => {
        const Icon = kpi.icon
        return (
          <article key={kpi.key} className="erp-kpi-card">
            <div>
              <p>{kpi.label}</p>
              <strong>{formatKpi(values[kpi.key], kpi.type)}</strong>
            </div>
            <span><Icon size={18} /></span>
          </article>
        )
      })}
    </section>
  )
}
