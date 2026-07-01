import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RESERVATION_TABS, DEFAULT_RESERVATION_TAB } from '../reservations.config'

const VALID_TAB_IDS = new Set(RESERVATION_TABS.map((t) => t.id))

export function useReservationsTabs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = VALID_TAB_IDS.has(rawTab) ? rawTab : DEFAULT_RESERVATION_TAB

  useEffect(() => {
    if (rawTab && VALID_TAB_IDS.has(rawTab)) return
    setSearchParams({ tab: DEFAULT_RESERVATION_TAB }, { replace: true })
  }, [rawTab, setSearchParams])

  const setActiveTab = (tabId) => {
    if (!VALID_TAB_IDS.has(tabId)) return
    setSearchParams({ tab: tabId }, { replace: true })
  }

  return { activeTab, setActiveTab }
}
