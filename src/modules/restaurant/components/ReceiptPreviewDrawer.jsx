import DrawerForm from 'src/components/forms/DrawerForm'

export default function ReceiptPreviewDrawer({ open = false, onClose, children }) {
  return (
    <DrawerForm
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.() }}
      title="Receipt Preview"
    >
      {children}
    </DrawerForm>
  )
}
