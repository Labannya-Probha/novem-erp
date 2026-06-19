import { useState } from 'react'
import { supabase } from '../supabase'
import { Leaf, LogIn } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true); setErr('')
    try {
      const uname = username.trim()
      if (!uname) throw new Error('Enter your username')
      const { data: email, error: re } = await supabase.rpc('email_for_username', { p_username: uname })
      if (re) throw re
      if (!email) throw new Error('No active account found for this username')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error('Wrong username or password')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pine relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, #fff 28px)' }} />
      <div className="card w-full max-w-sm p-8 relative">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-forest text-white flex items-center justify-center">
            <Leaf size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-pine leading-tight">Aura Stay ERP</h1>
            <p className="text-xs text-pine/60">Novem Eco Resort</p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" type="text" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" onKeyDown={(e) => e.key === 'Enter' && signIn()} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn()} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full justify-center" onClick={signIn} disabled={busy || !username || !password}>
            <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-pine/50 text-center">Staff accounts are created by the administrator in Settings → Staff &amp; roles.</p>
        </div>
      </div>
    </div>
  )
}
