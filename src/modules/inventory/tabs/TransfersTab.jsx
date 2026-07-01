import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function TransfersTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="transfers"
      onTabIdChange={onTabChange}
    />
  )
}
