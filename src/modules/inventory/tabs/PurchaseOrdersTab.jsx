import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function PurchaseOrdersTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="purchase-orders"
      onTabIdChange={onTabChange}
    />
  )
}
