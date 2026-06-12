import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gwllsoembqacolzfrquu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bGxzb2VtYnFhY29semZycXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODEwMzMsImV4cCI6MjA5Njc1NzAzM30.J1hfY_IxmtQzlCgpy_IzcRK6eR_cVcwuLwm201LrDJc'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  try {
    const { data: co, error: e1 } = await supabase.from('company_settings').select('*').limit(1)
    console.log('company_settings columns:', co && co.length > 0 ? Object.keys(co[0]) : 'No records or unable to read columns', e1 || '')

    const { data: ch, error: e2 } = await supabase.from('folio_charges').select('*').limit(1)
    console.log('folio_charges columns:', ch && ch.length > 0 ? Object.keys(ch[0]) : 'No records or unable to read columns', e2 || '')

    const { data: res, error: e3 } = await supabase.from('reservations').select('*').limit(1)
    console.log('reservations columns:', res && res.length > 0 ? Object.keys(res[0]) : 'No records or unable to read columns', e3 || '')

    const { data: pos, error: e4 } = await supabase.from('pos_orders').select('*').limit(1)
    console.log('pos_orders columns:', pos && pos.length > 0 ? Object.keys(pos[0]) : 'No records or unable to read columns', e4 || '')
  } catch (err) {
    console.error(err)
  }
}

test()
