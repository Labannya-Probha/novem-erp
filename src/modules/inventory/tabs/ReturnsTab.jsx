import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function ReturnsTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="returns"
      onTabIdChange={onTabChange}
    />
  )
}
