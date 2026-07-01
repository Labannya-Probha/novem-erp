/* ------------------------------------------------------------------ */
/*  SHARED SETTINGS UI HELPERS                                          */
/*  Small presentational components reused across settings cards.       */
/* ------------------------------------------------------------------ */

export function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-leaf bg-white p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-pine/45 font-bold">{label}</p>
        <strong className="text-xl text-pine">{value}</strong>
      </div>
      <span className="h-10 w-10 rounded-lg bg-forest/10 text-forest grid place-items-center"><Icon size={18} /></span>
    </div>
  )
}

export function InputField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value || options[0]} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}
