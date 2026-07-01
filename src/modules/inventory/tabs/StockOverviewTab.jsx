import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function StockOverviewTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="stock"
      onTabIdChange={onTabChange}
    />
  )
}
