/* ------------------------------------------------------------------ */
/*  SETTINGS MODULE — HELPERS                                           */
/*  Shared UI helpers used across the Settings page.                    */
/* ------------------------------------------------------------------ */
import { ChevronDown } from 'lucide-react'

/* Collapsible accordion wrapper — click header to expand/collapse */
export function CollapsibleSection({ title, icon: Icon, children, open, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-1 mb-1 group"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pine/50 group-hover:text-pine/80 transition-colors">
          {Icon && <Icon size={13} className="text-forest/70" />}
          {title}
        </span>
        <ChevronDown size={13} className={`text-pine/35 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && children}
    </div>
  )
}
