import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, STATUS_COLORS } from '../lib/helpers'
import { LogIn, LogOut, BedDouble, Wallet } from 'lucide-react'

export default function Dashboard({ openReservation }) {
  const [arrivals, setArrivals] = useState([])
  const [departures, setDepartures] = useState([])
  const [inHouse, setInHouse] = useState(0)
  const [dues, setDues] = useState(0)
  const today = todayISO()

  useEffect(() => {
    const load = async () => {
      const { data: arr } = await supabase.from('reservations')
        .select('id,res_no,reservation_name,check_in,check_out,status, guests:primary_guest_id(full_name)')
        .eq('check_in', today).in('status', ['QUERY', 'QUOTED', 'CONFIRMED'])
      setArrivals(arr || [])
      const { data: dep } = await supabase.from('reservations')
        .select('id,res_no,reservation_name,check_in,check_out,status, guests:primary_guest_id(full_name)')
        .eq('check_out', today).eq('status', 'CHECKED_IN')
      setDepartures(dep || [])
      const { count } = await supabase.from('reservations')
        .select('id', { count: 'exact', head: true }).eq('status', 'CHECKED_IN')
      setInHouse(count || 0)
      const { data: bills } = await supabase.from('v_billing_summary')
        .select('due_total,status').in('status', ['CHECKED_IN', 'CHECKED_OUT'])
      setDues((bills || []).reduce((a, b) => a + Number(b.due_total || 0), 0))
    }
    load()
  }, [])

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}><Icon size={20} /></div>
      <div>
        <div className="text-xs uppercase tracking-wider text-pine/60 font-semibold">{label}</div>
        <div className="text-2xl font-display font-bold text-pine money">{value}</div>
      </div>
    </div>
  )

  const List = ({ title, rows, empty }) => (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-pine mb-3">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-pine/50">{empty}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <button key={r.id} onClick={() => openReservation(r.id)}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-leaf hover:bg-leaf/40 text-left">
            <div>
              <div className="font-semibold text-sm">{r.reservation_name || r.guests?.full_name || '—'}</div>
              <div className="text-xs text-pine/60 money">{r.res_no} · {fmtDate(r.check_in)} → {fmtDate(r.check_out)}</div>
            </div>
            <span className={`status-chip ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Front Office — {fmtDate(today)}</h1>
      <p className="text-sm text-pine/60 mb-6">The day at a glance.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat icon={LogIn} label="Arrivals today" value={arrivals.length} accent="bg-forest/15 text-forest" />
        <Stat icon={LogOut} label="Departures today" value={departures.length} accent="bg-amber/15 text-amber" />
        <Stat icon={BedDouble} label="In-house" value={inHouse} accent="bg-pine/10 text-pine" />
        <Stat icon={Wallet} label="Outstanding dues" value={fmtBDT(dues)} accent="bg-red-50 text-red-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <List title="Expected arrivals" rows={arrivals} empty="No arrivals expected today." />
        <List title="Due to check out" rows={departures} empty="No departures due today." />
      </div>
    </div>
  )
}
