import MenuManagement from 'src/pages/MenuManagement.jsx'

export default function MenuManagementTab({ isAdmin, canManageMenu }) {
  if (!canManageMenu) {
    return (
      <div className="card p-6">
        <h3 className="text-base font-semibold text-pine">Menu Management</h3>
        <p className="mt-1 text-sm text-pine/60">You do not have access to this tab.</p>
      </div>
    )
  }

  return <MenuManagement isAdmin={isAdmin} />
}

