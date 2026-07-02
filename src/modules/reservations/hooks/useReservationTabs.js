import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_RESERVATION_TAB, resolveReservationTab } from '../reservations.config'

export function useReservationTabs({ visibleTabs = [] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const normalizedTab = resolveReservationTab(rawTab)
  const visibleTabIds = useMemo(() => new Set(visibleTabs.map((tab) => tab.id)), [visibleTabs])
  const fallbackTab = visibleTabs[0]?.id || DEFAULT_RESERVATION_TAB
  const activeTab = visibleTabIds.has(normalizedTab) ? normalizedTab : fallbackTab

  useEffect(() => {
    if (!fallbackTab) return
    if (rawTab === activeTab) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', activeTab)
    setSearchParams(nextSearchParams, { replace: true })
  }, [activeTab, fallbackTab, rawTab, searchParams, setSearchParams])

  const setActiveTab = (tabId) => {
    const nextTab = resolveReservationTab(tabId)
    if (!visibleTabIds.has(nextTab)) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', nextTab)
    setSearchParams(nextSearchParams, { replace: true })
  }

  return { activeTab, setActiveTab }
}
