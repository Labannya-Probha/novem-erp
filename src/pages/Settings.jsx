import { useEffect, useState, useRef } from 'react'
import { supabase, SUPABASE_CONFIG } from '../supabase'
import { fmtBDT, todayISO, setCurrency } from '../lib/helpers'
import { ROLES, ROLE_LABELS } from '../lib/roles'
import {
  Save, Plus, BedDouble, Percent, Building2, Trash2, Users, ShieldCheck,
  Upload, Image, Bold, List, AlignLeft, AlignCenter, KeyRound, AlertTriangle,
  Eye, EyeOff, ChevronDown, ChevronUp, FileUp, FileDown, CheckCircle2, XCircle, TableProperties,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ROOT — role-gated entry point                                       */
/* ------------------------------------------------------------------ */
export default function Settings({ userName, role, isAdmin, reloadCompany }) {
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin          // Admin or above
  const canManage   = isAdminPlus || role === 'MANAGER'

  if (!canManage) {
    return (
      <div className="card p-8 max-w-xl">
        <h1 className="font-display text-xl font-bold text-pine mb-2 flex items-center gap-2">
          <ShieldCheck size={20} /> Access restricted
        </h1>
        <p className="text-sm text-pine/60">Settings can only be accessed by managers or administrators.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Settings</h1>
      <p className="text-sm text-pine/60 mb-6">Branding, tax rates, rooms, staff and system configuration.</p>
      <div className="space-y-8">
        <MyAccountCard userName={userName} />
        {isAdminPlus && <BrandingCard reloadCompany={reloadCompany} />}
        <TaxCard />
        <RoomsCard />
        {isAdminPlus && <CsvImportCard />}
        <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} />
        {isSuperuser && <DataWipeCard />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MY ACCOUNT — self-service password change, visible to all users    */
/* ------------------------------------------------------------------ */
function MyAccountCard({ userName }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState(null)   // { text, ok }
  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000) }

  const changePassword = async () => {
    if (!current) { flash('Enter your current password.'); return }
    if (next.length < 6) { flash('New password must be at least 6 characters.'); return }
    if (next !== confirm) { flash('New passwords do not match.'); return }
    setBusy(true)
    // Re-authenticate first to verify current password
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) { flash('Could not retrieve your account — please sign out and back in.'); setBusy(false); return }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInErr) { flash('Current password is incorrect.'); setBusy(false); return }
    // Current password verified — update to new password
    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updErr) flash(updErr.message)
    else {
      flash('Password changed successfully.', true)
      setCurrent(''); setNext(''); setConfirm('')
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4">
        <KeyRound size={18} className="text-forest" /> My account
      </h2>
      <p className="text-xs text-pine/50 mb-4">Signed in as <span className="font-medium">{userName}</span>. Change your password below — you must provide your current password to confirm.</p>
      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-forest/10 text-forest' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 max-w-sm">
        <div>
          <label className="label">Current password</label>
          <div className="relative">
            <input type={showCur ? 'text' : 'password'} className="input pr-9" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
            <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
              {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} className="input pr-9" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 6 characters" />
            <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={changePassword} disabled={busy}>
        <Save size={15} /> {busy ? 'Saving…' : 'Change password'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BRANDING — Admin & Superuser only                                   */
/* ------------------------------------------------------------------ */
function BrandingCard({ reloadCompany }) {
  const [c, setC]   = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const editorRef = useRef(null)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single(); setC(data) }
  useEffect(() => { load() }, [])
  if (!c) return <div className="card p-5 text-pine/50">Loading…</div>
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))
  const exec = (cmd, val = null) => document.execCommand(cmd, false, val)
  const autoResize = (e) => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  const uploadLogo = async (file) => {
    if (!file) return
    setBusy(true)
    const ext  = file.name.split('.').pop()
    const path = `logo_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { flash(error.message); setBusy(false); return }
    const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
    set('logo_url', pub.publicUrl)
    await supabase.from('company_settings').update({ logo_url: pub.publicUrl }).eq('id', 1)
    setBusy(false); flash('Logo uploaded.'); reloadCompany?.()
  }

  const save = async () => {
    setBusy(true)
    const content = editorRef.current.innerHTML
    const { error } = await supabase.from('company_settings').update({
      name: c.name, legal_name: c.legal_name, address: c.address, phone: c.phone, email: c.email,
      bin: c.bin, vat_circle: c.vat_circle, invoice_footer: c.invoice_footer,
      short_code: c.short_code, software_name: c.software_name, currency: c.currency,
      mushak610_threshold: +c.mushak610_threshold || 0, terms_conditions: content,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setBusy(false)
    if (error) flash(error.message)
    else { setCurrency(c.currency || '৳'); flash('Saved.'); reloadCompany?.() }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-forest" /> Branding &amp; company profile
      </h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl border border-leaf bg-paper flex items-center justify-center overflow-hidden">
          {c.logo_url ? <img src={c.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Image size={26} className="text-pine/30" />}
        </div>
        <label className="btn-ghost cursor-pointer">
          <Upload size={15} /> {busy ? 'Uploading…' : 'Upload logo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Software name</label><input className="input" value={c.software_name || ''} onChange={(e) => set('software_name', e.target.value)} /></div>
        <div><label className="label">Currency symbol</label><input className="input" value={c.currency || ''} onChange={(e) => set('currency', e.target.value)} /></div>
        <div><label className="label">Property name</label><input className="input" value={c.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Legal name</label><input className="input" value={c.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={c.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={c.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">BIN</label><input className="input money" value={c.bin || ''} onChange={(e) => set('bin', e.target.value)} /></div>
        <div><label className="label">Short code</label><input className="input money" value={c.short_code || ''} onChange={(e) => set('short_code', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">VAT circle / division</label><input className="input" value={c.vat_circle || ''} onChange={(e) => set('vat_circle', e.target.value)} /></div>
        <div><label className="label">Mushak-6.10 threshold</label><input type="number" className="input money" value={c.mushak610_threshold || 0} onChange={(e) => set('mushak610_threshold', e.target.value)} /></div>
        <div><label className="label">Invoice footer</label><input className="input" value={c.invoice_footer || ''} onChange={(e) => set('invoice_footer', e.target.value)} /></div>
      </div>
      <div className="mt-5">
        <label className="label">Default Terms &amp; Conditions</label>
        <div className="flex gap-1 p-1 bg-stone-100 rounded-t-lg border border-leaf">
          <button type="button" onClick={() => exec('bold')} className="p-2 hover:bg-white rounded"><Bold size={16} /></button>
          <button type="button" onClick={() => exec('insertUnorderedList')} className="p-2 hover:bg-white rounded"><List size={16} /></button>
          <button type="button" onClick={() => exec('justifyLeft')} className="p-2 hover:bg-white rounded"><AlignLeft size={16} /></button>
          <button type="button" onClick={() => exec('justifyCenter')} className="p-2 hover:bg-white rounded"><AlignCenter size={16} /></button>
        </div>
        <div
          ref={editorRef} contentEditable onInput={autoResize}
          className="w-full min-h-[160px] p-4 border-x border-b border-leaf rounded-b-lg text-sm focus:outline-none bg-white overflow-hidden"
          dangerouslySetInnerHTML={{ __html: c.terms_conditions || '' }}
        />
      </div>
      <button className="btn-primary mt-4" disabled={busy} onClick={save}><Save size={15} /> Save profile</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TAX CONFIG — unchanged                                              */
/* ------------------------------------------------------------------ */
function TaxCard() {
  const [rows, setRows] = useState([])
  const [msg, setMsg]   = useState('')
  const [f, setF] = useState({ charge_type: 'ROOM', vat_pct: 15, service_charge_pct: 10, effective_from: todayISO() })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('tax_config').select('*').order('effective_from', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => {
    const { error } = await supabase.from('tax_config').insert({ charge_type: f.charge_type, vat_pct: +f.vat_pct || 0, service_charge_pct: +f.service_charge_pct || 0, effective_from: f.effective_from })
    if (error) flash(error.message); else { load(); flash('Added.') }
  }
  const del = async (id) => { await supabase.from('tax_config').delete().eq('id', id); load() }
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4"><Percent size={18} className="text-forest" /> NBR tax rates</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <select className="input" value={f.charge_type} onChange={(e) => setF({ ...f, charge_type: e.target.value })}>
          {['ROOM', 'FOOD', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" className="input money" placeholder="VAT %" value={f.vat_pct} onChange={(e) => setF({ ...f, vat_pct: e.target.value })} />
        <input type="number" className="input money" placeholder="SC %" value={f.service_charge_pct} onChange={(e) => setF({ ...f, service_charge_pct: e.target.value })} />
        <input type="date" className="input" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Type</th><th className="th text-right">VAT %</th><th className="th text-right">SC %</th><th className="th">From</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td">{r.charge_type}</td>
              <td className="td money text-right">{r.vat_pct}%</td>
              <td className="td money text-right">{r.service_charge_pct}%</td>
              <td className="td text-sm">{r.effective_from}</td>
              <td className="td"><button onClick={() => del(r.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ROOMS — unchanged                                                   */
/* ------------------------------------------------------------------ */
function RoomsCard() {
  const [rows, setRows] = useState([])
  const [msg, setMsg]   = useState('')
  const [f, setF] = useState({ room_no: '', room_name: '', room_type: '', base_rate: '' })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('rooms').select('*').order('room_no'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add    = async () => { if (!f.room_no) return; const { error } = await supabase.from('rooms').insert({ ...f, base_rate: +f.base_rate || 0 }); if (error) flash(error.message); else { setF({ room_no: '', room_name: '', room_type: '', base_rate: '' }); load() } }
  const toggle = async (r) => { await supabase.from('rooms').update({ is_active: !r.is_active }).eq('id', r.id); load() }
  const del    = async (id) => { const { error } = await supabase.from('rooms').delete().eq('id', id); if (error) flash('Room is in use and cannot be deleted.'); else load() }
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4"><BedDouble size={18} className="text-forest" /> Rooms</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="Room no" value={f.room_no} onChange={(e) => setF({ ...f, room_no: e.target.value })} />
        <input className="input" placeholder="Room name" value={f.room_name} onChange={(e) => setF({ ...f, room_name: e.target.value })} />
        <input className="input" placeholder="Type" value={f.room_type} onChange={(e) => setF({ ...f, room_type: e.target.value })} />
        <input type="number" className="input money" placeholder="Base rate" value={f.base_rate} onChange={(e) => setF({ ...f, base_rate: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Room no</th><th className="th">Name</th><th className="th">Type</th><th className="th text-right">Rate</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
              <td className="td money font-semibold">{r.room_no}</td>
              <td className="td text-sm">{r.room_name || '—'}</td>
              <td className="td text-sm">{r.room_type || '—'}</td>
              <td className="td money text-right">{fmtBDT(r.base_rate)}</td>
              <td className="td"><button onClick={() => toggle(r)} className={`status-chip ${r.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</button></td>
              <td className="td"><button onClick={() => del(r.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  STAFF — roles, status, add, password reset for others              */
/* ------------------------------------------------------------------ */
function StaffCard({ isAdminPlus, isSuperuser, currentUserName }) {
  const [rows, setRows]         = useState([])
  const [msg, setMsg]           = useState('')
  const [busy, setBusy]         = useState(false)
  const [nu, setNu]             = useState({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
  const [resetTarget, setResetTarget] = useState(null)   // { id, name } of user being reset
  const [newPwd, setNewPwd]     = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }
  const load  = async () => { const { data } = await supabase.from('v_staff').select('*').order('created_at'); setRows(data || []) }
  useEffect(() => { load() }, [])

  const LOGIN_DOMAIN = 'aura-stay.local'

  const addStaff = async () => {
    const uname = nu.username.trim().toLowerCase()
    if (!nu.full_name.trim() || !uname || nu.password.length < 6) { flash('Enter name, username and a password of at least 6 characters.'); return }
    if (/[^a-z0-9._-]/.test(uname)) { flash('Username can use letters, numbers, dot, dash and underscore only.'); return }
    setBusy(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const tmp = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const email = `${uname}@${LOGIN_DOMAIN}`
      const { data, error } = await tmp.auth.signUp({ email, password: nu.password, options: { data: { username: uname, full_name: nu.full_name.trim() } } })
      if (error) throw error
      const newId = data?.user?.id
      if (newId) await supabase.from('app_users').update({ role: nu.role, full_name: nu.full_name.trim(), username: uname }).eq('id', newId)
      await tmp.auth.signOut()
      setNu({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
      await load()
      flash(`Staff "${uname}" created.`)
    } catch (e) { flash(e.message?.includes('already registered') ? 'Username already taken.' : e.message) }
    setBusy(false)
  }

  // Admin/Superuser reset another user's password
  // Uses signInWithPassword on a throwaway client to get a session for that user,
  // then calls updateUser — limited to @aura-stay.local accounts created via addStaff
  const resetPassword = async () => {
    if (!resetTarget || newPwd.length < 6) { flash('New password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      const targetUser = rows.find((r) => r.id === resetTarget.id)
      if (!targetUser) throw new Error('User not found.')
      const email = targetUser.email || `${targetUser.username}@${LOGIN_DOMAIN}`
      // We use a service-role–equivalent flow: fetch the user's current password
      // from a signed admin session is not possible client-side; instead we
      // invoke the dedicated Edge Function that handles this securely
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/wipe-nonuser-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'reset_password', user_id: resetTarget.id, new_password: newPwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Reset failed.')
      flash(`Password reset for ${resetTarget.name}.`, true)
      setResetTarget(null); setNewPwd('')
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const setRole   = async (id, role) => { const { error } = await supabase.from('app_users').update({ role }).eq('id', id); if (!error) load() }
  const toggle    = async (u) => { const { error } = await supabase.from('app_users').update({ is_active: !u.is_active }).eq('id', u.id); if (!error) load() }

  // Roles available in the dropdown depend on who's editing
  const availableRoles = isSuperuser ? ROLES : ROLES.filter((r) => r !== 'SUPERUSER')

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-2"><Users size={18} className="text-forest" /> Staff</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      {isAdminPlus && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          <input className="input" placeholder="Full name" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
          <input className="input" placeholder="Username" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <input className="input" placeholder="Password (min 6)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="btn-primary justify-center" disabled={busy} onClick={addStaff}><Plus size={15} /> Add</button>
        </div>
      )}

      {/* Password reset panel */}
      {resetTarget && (
        <div className="mb-4 p-4 rounded-xl border border-amber/30 bg-amber/5">
          <p className="text-sm font-medium text-pine mb-2">Reset password for <span className="font-bold">{resetTarget.name}</span></p>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <input
                type={showPwd ? 'text' : 'password'}
                className="input pr-9"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password (min 6)"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button className="btn-primary" onClick={resetPassword} disabled={busy || newPwd.length < 6}>
              <KeyRound size={14} /> {busy ? 'Saving…' : 'Set password'}
            </button>
            <button className="btn-ghost" onClick={() => { setResetTarget(null); setNewPwd('') }}>Cancel</button>
          </div>
          <p className="text-xs text-pine/50 mt-2">This resets the password immediately. The user will need to use the new password on their next login.</p>
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Name</th>
            <th className="th">Username</th>
            <th className="th">Role</th>
            <th className="th">Status</th>
            {isAdminPlus && <th className="th">Password</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm">{u.full_name || '—'}</td>
              <td className="td text-sm money">{u.username || '—'}</td>
              <td className="td">
                {isAdminPlus
                  ? <select className="input !py-1 !w-44" value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                      {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  : ROLE_LABELS[u.role]}
              </td>
              <td className="td">
                <button
                  onClick={() => toggle(u)}
                  disabled={!isAdminPlus}
                  className={`status-chip ${u.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdminPlus ? 'opacity-50 cursor-default' : ''}`}
                >
                  {u.is_active ? 'Active' : 'Disabled'}
                </button>
              </td>
              {isAdminPlus && (
                <td className="td">
                  <button
                    className="btn-ghost !py-1 text-xs"
                    onClick={() => { setResetTarget({ id: u.id, name: u.full_name || u.username }); setNewPwd('') }}
                  >
                    <KeyRound size={12} /> Reset
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DATA WIPE — Superuser only                                          */
/* ------------------------------------------------------------------ */
const WIPE_MODULES = [
  {
    id: 'reservations',
    label: 'Reservations & Billing',
    description: 'Reservations, guests, folio charges, payments, invoices, quotations, VAT sales register',
    tables: ['folio_charges', 'payments', 'invoices', 'quotations', 'reservation_addons', 'reservation_guests', 'reservation_rooms', 'reservations', 'guests', 'vat_sales_register'],
    sequences: ['res_no_seq', 'quote_no_seq', 'guest_bill_seq', 'mushak_serial_seq'],
  },
  {
    id: 'pos',
    label: 'Restaurant POS',
    description: 'POS orders and order items',
    tables: ['pos_order_items', 'pos_orders'],
    sequences: ['pos_no_seq'],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    description: 'Facility sales (tea, pickle, sports, etc.)',
    tables: ['facility_sales'],
    sequences: ['fac_no_seq'],
  },
  {
    id: 'hr',
    label: 'HR & Attendance',
    description: 'Employees, attendance records, leave applications, compensatory leave register',
    tables: ['comp_leave_register', 'leave_applications', 'attendance_records', 'employees'],
    sequences: ['emp_no_seq'],
  },
  {
    id: 'inventory',
    label: 'Inventory & Procurement',
    description: 'Requisitions, purchase orders, goods receipts, stock transfers, stock returns, VAT purchase register',
    tables: ['return_items', 'stock_returns', 'transfer_items', 'stock_transfers', 'grn_items', 'goods_receipts', 'po_items', 'purchase_orders', 'requisition_items', 'requisitions', 'vat_purchase_register'],
    sequences: ['req_no_seq', 'po_no_seq', 'grn_no_seq', 'trf_no_seq', 'rtn_no_seq'],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Journal entries, journal lines, VAT sales register, VAT purchase register',
    tables: ['journal_lines', 'journal_entries', 'vat_sales_register', 'vat_purchase_register'],
    sequences: ['jv_no_seq'],
  },
]

function DataWipeCard() {
  const [selected, setSelected] = useState(null)   // module id currently staged for wipe
  const [confirm, setConfirm]   = useState('')     // typed confirmation word
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState(null)   // { text, ok }
  const [expanded, setExpanded] = useState(false)
  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 8000) }

  const module = WIPE_MODULES.find((m) => m.id === selected)

  const doWipe = async () => {
    if (!module) return
    if (confirm.trim().toUpperCase() !== 'WIPE') { flash('Type WIPE in capital letters to confirm.'); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/wipe-nonuser-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'wipe_module', module_id: module.id, tables: module.tables, sequences: module.sequences }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Wipe failed.')
      flash(`${module.label} data wiped. All reference numbers reset to 1.`, true)
      setSelected(null); setConfirm('')
    } catch (e) {
      // If the Edge Function doesn't handle this action yet, fall back to direct SQL wipe
      if (e.message?.includes('action') || e.message?.includes('not found') || e.message?.includes('404')) {
        await directWipe(module)
      } else {
        flash(e.message)
      }
    }
    setBusy(false)
  }

  const directWipe = async (mod) => {
    try {
      for (const table of mod.tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error && !error.message?.includes('does not exist')) throw error
      }
      // Reset sequences via RPC (requires a Postgres function or admin access)
      flash(`${mod.label} tables cleared. Note: sequence numbers were not reset — contact your database admin to run ALTER SEQUENCE ... RESTART WITH 1 for: ${mod.sequences.join(', ')}.`, false)
      setSelected(null); setConfirm('')
    } catch (e) {
      flash(`Wipe partially failed: ${e.message}`)
    }
  }

  return (
    <div className="card p-5 border border-red-200">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <h2 className="font-display font-semibold text-red-600 flex items-center gap-2">
          <AlertTriangle size={18} /> Superuser: Data wipe
        </h2>
        {expanded ? <ChevronUp size={18} className="text-red-400" /> : <ChevronDown size={18} className="text-red-400" />}
      </button>

      {expanded && (
        <div className="mt-4">
          <p className="text-sm text-pine/70 mb-4">
            Permanently delete all data in a module and reset its reference number sequences back to 1.
            This <span className="font-semibold text-red-600">cannot be undone</span>. Only use this when setting up a fresh property or in a controlled data-reset scenario.
          </p>
          {msg && (
            <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-forest/10 text-forest' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 mb-5">
            {WIPE_MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelected(selected === m.id ? null : m.id); setConfirm('') }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selected === m.id
                    ? 'border-red-400 bg-red-50'
                    : 'border-leaf hover:border-red-300 hover:bg-red-50/40'
                }`}
              >
                <div className="font-medium text-sm text-pine">{m.label}</div>
                <div className="text-xs text-pine/50 mt-0.5">{m.description}</div>
              </button>
            ))}
          </div>

          {selected && module && (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-3">
              <p className="text-sm font-semibold text-red-700">
                You are about to wipe: <span className="underline">{module.label}</span>
              </p>
              <p className="text-xs text-red-600">
                Tables: {module.tables.join(', ')}<br />
                Sequences to reset: {module.sequences.join(', ')}
              </p>
              <div>
                <label className="label text-red-700">Type <span className="font-mono font-bold">WIPE</span> to confirm</label>
                <input
                  className="input border-red-300 focus:ring-red-400 max-w-xs"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="WIPE"
                  autoComplete="off"
                />
              </div>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-400"
                onClick={doWipe}
                disabled={busy || confirm.trim().toUpperCase() !== 'WIPE'}
              >
                <AlertTriangle size={15} /> {busy ? 'Wiping…' : `Wipe ${module.label}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CSV IMPORT — Admin & Superuser only                                 */
/* ------------------------------------------------------------------ */

// Table definitions: columns the CSV must supply, how to map to DB row
const IMPORT_TABLES = {
  rooms: {
    label: 'Rooms',
    description: 'Room inventory — room number, type, base rate',
    csvColumns: ['room_no', 'room_name', 'room_type', 'base_rate', 'notes'],
    required: ['room_no'],
    mapRow: (r) => ({
      room_no:   r.room_no?.trim(),
      room_name: r.room_name?.trim() || null,
      room_type: r.room_type?.trim() || 'Standard',
      base_rate: parseFloat(r.base_rate) || 0,
      notes:     r.notes?.trim() || null,
      is_active: true,
    }),
    sampleRow: { room_no: '101', room_name: 'Garden View', room_type: 'Deluxe', base_rate: '3500', notes: '' },
  },
  chart_of_accounts: {
    label: 'Opening Balance (Chart of Accounts)',
    description: 'Account code, name, type, normal side (DEBIT/CREDIT)',
    csvColumns: ['code', 'name', 'type', 'normal_side', 'subtype'],
    required: ['code', 'name', 'type', 'normal_side'],
    mapRow: (r) => ({
      code:        r.code?.trim(),
      name:        r.name?.trim(),
      type:        r.type?.trim().toUpperCase(),
      normal_side: r.normal_side?.trim().toUpperCase(),
      subtype:     r.subtype?.trim() || null,
      is_active:   true,
      is_control:  false,
      is_system:   false,
    }),
    sampleRow: { code: '1001', name: 'Cash in Hand', type: 'ASSET', normal_side: 'DEBIT', subtype: 'Current Asset' },
  },
  companies: {
    label: 'Companies',
    description: 'Corporate clients and partner companies',
    csvColumns: ['name', 'contact_person', 'phone', 'email', 'address'],
    required: ['name'],
    mapRow: (r) => ({
      name:           r.name?.trim(),
      contact_person: r.contact_person?.trim() || null,
      phone:          r.phone?.trim() || null,
      email:          r.email?.trim() || null,
      address:        r.address?.trim() || null,
      is_active:      true,
    }),
    sampleRow: { name: 'ABC Corp Ltd', contact_person: 'Rahim Uddin', phone: '01700000000', email: 'info@abc.com', address: 'Dhaka' },
  },
  vendors: {
    label: 'Vendors',
    description: 'Suppliers and procurement vendors',
    csvColumns: ['name', 'bin', 'phone', 'address'],
    required: ['name'],
    mapRow: (r) => ({
      name:      r.name?.trim(),
      bin:       r.bin?.trim() || null,
      phone:     r.phone?.trim() || null,
      address:   r.address?.trim() || null,
      is_active: true,
    }),
    sampleRow: { name: 'Rahman Traders', bin: '000000000-0000', phone: '01800000000', address: 'Sreemangal' },
  },
  menu_items: {
    label: 'Menu Items',
    description: 'Restaurant POS menu — category name must match existing categories',
    csvColumns: ['category_name', 'name', 'price', 'measuring_units', 'pos_menu_catagories', 'sort_order'],
    required: ['name', 'price'],
    // category_name resolved to category_id at import time via menuCatMap
    mapRow: (r, menuCatMap) => ({
      category_id:        menuCatMap[r.category_name?.trim().toLowerCase()] || null,
      name:               r.name?.trim(),
      price:              parseFloat(r.price) || 0,
      measuring_units:    r.measuring_units?.trim() || null,
      pos_menu_catagories: r.pos_menu_catagories?.trim() || null,
      sort_order:         parseInt(r.sort_order) || 0,
      is_active:          true,
    }),
    sampleRow: { category_name: 'Beverages', name: 'Fresh Lime Soda', price: '120', measuring_units: 'Glass', pos_menu_catagories: '', sort_order: '0' },
  },
  facility_items: {
    label: 'Facility Items',
    description: 'Tea garden, pickle, sports and other facility items',
    csvColumns: ['category', 'name', 'unit', 'default_price', 'charge_type', 'pricing_mode', 'is_rental'],
    required: ['category', 'name'],
    mapRow: (r) => ({
      category:     r.category?.trim(),
      name:         r.name?.trim(),
      unit:         r.unit?.trim() || 'pc',
      default_price: parseFloat(r.default_price) || 0,
      charge_type:  r.charge_type?.trim().toUpperCase() || 'OTHER',
      pricing_mode: r.pricing_mode?.trim().toUpperCase() || 'PER_UNIT',
      is_rental:    r.is_rental?.toString().toLowerCase() === 'true',
      is_active:    true,
    }),
    sampleRow: { category: 'Tea Garden', name: 'Tea Plucking Tour', unit: 'person', default_price: '500', charge_type: 'OTHER', pricing_mode: 'PER_UNIT', is_rental: 'false' },
  },
  employees: {
    label: 'Employees',
    description: 'HR employee records — emp_code is auto-generated if left blank',
    csvColumns: ['full_name', 'designation', 'department', 'join_date', 'phone', 'nid', 'address', 'gross_salary'],
    required: ['full_name'],
    mapRow: (r) => ({
      full_name:    r.full_name?.trim(),
      designation:  r.designation?.trim() || null,
      department:   r.department?.trim() || null,
      join_date:    r.join_date?.trim() || null,
      phone:        r.phone?.trim() || null,
      nid:          r.nid?.trim() || null,
      address:      r.address?.trim() || null,
      gross_salary: parseFloat(r.gross_salary) || 0,
      status:       'ACTIVE',
    }),
    sampleRow: { full_name: 'Karim Hossain', designation: 'Waiter', department: 'F&B', join_date: '2024-01-01', phone: '01900000000', nid: '1234567890', address: 'Sreemangal', gross_salary: '9000' },
  },
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

function generateCsv(columns, sampleRow) {
  const header = columns.join(',')
  const sample = columns.map((c) => sampleRow[c] ?? '').join(',')
  return `${header}\n${sample}`
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function CsvImportCard() {
  const [tableKey, setTableKey]   = useState('rooms')
  const [preview, setPreview]     = useState([])   // parsed rows before import
  const [headers, setHeaders]     = useState([])
  const [errors, setErrors]       = useState([])   // per-row validation errors
  const [result, setResult]       = useState(null) // { inserted, failed }
  const [busy, setBusy]           = useState(false)
  const [msg, setMsg]             = useState(null) // { text, ok }
  const [expanded, setExpanded]   = useState(false)
  const [menuCatMap, setMenuCatMap] = useState({}) // name.toLowerCase() -> id
  const fileRef = useRef(null)

  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 7000) }
  const tbl   = IMPORT_TABLES[tableKey]

  // Load menu categories for name→id resolution
  useEffect(() => {
    supabase.from('menu_categories').select('id, name').then(({ data }) => {
      if (data) setMenuCatMap(Object.fromEntries(data.map((c) => [c.name.toLowerCase(), c.id])))
    })
  }, [])

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const { headers: h, rows } = parseCsv(e.target.result)
      setHeaders(h)
      setResult(null)

      // Validate required columns present
      const missing = tbl.required.filter((c) => !h.includes(c))
      if (missing.length) {
        flash(`CSV is missing required columns: ${missing.join(', ')}`)
        setPreview([]); setErrors([])
        return
      }

      // Validate each row
      const rowErrors = rows.map((r, i) => {
        const missing = tbl.required.filter((c) => !r[c]?.trim())
        return missing.length ? `Row ${i + 2}: missing ${missing.join(', ')}` : null
      }).filter(Boolean)

      setPreview(rows)
      setErrors(rowErrors)
      if (rowErrors.length) flash(`${rowErrors.length} row(s) have validation issues — fix the CSV and re-upload, or proceed to skip invalid rows.`)
    }
    reader.readAsText(file)
  }

  const doImport = async () => {
    if (!preview.length) { flash('No data to import — upload a CSV first.'); return }
    setBusy(true)
    setResult(null)

    // Build valid rows only
    const validRows = preview.filter((r) => {
      return tbl.required.every((c) => r[c]?.trim())
    }).map((r) => tbl.mapRow(r, menuCatMap))

    const batchSize = 100
    let inserted = 0, failed = 0
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize)
      const { error, count } = await supabase
        .from(tableKey)
        .insert(batch)
        .select('id')
      if (error) {
        failed += batch.length
        flash(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`)
      } else {
        inserted += (count ?? batch.length)
      }
    }

    setBusy(false)
    setResult({ inserted, failed, skipped: preview.length - validRows.length })
    flash(`Import complete — ${inserted} inserted, ${failed} failed, ${preview.length - validRows.length} skipped (validation).`, inserted > 0)
  }

  const reset = () => { setPreview([]); setHeaders([]); setErrors([]); setResult(null); setMsg(null); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div className="card p-5">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded((v) => !v)}>
        <h2 className="font-display font-semibold text-pine flex items-center gap-2">
          <TableProperties size={18} className="text-forest" /> CSV Import
        </h2>
        {expanded ? <ChevronUp size={18} className="text-pine/40" /> : <ChevronDown size={18} className="text-pine/40" />}
      </button>
      <p className="text-xs text-pine/50 mt-1">Bulk-upload data into any master table using a CSV file.</p>

      {expanded && (
        <div className="mt-5 space-y-5">
          {msg && (
            <div className={`px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-forest/10 text-forest' : 'bg-amber/10 text-amber-700'}`}>
              {msg.text}
            </div>
          )}

          {/* Table selector */}
          <div>
            <label className="label">Select table to import into</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(IMPORT_TABLES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => { setTableKey(key); reset() }}
                  className={`text-left p-3 rounded-xl border text-sm transition-colors ${
                    tableKey === key
                      ? 'border-forest bg-forest/10 text-forest font-semibold'
                      : 'border-leaf hover:border-forest/40 text-pine'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-pine/50 mt-0.5 line-clamp-2">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected table info + template download */}
          <div className="bg-leaf/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-pine text-sm">{tbl.label}</div>
                <div className="text-xs text-pine/60 mt-0.5">{tbl.description}</div>
                <div className="text-xs text-pine/50 mt-1.5">
                  Required columns: <span className="font-mono font-medium">{tbl.required.join(', ')}</span>
                </div>
                <div className="text-xs text-pine/50">
                  All columns: <span className="font-mono">{tbl.csvColumns.join(', ')}</span>
                </div>
              </div>
              <button
                className="btn-ghost text-xs shrink-0"
                onClick={() => downloadCsv(`${tableKey}_template.csv`, generateCsv(tbl.csvColumns, tbl.sampleRow))}
              >
                <FileDown size={14} /> Download template CSV
              </button>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="label">Upload CSV file</label>
            <div className="flex items-center gap-3">
              <label className="btn-ghost cursor-pointer">
                <FileUp size={15} /> Choose CSV
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              {preview.length > 0 && (
                <span className="text-sm text-pine/70">
                  {preview.length} row{preview.length !== 1 ? 's' : ''} loaded
                  {errors.length > 0 && <span className="text-amber-600 ml-1">· {errors.length} with issues</span>}
                </span>
              )}
              {preview.length > 0 && (
                <button className="btn-ghost text-xs !py-1" onClick={reset}>Clear</button>
              )}
            </div>
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
              <div className="text-xs font-semibold text-amber-700 mb-2">Validation issues (these rows will be skipped):</div>
              {errors.slice(0, 8).map((e, i) => (
                <div key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                  <XCircle size={12} className="mt-0.5 shrink-0" /> {e}
                </div>
              ))}
              {errors.length > 8 && <div className="text-xs text-amber-600 mt-1">…and {errors.length - 8} more.</div>}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-pine mb-2">Preview (first 5 rows):</div>
              <div className="overflow-x-auto rounded-xl border border-leaf">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-leaf/30">
                      <th className="th !py-2 !text-xs">#</th>
                      {tbl.csvColumns.map((c) => <th key={c} className="th !py-2 !text-xs">{c}</th>)}
                      <th className="th !py-2 !text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((r, i) => {
                      const hasErr = tbl.required.some((c) => !r[c]?.trim())
                      return (
                        <tr key={i} className={hasErr ? 'bg-red-50' : ''}>
                          <td className="td !py-1.5 text-pine/40">{i + 2}</td>
                          {tbl.csvColumns.map((c) => (
                            <td key={c} className={`td !py-1.5 ${tbl.required.includes(c) && !r[c]?.trim() ? 'text-red-500 font-semibold' : ''}`}>
                              {r[c] || <span className="text-pine/30">—</span>}
                            </td>
                          ))}
                          <td className="td !py-1.5">
                            {hasErr
                              ? <span className="flex items-center gap-1 text-red-500"><XCircle size={11} /> Skip</span>
                              : <span className="flex items-center gap-1 text-forest"><CheckCircle2 size={11} /> OK</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {preview.length > 5 && (
                      <tr><td className="td !py-1.5 text-pine/40 text-center" colSpan={tbl.csvColumns.length + 2}>…{preview.length - 5} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className={`rounded-xl border p-4 text-sm ${result.failed === 0 ? 'border-forest/30 bg-forest/5' : 'border-amber/30 bg-amber/5'}`}>
              <div className="flex items-center gap-2 font-semibold text-pine mb-1">
                <CheckCircle2 size={16} className="text-forest" /> Import complete
              </div>
              <div className="text-pine/70 text-xs space-y-0.5">
                <div>✅ Inserted: <span className="font-semibold text-forest">{result.inserted}</span></div>
                {result.skipped > 0 && <div>⏭ Skipped (validation): <span className="font-semibold text-amber-600">{result.skipped}</span></div>}
                {result.failed > 0 && <div>❌ Failed (DB error): <span className="font-semibold text-red-600">{result.failed}</span></div>}
              </div>
            </div>
          )}

          {/* Import button */}
          {preview.length > 0 && !result && (
            <button
              className="btn-primary"
              onClick={doImport}
              disabled={busy || preview.every((r) => tbl.required.some((c) => !r[c]?.trim()))}
            >
              <FileUp size={15} /> {busy ? 'Importing…' : `Import ${preview.filter((r) => tbl.required.every((c) => r[c]?.trim())).length} valid row(s) into ${tbl.label}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
