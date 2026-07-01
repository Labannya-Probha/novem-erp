import DrawerForm from '../../../components/forms/DrawerForm'

export default function StockMovementDrawer({
  open,
  onOpenChange,
  title = 'Stock Movement',
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
