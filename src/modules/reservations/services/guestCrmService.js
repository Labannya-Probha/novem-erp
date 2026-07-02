import { supabase } from '../../../supabase'
import { withTenantScope } from '../../../lib/companySettings'

export async function getGuestCrmSummary() {
  const [guestCountRes, vipRes] = await Promise.all([
    withTenantScope(supabase.from('guests').select('id', { count: 'exact', head: true })),
    withTenantScope(supabase.from('v_guest_profile').select('id', { count: 'exact', head: true }).gte('loyalty_points', 2000)),
  ])

  const error = guestCountRes.error || vipRes.error
  if (error) throw error

  return {
    guests: guestCountRes.count || 0,
    vipGuests: vipRes.count || 0,
  }
}
