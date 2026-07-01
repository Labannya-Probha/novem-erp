// Thin wrapper — detailed task editing drawer planned for next phase.
import { useId } from 'react'
import { X } from 'lucide-react'

export default function TaskDrawer({ task, onClose }) {
  const titleId = useId()
  if (!task) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-display font-bold text-pine text-lg">Task Detail</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-pine/40 hover:text-pine">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs font-mono text-pine/40">{task.task_no || task.id}</p>
        <p className="font-semibold text-pine">{task.title}</p>
        {task.description && <p className="text-sm text-pine/60 whitespace-pre-line">{task.description}</p>}
        <button type="button" className="btn-ghost w-full justify-center mt-2" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
