import { useEffect, useState } from 'react'
import { BedDouble, CalendarClock, DoorOpen, HandCoins, LogIn, LogOut } from 'lucide-react'
import KpiStrip from '../../../components/layout/KpiStrip'
import { getReservationKpis } from '../services/reservationService'

const KPI_META = [
  { key: 'todayArrivals', label: 'Today Arrivals', icon: LogIn },
  { key: 'todayDepartures', label: 'Today Departures', icon: LogOut },
  { key: 'inHouse', label: 'In-house', icon: BedDouble },
  { key: 'availableRooms', label: 'Available Rooms', icon: DoorOpen },
  { key: 'pendingPayments', label: 'Pending Payments', icon: HandCoins },
  { key: 'noShows', label: 'No Shows', icon: CalendarClock },
]

export default function ReservationKpiStrip() {
  const [kpis, setKpis] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const nextKpis = await getReservationKpis()
        if (!cancelled) setKpis(nextKpis)
      } catch {
        if (!cancelled) setKpis({})
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <KpiStrip
      loading={!kpis}
      items={KPI_META.map((item) => ({
        label: item.label,
        value: kpis?.[item.key] ?? '—',
        icon: item.icon,
      }))}
    />
  )
}
