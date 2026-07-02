import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

const amountFormatter = (value, type = 'currency', currency = 'BDT') => {
  const safeValue = Number(value || 0)
  const absoluteValue = Math.abs(safeValue)

  if (type === 'percent') {
    const formatted = `${absoluteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    return safeValue < 0 ? `(${formatted})` : formatted
  }

  const formatted = absoluteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return safeValue < 0 ? `(${currency} ${formatted})` : `${currency} ${formatted}`
}

function VarianceArrow({ value }) {
  if (value > 0) return <ArrowUpRight className="size-4 text-emerald-600" />
  if (value < 0) return <ArrowDownRight className="size-4 text-rose-600" />
  return <Minus className="size-4 text-slate-400" />
}

export default function ReportKpiCards({ cards = [], currency = 'BDT' }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</p>
              <strong className="text-2xl font-semibold text-slate-900">
                {amountFormatter(card.currentValue, card.type, currency)}
              </strong>
            </div>
            <div className="rounded-2xl bg-slate-100 p-2">
              <VarianceArrow value={card.varianceValue} />
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <dt>Previous Period</dt>
              <dd className="font-medium text-slate-900">{amountFormatter(card.previousValue, card.type, currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Variance</dt>
              <dd className="font-medium text-slate-900">{amountFormatter(card.varianceValue, card.type, currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Variance %</dt>
              <dd className="font-medium text-slate-900">{amountFormatter(card.variancePercent, 'percent', currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Trend</dt>
              <dd className="inline-flex items-center gap-2 font-medium text-slate-900">
                <VarianceArrow value={card.varianceValue} />
                <span>{card.varianceValue > 0 ? 'Up' : card.varianceValue < 0 ? 'Down' : 'Flat'}</span>
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  )
}
