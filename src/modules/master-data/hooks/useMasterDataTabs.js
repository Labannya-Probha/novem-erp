import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_MASTER_DATA_TAB,
  MASTER_DATA_TAB_IDS,
  MASTER_DATA_LEGACY_TAB_MAP,
} from '../masterData.config'

const normalizeTab = (value) => {
  if (!value) return DEFAULT_MASTER_DATA_TAB
  if (MASTER_DATA_TAB_IDS.has(value)) return value
  return MASTER_DATA_LEGACY_TAB_MAP[value] || DEFAULT_MASTER_DATA_TAB
}

export function useMasterDataTabs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = normalizeTab(rawTab)

  useEffect(() => {
    if (rawTab !== activeTab) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tab', activeTab)
      setSearchParams(nextParams, { replace: true })
    }
  }, [rawTab, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveTab = (tabId) => {
    const next = normalizeTab(tabId)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    if (next !== 'agencies-shareholders') {
      nextParams.delete('entity')
    }
    setSearchParams(nextParams, { replace: true })
  }

  return { activeTab, setActiveTab }
}
