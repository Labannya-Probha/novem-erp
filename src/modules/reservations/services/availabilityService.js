import { supabase } from '../../../supabase'
import { nightsBetween, todayISO } from '../../../lib/helpers'
import { withTenantScope } from '../../../lib/companySettings'

const ACTIVE_RESERVATION_STATUSES = ['QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'HOLD']

function normalizeRoomType(room) {
  return room.room_type || 'Unassigned'
}

function nextDay(date) {
  const instance = new Date(`${date}T00:00:00`)
  instance.setDate(instance.getDate() + 1)
  return instance.toISOString().slice(0, 10)
}

export function createAvailabilityFilters(overrides = {}) {
  const checkIn = overrides.checkIn || todayISO()
  const checkOut = overrides.checkOut || nextDay(checkIn)

  return {
    checkIn,
    checkOut,
    roomType: overrides.roomType || '',
    roomCount: overrides.roomCount || '1',
    pax: overrides.pax || '1',
    ratePlan: overrides.ratePlan || 'BAR',
  }
}

export async function getAvailabilityPreview(filters) {
  const roomCount = Math.max(1, Number(filters.roomCount || 1))
  const checkIn = filters.checkIn || todayISO()
  const checkOut = filters.checkOut || nextDay(checkIn)
  const totalNights = Math.max(1, nightsBetween(checkIn, checkOut) || 1)

  const roomsRes = await withTenantScope(
    supabase.from('rooms')
      .select('id, room_no, room_name, room_type, base_rate, hk_status, is_active')
      .eq('is_active', true)
      .order('room_no')
  )

  if (roomsRes.error) throw roomsRes.error

  const roomTypeOptions = [...new Set((roomsRes.data || []).map((room) => normalizeRoomType(room)))].sort()
  const roomRows = (roomsRes.data || []).filter((room) => !filters.roomType || normalizeRoomType(room) === filters.roomType)

  const reservationRoomsRes = await withTenantScope(
    supabase.from('reservation_rooms')
      .select('room_id, reservations!inner(status, check_in, check_out)')
      .in('reservations.status', ACTIVE_RESERVATION_STATUSES)
      .lt('from_date', checkOut)
      .gt('to_date', checkIn)
  )

  if (reservationRoomsRes.error) throw reservationRoomsRes.error

  const bookedRoomIds = new Set((reservationRoomsRes.data || []).map((row) => row.room_id).filter(Boolean))
  const grouped = roomRows.reduce((accumulator, room) => {
    const key = normalizeRoomType(room)
    const current = accumulator.get(key) || { roomType: key, rooms: [] }
    current.rooms.push(room)
    accumulator.set(key, current)
    return accumulator
  }, new Map())

  const results = Array.from(grouped.values()).map((group) => {
    const availableRooms = group.rooms.filter((room) => !bookedRoomIds.has(room.id))
    const suggestedRooms = availableRooms.slice(0, roomCount)
    const baseRate = Math.round(
      group.rooms.reduce((sum, room) => sum + Number(room.base_rate || 0), 0) / Math.max(group.rooms.length, 1)
    )
    const estimatedTotal = baseRate * totalNights * roomCount

    return {
      id: group.roomType,
      roomType: group.roomType,
      availableRooms: availableRooms.length,
      baseRate,
      discount: 0,
      finalRate: baseRate,
      totalNights,
      estimatedTotal,
      suggestedRooms: suggestedRooms.map((room) => room.room_no).join(', ') || 'Waitlist',
      suggestedPackage: filters.ratePlan === 'CORPORATE' ? 'Corporate Stay' : 'Standard Stay',
      roomCount,
      blockedRooms: group.rooms.filter((room) => String(room.hk_status || '').toUpperCase() === 'BLOCKED').length,
      outOfOrderRooms: group.rooms.filter((room) => String(room.hk_status || '').toUpperCase() === 'OUT_OF_ORDER').length,
    }
  })

  return {
    filters: { ...filters, checkIn, checkOut },
    roomTypeOptions,
    results,
  }
}
