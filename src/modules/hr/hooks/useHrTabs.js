import { useState } from 'react'
import { VALID_TAB_KEYS } from '../hr.config'

function readParams() {
  try {
    const p = new URLSearchParams(window.location.search)
    return { tab: p.get('tab') || '', view: p.get('view') || '' }
  } catch {
    return { tab: '', view: '' }
  }
}

function writeParams(tab, view) {
  try {
    const p = new URLSearchParams()
    p.set('tab', tab)
    if (view) p.set('view', view)
    window.history.replaceState(null, '', `?${p.toString()}`)
  } catch { /* non-browser env */ }
}

export function useHrTabs(defaultTab = 'employees') {
  const initial = readParams()
  const [tab, setTabState] = useState(() =>
    VALID_TAB_KEYS.includes(initial.tab) ? initial.tab : defaultTab
  )
  const [view, setViewState] = useState(initial.view)

  const setTab = (newTab, newView = '') => {
    if (!VALID_TAB_KEYS.includes(newTab)) return
    setTabState(newTab)
    setViewState(newView)
    writeParams(newTab, newView)
  }

  const setView = (newView) => {
    setViewState(newView)
    writeParams(tab, newView)
  }

  return { tab, view, setTab, setView }
}
