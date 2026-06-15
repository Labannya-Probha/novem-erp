import { useEffect, useMemo, useState } from 'react'
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
import { exportXLSX } from '../lib/helpers'
import {
  ArrowLeft, MessageCircle, Mail, CheckCircle2, LogIn, BedDouble,
  Plus, Trash2, Printer, FileDown, Receipt, BadgeCheck, Ban, BadgePercent,
} from 'lucide-react'

const TABS = ['Overview', 'Quotation', 'Check-In', 'Folio & Payments', 'Invoices']

export default function ReservationDetail({ id, back, userName, isAdmin }) {
  const [res, setRes] = useState(null)
  const [guest, setGuest] = useState(null)
  const [resGuests, setResGuests] = useState([])
  const [resRooms, setResRooms] = useState([])
  const [rooms, setRooms] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')

  const loadAll = async () => {
    const { data: r } = await supabase.from('reservations').select('*').eq('id', id).single()
    setRes(r)
    if (r?.primary_guest_id) {
      const { data: g } = await supabase.from('guests').select('*').eq('id', r.primary_guest_id).single()
      setGuest(g)
    }
    const [{ data: rg }, { data: rr }, { data: rm }, { data: ch }, { data: pm }, { data: inv }, { data: tc }, { data: co }] =
      await Promise.all([
        supabase.from('reservation_guests').select('*').eq('reservation_id', id).order('is_primary', { ascending: false }),
        supabase.from('reservation_rooms').select('*, rooms(*)').eq('reservation_id', id),
        supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
        supabase.from('folio_charges').select('*').eq('reservation_id', id).order('charge_date'),
        supabase.from('payments').select('*').eq('reservation_id', id).order('received_date'),
        supabase.from('invoices').select('*').eq('reservation_id', id).order('created_at'),
        supabase.from('tax_config').select('*'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ])
    setResGuests(rg || []); setResRooms(rr || []); setRooms(rm || [])
    setCharges(ch || []); setPayments(pm || []); setInvoices(inv || [])
    setTaxConfig(tc || []); setCompany(co)
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
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-pine">{res.reservation_name || guest?.full_name}</h1>
            <span className={`status-chip ${STATUS_COLORS[res.status]}`}>{res.status.replace('_', ' ')}</span>
          </div>
          <p className="text-sm text-pine/60 money mt-1">
            {res.res_no} · {fmtDate(res.check_in)} → {fmtDate(res.check_out)} · {nights} night{nights !== 1 && 's'}
          </p>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Quotation' && <QuotationTab res={res} guest={guest} taxConfig={taxConfig} company={company} reload={loadAll} flash={flash} userName={userName} resRooms={resRooms} setPrintDoc={setPrintDoc} />}
      {tab === 'Folio & Payments' && <FolioTab res={res} charges={charges} payments={payments} resRooms={resRooms} taxConfig={taxConfig} reload={loadAll} userName={userName} totals={totals} paid={paid} due={due} flash={flash} isAdmin={isAdmin} />}
      {/* বাকি ট্যাবগুলো আপনার আগের মতো রাখুন */}
    </div>
  )
}

function QuotationTab({ res, guest, taxConfig, company, reload, flash, userName, resRooms = [], setPrintDoc }) {
  const [disc, setDisc] = useState(Number(res.discount_pct) || 0)
  const [validDays, setValidDays] = useState(7)
  const [terms, setTerms] = useState(res.terms_conditions || company?.terms_conditions || '')

  const printQuote = () => setPrintDoc({ type: 'QUOTE', terms, discountPct: disc, validDays })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Build quotation</h3>
        <button className="btn-amber justify-center" onClick={printQuote}><Printer size={16} /> PDF Quotation</button>
      </div>
    </div>
  )
}

function FolioTab({ res, charges, payments, resRooms, taxConfig, reload, userName, totals, paid, due, flash, isAdmin }) {
  
  const buildRoomRows = () => {
    const rows = []
    for (const rr of resRooms) {
      const ci = rr.from_date || res.check_in
      const co = rr.to_date || res.check_out
      for (const night of eachNight(ci, co)) {
        const rate = rateFor(taxConfig, 'ROOM', night)
        rows.push({ 
          reservation_id: res.id, 
          charge_date: night, 
          charge_type: 'ROOM', 
          description: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''} — Night of ${fmtDate(night)}`, 
          ...computeCharge(rr.rate, res.discount_pct, rate), 
          created_by: userName 
        })
      }
    }
    return rows
  }

  return (
    <div className="space-y-4">
      <button className="btn-ghost" onClick={async () => {
        const rows = buildRoomRows();
        await supabase.from('folio_charges').delete().eq('reservation_id', res.id).eq('charge_type', 'ROOM');
        await supabase.from('folio_charges').insert(rows);
        await reload();
      }}>Repost room charges</button>
    </div>
  )
}
