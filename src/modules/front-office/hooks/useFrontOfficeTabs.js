import { useSearchParams } from 'react-router-dom'
import { FRONT_OFFICE_TABS, DEFAULT_FRONT_OFFICE_TAB } from '../frontOffice.config'

const VALID_TAB_IDS = new Set(FRONT_OFFICE_TABS.map((t) => t.id))

export function useFrontOfficeTabs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = VALID_TAB_IDS.has(rawTab) ? rawTab : DEFAULT_FRONT_OFFICE_TAB

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true })
  }

  return { activeTab, setActiveTab }
}
