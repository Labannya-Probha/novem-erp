import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'

export default function AlertsPanel({ alerts = [] }) {
  if (!alerts.length) return null

  return (
    <section className="space-y-2">
      {alerts.map((alert) => (
        <Alert key={alert.id} variant={alert.variant || 'default'}>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.description}</AlertDescription>
        </Alert>
      ))}
    </section>
  )
}
