import { supabase } from '../../../supabase'
import { withTenantScope } from '../../../lib/companySettings'

export async function getReservationPaymentCount() {
  const { count = 0, error } = await withTenantScope(
    supabase.from('payments').select('id', { count: 'exact', head: true })
  )

  if (error) throw error
  return count
}

export async function getRecentReservationPayments(limit = 10) {
  const { data = [], error } = await withTenantScope(
    supabase.from('payments')
      .select('id, reservation_id, amount, method, received_date, reference')
      .order('received_date', { ascending: false })
      .limit(limit)
  )

  if (error) throw error
  return data
}
