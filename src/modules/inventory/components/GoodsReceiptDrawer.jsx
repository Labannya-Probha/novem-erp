import DrawerForm from '../../../components/forms/DrawerForm'

export default function GoodsReceiptDrawer({
  open,
  onOpenChange,
  title = 'Goods Receipt',
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
