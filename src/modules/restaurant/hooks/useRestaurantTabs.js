import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PATHS } from 'src/app/paths'
import { RESTAURANT_TAB_ORDER, RESTAURANT_TABS } from '../restaurant.config'

const DEFAULT_TAB = 'pos'

export function useRestaurantTabs({ canManageMenu = false } = {}) {
  const location = useLocation()
  const navigate = useNavigate()

  const requestedTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab')
    if (!tab) return DEFAULT_TAB
    if (!RESTAURANT_TAB_ORDER.includes(tab)) return DEFAULT_TAB
    if (tab === 'menu' && !canManageMenu) return DEFAULT_TAB
    return tab
  }, [canManageMenu, location.search])

  const tabs = useMemo(
    () => RESTAURANT_TABS.map((tab) => (
      tab.id === 'menu'
        ? { ...tab, disabled: !canManageMenu }
        : tab
    )),
    [canManageMenu],
  )

  const setTab = useCallback((tabId) => {
    const targetTab = RESTAURANT_TAB_ORDER.includes(tabId) ? tabId : DEFAULT_TAB
    const safeTab = targetTab === 'menu' && !canManageMenu ? DEFAULT_TAB : targetTab
    navigate(`${PATHS.RESTAURANT}?tab=${safeTab}`, { replace: true })
  }, [canManageMenu, navigate])

  return { activeTab: requestedTab, tabs, setTab }
}

