import DrawerForm from '../../../components/forms/DrawerForm'
import ReportListPanel from './ReportListPanel'

export default function ReportFilterDrawer({ open, onOpenChange, items, activeReportCode, onSelectReport }) {
  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Reports panel"
      subtitle="Choose a report or use legacy report links."
      size="md"
    >
      <ReportListPanel items={items} activeReportCode={activeReportCode} onSelectReport={onSelectReport} />
    </DrawerForm>
  )
}
