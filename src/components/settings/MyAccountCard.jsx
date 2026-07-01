import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { KeyRound, Save, Eye, EyeOff } from 'lucide-react'

export default function MyAccountCard({ userName }) {
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
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) { flash('Could not retrieve your account — please sign out and back in.'); setBusy(false); return }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInErr) { flash('Current password is incorrect.'); setBusy(false); return }
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
