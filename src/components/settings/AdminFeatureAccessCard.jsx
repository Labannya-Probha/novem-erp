import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Lock } from 'lucide-react'
import { PRIV_MODULES, MODULE_LABELS } from './settingsConfig'

export default function AdminFeatureAccessCard() {
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
      const { error } = await supabase
        .from('admin_feature_access')
        .delete()
        .eq('user_id', userId)
        .eq('module', module)
      if (error) { flash(error.message); load() }
    } else {
      const { error } = await supabase
        .rpc('upsert_admin_feature_access', {
          p_user_id: userId,
          p_module: module,
          p_can_access: false,
          p_updated_by: null
        })
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
