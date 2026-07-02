import StatusBadge from '../../../components/data/StatusBadge'

const STATUS_ALIASES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'cancelled',
  HOLD: 'pending',
  PAID: 'paid',
  DUE: 'due',
  POSTED: 'posted',
  VOID: 'void',
}

export default function ReservationStatusBadge({ status, className }) {
  const normalizedStatus = STATUS_ALIASES[String(status || '').trim().toUpperCase()] || status
  return <StatusBadge status={normalizedStatus} className={className} />
}
