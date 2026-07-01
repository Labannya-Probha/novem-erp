import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { ROLE_LABELS } from '../../lib/roles'
import { ShieldCheck } from 'lucide-react'
import { PRIV_ROLES, PRIV_MODULES, MODULE_LABELS } from './settingsConfig'

export default function RolePrivilegesCard() {
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
    if (error) { flash(error.message); load() }
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
