import { useNavigate } from 'react-router-dom'

export default function ReportListPanel({ items = [], activeReportCode, onSelectReport }) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Reports</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const isActive = item.reportCode && activeReportCode === item.reportCode
          return (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled && !!item.reportCode}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'border-[rgb(var(--tenant-primary-rgb)_/_0.4)] bg-secondary text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => {
                if (item.route) {
                  navigate(item.route)
                  return
                }
                if (item.reportCode) onSelectReport?.(item.reportCode)
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
