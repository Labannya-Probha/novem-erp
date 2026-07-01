import { useSearchParams } from 'react-router-dom'
import { INVENTORY_TABS, DEFAULT_INVENTORY_TAB } from '../inventory.config'

const VALID_TAB_IDS = new Set(INVENTORY_TABS.map((tab) => tab.id))
const LEGACY_TAB_MAP = {
  'Items & Stock': 'stock',
  Vendors: 'vendors',
  Requisitions: 'requisitions',
  'Purchase Orders': 'purchase-orders',
  'Goods Receipt': 'goods-receipt',
  Transfers: 'transfers',
  Returns: 'returns',
  Consumption: 'consumption',
  'Consumption Entry': 'consumption',
}

const normalizeTab = (value) => {
  if (!value) return DEFAULT_INVENTORY_TAB
  if (VALID_TAB_IDS.has(value)) return value
  return LEGACY_TAB_MAP[value] || DEFAULT_INVENTORY_TAB
}

export function useInventoryTabs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeTab(searchParams.get('tab'))

  const setActiveTab = (tabId) => {
    const next = normalizeTab(tabId)
    setSearchParams({ tab: next }, { replace: true })
  }

  return { activeTab, setActiveTab }
}
