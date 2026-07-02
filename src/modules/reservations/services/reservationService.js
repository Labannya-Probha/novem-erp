import { supabase } from '../../../supabase'
import { todayISO } from '../../../lib/helpers'
import { withTenantScope } from '../../../lib/companySettings'

const ACTIVE_STATUS_FILTER = ['CONFIRMED', 'CHECKED_IN', 'HOLD']

export async function getReservationCount() {
  const { count = 0, error } = await withTenantScope(
    supabase.from('reservations').select('id', { count: 'exact', head: true })
  )

  if (error) throw error
  return count
}

export async function getReservationKpis(referenceDate = todayISO()) {
  const [
    arrivalsRes,
    departuresRes,
    inHouseRes,
    noShowsRes,
    roomsRes,
    occupiedRes,
    pendingReservationsCountRes,
  ] = await Promise.all([
    withTenantScope(
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('check_in', referenceDate)
        .in('status', ACTIVE_STATUS_FILTER)
    ),
    withTenantScope(
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('check_out', referenceDate)
        .in('status', ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'])
    ),
    withTenantScope(
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('status', 'CHECKED_IN')
    ),
    withTenantScope(
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('check_in', referenceDate)
        .eq('status', 'NO_SHOW')
    ),
    withTenantScope(
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ),
    withTenantScope(
      supabase.from('reservations')
        .select('id, reservation_rooms(room_id)')
        .lte('check_in', referenceDate)
        .gt('check_out', referenceDate)
        .in('status', ACTIVE_STATUS_FILTER)
    ),
    withTenantScope(
      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
    ),
  ])

  const error = [arrivalsRes, departuresRes, inHouseRes, noShowsRes, roomsRes, occupiedRes, pendingReservationsCountRes]
    .map((result) => result.error)
    .find(Boolean)

  if (error) throw error

  const occupiedRoomIds = new Set(
    (occupiedRes.data || [])
      .flatMap((reservation) => reservation.reservation_rooms || [])
      .map((room) => room.room_id)
      .filter(Boolean)
  )

  const pendingReservationCount = pendingReservationsCountRes.count || 0
  let pendingPayments = pendingReservationCount

  if (pendingReservationCount) {
    const paymentsRes = await withTenantScope(
      supabase.from('payments')
        .select('reservation_id, reservations!inner(status)')
        .in('reservations.status', ['CONFIRMED', 'CHECKED_IN'])
    )

    if (paymentsRes.error) throw paymentsRes.error

    const paidReservationIds = new Set((paymentsRes.data || []).map((payment) => payment.reservation_id).filter(Boolean))
    pendingPayments = Math.max(0, pendingReservationCount - paidReservationIds.size)
  }

  return {
    todayArrivals: arrivalsRes.count || 0,
    todayDepartures: departuresRes.count || 0,
    inHouse: inHouseRes.count || 0,
    availableRooms: Math.max(0, (roomsRes.count || 0) - occupiedRoomIds.size),
    pendingPayments,
    noShows: noShowsRes.count || 0,
  }
}
