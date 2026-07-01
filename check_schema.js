import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables before running this script.')
  process.exit(1)
}

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
