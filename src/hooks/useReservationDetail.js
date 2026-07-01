import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { applyRounding, nightsBetween, sumCharges } from '../lib/helpers'

export default function useReservationDetail(id) {
  const [res, setRes] = useState(null)
  const [guest, setGuest] = useState(null)
  const [guestCompany, setGuestCompany] = useState(null)
  const [resGuests, setResGuests] = useState([])
  const [guestIds, setGuestIds] = useState([])
  const [resRooms, setResRooms] = useState([])
  const [rooms, setRooms] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [addons, setAddons] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)

  const loadAll = useCallback(async () => {
    const { data: r } = await supabase
      .from('reservations')
      .select('*, agencies(*), shareholders(*)')
      .eq('id', id)
      .single()
    setRes(r)
    if (r?.primary_guest_id) {
      const { data: g } = await supabase.from('guests').select('*').eq('id', r.primary_guest_id).single()
      setGuest(g)
    } else {
      setGuest(null)
    }
    if (r?.company_id) {
      const { data: gc } = await supabase.from('companies').select('*').eq('id', r.company_id).maybeSingle()
      setGuestCompany(gc)
    } else {
      setGuestCompany(null)
    }
    const [
      { data: rg }, { data: rr }, { data: rm }, { data: ch },
      { data: pm }, { data: inv }, { data: ad }, { data: tc }, { data: co }, { data: gi },
    ] = await Promise.all([
      supabase.from('reservation_guests').select('*').eq('reservation_id', id).order('is_primary', { ascending: false }),
      supabase.from('reservation_rooms').select('*, rooms(*)').eq('reservation_id', id),
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
      supabase.from('folio_charges').select('*').eq('reservation_id', id).order('charge_date'),
      supabase.from('payments').select('*').eq('reservation_id', id).order('received_date'),
      supabase.from('invoices').select('*').eq('reservation_id', id).order('created_at', { ascending: false }),
      supabase.from('reservation_addons').select('*').eq('reservation_id', id).order('created_at'),
      supabase.from('tax_config').select('*'),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('guest_ids').select('*').eq('reservation_id', id).order('created_at'),
    ])
    setResGuests(rg || [])
    setResRooms(rr || [])
    setRooms(rm || [])
    setCharges(ch || [])
    setPayments(pm || [])
    setInvoices(inv || [])
    setAddons(ad || [])
    setTaxConfig(tc || [])
    setCompany(co)
    setGuestIds(gi || [])
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const totals = useMemo(
    () => applyRounding(sumCharges(charges), company?.rounding_mode || 'NEAREST_1'),
    [charges, company],
  )
  const paid = useMemo(() => payments.reduce((a, p) => a + Number(p.amount), 0), [payments])
  const due = +(totals.grand_total - paid).toFixed(2)
  const nights = res ? nightsBetween(res.check_in, res.check_out) : 0

  return {
    res,
    guest,
    guestCompany,
    resGuests,
    guestIds,
    resRooms,
    rooms,
    charges,
    payments,
    invoices,
    addons,
    taxConfig,
    company,
    loadAll,
    totals,
    paid,
    due,
    nights,
  }
}
