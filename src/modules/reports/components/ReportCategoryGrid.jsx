export default function ReportCategoryGrid({ tabs = [], activeTab, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              isActive
                ? 'border-[rgb(var(--tenant-primary-rgb)_/_0.4)] bg-secondary text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onChange?.(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
