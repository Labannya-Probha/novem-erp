import { useEffect, useState } from 'react'

export function WelcomePopover({ isOpen, userName = 'User', onClose }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setAnimate(false)
      return undefined
    }
    const showTimer = window.setTimeout(() => setAnimate(true), 50)
    const closeTimer = window.setTimeout(() => onClose?.(), 3200)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(closeTimer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[1000] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 no-print">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto rounded-lg border bg-white px-4 py-3 text-center text-sm font-semibold text-pine shadow-lg transition-all duration-300 ${
          animate ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
        style={{
          borderColor: 'rgba(var(--tenant-primary-rgb),0.22)',
          boxShadow: '0 12px 30px rgba(var(--tenant-primary-rgb),0.14)',
        }}
      >
        Welcome {userName}
      </div>
    </div>
  )
}
