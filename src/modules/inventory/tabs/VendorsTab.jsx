import InventoryHub from '../../../pages/InventoryHub.jsx'

export default function VendorsTab({ userName, role, isAdmin, onTabChange }) {
  return (
    <InventoryHub
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      embedded
      controlledTabId="vendors"
      onTabIdChange={onTabChange}
    />
  )
}
