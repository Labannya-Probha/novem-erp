import DrawerForm from 'src/components/forms/DrawerForm'

export default function KotPreviewDrawer({ open = false, onClose, children }) {
  return (
    <DrawerForm
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.() }}
      title="KOT Preview"
    >
      {children}
    </DrawerForm>
  )
}
