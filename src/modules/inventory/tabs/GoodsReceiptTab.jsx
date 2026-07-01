import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function GoodsReceiptTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="goods-receipt"
      onTabIdChange={onTabChange}
    />
  )
}
