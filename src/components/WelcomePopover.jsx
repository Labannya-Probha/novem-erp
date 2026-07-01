import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'

export function WelcomePopover({ isOpen, userName = 'User', onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined
    const closeTimer = window.setTimeout(() => onClose?.(), 3200)
    return () => window.clearTimeout(closeTimer)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full pointer-events-none no-print">
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl bg-forest text-white pointer-events-auto animate-slide-in"
      >
        <span className="mt-0.5 shrink-0 opacity-90"><Sparkles size={16} /></span>
        <p className="flex-1 text-sm font-medium leading-snug">Welcome, {userName}!</p>
        <button onClick={() => onClose?.()} className="shrink-0 opacity-60 hover:opacity-100 mt-0.5">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
