import { useEffect, useState } from 'react'
import { Pencil, Plus, Save } from 'lucide-react'
import SearchableSelect from '../SearchableSelect.jsx'
import { fmtBDT, fmtDate } from '../../lib/helpers'
import { supabase } from '../../supabase'
import { PRESET_PREFERENCES } from './utils.js'

export function GuestProfileCard({ guest, reservationId, isAdmin, userName, reload, flash }) {
  const [profile, setProfile]     = useState(null)
  const [ledger, setLedger]       = useState([])
  const [editing, setEditing]     = useState(false)
  const [prefInput, setPrefInput] = useState('')
  const [form, setForm]           = useState({
    birthday: '', anniversary_date: '', preferences: [], notes: '',
  })
  const [ptForm, setPtForm]       = useState({ change: '', reason: 'MANUAL', note: '' })
  const [busy, setBusy]           = useState(false)
  const [showLedger, setShowLedger] = useState(false)

  const loadProfile = async () => {
    if (!guest?.id) return
    const { data } = await supabase.from('v_guest_profile').select('*').eq('id', guest.id).single()
    if (data) {
      setProfile(data)
      setForm({
        birthday: data.birthday || '',
        anniversary_date: data.anniversary_date || '',
        preferences: data.preferences || [],
        notes: data.notes || '',
      })
    }
  }

  const loadLedger = async () => {
    if (!guest?.id) return
    const { data } = await supabase.from('loyalty_ledger').select('*').eq('guest_id', guest.id).order('created_at', { ascending: false }).limit(20)
    setLedger(data || [])
  }

  useEffect(() => { loadProfile() }, [guest?.id])

  const saveProfile = async () => {
    if (!guest?.id) return
    setBusy(true)
    const { error } = await supabase.from('guests').update({
      birthday: form.birthday || null,
      anniversary_date: form.anniversary_date || null,
      preferences: form.preferences,
      notes: form.notes,
    }).eq('id', guest.id)
    setBusy(false)
    if (error) { flash(error.message); return }
    await loadProfile()
    setEditing(false)
    flash('Guest profile updated.')
  }

  const addPreference = (pref) => {
    if (!pref.trim() || form.preferences.includes(pref.trim())) return
    setForm(p => ({ ...p, preferences: [...p.preferences, pref.trim()] }))
    setPrefInput('')
  }

  const removePreference = (pref) => setForm(p => ({ ...p, preferences: p.preferences.filter(x => x !== pref) }))

  const adjustPoints = async () => {
    if (!ptForm.change || isNaN(Number(ptForm.change))) { flash('Enter a valid points amount.'); return }
    setBusy(true)
    const change = Number(ptForm.change)
    const newBalance = (profile?.loyalty_points || 0) + change
    if (newBalance < 0) { flash('Points cannot go below 0.'); setBusy(false); return }
    const { error: gErr } = await supabase.from('guests').update({ loyalty_points: newBalance }).eq('id', guest.id)
    if (gErr) { flash(gErr.message); setBusy(false); return }
    await supabase.from('loyalty_ledger').insert({
      guest_id: guest.id,
      reservation_id: reservationId || null,
      change,
      balance_after: newBalance,
      reason: ptForm.reason,
      created_by: userName,
    })
    setPtForm({ change: '', reason: 'MANUAL', note: '' })
    await loadProfile()
    await loadLedger()
    flash(`${change > 0 ? '+' : ''}${change} points ${change > 0 ? 'added' : 'deducted'}.`)
    setBusy(false)
  }

  if (!guest) return null

  const p = profile

  return (
    <div className="card p-5 lg:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2">
          Guest Profile
        </h3>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button className="btn-primary !py-1.5 text-xs" onClick={saveProfile} disabled={busy}>
                <Save size={12} /> {busy ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil size={12} /> Edit profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Stay History */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Stay History</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-pine/60">Total stays</span>
              <span className="font-bold money text-pine">{p?.booking_count ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pine/60">Total spend</span>
              <span className="font-bold money text-forest">{p ? fmtBDT(p.total_spend) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pine/60">Last stay</span>
              <span className="font-semibold">{p?.last_stay_date ? fmtDate(p.last_stay_date) : '—'}</span>
            </div>
            {p?.active_stays > 0 && (
              <div className="flex justify-between">
                <span className="text-pine/60">Currently in</span>
                <span className="status-chip bg-forest/15 text-forest text-xs">{p.active_stays} active</span>
              </div>
            )}
          </div>
        </div>

        {/* Important Dates */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Important Dates</div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="label !text-xs">Birthday</label>
                <input type="date" className="input" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>
              <div>
                <label className="label !text-xs">Anniversary</label>
                <input type="date" className="input" value={form.anniversary_date} onChange={e => setForm(f => ({ ...f, anniversary_date: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pine/60">Birthday</span>
                <span className="font-semibold">{p?.birthday ? fmtDate(p.birthday) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pine/60">Anniversary</span>
                <span className="font-semibold">{p?.anniversary_date ? fmtDate(p.anniversary_date) : '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Loyalty Points */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Loyalty Points</div>
          <div className="text-3xl font-display font-bold text-forest money mb-3">
            {p?.loyalty_points ?? 0}
            <span className="text-sm font-normal text-pine/50 ml-1">pts</span>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input money flex-1 !py-1.5 text-sm"
                  placeholder="±points"
                  value={ptForm.change}
                  onChange={e => setPtForm(p => ({ ...p, change: e.target.value }))}
                />
                <SearchableSelect
                  className="flex-1"
                  value={ptForm.reason}
                  onChange={v => setPtForm(p => ({ ...p, reason: v }))}
                  options={['STAY', 'MANUAL', 'REDEMPTION', 'ADJUSTMENT', 'BONUS']}
                />
              </div>
              <button className="btn-ghost !py-1.5 text-xs w-full justify-center" onClick={adjustPoints} disabled={busy || !ptForm.change}>
                <Plus size={12} /> Apply
              </button>
            </div>
          )}
          <button
            className="text-xs text-pine/50 hover:text-pine mt-2 underline"
            onClick={() => { setShowLedger(v => !v); if (!showLedger) loadLedger() }}
          >
            {showLedger ? 'Hide' : 'View'} ledger
          </button>
          {showLedger && (
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {ledger.length === 0 && <p className="text-xs text-pine/40">No transactions yet.</p>}
              {ledger.map(l => (
                <div key={l.id} className="flex justify-between text-xs py-1 border-b border-leaf/40">
                  <span className="text-pine/60">{l.reason} · {l.created_at?.slice(0, 10)}</span>
                  <span className={l.change > 0 ? 'text-forest font-semibold' : 'text-red-500 font-semibold'}>
                    {l.change > 0 ? '+' : ''}{l.change} → {l.balance_after}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="lg:col-span-3">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Preferences & Special Requests</div>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
            {(editing ? form.preferences : (p?.preferences || [])).map(pref => (
              <span key={pref} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${editing ? 'bg-forest/15 text-forest' : 'bg-leaf text-pine'}`}>
                {pref}
                {editing && (
                  <button onClick={() => removePreference(pref)} className="text-forest/60 hover:text-red-500 ml-0.5">×</button>
                )}
              </span>
            ))}
            {!editing && (p?.preferences || []).length === 0 && (
              <span className="text-sm text-pine/40">No preferences recorded.</span>
            )}
          </div>
          {editing && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Type a preference and press Enter…"
                  value={prefInput}
                  onChange={e => setPrefInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPreference(prefInput) } }}
                />
                <button className="btn-ghost !py-1.5" onClick={() => addPreference(prefInput)}><Plus size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PREFERENCES.filter(p => !form.preferences.includes(p)).map(p => (
                  <button key={p} type="button" onClick={() => addPreference(p)}
                    className="text-xs px-2 py-1 rounded-full border border-leaf hover:bg-leaf text-pine/60 hover:text-pine transition-colors">
                    + {p}
                  </button>
                ))}
              </div>
              <div>
                <label className="label !text-xs mt-2">Internal notes</label>
                <textarea className="input text-xs" rows={2} value={form.notes} placeholder="Internal staff notes about this guest…" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}
          {!editing && p?.notes && (
            <div className="mt-2 text-xs text-pine/60 bg-amber/10 rounded-lg px-3 py-2">
              <span className="font-semibold text-amber-700">Note:</span> {p.notes}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default GuestProfileCard
