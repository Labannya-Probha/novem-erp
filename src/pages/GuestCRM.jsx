import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import KPICards from '../components/KPICards.jsx'
import {
  Users, Search, X, Plus, Pencil, Save, Star, Phone, Mail,
  MapPin, CreditCard, Calendar, TrendingUp, Gift, ChevronDown,
  ChevronUp, FileText, BadgeCheck, Filter, Download,
} from 'lucide-react'

/* ── colour helpers ─────────────────────────────────────────────────── */
const TIER_CONFIG = {
  PLATINUM: { min: 5000, label: 'Platinum', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  GOLD:     { min: 2000, label: 'Gold',     bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-300' },
  SILVER:   { min: 500,  label: 'Silver',   bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-300' },
  BRONZE:   { min: 0,    label: 'Bronze',   bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
}
const getTier = (pts) => {
  if (pts >= 5000) return TIER_CONFIG.PLATINUM
  if (pts >= 2000) return TIER_CONFIG.GOLD
  if (pts >= 500)  return TIER_CONFIG.SILVER
  return TIER_CONFIG.BRONZE
}

const PRESET_PREFERENCES = [
  'Quiet room','High floor','Low floor','Twin beds','King bed',
  'Extra pillows','Extra blanket','Early check-in','Late check-out',
  'Airport pickup','Vegan meals','Vegetarian','Halal meals',
  'No smoking','Accessible room','Baby cot','Honeymoon setup',
]

/* ================================================================== */
/*  ROOT                                                                */
/* ================================================================== */
export default function GuestCRM({ userName, isAdmin, role }) {
  const [guests, setGuests]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [tierFilter, setTierFilter] = useState('ALL')
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [msg, setMsg]             = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const canEdit = isAdmin || role === 'MANAGER'

  const loadGuests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('v_guest_profile')
      .select('*')
      .order('full_name')
    setGuests(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadGuests() }, [loadGuests])

  /* filter */
  const filtered = guests.filter((g) => {
    const matchQ = !q || [g.full_name, g.phone, g.email, g.customer_id]
      .join(' ').toLowerCase().includes(q.toLowerCase())
    const matchTier = tierFilter === 'ALL' || getTier(g.loyalty_points || 0).label.toUpperCase() === tierFilter
    return matchQ && matchTier
  })

  /* stats */
  const stats = {
    total:    guests.length,
    active:   guests.filter(g => g.active_stays > 0).length,
    platinum: guests.filter(g => (g.loyalty_points || 0) >= 5000).length,
    gold:     guests.filter(g => (g.loyalty_points || 0) >= 2000 && (g.loyalty_points || 0) < 5000).length,
  }

  /* export CSV */
  const exportCSV = () => {
    const headers = ['Customer ID','Full Name','Phone','Email','Bookings','Total Spend','Loyalty Pts','Tier','Last Stay']
    const rows = filtered.map(g => [
      g.customer_id || '', g.full_name, g.phone || '', g.email || '',
      g.booking_count, g.total_spend, g.loyalty_points || 0,
      getTier(g.loyalty_points || 0).label, g.last_stay_date || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `guests-${todayISO()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
            <Users className="text-forest" /> Guest CRM
          </h1>
          <p className="text-sm text-pine/60">Guest profiles, stay history, loyalty points & preferences.</p>
        </div>
        <button onClick={exportCSV} className="btn-ghost text-sm">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total guests', value: stats.total, icon: Users, color: 'bg-pine/10 text-pine' },
          { label: 'In-house now', value: stats.active, icon: BadgeCheck, color: 'bg-forest/10 text-forest' },
          { label: 'Platinum tier', value: stats.platinum, icon: Star, color: 'bg-slate-100 text-slate-700' },
          { label: 'Gold tier', value: stats.gold, icon: Star, color: 'bg-amber-50 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color} flex items-center gap-3`}>
            <s.icon size={20} className="shrink-0 opacity-70" />
            <div>
              <div className="text-2xl font-display font-bold">{s.value}</div>
              <div className="text-xs font-medium opacity-70">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/30" />
          <input
            className="input pl-9 w-full"
            placeholder="Search name, phone, CUST ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/30 hover:text-pine">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-pine/40" />
          {['ALL', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'].map((t) => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tierFilter === t ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/60 hover:bg-leaf/50'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-pine/40">{filtered.length} guests</span>
      </div>

      {/* Guest list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-pine/40">Loading guests…</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Customer</th>
                    <th className="th">Contact</th>
                    <th className="th text-center">Stays</th>
                    <th className="th text-right">Total spend</th>
                    <th className="th text-right">Loyalty pts</th>
                    <th className="th">Tier</th>
                    <th className="th">Last stay</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const tier = getTier(g.loyalty_points || 0)
                    return (
                      <tr key={g.id} className="hover:bg-leaf/20 cursor-pointer"
                        onClick={() => setSelectedGuest(g)}>
                        <td className="td">
                          <div className="font-semibold text-sm">{g.full_name}</div>
                          {g.customer_id && (
                            <div className="font-mono text-[10px] text-pine/50 bg-pine/5 px-1.5 py-0.5 rounded w-fit mt-0.5">
                              {g.customer_id}
                            </div>
                          )}
                        </td>
                        <td className="td text-sm">
                          <div className="text-pine/70">{g.phone || '—'}</div>
                          <div className="text-xs text-pine/40 truncate max-w-[150px]">{g.email || ''}</div>
                        </td>
                        <td className="td text-center money font-semibold">{g.booking_count || 0}</td>
                        <td className="td text-right money font-semibold text-forest">{fmtBDT(g.total_spend || 0)}</td>
                        <td className="td text-right money font-bold">{g.loyalty_points || 0}</td>
                        <td className="td">
                          <span className={`status-chip text-xs font-semibold border ${tier.bg} ${tier.text} ${tier.border}`}>
                            {tier.label}
                          </span>
                        </td>
                        <td className="td text-sm text-pine/60">{g.last_stay_date ? fmtDate(g.last_stay_date) : '—'}</td>
                        <td className="td">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedGuest(g) }}
                            className="btn-ghost !py-1 !px-2 text-xs"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td className="td text-center text-pine/40 py-8" colSpan={8}>
                      No guests found.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-leaf">
              {filtered.map((g) => {
                const tier = getTier(g.loyalty_points || 0)
                return (
                  <div key={g.id} onClick={() => setSelectedGuest(g)}
                    className="p-4 cursor-pointer active:bg-leaf/30">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="font-semibold text-sm">{g.full_name}</div>
                        {g.customer_id && (
                          <span className="font-mono text-[10px] text-pine/50">{g.customer_id}</span>
                        )}
                      </div>
                      <span className={`status-chip text-xs border ${tier.bg} ${tier.text} ${tier.border}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="text-xs text-pine/60 flex gap-3 flex-wrap">
                      <span>{g.phone || '—'}</span>
                      <span>{g.booking_count || 0} stays</span>
                      <span className="text-forest font-semibold">{fmtBDT(g.total_spend || 0)}</span>
                      <span>{g.loyalty_points || 0} pts</span>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-pine/40 text-sm">No guests found.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Guest detail panel */}
      {selectedGuest && (
        <GuestDetailPanel
          guestId={selectedGuest.id}
          onClose={() => setSelectedGuest(null)}
          onSaved={() => { loadGuests(); flash('Guest profile updated.') }}
          canEdit={canEdit}
          isAdmin={isAdmin}
          userName={userName}
        />
      )}
    </div>
  )
}

/* ================================================================== */
/*  GUEST DETAIL PANEL — full profile, stay history, loyalty, prefs    */
/* ================================================================== */
function GuestDetailPanel({ guestId, onClose, onSaved, canEdit, isAdmin, userName }) {
  const [profile, setProfile]   = useState(null)
  const [stays, setStays]       = useState([])
  const [ledger, setLedger]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [showLedger, setShowLedger] = useState(false)
  const [showStays, setShowStays]   = useState(true)
  const [ptForm, setPtForm]     = useState({ change: '', reason: 'MANUAL' })
  const [prefInput, setPrefInput] = useState('')
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', address: '',
    birthday: '', anniversary_date: '', preferences: [], notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: s }, { data: l }] = await Promise.all([
      supabase.from('v_guest_profile').select('*').eq('id', guestId).single(),
      supabase.from('reservations')
        .select('id,res_no,check_in,check_out,status,reservation_rooms(rooms(room_no))')
        .eq('primary_guest_id', guestId)
        .order('check_in', { ascending: false })
        .limit(20),
      supabase.from('loyalty_ledger')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    if (p) {
      setProfile(p)
      setForm({
        full_name:        p.full_name || '',
        phone:            p.phone || '',
        email:            p.email || '',
        address:          p.address || '',
        birthday:         p.birthday || '',
        anniversary_date: p.anniversary_date || '',
        preferences:      p.preferences || [],
        notes:            p.notes || '',
      })
    }
    setStays(s || [])
    setLedger(l || [])
    setLoading(false)
  }, [guestId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.full_name.trim()) { flash('Full name is required.'); return }
    setBusy(true)
    const { error } = await supabase.from('guests').update({
      full_name:        form.full_name.trim(),
      phone:            form.phone,
      email:            form.email,
      address:          form.address,
      birthday:         form.birthday || null,
      anniversary_date: form.anniversary_date || null,
      preferences:      form.preferences,
      notes:            form.notes,
    }).eq('id', guestId)
    setBusy(false)
    if (error) { flash(error.message); return }
    setEditing(false)
    await load()
    onSaved?.()
  }

  const addPreference = (pref) => {
    if (!pref.trim() || form.preferences.includes(pref.trim())) return
    setForm(p => ({ ...p, preferences: [...p.preferences, pref.trim()] }))
    setPrefInput('')
  }
  const removePreference = (pref) =>
    setForm(p => ({ ...p, preferences: p.preferences.filter(x => x !== pref) }))

  const adjustPoints = async () => {
    if (!ptForm.change || isNaN(Number(ptForm.change))) { flash('Enter a valid points amount.'); return }
    const change = Number(ptForm.change)
    const newBalance = Math.max(0, (profile?.loyalty_points || 0) + change)
    if ((profile?.loyalty_points || 0) + change < 0) { flash('Points cannot go below 0.'); return }
    setBusy(true)
    const { error: ge } = await supabase.from('guests')
      .update({ loyalty_points: newBalance }).eq('id', guestId)
    if (ge) { flash(ge.message); setBusy(false); return }
    await supabase.from('loyalty_ledger').insert({
      guest_id: guestId, change, balance_after: newBalance,
      reason: ptForm.reason, created_by: userName,
    })
    setPtForm({ change: '', reason: 'MANUAL' })
    await load()
    flash(`${change > 0 ? '+' : ''}${change} points applied. New balance: ${newBalance}.`)
    setBusy(false)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-ink/50 z-40 flex items-center justify-center">
      <div className="card p-8 text-pine/40">Loading…</div>
    </div>
  )

  if (!profile) return null
  const tier = getTier(profile.loyalty_points || 0)

  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-end overflow-auto">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Side panel */}
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-leaf px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-bold text-pine truncate">{profile.full_name}</h2>
              <span className={`status-chip text-xs border ${tier.bg} ${tier.text} ${tier.border}`}>
                {tier.label}
              </span>
              {profile.active_stays > 0 && (
                <span className="status-chip bg-forest/15 text-forest text-xs">In-house</span>
              )}
            </div>
            {profile.customer_id && (
              <div className="font-mono text-[11px] text-pine/50 mt-0.5">{profile.customer_id}</div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="btn-ghost !py-1.5 text-xs">
                <Pencil size={12} /> Edit
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {msg && <div className="px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total stays', value: profile.booking_count || 0, icon: FileText },
              { label: 'Total spend', value: fmtBDT(profile.total_spend || 0), icon: TrendingUp },
              { label: 'Loyalty pts', value: profile.loyalty_points || 0, icon: Gift },
            ].map((s) => (
              <div key={s.label} className="bg-leaf/20 rounded-xl p-3 text-center">
                <s.icon size={16} className="text-forest mx-auto mb-1" />
                <div className="font-display font-bold text-lg text-pine">{s.value}</div>
                <div className="text-[10px] text-pine/50 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Contact info ── */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-pine text-sm">Contact Info</h3>
              {editing && (
                <div className="flex gap-2">
                  <button onClick={save} disabled={busy} className="btn-primary !py-1.5 text-xs">
                    <Save size={12} /> {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost !py-1.5 text-xs">Cancel</button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label !text-xs">Full name *</label>
                  <input className="input" value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label !text-xs">Phone</label>
                  <input className="input" value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label !text-xs">Email</label>
                  <input className="input" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label !text-xs">Address</label>
                  <input className="input" value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div>
                  <label className="label !text-xs">Birthday</label>
                  <input type="date" className="input" value={form.birthday}
                    onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
                </div>
                <div>
                  <label className="label !text-xs">Anniversary</label>
                  <input type="date" className="input" value={form.anniversary_date}
                    onChange={e => setForm(p => ({ ...p, anniversary_date: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label !text-xs">Internal notes</label>
                  <textarea className="input text-xs" rows={2} value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {[
                  { icon: Phone, value: profile.phone },
                  { icon: Mail,  value: profile.email },
                  { icon: MapPin, value: profile.address },
                  { icon: Calendar, value: profile.birthday ? `Birthday: ${fmtDate(profile.birthday)}` : null },
                  { icon: Star, value: profile.anniversary_date ? `Anniversary: ${fmtDate(profile.anniversary_date)}` : null },
                ].filter(r => r.value).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-pine/70">
                    <r.icon size={13} className="text-pine/40 shrink-0" />
                    <span>{r.value}</span>
                  </div>
                ))}
                {profile.notes && (
                  <div className="mt-2 text-xs text-pine/60 bg-amber/10 rounded-lg px-3 py-2">
                    <span className="font-semibold text-amber-700">Note: </span>{profile.notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Preferences ── */}
          <div className="card p-4">
            <h3 className="font-display font-semibold text-pine text-sm mb-3">Preferences</h3>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
              {(editing ? form.preferences : (profile.preferences || [])).map(pref => (
                <span key={pref}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    editing ? 'bg-forest/15 text-forest' : 'bg-leaf text-pine'
                  }`}>
                  {pref}
                  {editing && (
                    <button onClick={() => removePreference(pref)} className="text-forest/60 hover:text-red-500 ml-0.5">×</button>
                  )}
                </span>
              ))}
              {!editing && (profile.preferences || []).length === 0 && (
                <span className="text-xs text-pine/40">No preferences recorded.</span>
              )}
            </div>
            {editing && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Type and press Enter…"
                    value={prefInput}
                    onChange={e => setPrefInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPreference(prefInput) } }}
                  />
                  <button className="btn-ghost !py-1.5" onClick={() => addPreference(prefInput)}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PREFERENCES.filter(p => !form.preferences.includes(p)).map(p => (
                    <button key={p} onClick={() => addPreference(p)}
                      className="text-xs px-2 py-1 rounded-full border border-leaf hover:bg-leaf text-pine/60 hover:text-pine">
                      + {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Loyalty Points ── */}
          {isAdmin && (
            <div className="card p-4">
              <h3 className="font-display font-semibold text-pine text-sm mb-3 flex items-center gap-2">
                <Gift size={15} className="text-forest" /> Loyalty Points
              </h3>

              {/* Tier progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-pine/50 mb-1">
                  <span>{tier.label} tier</span>
                  <span className="font-semibold text-pine">{profile.loyalty_points || 0} pts</span>
                </div>
                {tier.label !== 'PLATINUM' && (() => {
                  const tiers = [TIER_CONFIG.BRONZE, TIER_CONFIG.SILVER, TIER_CONFIG.GOLD, TIER_CONFIG.PLATINUM]
                  const next  = tiers.find(t => t.min > (profile.loyalty_points || 0))
                  if (!next) return null
                  const pct = Math.min(100, Math.round(((profile.loyalty_points || 0) / next.min) * 100))
                  return (
                    <div>
                      <div className="h-2 bg-leaf rounded-full overflow-hidden">
                        <div className="h-full bg-forest rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-pine/40 mt-1">{next.min - (profile.loyalty_points || 0)} pts to {next.label}</div>
                    </div>
                  )
                })()}
              </div>

              {/* Adjust points */}
              <div className="flex gap-2 flex-wrap">
                <input
                  type="number"
                  className="input money flex-1 min-w-[100px]"
                  placeholder="±points (e.g. 100 or -50)"
                  value={ptForm.change}
                  onChange={e => setPtForm(p => ({ ...p, change: e.target.value }))}
                />
                <select className="input !w-36"
                  value={ptForm.reason}
                  onChange={e => setPtForm(p => ({ ...p, reason: e.target.value }))}>
                  {['STAY','MANUAL','REDEMPTION','ADJUSTMENT','BONUS'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button className="btn-primary !py-1.5" onClick={adjustPoints} disabled={busy || !ptForm.change}>
                  <Plus size={13} /> Apply
                </button>
              </div>

              {/* Ledger toggle */}
              <button
                className="text-xs text-pine/50 hover:text-pine mt-3 underline flex items-center gap-1"
                onClick={() => setShowLedger(v => !v)}
              >
                {showLedger ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showLedger ? 'Hide' : 'View'} points ledger ({ledger.length})
              </button>
              {showLedger && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1 border border-leaf rounded-lg p-2">
                  {ledger.length === 0 && <p className="text-xs text-pine/40 p-2">No transactions yet.</p>}
                  {ledger.map(l => (
                    <div key={l.id} className="flex justify-between text-xs py-1.5 border-b border-leaf/40 last:border-0">
                      <span className="text-pine/60">{l.reason} · {l.created_at?.slice(0, 10)} · {l.created_by}</span>
                      <span className={l.change > 0 ? 'text-forest font-semibold' : 'text-red-500 font-semibold'}>
                        {l.change > 0 ? '+' : ''}{l.change} → {l.balance_after}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Stay History ── */}
          <div className="card p-4">
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setShowStays(v => !v)}
            >
              <h3 className="font-display font-semibold text-pine text-sm flex items-center gap-2">
                <FileText size={15} className="text-forest" /> Stay History ({stays.length})
              </h3>
              {showStays ? <ChevronUp size={15} className="text-pine/40" /> : <ChevronDown size={15} className="text-pine/40" />}
            </button>
            {showStays && (
              <div className="mt-3 space-y-2">
                {stays.length === 0 && <p className="text-xs text-pine/40">No stays on record.</p>}
                {stays.map(s => {
                  const STATUS_CHIP = {
                    CHECKED_IN:  'bg-forest/15 text-forest',
                    CHECKED_OUT: 'bg-stone-100 text-stone-600',
                    SETTLED:     'bg-sky-50 text-sky-700',
                    CONFIRMED:   'bg-amber/15 text-amber-700',
                    CANCELLED:   'bg-red-50 text-red-500',
                  }
                  const rooms = (s.reservation_rooms || [])
                    .map(rr => rr.rooms?.room_no).filter(Boolean).join(', ')
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-leaf bg-leaf/10 text-sm">
                      <div>
                        <div className="font-mono font-semibold text-xs text-forest">{s.res_no}</div>
                        <div className="text-xs text-pine/60">
                          {fmtDate(s.check_in)} → {fmtDate(s.check_out)}
                          {rooms && <span className="ml-2 text-pine/40">· {rooms}</span>}
                        </div>
                      </div>
                      <span className={`status-chip text-xs ${STATUS_CHIP[s.status] || 'bg-stone-100 text-stone-500'}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
