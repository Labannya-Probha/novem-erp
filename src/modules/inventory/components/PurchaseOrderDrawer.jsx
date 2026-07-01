import DrawerForm from '../../../components/forms/DrawerForm'

export default function PurchaseOrderDrawer({
  open,
  onOpenChange,
  title = 'Purchase Order',
  subtitle,
  children,
  footer,
}) {
  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle} footer={footer} size="lg">
      {children}
    </DrawerForm>
  )
}
