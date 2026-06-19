import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  fmtBDT, fmtDate, todayISO, nightsBetween, eachNight,
  rateFor, computeCharge, sumCharges, applyRounding, STATUS_COLORS,
} from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import RegistrationCard from '../components/print/RegistrationCard.jsx'
import GuestBill from '../components/print/GuestBill.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import Quotation from '../components/print/Quotation.jsx'
import {
  ArrowLeft, MessageCircle, Mail, CheckCircle2, LogIn, BedDouble,
  Plus, Trash2, Printer, FileDown, Receipt, BadgeCheck, Ban, BadgePercent, Pencil, Save,
} from 'lucide-react'

const TABS = ['Overview', 'Check-In', 'Billings & Check-Out', 'Partners']

export default function ReservationDetail({ id, back, userName, isAdmin }) {
  const [res, setRes] = useState(null)
  const [guest, setGuest] = useState(null)
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
  const [searchParams] = useSearchParams()
  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'Overview'
  const [tab, setTab] = useState(initialTab)
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')

  const loadAll = async () => {
    const { data: r } = await supabase.from('reservations').select('*, agencies(*), shareholders(*)').eq('id', id).single()
    setRes(r)
    if (r?.primary_guest_id) {
      const { data: g } = await supabase.from('guests').select('*').eq('id', r.primary_guest_id).single()
      setGuest(g)
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
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('guest_ids').select('*').eq('reservation_id', id).order('created_at'),
    ])
    setResGuests(rg || []); setResRooms(rr || []); setRooms(rm || [])
    setCharges(ch || []); setPayments(pm || []); setInvoices(inv || [])
    setAddons(ad || []); setTaxConfig(tc || []); setCompany(co); setGuestIds(gi || [])
  }

  useEffect(() => { loadAll() }, [id])

  const totals = useMemo(() => applyRounding(sumCharges(charges), company?.rounding_mode || 'NEAREST_1'), [charges, company])
  const paid = useMemo(() => payments.reduce((a, p) => a + Number(p.amount), 0), [payments])
  const due = +(totals.grand_total - paid).toFixed(2)
  const nights = res ? nightsBetween(res.check_in, res.check_out) : 0

  const setStatus = async (status, extra = {}) => {
    await supabase.from('reservations').update({ status, ...extra }).eq('id', id)
    await loadAll()
  }

  if (!res) return <div className="text-pine/50">Loading…</div>

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  return (
    <div>
      <button className="btn-ghost mb-4" onClick={back}><ArrowLeft size={15} /> All reservations</button>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <Overview
          res={res} guest={guest} resRooms={resRooms} resGuests={resGuests} setStatus={setStatus}
          payments={payments} advance={paid} flash={flash} isAdmin={isAdmin} userName={userName}
          addons={addons} taxConfig={taxConfig} reload={loadAll}
          nights={nights} company={company} setPrintDoc={setPrintDoc}
        />
      )}

      {tab === 'Check-In' && <CheckInTab />}
      {tab === 'Billings & Check-Out' && <BillingsAndCheckOutTab />}
      {tab === 'Partners' && <PartnerAccounts />}

      {printDoc?.type === 'QUOTE' && (
        <PrintPortal title="Quotation" onClose={() => setPrintDoc(null)}>
          <Quotation
            res={res}
            guest={guest}
            terms={printDoc.terms}
            roomRate={printDoc.roomRate}
            roomCount={printDoc.roomCount}
            discountPct={printDoc.discountPct}
            validDays={printDoc.validDays}
            taxConfig={taxConfig}
            company={company}
            resRooms={resRooms}
          />
        </PrintPortal>
      )}
    </div>
  )
}
