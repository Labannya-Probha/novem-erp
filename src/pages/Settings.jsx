import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase, SUPABASE_CONFIG } from '../supabase'
import { fmtBDT, todayISO, setCurrency } from '../lib/helpers'
import { ROLES, ROLE_LABELS } from '../lib/roles'
import {
  Save, Plus, Percent, Building2, Trash2, Users, ShieldCheck,
  Upload, Image, KeyRound, AlertTriangle, FileText, Lock,
  Eye, EyeOff, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react'

export const SETTINGS_SECTIONS = [
  { id: 'my-account', label: 'My Account' },
  { id: 'branding', label: 'Branding', adminOnly: true },
  { id: 'tax', label: 'Tax Rates' },
  { id: 'tax-policy', label: 'Tax Policy' },
  { id: 'allowance', label: 'Allowance Configuration', superuserOnly: true },
  { id: 'role-permissions', label: 'Role Permissions', superuserOnly: true },
  { id: 'admin-feature-access', label: 'Admin Feature Access', superuserOnly: true },
  { id: 'staff', label: 'Staff Management' },
  { id: 'data-system', label: 'Data & System', superuserOnly: true },
]

/* ------------------------------------------------------------------ */
/*  COLLAPSIBLE SECTION wrapper — click header to expand/collapse       */
/* ------------------------------------------------------------------ */
function CollapsibleSection({ title, icon: Icon, children, open, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-1 mb-1 group"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pine/50 group-hover:text-pine/80 transition-colors">
          {Icon && <Icon size={13} className="text-forest/70" />}
          {title}
        </span>
        <ChevronDown size={13} className={`text-pine/35 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ROOT — role-gated entry point                                       */
/* ------------------------------------------------------------------ */
export default function Settings({ userName, role, isAdmin, reloadCompany }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin          // Admin or above
  const canManage   = isAdminPlus || role === 'MANAGER'
  const [activeSection, setActiveSection] = useState(null)
  const [myTenantId, setMyTenantId]       = useState(null)
    useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u?.user?.id) return
      supabase.from('app_users')
        .select('tenant_id')
        .eq('id', u.user.id)
        .single()
        .then(({ data }) => { if (data?.tenant_id) setMyTenantId(data.tenant_id) })
    })
  }, [])
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

  const sections = [
    { id: 'my-account', title: 'My Account', icon: KeyRound, visible: true, content: <MyAccountCard userName={userName} /> },
    { id: 'branding', title: 'Branding', icon: Image, visible: isAdminPlus, content: <BrandingCard reloadCompany={reloadCompany} /> },
    { id: 'tax', title: 'Tax Rates', visible: true, content: <TaxCard /> },
    { id: 'tax-policy', title: 'Tax Policy', icon: FileText, visible: true, content: <TaxPolicyCard tenantId={myTenantId} isAdmin={isAdminPlus} /> },
    { id: 'allowance', title: 'Allowance Configuration', icon: Percent, visible: isSuperuser, content: <AllowanceCard /> },
    { id: 'role-permissions', title: 'Role Permissions', icon: ShieldCheck, visible: isSuperuser, content: <RolePrivilegesCard /> },
    { id: 'admin-feature-access', title: 'Admin Feature Access', icon: Lock, visible: isSuperuser, content: <AdminFeatureAccessCard /> },
    { id: 'staff', title: 'Staff Management', icon: Users, visible: true, content: <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} /> },
    { id: 'data-system', title: 'Data & System', icon: AlertTriangle, visible: isSuperuser, content: <DataWipeCard /> },
  ].filter((s) => s.visible)

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('section')
    if (requested && sections.some((s) => s.id === requested)) {
      setActiveSection(requested)
      return
    }
    if (!activeSection || !sections.some((s) => s.id === activeSection)) {
      setActiveSection(sections[0]?.id || null)
    }
  }, [location.search, activeSection, isSuperuser, isAdminPlus])

  const openSection = (sectionId) => {
    setActiveSection(sectionId)
    navigate(`/settings?section=${sectionId}`, { replace: true })
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Settings</h1>
      <p className="text-sm text-pine/60 mb-6">Branding, tax rates, staff and system configuration.</p>
      <div className="space-y-4">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            open={activeSection === section.id}
            onToggle={() => openSection(section.id)}
          >
            {section.content}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}
/* ------------------------------------------------------------------ */
/*  ALLOWANCE CONFIG — designation-wise Internet/Telephone allowance,   */
/*  used by HR & Office → Payroll when generating monthly payslips.     */
/*  Admin & Superuser only.                                              */
/* ------------------------------------------------------------------ */
function AllowanceCard() {
  const [rows, setRows]     = useState([])
  const [msg, setMsg]       = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF]   = useState({})
  const [f, setF] = useState({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('allowance_config').select('*').order('designation'); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.designation.trim()) { flash('Enter a designation (or DEFAULT for the fallback amount).'); return }
    const { error } = await supabase.from('allowance_config').insert({
      designation: f.designation.trim(), allowance_name: f.allowance_name.trim() || 'Internet/Telephone Allowance', amount: +f.amount || 0,
    })
    if (error) flash(error.message.includes('duplicate') ? 'This designation + allowance already has a row — edit it instead.' : error.message)
    else { setF({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' }); load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ designation: r.designation, allowance_name: r.allowance_name, amount: r.amount }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('allowance_config').update({
      designation: editF.designation, allowance_name: editF.allowance_name, amount: +editF.amount || 0, updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const toggleActive = async (r) => { await supabase.from('allowance_config').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('allowance_config').delete().eq('id', id); load() }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1"><Percent size={18} className="text-forest" /> Allowance configuration</h2>
      <p className="text-xs text-pine/50 mb-4">Designation-wise fixed allowance amounts (e.g. Internet/Telephone) used when generating monthly payroll. Add a row named <span className="font-mono">DEFAULT</span> as a fallback for any designation without its own row.</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="Designation (e.g. Manager, DEFAULT)" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
        <input className="input col-span-2" placeholder="Allowance name" value={f.allowance_name} onChange={(e) => setF({ ...f, allowance_name: e.target.value })} />
        <input type="number" className="input money" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Designation</th><th className="th">Allowance</th><th className="th text-right">Amount</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td"><input className="input !py-1" value={editF.designation} onChange={(e) => setEditF({ ...editF, designation: e.target.value })} /></td>
              <td className="td"><input className="input !py-1" value={editF.allowance_name} onChange={(e) => setEditF({ ...editF, allowance_name: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-24 text-right" value={editF.amount} onChange={(e) => setEditF({ ...editF, amount: e.target.value })} /></td>
              <td className="td"><span className="text-xs text-pine/40">—</span></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm font-medium">{r.designation}</td>
              <td className="td text-sm">{r.allowance_name}</td>
              <td className="td money text-right">{fmtBDT(r.amount)}</td>
              <td className="td"><button onClick={() => toggleActive(r)} className={`status-chip ${r.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'}`}>{r.is_active ? 'Active' : 'Disabled'}</button></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No allowance rows yet — add a DEFAULT row above so payroll has a fallback amount.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
/* ------------------------------------------------------------------ */
/*  ROLE PERMISSIONS MATRIX — role × module × (view/create/edit/delete) */
/*  Admin & Superuser only. Drives can()/canCreate()/canEdit()/canDelete()*/
/*  in lib/roles.js at runtime — changes here take effect on next page    */
/*  load / role switch, no code deploy needed.                            */
/* ------------------------------------------------------------------ */
const PRIV_ROLES = ['SUPERUSER', 'ADMIN', 'MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING']
const PRIV_MODULES = [
  'dashboard', 'reservations', 'calendar', 'nightaudit', 'housekeeping', 'pos',
  'facilities', 'inventory', 'vat', 'accounting', 'hr', 'reports', 'settings', 'cms',
]
const MODULE_LABELS = {
  dashboard: 'Dashboard', reservations: 'Reservations', calendar: 'Booking Calendar',
  nightaudit: 'Night Audit', housekeeping: 'Housekeeping', pos: 'Restaurant POS',
  facilities: 'Facilities', inventory: 'Inventory', vat: 'VAT Center',
  accounting: 'Accounting', hr: 'HR & Office', reports: 'Reports',
  settings: 'Settings', cms: 'Client Management',
}

function RolePrivilegesCard() {
  const [rows, setRows]             = useState([])
  const [activeRole, setActiveRole] = useState('MANAGER')
  const [msg, setMsg]               = useState('')
  const [busy, setBusy]             = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data } = await supabase.from('role_privileges').select('*').order('role').order('module')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  // SUPERUSER and ADMIN always have full access everywhere in the app
  // (can() in lib/roles.js short-circuits for them) — editing their rows
  // here wouldn't change actual behaviour, so don't offer them as a tab.
  const editableRoles = PRIV_ROLES.filter((r) => r !== 'SUPERUSER' && r !== 'ADMIN')

  const rowFor = (role, module) => rows.find((r) => r.role === role && r.module === module)

  const toggle = async (role, module, field, current) => {
    const r = rowFor(role, module)
    if (!r) { flash(`No row found for ${role} / ${module} — this shouldn't happen, contact support.`); return }
    setBusy(true)
    const next = !current
    setRows((prev) => prev.map((row) => row.id === r.id ? { ...row, [field]: next } : row))
    const { error } = await supabase.from('role_privileges').update({ [field]: next, updated_at: new Date().toISOString() }).eq('id', r.id)
    setBusy(false)
    if (error) { flash(error.message); load() } // revert from DB on failure
  }

  const Check = ({ on, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
        on ? 'bg-forest border-forest text-white' : 'bg-white border-leaf text-transparent hover:border-forest/40'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      ✓
    </button>
  )

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1"><ShieldCheck size={18} className="text-forest" /> Role permissions</h2>
      <p className="text-xs text-pine/50 mb-4">Controls which modules each role can view, and whether they can create, edit, or delete within that module. Superuser and Administrator always have full access everywhere, so they're not listed here. Changes apply immediately — no redeploy needed.</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf flex-wrap mb-4">
        {editableRoles.map((r) => (
          <button key={r} onClick={() => setActiveRole(r)} className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg ${activeRole === r ? 'bg-forest/10 border border-leaf border-b-white text-forest -mb-px' : 'text-pine/50 hover:text-pine'}`}>
            {ROLE_LABELS[r] || r}
          </button>
        ))}
      </div>

      <table className="w-full">
        <thead><tr>
          <th className="th">Module</th>
          <th className="th text-center">View</th>
          <th className="th text-center">Create</th>
          <th className="th text-center">Edit</th>
          <th className="th text-center">Delete</th>
        </tr></thead>
        <tbody>
          {PRIV_MODULES.map((m) => {
            const r = rowFor(activeRole, m)
            if (!r) return (
              <tr key={m}><td className="td text-sm text-pine/40" colSpan={5}>{MODULE_LABELS[m]} — no row (contact support to backfill).</td></tr>
            )
            return (
              <tr key={m}>
                <td className="td text-sm font-medium">{MODULE_LABELS[m]}</td>
                <td className="td text-center"><Check on={r.can_view} disabled={busy} onClick={() => toggle(activeRole, m, 'can_view', r.can_view)} /></td>
                <td className="td text-center"><Check on={r.can_create} disabled={busy} onClick={() => toggle(activeRole, m, 'can_create', r.can_create)} /></td>
                <td className="td text-center"><Check on={r.can_edit} disabled={busy} onClick={() => toggle(activeRole, m, 'can_edit', r.can_edit)} /></td>
                <td className="td text-center"><Check on={r.can_delete} disabled={busy} onClick={() => toggle(activeRole, m, 'can_delete', r.can_delete)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
/*  RICH TEXT EDITOR — contentEditable, properly implemented           */
/* ------------------------------------------------------------------ */
function RichTextEditor({ initialHtml, onSave, saveLabel = 'Save' }) {
  const editorRef = useRef(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  // Set content ONCE on mount via ref — never via dangerouslySetInnerHTML
  // This avoids React re-rendering the div and resetting cursor position
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml || ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toolbar button handler — MUST use onMouseDown + preventDefault
  // so the editor div never loses focus before execCommand fires
  const cmd = (command, value = null) => (e) => {
    e.preventDefault()        // stop button from blurring the editor
    e.stopPropagation()
    editorRef.current?.focus() // ensure editor has focus
    document.execCommand(command, false, value)
    editorRef.current?.focus() // restore focus after command (some browsers lose it)
  }

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || ''
    setSaving(true)
    await onSave(html)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const togglePreview = () => {
    const html = editorRef.current?.innerHTML || ''
    setPreviewHtml(html)
    setPreview((v) => !v)
  }

  const Btn = ({ command, value, title, children }) => (
    <button
      type="button"
      title={title}
      onMouseDown={cmd(command, value)}
      className="w-8 h-8 flex items-center justify-center rounded text-pine/50 hover:bg-leaf hover:text-forest transition-colors select-none"
    >
      {children}
    </button>
  )

  const Sep = () => <div className="w-px h-5 bg-pine/15 mx-0.5 shrink-0" />

  return (
    <div className="border border-leaf rounded-xl overflow-hidden shadow-sm">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-stone-50 border-b border-leaf">

        {/* Text style */}
        <Btn command="bold"      title="Bold (Ctrl+B)">      <strong>B</strong></Btn>
        <Btn command="italic"    title="Italic (Ctrl+I)">    <em>I</em></Btn>
        <Btn command="underline" title="Underline (Ctrl+U)"> <span className="underline">U</span></Btn>
        <Btn command="strikeThrough" title="Strikethrough">  <span className="line-through">S</span></Btn>
        <Sep />

        {/* Block format */}
        <Btn command="formatBlock" value="h2"  title="Heading 1"> <span className="text-xs font-bold">H1</span></Btn>
        <Btn command="formatBlock" value="h3"  title="Heading 2"> <span className="text-xs font-bold">H2</span></Btn>
        <Btn command="formatBlock" value="p"   title="Paragraph"> <span className="text-xs">¶</span></Btn>
        <Sep />

        {/* Lists */}
        <Btn command="insertUnorderedList" title="Bullet list">  <span className="text-sm">•≡</span></Btn>
        <Btn command="insertOrderedList"   title="Numbered list"><span className="text-sm">1≡</span></Btn>
        <Btn command="outdent"  title="Decrease indent"> <span className="text-sm">←</span></Btn>
        <Btn command="indent"   title="Increase indent"> <span className="text-sm">→</span></Btn>
        <Sep />

        {/* Alignment */}
        <Btn command="justifyLeft"   title="Align left">   <span className="text-xs">◀═</span></Btn>
        <Btn command="justifyCenter" title="Align center"> <span className="text-xs">═◼═</span></Btn>
        <Btn command="justifyRight"  title="Align right">  <span className="text-xs">═▶</span></Btn>
        <Btn command="justifyFull"   title="Justify">      <span className="text-xs">☰</span></Btn>
        <Sep />

        {/* Misc */}
        <Btn command="removeFormat" title="Clear formatting"><span className="text-xs line-through opacity-60">A</span></Btn>

        <div className="flex-1" />

        {/* Preview toggle */}
        <button
          type="button"
          onClick={togglePreview}
          className={`px-2.5 py-1 rounded text-xs font-medium mr-1 transition-colors ${preview ? 'bg-forest/15 text-forest' : 'bg-white border border-leaf text-pine/60 hover:text-pine'}`}
        >
          {preview ? '✏ Edit' : '👁 Preview'}
        </button>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-forest/15 text-forest' : 'bg-forest text-white hover:bg-forest/90'}`}
        >
          <Save size={12} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : saveLabel}
        </button>
      </div>

      {/* ── Editor / Preview ── */}
      {preview ? (
        <div
          className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed focus:outline-none"
          style={{ caretColor: '#1B4D2E' }}
          onKeyDown={(e) => {
            // Ctrl+B / Ctrl+I / Ctrl+U — let browser handle natively, they work in contentEditable
            if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase())) {
              // Allow default — browser handles these natively in contentEditable
            }
          }}
        />
      )}

      {/* Footer hint */}
      <div className="px-4 py-2 bg-stone-50 border-t border-leaf flex items-center justify-between text-xs text-pine/40">
        <span>Select text then use toolbar · Ctrl+B Bold · Ctrl+I Italic · Ctrl+U Underline</span>
        <span>Saves separately from profile</span>
      </div>
    </div>
  )
}

// ─── VAT Circle master list ───────────────────────────────────────────────────
const VAT_CIRCLES = [
  // LTU
  { comm: "LTU (বৃহৎ করদাতা ইউনিট)", code: "0006", circles: ["LTU মূসক সার্কেল-১","LTU মূসক সার্কেল-২","LTU মূসক সার্কেল-৩","LTU মূসক সার্কেল-৪","LTU মূসক সার্কেল-৫","LTU মূসক সার্কেল-৬"] },
  // Dhaka South
  { comm: "ঢাকা (দক্ষিণ)", code: "0010", circles: ["মতিঝিল সার্কেল","রাজারবাগ সার্কেল","আরামবাগ সার্কেল","রামপুরা সার্কেল","সেগুনবাগিচা সার্কেল","সিদ্ধেশ্বরী সার্কেল","ফুলবাড়িয়া সার্কেল","পল্টন সার্কেল","তেজগাঁও সার্কেল","বেগুনবাড়ি সার্কেল","কাওরানবাজার সার্কেল","ফার্মগেট সার্কেল","ধানমন্ডি সার্কেল","রায়েরবাজার সার্কেল","কাঁঠালবাগান সার্কেল","নীলক্ষেত সার্কেল","আজিমপুর সার্কেল","ইমামগঞ্জ সার্কেল","কেরাণীগঞ্জ সার্কেল","হাসনাবাদ সার্কেল","আরমানিটোলা সার্কেল","বংশাল সার্কেল","চকবাজার সার্কেল","বকশীবাজার সার্কেল","নারায়ণগঞ্জ সার্কেল","ফতুল্লা সার্কেল","আলীগঞ্জ সার্কেল","এনায়েতনগর সার্কেল","মুন্সীগঞ্জ সার্কেল","গজারিয়া সার্কেল","শ্রীনগর সার্কেল","সিরাজদীখাঁন সার্কেল"] },
  // Dhaka North
  { comm: "ঢাকা (উত্তর)", code: "0015", circles: ["গুলশান সার্কেল","বনানী সার্কেল","বারিধারা সার্কেল","খিলক্ষেত সার্কেল","উত্তরা সার্কেল","টঙ্গী সার্কেল","আশুলিয়া সার্কেল","সাভার সার্কেল","মিরপুর সার্কেল","পল্লবী সার্কেল","শাহ আলী সার্কেল","কাফরুল সার্কেল","ময়মনসিংহ সার্কেল-১","ময়মনসিংহ সার্কেল-২","ময়মনসিংহ সার্কেল-৩"] },
  // Dhaka East
  { comm: "ঢাকা (পূর্ব)", code: "0030", circles: ["সূত্রাপুর সার্কেল","ওয়ারী সার্কেল","দেমরা সার্কেল","শ্যামপুর সার্কেল","কদমতলী সার্কেল","জুরাইন সার্কেল","সোনারগাঁও সার্কেল","আড়াইহাজার সার্কেল","রূপগঞ্জ সার্কেল","বন্দর সার্কেল","সিদ্ধিরগঞ্জ সার্কেল"] },
  // Dhaka West
  { comm: "ঢাকা (পশ্চিম)", code: "0035", circles: ["মোহাম্মদপুর সার্কেল","লালমাটিয়া সার্কেল","বেড়িবাঁধ সার্কেল","সাভার সার্কেল (ঢাপশ)","ধামরাই সার্কেল","হেমায়েতপুর সার্কেল","টাঙ্গাইল সার্কেল-১","টাঙ্গাইল সার্কেল-২","টাঙ্গাইল সার্কেল-৩"] },
  // Chittagong
  { comm: "চট্টগ্রাম", code: "0025", circles: ["আগ্রাবাদ সার্কেল","হালিশহর সার্কেল","ডবলমুরিং সার্কেল","পাঁচলাইশ সার্কেল","সদরঘাট সার্কেল","কোতোয়ালি সার্কেল","চকবাজার সার্কেল (চট্ট)","বাকলিয়া সার্কেল","কর্ণফুলী সার্কেল","আনোয়ারা সার্কেল","চন্দনাইশ সার্কেল","পটিয়া সার্কেল","সীতাকুণ্ড সার্কেল","ফটিকছড়ি সার্কেল","মিরসরাই সার্কেল","কক্সবাজার সার্কেল-১","কক্সবাজার সার্কেল-২","চকরিয়া সার্কেল","টেকনাফ সার্কেল","রাঙামাটি সার্কেল","খাগড়াছড়ি সার্কেল","বান্দরবান সার্কেল"] },
  // Sylhet
  { comm: "সিলেট", code: "0018", circles: ["সিলেট সার্কেল-১","সিলেট সার্কেল-২","সিলেট সার্কেল-৩","সিলেট সার্কেল-৪","মৌলভীবাজার সার্কেল","শ্রীমঙ্গল সার্কেল","কমলগঞ্জ সার্কেল","কুলাউড়া সার্কেল","হবিগঞ্জ সার্কেল-১","হবিগঞ্জ সার্কেল-২","মাধবপুর সার্কেল","সুনামগঞ্জ সার্কেল-১","সুনামগঞ্জ সার্কেল-২"] },
  // Rajshahi
  { comm: "রাজশাহী", code: "0020", circles: ["রাজশাহী সার্কেল-১","রাজশাহী সার্কেল-২","রাজশাহী সার্কেল-৩","বগুড়া সার্কেল-১","বগুড়া সার্কেল-২","বগুড়া সার্কেল-৩","পাবনা সার্কেল-১","পাবনা সার্কেল-২","নওগাঁ সার্কেল","চাঁপাইনবাবগঞ্জ সার্কেল","সিরাজগঞ্জ সার্কেল"] },
  // Khulna
  { comm: "খুলনা", code: "0001", circles: ["খুলনা সার্কেল-১","খুলনা সার্কেল-২","খুলনা সার্কেল-৩","বরিশাল সার্কেল-১","বরিশাল সার্কেল-২","বরিশাল সার্কেল-৩","বাগেরহাট সার্কেল","পিরোজপুর সার্কেল","ঝালকাঠি সার্কেল"] },
  // Jessore
  { comm: "যশোর", code: "0005", circles: ["যশোর সার্কেল-১","যশোর সার্কেল-২","যশোর সার্কেল-৩","কুষ্টিয়া সার্কেল-১","কুষ্টিয়া সার্কেল-২","মেহেরপুর সার্কেল","সাতক্ষীরা সার্কেল","ঝিনাইদহ সার্কেল","মাগুরা সার্কেল"] },
  // Comilla
  { comm: "কুমিল্লা", code: "0040", circles: ["কুমিল্লা সার্কেল-১","কুমিল্লা সার্কেল-২","কুমিল্লা সার্কেল-৩","কুমিল্লা সার্কেল-৪","ব্রাহ্মণবাড়িয়া সার্কেল-১","ব্রাহ্মণবাড়িয়া সার্কেল-২","আখাউড়া সার্কেল","নোয়াখালী সার্কেল-১","নোয়াখালী সার্কেল-২","ফেনী সার্কেল","লক্ষ্মীপুর সার্কেল","চাঁদপুর সার্কেল-১","চাঁদপুর সার্কেল-২"] },
  // Rangpur
  { comm: "রংপুর", code: "0045", circles: ["রংপুর সার্কেল-১","রংপুর সার্কেল-২","রংপুর সার্কেল-৩","দিনাজপুর সার্কেল-১","দিনাজপুর সার্কেল-২","দিনাজপুর সার্কেল-৩","গাইবান্ধা সার্কেল","নীলফামারী সার্কেল","কুড়িগ্রাম সার্কেল","লালমনিরহাট সার্কেল"] },
]

// flat list for dropdown
const ALL_CIRCLES = VAT_CIRCLES.flatMap((c) =>
  c.circles.map((name) => ({ label: name, value: name, comm: c.comm, code: c.code }))
)
function VatCircleDropdown({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? ALL_CIRCLES.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.comm.toLowerCase().includes(query.toLowerCase()) ||
        c.code.includes(query)
      )
    : ALL_CIRCLES

  const select = (item) => {
    onChange(item.value)
    setQuery('')
    setOpen(false)
  }

  // group filtered results by commissionerate
  const groups = VAT_CIRCLES.map((c) => ({
    comm: c.comm,
    code: c.code,
    items: filtered.filter((f) => f.comm === c.comm),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="relative" ref={ref}>
      {/* trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input text-left flex items-center justify-between w-full"
      >
        <span className={value ? 'text-pine' : 'text-pine/40'}>
          {value || 'সার্কেল নির্বাচন করুন…'}
        </span>
        <ChevronDown size={14} className={`text-pine/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-leaf rounded-xl shadow-lg overflow-hidden">
          {/* search box inside dropdown */}
          <div className="p-2 border-b border-leaf">
            <input
              autoFocus
              className="input !py-1.5 text-sm"
              placeholder="খুঁজুন… (যেমন: শ্রীমঙ্গল, সিলেট, 0018)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {groups.length === 0 && (
              <div className="px-4 py-3 text-sm text-pine/40">কোনো ফলাফল নেই।</div>
            )}
            {groups.map((g) => (
              <div key={g.comm}>
                {/* group header */}
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-pine/40 bg-stone-50 border-b border-leaf/50 flex justify-between">
                  <span>{g.comm}</span>
                  <span className="font-mono text-forest/60">{g.code}</span>
                </div>
                {g.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => select(item)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-leaf/60 transition-colors flex items-center justify-between ${
                      value === item.label ? 'bg-forest/10 text-forest font-medium' : 'text-pine'
                    }`}
                  >
                    <span>{item.label}</span>
                    {value === item.label && <span className="text-forest text-xs">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* clear button */}
          {value && (
            <div className="p-2 border-t border-leaf">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="w-full text-xs text-pine/50 hover:text-red-500 py-1 transition-colors"
              >
                ✕ Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
function BrandingCard({ reloadCompany }) {
  const [c, setC]   = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('company_settings').select('*').single(); setC(data) }
  useEffect(() => { load() }, [])
  if (!c) return <div className="card p-5 text-pine/50">Loading…</div>
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))

  const uploadLogo = async (file) => {
  if (!file) return
  // size guard — 2 MB max
  if (file.size > 2 * 1024 * 1024) { flash('File too large — max 2 MB.'); return }
  setBusy(true)
  try {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `logos/logo_${Date.now()}.${ext}`
    // remove old logo first (best-effort, ignore errors)
    if (c.logo_url) {
      const old = c.logo_url.split('/branding/').pop()
      if (old) await supabase.storage.from('branding').remove([old])
    }
    const { error: upErr } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
    if (upErr) { flash(`Upload failed: ${upErr.message}`); setBusy(false); return }
    const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
    const url = pub.publicUrl
    set('logo_url', url)
    const { error: dbErr } = await supabase.from('company_settings').update({ logo_url: url }).eq('id', c.id)
    if (dbErr) { flash(`Saved to storage but DB update failed: ${dbErr.message}`); } 
    else { flash('Logo uploaded successfully.'); reloadCompany?.() }
  } catch (e) { flash(e.message) }
  setBusy(false)
}

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('company_settings').update({
      name: c.name, legal_name: c.legal_name, address: c.address, phone: c.phone, email: c.email,
      bin: c.bin, vat_circle: c.vat_circle, invoice_footer: c.invoice_footer,
      short_code: c.short_code, software_name: c.software_name, currency: c.currency,
      primary_color: c.primary_color || null,
      accent_color: c.accent_color || null,
      brand_primary: c.brand_primary || null,
      brand_accent: c.brand_accent || null,
      mushak610_threshold: +c.mushak610_threshold || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
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
        <div><label className="label">Currency symbol</label><input className="input" value={c.currency || ''} onChange={(e) => set('currency', e.target.value)} /></div>
        <div><label className="label">Short code</label><input className="input money" value={c.short_code || ''} onChange={(e) => set('short_code', e.target.value)} /></div>
        <div><label className="label">Property name</label><input className="input" value={c.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Legal name</label><input className="input" value={c.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={c.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={c.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">BIN</label><input className="input money" value={c.bin || ''} onChange={(e) => set('bin', e.target.value)} /></div>
        <div><label className="label">Short code</label><input className="input money" value={c.short_code || ''} onChange={(e) => set('short_code', e.target.value)} /></div>
        <div><label className="label">Primary UI color (optional)</label><input type="color" className="input !p-1" value={c.primary_color || '#1F6F78'} onChange={(e) => set('primary_color', e.target.value)} /></div>
        <div><label className="label">Accent UI color (optional)</label><input type="color" className="input !p-1" value={c.accent_color || '#2E7D32'} onChange={(e) => set('accent_color', e.target.value)} /></div>
        <div><label className="label">Print primary (optional)</label><input type="color" className="input !p-1" value={c.brand_primary || '#1B4D2E'} onChange={(e) => set('brand_primary', e.target.value)} /></div>
        <div><label className="label">Print accent (optional)</label><input type="color" className="input !p-1" value={c.brand_accent || '#2E7D32'} onChange={(e) => set('brand_accent', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">VAT circle / division</label><VatCircleDropdown value={c.vat_circle || ''} onChange={(v) => set('vat_circle', v)} />{c.vat_circle && (<p className="text-xs text-pine/40 mt-1 font-mono">Challan code: 1/1133/{VAT_CIRCLES.find((g) => g.circles.includes(c.vat_circle))?.code || '????'}/0311</p>)}</div>
        <div><label className="label">Mushak-6.10 threshold</label><input type="number" className="input money" value={c.mushak610_threshold || 0} onChange={(e) => set('mushak610_threshold', e.target.value)} /></div>
        <div><label className="label">Invoice footer</label><input className="input" value={c.invoice_footer || ''} onChange={(e) => set('invoice_footer', e.target.value)} /></div>
      </div>
      <div className="mt-5">
        <label className="label">Default Terms &amp; Conditions</label>
        <RichTextEditor
          initialHtml={c.terms_conditions || ''}
          saveLabel="Save T&C"
          onSave={async (html) => {
            const { error } = await supabase.from('company_settings').update({
              terms_conditions: html, updated_at: new Date().toISOString(),
            }).eq('id', c.id)
            if (error) flash(error.message)
            else { flash('Terms & Conditions saved.'); reloadCompany?.() }
          }}
        />
      </div>
      <button className="btn-primary mt-4" disabled={busy} onClick={save}><Save size={15} /> Save profile</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TAX CONFIG — with inline edit                                       */
/* ------------------------------------------------------------------ */
function TaxCard() {
  const [rows, setRows]   = useState([])
  const [msg, setMsg]     = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF] = useState({})
  const [f, setF] = useState({ charge_type: 'ROOM', vat_pct: 15, service_charge_pct: 10, effective_from: todayISO() })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('tax_config').select('*').order('effective_from', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    const { error } = await supabase.from('tax_config').insert({ charge_type: f.charge_type, vat_pct: +f.vat_pct || 0, service_charge_pct: +f.service_charge_pct || 0, effective_from: f.effective_from })
    if (error) flash(error.message); else { load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ charge_type: r.charge_type, vat_pct: r.vat_pct, service_charge_pct: r.service_charge_pct, effective_from: r.effective_from }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('tax_config').update({ charge_type: editF.charge_type, vat_pct: +editF.vat_pct || 0, service_charge_pct: +editF.service_charge_pct || 0, effective_from: editF.effective_from }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
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
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td">
                <select className="input !py-1 !w-28" value={editF.charge_type} onChange={(e) => setEditF({ ...editF, charge_type: e.target.value })}>
                  {['ROOM', 'FOOD', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.vat_pct} onChange={(e) => setEditF({ ...editF, vat_pct: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.service_charge_pct} onChange={(e) => setEditF({ ...editF, service_charge_pct: e.target.value })} /></td>
              <td className="td"><input type="date" className="input !py-1" value={editF.effective_from} onChange={(e) => setEditF({ ...editF, effective_from: e.target.value })} /></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id}>
              <td className="td">{r.charge_type}</td>
              <td className="td money text-right">{r.vat_pct}%</td>
              <td className="td money text-right">{r.service_charge_pct}%</td>
              <td className="td text-sm">{r.effective_from}</td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  STAFF — inline edit, password reset, fixed to use app_users        */
/* ------------------------------------------------------------------ */
function StaffCard({ isAdminPlus, isSuperuser, currentUserName }) {
  const [rows, setRows]           = useState([])
  const [msg, setMsg]             = useState('')
  const [busy, setBusy]           = useState(false)
  const [nu, setNu]               = useState({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
  const [editId, setEditId]       = useState(null)
  const [editF, setEditF]         = useState({})
  const [resetTarget, setResetTarget] = useState(null)  // { id, name, email }
  const [newPwd, setNewPwd]       = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }

  const [myTenantId, setMyTenantId] = useState(null)

  // Tenant-filtered load: only show staff belonging to the current tenant
  const load = async (tid) => {
    const effectiveTid = tid !== undefined ? tid : myTenantId
    let q = supabase.from('app_users')
      .select('id, email, full_name, username, role, is_active, created_at')
      .order('created_at')
    if (effectiveTid) q = q.eq('tenant_id', effectiveTid)
    const { data } = await q
    setRows(data || [])
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u?.user?.id) { load(null); return }
      supabase.from('app_users').select('tenant_id').eq('id', u.user.id).single()
        .then(({ data: row }) => { const tid = row?.tenant_id || null; setMyTenantId(tid); load(tid) })
    })
  }, [])

  const LOGIN_DOMAIN = 'aura-stay.local'
  const availableRoles = isSuperuser ? ROLES : ROLES.filter((r) => r !== 'SUPERUSER')

  // ── Add new staff ──
  // ── Add new staff ──
  const addStaff = async () => {
    const uname = nu.username.trim().toLowerCase()
    if (!nu.full_name.trim() || !uname || nu.password.length < 6) { flash('Enter name, username and a password of at least 6 characters.'); return }
    if (/[^a-z0-9._-]/.test(uname)) { flash('Username may only use letters, numbers, dot, dash and underscore.'); return }
    setBusy(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { data: myRow, error: myRowErr } = await supabase
        .from('app_users').select('tenant_id').eq('id', currentUser?.id).single()
      if (myRowErr || !myRow?.tenant_id) { flash('Could not determine your company — please sign out and back in, then try again.'); setBusy(false); return }

      // Pre-check: username must be unique within this tenant
      const { data: dup } = await supabase
        .from('app_users').select('id').eq('tenant_id', myRow.tenant_id).eq('username', uname).maybeSingle()
      if (dup) { flash('Username already taken in your company.'); setBusy(false); return }

      // Build tenant-scoped email so Auth stays globally unique across tenants
      const { data: propRow } = await supabase
        .from('properties').select('slug').eq('id', myRow.tenant_id).maybeSingle()
      const tenantSlug = propRow?.slug || myRow.tenant_id.replace(/-/g, '').substring(0, 8)
      const email = `${uname}.${tenantSlug}@${LOGIN_DOMAIN}`

      // Use the admin-create-user Edge Function so that user creation succeeds
      // even when "Enable Signups" is disabled in the Supabase Auth dashboard.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email,
          password: nu.password,
          user_metadata: { username: uname, full_name: nu.full_name.trim(), tenant_id: myRow.tenant_id },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user account.')
      const newId = json.user?.id
      if (newId) await supabase.from('app_users').update({ role: nu.role, full_name: nu.full_name.trim(), username: uname }).eq('id', newId)
      setNu({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
      await load()
      flash(`Staff "${uname}" created successfully.`)
    } catch (e) { flash(e.message?.includes('already registered') ? 'Username already taken.' : e.message) }
    setBusy(false)
  }

  // ── Inline edit ──
  const startEdit = (u) => { setEditId(u.id); setEditF({ full_name: u.full_name || '', username: u.username || '', role: u.role }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('app_users').update({ full_name: editF.full_name, username: editF.username, role: editF.role }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Staff updated.') }
  }

  // ── Active/Inactive toggle ──
  const toggle = async (u) => { await supabase.from('app_users').update({ is_active: !u.is_active }).eq('id', u.id); load() }

  // ── Password reset for other users (Admin/Superuser) ──
  // Calls the existing wipe-nonuser-data Edge Function with action: reset_password
  const resetPassword = async () => {
    if (!resetTarget || newPwd.length < 6) { flash('New password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: resetTarget.id, new_password: newPwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Reset failed.')
      flash(`Password reset for ${resetTarget.name}.`)
      setResetTarget(null); setNewPwd('')
    } catch (e) { flash(`Password reset failed: ${e.message}`) }
    setBusy(false)
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-2"><Users size={18} className="text-forest" /> Staff</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      {/* Add new staff row */}
      {isAdminPlus && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          <input className="input" placeholder="Full name" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
          <input className="input" placeholder="Username" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <input type="password" className="input" placeholder="Password (min 6)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="btn-primary justify-center" disabled={busy} onClick={addStaff}><Plus size={15} /> Add</button>
        </div>
      )}

      {/* Password reset panel */}
      {resetTarget && (
        <div className="mb-4 p-4 rounded-xl border border-amber/30 bg-amber/5">
          <p className="text-sm font-semibold text-pine mb-2 flex items-center gap-2">
            <KeyRound size={15} className="text-amber-600" />
            Reset password for <span className="font-bold">{resetTarget.name}</span>
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <input
                type={showPwd ? 'text' : 'password'}
                className="input pr-9"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password (min 6 characters)"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button className="btn-primary" onClick={resetPassword} disabled={busy || newPwd.length < 6}>
              <KeyRound size={14} /> {busy ? 'Saving…' : 'Set new password'}
            </button>
            <button className="btn-ghost" onClick={() => { setResetTarget(null); setNewPwd('') }}>Cancel</button>
          </div>
          <p className="text-xs text-pine/50 mt-2">The user will need to use this password on their next login.</p>
        </div>
      )}

      {/* Staff table */}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Full name</th>
            <th className="th">Username</th>
            <th className="th">Role</th>
            <th className="th">Status</th>
            {isAdminPlus && <th className="th text-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => editId === u.id ? (
            <tr key={u.id} className="bg-leaf/20">
              <td className="td"><input className="input !py-1" value={editF.full_name} onChange={(e) => setEditF({ ...editF, full_name: e.target.value })} /></td>
              <td className="td"><input className="input !py-1 money" value={editF.username} onChange={(e) => setEditF({ ...editF, username: e.target.value })} /></td>
              <td className="td">
                <select className="input !py-1 !w-44" value={editF.role} onChange={(e) => setEditF({ ...editF, role: e.target.value })}>
                  {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </td>
              <td className="td"><span className="text-xs text-pine/40">—</span></td>
              <td className="td">
                <div className="flex gap-1 justify-center">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm font-medium">{u.full_name || '—'}</td>
              <td className="td text-sm money">{u.username || '—'}</td>
              <td className="td">
                <span className={`status-chip text-xs ${u.role === 'SUPERUSER' ? 'bg-purple-100 text-purple-700' : u.role === 'ADMIN' ? 'bg-forest/15 text-forest' : 'bg-leaf/50 text-pine'}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </td>
              <td className="td">
                <button
                  onClick={() => toggle(u)}
                  disabled={!isAdminPlus}
                  className={`status-chip ${u.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'} ${!isAdminPlus ? 'cursor-default opacity-60' : ''}`}
                >
                  {u.is_active ? 'Active' : 'Disabled'}
                </button>
              </td>
              {isAdminPlus && (
                <td className="td">
                  <div className="flex gap-1 justify-center">
                    {/* Edit name/username/role */}
                    <button
                      onClick={() => startEdit(u)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest"
                      title="Edit staff"
                    >
                      <Pencil size={13} />
                    </button>
                    {/* Password reset */}
                    <button
                      onClick={() => { setResetTarget({ id: u.id, name: u.full_name || u.username }); setNewPwd(''); setShowPwd(false) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber/10 text-pine/40 hover:text-amber-600"
                      title="Reset password"
                    >
                      <KeyRound size={13} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
// ─── COUNTRY FLAG EMOJI HELPER ────────────────────────────────────────────
const COUNTRY_FLAG = { BD: '🇧🇩', IN: '🇮🇳', AE: '🇦🇪', SG: '🇸🇬', TH: '🇹🇭', MY: '🇲🇾', '00': '🚫' }

const CHARGE_TYPE_META = {
  ROOM:          { label: 'Room / Accommodation', icon: '🛏️', color: 'blue' },
  RESTAURANT:    { label: 'Restaurant (F&B)',      icon: '🍽️', color: 'orange' },
  FOOD:          { label: 'Food Service',          icon: '🥘', color: 'amber' },
  LAUNDRY:       { label: 'Laundry',               icon: '👕', color: 'cyan' },
  ROOM_CORPORATE:{ label: 'Corporate Room (TDS)',  icon: '🏢', color: 'purple' },
  OTHER:         { label: 'Other Services',        icon: '🔧', color: 'slate' },
}

const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800',    head: 'bg-blue-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', head: 'bg-orange-100' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800',   head: 'bg-amber-100' },
  cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-800',     head: 'bg-cyan-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', head: 'bg-purple-100' },
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',   head: 'bg-slate-100' },
}

function TaxPolicyCard({ tenantId, isAdmin }) {
  const [countries,       setCountries]       = useState([])
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [templateRows,    setTemplateRows]    = useState([])
  const [activeConfig,    setActiveConfig]    = useState([])
  const [editMap,         setEditMap]         = useState({})
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState('')
  const [loading,         setLoading]         = useState(true)
  const [effectiveFrom,   setEffectiveFrom]   = useState(new Date().toISOString().split('T')[0])

  // Load distinct countries
  useEffect(() => {
    supabase
      .from('tax_policies')
      .select('country_code, country_name')
      .order('country_name')
      .then(({ data }) => {
        if (!data) return
        const seen = new Set()
        const unique = []
        for (const r of data) {
          if (!seen.has(r.country_code)) { seen.add(r.country_code); unique.push(r) }
        }
        setCountries(unique)
      })
  }, [])

  // Load tenant's current tax_config
  useEffect(() => {
    if (!tenantId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('tax_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('effective_from', { ascending: false })
      .then(({ data }) => {
        setLoading(false)
        if (!data || data.length === 0) return
        const latestMap = {}
        for (const row of data) {
          if (!latestMap[row.charge_type]) latestMap[row.charge_type] = row
        }
        const latest = Object.values(latestMap)
        setActiveConfig(latest)
        const em = {}
        for (const row of latest) {
          em[row.charge_type] = {
            tax_pct:            Number(row.tax_pct ?? row.vat_pct ?? 0),
            service_charge_pct: Number(row.service_charge_pct ?? 0),
            tds_pct:            Number(row.tds_pct ?? 0),
            vds_pct:            Number(row.vds_pct ?? 0),
            sd_pct:             Number(row.sd_pct ?? 0),
            is_tax_inclusive:   row.is_tax_inclusive ?? false,
          }
        }
        setEditMap(em)
        setEffectiveFrom(latest[0]?.effective_from ?? new Date().toISOString().split('T')[0])
      })
  }, [tenantId])

  // Load template when country selected
  useEffect(() => {
    if (!selectedCountry) return
    supabase
      .from('tax_policies')
      .select('*')
      .eq('country_code', selectedCountry.country_code)
      .order('charge_type')
      .then(({ data }) => setTemplateRows(data || []))
  }, [selectedCountry])

  // Pre-select country after both countries list and activeConfig are loaded
  useEffect(() => {
    if (countries.length === 0 || activeConfig.length === 0) return
    const cc = activeConfig[0]?.country_code || 'BD'
    const found = countries.find(c => c.country_code === cc)
    if (found) setSelectedCountry(found)
  }, [countries, activeConfig])

  function applyTemplate() {
    const em = {}
    for (const row of templateRows) {
      em[row.charge_type] = {
        tax_pct:            Number(row.tax_pct),
        service_charge_pct: Number(row.service_charge_pct),
        tds_pct:            Number(row.tds_pct),
        vds_pct:            Number(row.vds_pct),
        sd_pct:             Number(row.sd_pct),
        is_tax_inclusive:   row.is_tax_inclusive,
      }
    }
    setEditMap(em)
    setSaveMsg('✅ Template applied — review and save to confirm.')
  }

  function handleField(chargeType, field, value) {
    setEditMap(prev => ({
      ...prev,
      [chargeType]: {
        ...prev[chargeType],
        [field]: field === 'is_tax_inclusive' ? value : Number(value),
      },
    }))
  }

  async function handleSave() {
    if (!selectedCountry) { setSaveMsg('❌ Please select a country first.'); return }
    setSaving(true); setSaveMsg('')
    try {
      for (const ct of Object.keys(editMap)) {
        const vals = editMap[ct]
        const tmpl = templateRows.find(r => r.charge_type === ct)
        const payload = {
          tenant_id:          tenantId,
          charge_type:        ct,
          country_code:       selectedCountry.country_code,
          tax_name:           tmpl?.tax_name ?? 'VAT',
          tax_pct:            vals.tax_pct,
          vat_pct:            vals.tax_pct,
          service_charge_pct: vals.service_charge_pct,
          tds_pct:            vals.tds_pct,
          vds_pct:            vals.vds_pct,
          sd_pct:             vals.sd_pct,
          is_tax_inclusive:   vals.is_tax_inclusive,
          effective_from:     effectiveFrom,
        }
        const existing = activeConfig.find(r => r.charge_type === ct)
        if (existing) {
          await supabase.from('tax_config').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('tax_config').insert(payload)
        }
      }
      setSaveMsg('✅ Tax policy saved successfully.')
      const { data } = await supabase.from('tax_config').select('*').eq('tenant_id', tenantId).order('effective_from', { ascending: false })
      if (data) {
        const lm = {}
        for (const row of data) { if (!lm[row.charge_type]) lm[row.charge_type] = row }
        setActiveConfig(Object.values(lm))
      }
    } catch (e) {
      setSaveMsg('❌ Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return (
    <div className="card p-5 text-pine/50 text-sm">Tax policy configuration is available to administrators only.</div>
  )

  const chargeTypesInEdit = Object.keys(editMap)

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🏛️</span>
        <div>
          <h3 className="text-white font-bold text-lg">Tax Policy Configuration</h3>
          <p className="text-green-100 text-sm">Country-wise tax rates applied to each charge type</p>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Country Selector */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-semibold text-blue-800 mb-2">🌍 Select Country / Tax Jurisdiction</label>
          <div className="flex flex-wrap gap-2">
            {countries.map(c => (
              <button
                key={c.country_code}
                onClick={() => setSelectedCountry(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedCountry?.country_code === c.country_code
                    ? 'bg-blue-700 text-white border-blue-700 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-700'
                }`}
              >
                {COUNTRY_FLAG[c.country_code] || '🌐'} {c.country_name}
                {c.country_code !== '00' && <span className="ml-1 text-xs opacity-70">({c.country_code})</span>}
              </button>
            ))}
          </div>
          {selectedCountry && templateRows.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={applyTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                ⬇️ Load {selectedCountry.country_name} Template
              </button>
              <span className="text-xs text-blue-600">Loads standard rates — edit before saving</span>
            </div>
          )}
        </div>

        {/* Effective From */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">📅 Effective From:</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={e => setEffectiveFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {/* Charge Type Cards */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading current policy…</div>
        ) : chargeTypesInEdit.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-4xl mb-2">🌍</div>
            <p className="font-medium text-gray-600">Select a country and click "Load Template" to begin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chargeTypesInEdit.map(ct => {
              const meta   = CHARGE_TYPE_META[ct] || { label: ct, icon: '💰', color: 'slate' }
              const colors = COLOR_CLASSES[meta.color] || COLOR_CLASSES.slate
              const vals   = editMap[ct] || {}
              const tmpl   = templateRows.find(r => r.charge_type === ct)
              return (
                <div key={ct} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  <div className={`${colors.head} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="font-semibold text-gray-800 text-sm">{meta.label}</span>
                    </div>
                    {tmpl && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                        {tmpl.tax_name}
                      </span>
                    )}
                  </div>
                  <div className={`${colors.bg} p-4 space-y-3`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tax / VAT %</label>
                        <input type="number" min="0" max="100" step="0.01"
                          value={vals.tax_pct ?? 0}
                          onChange={e => handleField(ct, 'tax_pct', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Service Charge %</label>
                        <input type="number" min="0" max="100" step="0.01"
                          value={vals.service_charge_pct ?? 0}
                          onChange={e => handleField(ct, 'service_charge_pct', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    {(Number(vals.tds_pct) > 0 || Number(vals.vds_pct) > 0 || Number(vals.sd_pct) > 0 || ct === 'ROOM_CORPORATE') && (
                      <div className="grid grid-cols-3 gap-2">
                        {['tds_pct','vds_pct','sd_pct'].map(field => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.split('_')[0].toUpperCase()} %</label>
                            <input type="number" min="0" max="100" step="0.01"
                              value={vals[field] ?? 0}
                              onChange={e => handleField(ct, field, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-green-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={vals.is_tax_inclusive ?? false}
                        onChange={e => handleField(ct, 'is_tax_inclusive', e.target.checked)}
                        className="w-4 h-4 rounded text-green-600"
                      />
                      <span className="text-xs text-gray-600">Tax inclusive in price</span>
                    </label>
                    {tmpl?.notes && (
                      <p className="text-xs text-gray-500 italic bg-white/60 rounded px-2 py-1">ℹ️ {tmpl.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Save */}
        {chargeTypesInEdit.length > 0 && (
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition"
            >
              {saving ? '⏳ Saving…' : '💾 Save Tax Policy'}
            </button>
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        )}

        {/* Active Summary */}
        {activeConfig.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Currently Active Policy
              {activeConfig[0]?.country_code && (
                <span className="ml-2 normal-case font-normal text-gray-400">
                  — {COUNTRY_FLAG[activeConfig[0].country_code] || '🌐'} {activeConfig[0].country_code}
                  &nbsp;| Effective: {activeConfig[0].effective_from}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeConfig.map(r => {
                const meta = CHARGE_TYPE_META[r.charge_type] || { label: r.charge_type, icon: '💰' }
                return (
                  <span key={r.charge_type} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                    {meta.icon} {meta.label}:&nbsp;
                    <strong>{Number(r.tax_pct ?? r.vat_pct ?? 0)}%</strong>
                    {Number(r.service_charge_pct) > 0 && <> + {Number(r.service_charge_pct)}% SC</>}
                    {Number(r.tds_pct) > 0 && <> + {Number(r.tds_pct)}% TDS</>}
                  </span>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ADMIN FEATURE ACCESS — Superuser controls which modules each Admin  */
/*  user can see. Backed by the admin_feature_access table.             */
/* ------------------------------------------------------------------ */
function AdminFeatureAccessCard() {
  const [admins, setAdmins]           = useState([])
  const [access, setAccess]           = useState({})   // { [userId]: { [module]: boolean } }
  const [selectedUser, setSelectedUser] = useState(null)
  const [msg, setMsg]                 = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data: adminUsers } = await supabase
      .from('app_users')
      .select('id, full_name, username')
      .eq('role', 'ADMIN')
      .eq('is_active', true)
      .order('full_name')

    const { data: accessRows } = await supabase
      .from('admin_feature_access')
      .select('user_id, module, can_access')

    const map = {}
    for (const u of (adminUsers || [])) {
      map[u.id] = {}
      for (const mod of PRIV_MODULES) {
        map[u.id][mod] = true  // default: full access
      }
    }
    for (const row of (accessRows || [])) {
      if (map[row.user_id]) {
        map[row.user_id][row.module] = row.can_access !== false
      }
    }

    setAdmins(adminUsers || [])
    setAccess(map)
  }

  useEffect(() => { load() }, [])

  const toggle = async (userId, module) => {
    const current = access[userId]?.[module] ?? true
    const next    = !current

    setAccess((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [module]: next },
    }))

    if (next) {
      // Restore access — remove the restriction row
      const { error } = await supabase
        .from('admin_feature_access')
        .delete()
        .eq('user_id', userId)
        .eq('module', module)
      if (error) { flash(error.message); load() }
    } else {
      // Restrict — upsert with can_access = false
      const { error } = await supabase
        .from('admin_feature_access')
        .upsert({ user_id: userId, module, can_access: false }, { onConflict: 'user_id,module' })
      if (error) { flash(error.message); load() }
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1">
        <Lock size={18} className="text-forest" /> Admin Feature Access
      </h2>
      <p className="text-xs text-pine/50 mb-4">
        Control which modules each Admin user can access. Unchecked modules are hidden from that admin.
        Superusers always retain full access regardless of these settings.
      </p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      {admins.length === 0 ? (
        <p className="text-sm text-pine/40">
          No active Admin users found. Promote a user to the Admin role in Staff Management first.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {admins.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser((prev) => (prev === u.id ? null : u.id))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  selectedUser === u.id
                    ? 'bg-forest text-white border-forest'
                    : 'bg-white text-pine/70 border-leaf hover:border-forest/40 hover:text-pine'
                }`}
              >
                {u.full_name || u.username}
              </button>
            ))}
          </div>

          {selectedUser ? (
            <div className="grid grid-cols-2 gap-2">
              {PRIV_MODULES.map((mod) => {
                const canAccess = access[selectedUser]?.[mod] ?? true
                return (
                  <label key={mod} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-leaf cursor-pointer hover:bg-leaf/40 transition-colors">
                    <input
                      type="checkbox"
                      className="accent-forest w-4 h-4 shrink-0"
                      checked={canAccess}
                      onChange={() => toggle(selectedUser, mod)}
                    />
                    <span className="text-xs text-pine">{MODULE_LABELS[mod] || mod}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-pine/40 italic">Select an admin above to configure their feature access.</p>
          )}
        </>
      )}
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
    description: 'Reservations, guests, folio charges, payments, invoices, quotations, VAT sales register, night audits, guest IDs, loyalty ledger, companies',
    tables: ['folio_charges', 'payments', 'invoices', 'quotations', 'reservation_addons', 'reservation_guests', 'reservation_rooms', 'reservations', 'guests', 'vat_sales_register', 'night_audits', 'guest_ids', 'loyalty_ledger', 'companies'],
    // Each sequence only resets if ALL of its dependsOn tables are still checked —
    // resetting a number sequence while related rows are kept would cause duplicate/clashing numbers.
    sequences: [
      { id: 'res_no_seq',        dependsOn: ['reservations'] },
      { id: 'quote_no_seq',      dependsOn: ['quotations'] },
      { id: 'guest_bill_seq',    dependsOn: ['invoices'] },
      { id: 'mushak_serial_seq', dependsOn: ['vat_sales_register'] },
    ],
  },
  {
    id: 'pos',
    label: 'Restaurant POS',
    description: 'POS orders and order items',
    tables: ['pos_order_items', 'pos_orders'],
    sequences: [
      { id: 'pos_no_seq', dependsOn: ['pos_orders'] },
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    description: 'Facility sales (tea, pickle, sports, etc.)',
    tables: ['facility_sales'],
    sequences: [
      { id: 'fac_no_seq', dependsOn: ['facility_sales'] },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Attendance',
    description: 'Employees, attendance records, leave applications, compensatory leave register, incident register',
    tables: ['comp_leave_register', 'leave_applications', 'attendance_records', 'employees', 'incident_register'],
    sequences: [
      { id: 'emp_no_seq', dependsOn: ['employees'] },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Procurement',
    description: 'Requisitions, purchase orders, goods receipts, stock transfers, stock returns, VAT purchase register, vendors, inventory stock items',
    tables: ['return_items', 'stock_returns', 'transfer_items', 'stock_transfers', 'grn_items', 'goods_receipts', 'po_items', 'purchase_orders', 'requisition_items', 'requisitions', 'vat_purchase_register', 'vendors', 'inv_items'],
    sequences: [
      { id: 'req_no_seq', dependsOn: ['requisitions'] },
      { id: 'po_no_seq',  dependsOn: ['purchase_orders'] },
      { id: 'grn_no_seq', dependsOn: ['goods_receipts'] },
      { id: 'trf_no_seq', dependsOn: ['stock_transfers'] },
      { id: 'rtn_no_seq', dependsOn: ['stock_returns'] },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Journal entries, journal lines, VAT registers, document register, fixed assets, depreciation, VDS certificates',
    tables: ['journal_lines', 'journal_entries', 'vat_sales_register', 'vat_purchase_register', 'doc_register', 'fixed_assets', 'asset_depreciation', 'vds_certificates'],
    sequences: [
      { id: 'jv_no_seq',  dependsOn: ['journal_entries'] },
      { id: 'doc_no_seq', dependsOn: ['doc_register'] },
      { id: 'fa_no_seq',  dependsOn: ['fixed_assets'] },
      { id: 'vds_certificates_id_seq', dependsOn: ['vds_certificates'] },
    ],
  },
]

// Step states for the process flow animation
const STEP_IDLE    = 'idle'
const STEP_RUNNING = 'running'
const STEP_DONE    = 'done'
const STEP_ERROR   = 'error'

function DataWipeCard() {
  const [selected, setSelected]           = useState(null)
  const [checkedTables, setCheckedTables] = useState(new Set()) // tables staged for wipe within the selected module
  const [confirm, setConfirm]             = useState('')
  const [expanded, setExpanded]           = useState(false)
  const [phase, setPhase]                 = useState('idle') // idle | wiping | done | error
  const [steps, setSteps]                 = useState([])     // [{ id, label, type:'table'|'sequence', state, detail }]
  const [result, setResult]               = useState(null)   // final RPC result
  const [errMsg, setErrMsg]               = useState('')

  const module = WIPE_MODULES.find((m) => m.id === selected)

  const selectModule = (id) => {
    if (phase === 'wiping') return
    if (selected === id) {
      setSelected(null)
      setCheckedTables(new Set())
    } else {
      const m = WIPE_MODULES.find((mm) => mm.id === id)
      setSelected(id)
      setCheckedTables(new Set(m.tables)) // default: every table in the module is checked
    }
    setConfirm('')
    setPhase('idle')
    setSteps([])
    setResult(null)
    setErrMsg('')
  }

  const toggleTable = (t) => {
    if (phase === 'wiping') return
    setCheckedTables((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }
  const selectAllTables   = () => module && setCheckedTables(new Set(module.tables))
  const deselectAllTables = () => setCheckedTables(new Set())

  // Tables actually staged for wipe, kept in module order
  const tablesToWipe = module ? module.tables.filter((t) => checkedTables.has(t)) : []
  // A sequence only resets if every table it depends on is still checked —
  // resetting a number sequence while related rows survive would cause clashing/duplicate numbers
  const eligibleSequences = module ? module.sequences.filter((s) => s.dependsOn.every((t) => checkedTables.has(t))) : []
  const skippedSequences  = module ? module.sequences.filter((s) => !s.dependsOn.every((t) => checkedTables.has(t))) : []

  const startWipe = () => {
    if (!module || confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0) return
    // Build step list for animation
    const allSteps = [
      ...tablesToWipe.map((t) => ({ id: t, label: t, type: 'table', state: STEP_IDLE, detail: '' })),
      ...eligibleSequences.map((s) => ({ id: s.id, label: s.id, type: 'sequence', state: STEP_IDLE, detail: '' })),
    ]
    setSteps(allSteps)
    setPhase('wiping')
    runWipe(allSteps, tablesToWipe, eligibleSequences.map((s) => s.id))
  }

  const runWipe = async (initialSteps, tables, sequences) => {
    // Animate steps one by one with a small delay so user sees progress
    // then call the RPC which does the real work atomically
    const animated = [...initialSteps]

    // Animate table steps
    for (let i = 0; i < animated.length; i++) {
      animated[i] = { ...animated[i], state: STEP_RUNNING }
      setSteps([...animated])
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 80))
    }

    // Now do the actual RPC call — only the checked tables / eligible sequences
    try {
      const { data, error } = await supabase.rpc('wipe_module', {
        tables,
        sequences,
      })

      if (error) throw new Error(error.message)

      const rpcResult = data
      const errMap = {}
      for (const e of rpcResult.errors || []) {
        errMap[e.table || e.sequence] = e.error
      }
      const clearedMap = {}
      for (const c of rpcResult.tables_cleared || []) {
        clearedMap[c.table] = c.rows_deleted
      }
      const resetMap = {}
      for (const r of rpcResult.sequences_reset || []) {
        resetMap[r.sequence] = r.restarted_at
      }

      // Update step states from real results
      const finalSteps = animated.map((s) => {
        if (s.type === 'table') {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          const rows = clearedMap[s.id]
          return { ...s, state: STEP_DONE, detail: rows !== undefined ? `${rows} rows deleted` : 'cleared' }
        } else {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          return { ...s, state: STEP_DONE, detail: 'reset to 1' }
        }
      })
      setSteps(finalSteps)
      setResult(rpcResult)
      setPhase(rpcResult.success ? 'done' : 'error')
      if (!rpcResult.success) setErrMsg(`${rpcResult.errors.length} step(s) failed — see details above.`)
    } catch (e) {
      // Mark all remaining as error
      const errSteps = animated.map((s) => ({ ...s, state: STEP_ERROR, detail: e.message }))
      setSteps(errSteps)
      setPhase('error')
      setErrMsg(e.message)
    }
  }

  const reset = () => {
    setSelected(null); setCheckedTables(new Set()); setConfirm(''); setPhase('idle')
    setSteps([]); setResult(null); setErrMsg('')
  }

  return (
    <div className="card p-5 border border-red-200">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded((v) => !v)}>
        <h2 className="font-display font-semibold text-red-600 flex items-center gap-2">
          <AlertTriangle size={18} /> Superuser: Data wipe
        </h2>
        {expanded ? <ChevronUp size={18} className="text-red-400" /> : <ChevronDown size={18} className="text-red-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-pine/70">
            Permanently delete selected data and reset its reference number sequences to 1.
            This <span className="font-semibold text-red-600">cannot be undone.</span>
          </p>

          {/* Module selector — disabled while wiping */}
          <div className="grid grid-cols-1 gap-2">
            {WIPE_MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => selectModule(m.id)}
                disabled={phase === 'wiping'}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  selected === m.id
                    ? 'border-red-400 bg-red-50'
                    : 'border-leaf hover:border-red-300 hover:bg-red-50/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="font-medium text-sm text-pine">{m.label}</div>
                <div className="text-xs text-pine/50 mt-0.5">{m.description}</div>
              </button>
            ))}
          </div>

          {/* Table picker + confirm — only shown when a module is selected and not yet wiping */}
          {selected && module && phase === 'idle' && (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-red-700">
                  Wipe: <span className="underline">{module.label}</span>
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllTables} className="text-red-600 underline hover:text-red-700">Select all</button>
                  <span className="text-red-300">·</span>
                  <button onClick={deselectAllTables} className="text-red-600 underline hover:text-red-700">Deselect all</button>
                </div>
              </div>

              {/* Per-table checkboxes — uncheck any table to keep it out of this wipe */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-56 overflow-y-auto pr-1">
                {module.tables.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs text-pine cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-red-600 w-3.5 h-3.5"
                      checked={checkedTables.has(t)}
                      onChange={() => toggleTable(t)}
                    />
                    <span className="font-mono">{t}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-red-500">
                {tablesToWipe.length} of {module.tables.length} tables selected · {eligibleSequences.length} of {module.sequences.length} sequences will reset
              </p>

              {/* Sequences skipped because a table they depend on is unchecked */}
              {skippedSequences.length > 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  Not resetting: {skippedSequences.map((s) => `${s.id} (needs ${s.dependsOn.join(', ')} checked)`).join(' · ')}
                </p>
              )}

              <div>
                <label className="label text-red-700 !text-xs">Type <span className="font-mono font-bold">WIPE</span> to confirm</label>
                <input
                  className="input border-red-300 focus:ring-red-400 max-w-xs"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="WIPE"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                className="btn-primary !bg-red-600 hover:!bg-red-700"
                onClick={startWipe}
                disabled={confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0}
              >
                <AlertTriangle size={15} /> Start Wipe{tablesToWipe.length < module.tables.length ? ' (partial)' : ''}
              </button>
            </div>
          )}

          {/* ── PROCESS FLOW ANIMATION ── */}
          {steps.length > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  {phase === 'wiping' && (
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  )}
                  {phase === 'done' && <span className="text-forest">✓</span>}
                  {phase === 'error' && <span className="text-red-600">✗</span>}
                  {phase === 'wiping' ? `Wiping ${module.label}…` : phase === 'done' ? 'Wipe complete' : 'Wipe finished with errors'}
                </div>
                {(phase === 'done' || phase === 'error') && (
                  <button onClick={reset} className="text-xs text-pine/50 hover:text-pine underline">Reset</button>
                )}
              </div>

              {/* Two-column: tables | sequences */}
              <div className="grid grid-cols-2 divide-x divide-red-100">
                {/* Tables column */}
                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Tables</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'table').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        {/* State icon */}
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-red-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${
                            s.state === STEP_DONE  ? 'text-forest line-through opacity-60' :
                            s.state === STEP_ERROR ? 'text-red-600' :
                            s.state === STEP_RUNNING ? 'text-red-500 font-semibold' : 'text-pine/50'
                          }`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && (
                            <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sequences column */}
                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Sequences → reset to 1</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'sequence').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${
                            s.state === STEP_DONE  ? 'text-forest line-through opacity-60' :
                            s.state === STEP_ERROR ? 'text-red-600' :
                            s.state === STEP_RUNNING ? 'text-amber-600 font-semibold' : 'text-pine/50'
                          }`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && (
                            <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {steps.filter((s) => s.type === 'sequence').length === 0 && (
                      <div className="text-xs text-pine/40 italic">None eligible this run.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Result summary bar */}
              {phase === 'done' && result && (
                <div className="px-4 py-3 bg-forest/10 border-t border-forest/20 flex flex-wrap gap-4 text-xs">
                  <span className="font-semibold text-forest">✓ Wipe successful</span>
                  <span className="text-pine/60">{result.tables_cleared?.length || 0} tables cleared</span>
                  <span className="text-pine/60">{result.sequences_reset?.length || 0} sequences reset to 1</span>
                  <span className="text-pine/60">
                    {result.tables_cleared?.reduce((sum, t) => sum + (t.rows_deleted || 0), 0)} total rows deleted
                  </span>
                </div>
              )}
              {phase === 'error' && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-xs text-red-600">
                  ✗ {errMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
