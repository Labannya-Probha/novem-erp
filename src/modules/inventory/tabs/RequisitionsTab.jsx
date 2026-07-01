import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function RequisitionsTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="requisitions"
      onTabIdChange={onTabChange}
    />
  )
}
