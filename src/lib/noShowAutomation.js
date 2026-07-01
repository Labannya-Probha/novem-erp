export const NO_SHOW_CUTOFF_HOUR = 12
export const NO_SHOW_CUTOFF_MINUTE = 5
const CHECK_IN_BLOCKED_STATUSES = ['CHECKED_IN', 'CHECKED_OUT', 'SETTLED']

export function canManualCheckIn(status) {
  return !CHECK_IN_BLOCKED_STATUSES.includes(status)
}

export function getCheckInActionCopy(status) {
  if (status === 'NO_SHOW') {
    return {
      label: 'Override no-show & check in',
      hint: 'Auto no-show after 12:05 PM can still be manually overridden by staff check-in.',
    }
  }
  return {
    label: 'Check in guest',
    hint: '',
  }
}

export function localISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNoShowCutoff(checkInDate) {
  const cutoff = new Date(`${checkInDate}T00:00:00`)
  cutoff.setHours(NO_SHOW_CUTOFF_HOUR, NO_SHOW_CUTOFF_MINUTE, 0, 0)
  return cutoff
}

export function shouldAutoNoShow({ status, check_in }, now = new Date()) {
  if (status !== 'CONFIRMED' || !check_in) return false
  return localISODate(now) === check_in && now >= getNoShowCutoff(check_in)
}

export async function runAutoNoShowSweep(runAt = new Date()) {
  const { supabase } = await import('../supabase.js')
  const { data, error } = await supabase.rpc('auto_mark_reservation_no_shows', {
    p_now: runAt.toISOString(),
  })
  if (error) throw error
  return Number(data || 0)
}
