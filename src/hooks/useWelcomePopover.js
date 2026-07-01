import { useState, useEffect } from 'react'

export function useWelcomePopover() {
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  return { showWelcome, setShowWelcome }
}
