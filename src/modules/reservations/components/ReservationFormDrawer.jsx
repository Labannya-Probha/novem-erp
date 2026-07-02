import { Button } from '../../../components/ui/button'
import DrawerForm from '../../../components/forms/DrawerForm'

const SECTION_TITLES = [
  'Guest Information',
  'Stay Information',
  'Rate & Package',
  'Payment',
  'Notes',
]

export default function ReservationFormDrawer({ open, onOpenChange, actions, children }) {
  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Reservation form"
      subtitle="Reusable AEDS v2 shell for the guided reservation flow."
      size="xl"
      footer={actions || (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button">Save Draft</Button>
          <Button type="button">Confirm Reservation</Button>
        </div>
      )}
    >
      {children || (
        <div className="space-y-4">
          {SECTION_TITLES.map((section) => (
            <section key={section} className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
              <h3 className="font-medium text-foreground">{section}</h3>
              <p className="mt-1 text-sm text-muted-foreground">This shell is ready for gradual migration of the existing reservation form.</p>
            </section>
          ))}
        </div>
      )}
    </DrawerForm>
  )
}
