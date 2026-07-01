import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Calendar, Save, Pencil, Plus, Trash2 } from 'lucide-react'

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

export default function ReservationPolicyCard() {
  const [policy, setPolicy]         = useState(null)
  const [blackouts, setBlackouts]   = useState([])
  const [editing, setEditing]       = useState(false)
  const [form, setForm]             = useState({
    name: '', weekday_discount_pct: 30, weekend_discount_pct: 20, blackout_discount_pct: 5,
  })
  const [newBlackout, setNewBlackout] = useState({ name: '', from_date: '', to_date: '' })
  const [msg, setMsg]               = useState('')
  const [busy, setBusy]             = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data: p } = await supabase
      .from('reservation_policies')
      .select('*, policy_blackout_dates(*)')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (p) {
      setPolicy(p)
      setBlackouts(p.policy_blackout_dates || [])
      setForm({
        name: p.name,
        weekday_discount_pct: Number(p.weekday_discount_pct),
        weekend_discount_pct: Number(p.weekend_discount_pct),
        blackout_discount_pct: Number(p.blackout_discount_pct),
      })
    }
  }
  useEffect(() => { load() }, [])

  const savePolicy = async () => {
    if (!form.name.trim()) { flash('Policy name required.'); return }
    setBusy(true)
    if (policy) {
      const { error } = await supabase.from('reservation_policies').update({
        name: form.name,
        weekday_discount_pct: Number(form.weekday_discount_pct),
        weekend_discount_pct: Number(form.weekend_discount_pct),
        blackout_discount_pct: Number(form.blackout_discount_pct),
        updated_at: new Date().toISOString(),
      }).eq('id', policy.id)
      if (error) { flash(error.message); setBusy(false); return }
    } else {
      const { error } = await supabase.from('reservation_policies').insert({
        name: form.name,
        weekday_days: [0,1,2,3],
        weekend_days: [4,5,6],
        weekday_discount_pct: Number(form.weekday_discount_pct),
        weekend_discount_pct: Number(form.weekend_discount_pct),
        blackout_discount_pct: Number(form.blackout_discount_pct),
        is_active: true,
      })
      if (error) { flash(error.message); setBusy(false); return }
    }
    await load()
    setEditing(false)
    setBusy(false)
    flash('Policy saved successfully.')
  }

  const addBlackout = async () => {
    if (!newBlackout.name || !newBlackout.from_date || !newBlackout.to_date) {
      flash('Name, from date and to date are required.'); return
    }
    if (!policy) { flash('Save policy first.'); return }
    const { error } = await supabase.from('policy_blackout_dates').insert({
      policy_id: policy.id,
      tenant_id: policy.tenant_id,
      name: newBlackout.name,
      from_date: newBlackout.from_date,
      to_date: newBlackout.to_date,
    })
    if (error) { flash(error.message); return }
    setNewBlackout({ name: '', from_date: '', to_date: '' })
    await load()
    flash('Blackout date added.')
  }

  const deleteBlackout = async (id) => {
    await supabase.from('policy_blackout_dates').delete().eq('id', id)
    await load()
    flash('Blackout date removed.')
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-pine flex items-center gap-2">
            <Calendar size={18} className="text-forest" /> Reservation Pricing Policy
          </h2>
          <p className="text-xs text-pine/50 mt-0.5">Discount rates applied automatically based on check-in day type.</p>
        </div>
        {!editing && (
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(true)}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {msg && <div className="px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-leaf bg-leaf/10 p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-1">Weekday</div>
          <div className="text-[11px] text-pine/40 mb-3">
            {(policy?.weekday_days || [0,1,2,3]).map(d => DAY_LABELS[d]).join(' · ')}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" className="input money flex-1 !py-1"
                value={form.weekday_discount_pct}
                onChange={e => setForm(p => ({ ...p, weekday_discount_pct: e.target.value }))} />
              <span className="text-sm text-pine/50">%</span>
            </div>
          ) : (
            <div className="text-2xl font-display font-bold text-pine money">
              {policy ? `${Number(policy.weekday_discount_pct)}%` : '—'}
              <span className="text-xs font-normal text-pine/40 ml-1">discount</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-forest/20 bg-forest/5 p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-1">Weekend</div>
          <div className="text-[11px] text-pine/40 mb-3">
            {(policy?.weekend_days || [4,5,6]).map(d => DAY_LABELS[d]).join(' · ')}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" className="input money flex-1 !py-1"
                value={form.weekend_discount_pct}
                onChange={e => setForm(p => ({ ...p, weekend_discount_pct: e.target.value }))} />
              <span className="text-sm text-pine/50">%</span>
            </div>
          ) : (
            <div className="text-2xl font-display font-bold text-forest money">
              {policy ? `${Number(policy.weekend_discount_pct)}%` : '—'}
              <span className="text-xs font-normal text-forest/50 ml-1">discount</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-1">Blackout / Peak</div>
          <div className="text-[11px] text-pine/40 mb-3">Eid, Boishakh, special events</div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" className="input money flex-1 !py-1"
                value={form.blackout_discount_pct}
                onChange={e => setForm(p => ({ ...p, blackout_discount_pct: e.target.value }))} />
              <span className="text-sm text-pine/50">%</span>
            </div>
          ) : (
            <div className="text-2xl font-display font-bold text-amber money">
              {policy ? `${Number(policy.blackout_discount_pct)}%` : '—'}
              <span className="text-xs font-normal text-amber/60 ml-1">discount</span>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-3 border-t border-leaf pt-4">
          <div>
            <label className="label !text-xs">Policy Name</label>
            <input className="input max-w-xs" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Standard Policy 2026" />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={savePolicy} disabled={busy}>
              <Save size={14} /> {busy ? 'Saving…' : 'Save Policy'}
            </button>
            <button className="btn-ghost" onClick={() => { setEditing(false); load() }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="border-t border-leaf pt-4">
        <h3 className="font-semibold text-pine text-sm mb-3 flex items-center gap-2">
          Blackout Dates
          <span className="text-xs font-normal text-pine/40">({blackouts.length} configured)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <input className="input" placeholder="Event name (e.g. Eid ul-Fitr 2026)"
            value={newBlackout.name}
            onChange={e => setNewBlackout(p => ({ ...p, name: e.target.value }))} />
          <input type="date" className="input"
            value={newBlackout.from_date}
            onChange={e => setNewBlackout(p => ({ ...p, from_date: e.target.value }))} />
          <input type="date" className="input"
            value={newBlackout.to_date}
            onChange={e => setNewBlackout(p => ({ ...p, to_date: e.target.value }))} />
          <button className="btn-primary justify-center" onClick={addBlackout}>
            <Plus size={14} /> Add
          </button>
        </div>

        {blackouts.length === 0 ? (
          <p className="text-xs text-pine/40 py-2">No blackout dates configured yet.</p>
        ) : (
          <div className="space-y-1.5">
            {blackouts.map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber/20 bg-amber/5 text-sm">
                <div>
                  <span className="font-semibold text-pine">{b.name}</span>
                  <span className="text-pine/50 text-xs ml-2">
                    {fmtDate(b.from_date)} → {fmtDate(b.to_date)}
                  </span>
                </div>
                <button onClick={() => deleteBlackout(b.id)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-300 hover:text-red-600">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-pine/50 bg-leaf/20 rounded-lg px-3 py-2 space-y-1">
        <div><span className="font-semibold">Day mapping:</span> Sunday–Wednesday = Weekday · Thursday–Saturday = Weekend</div>
        <div><span className="font-semibold">Priority:</span> Blackout {'>'} Weekend {'>'} Weekday</div>
        <div><span className="font-semibold">Formula:</span> Rate = Base Rate − (Base Rate × Discount %)</div>
        <div>Discount auto-applies when creating new reservations based on check-in date.</div>
      </div>
    </div>
  )
}
