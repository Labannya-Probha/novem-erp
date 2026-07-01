// Placeholder — full payroll generation wizard planned for next phase
export default function PayrollWizard({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-bold text-pine text-lg">Generate Payroll</h2>
        <p className="text-pine/60 text-sm">Payroll generation wizard — coming in next phase.</p>
        <button className="btn-ghost w-full justify-center" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
