import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn } from 'lucide-react'

// Hardcoded fallback — used if company_settings query fails for any reason
const FALLBACK_LOGO = 'https://gwllsoembqacolzfrquu.supabase.co/storage/v1/object/public/branding/logo_1781457117977.png'
const FALLBACK_NAME = 'Novem Eco Resort'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [busy, setBusy]         = useState(false)
  const [company, setCompany]   = useState(null)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    // Use anon key — RLS now allows anonymous read on company_settings
    supabase
      .from('company_settings')
      .select('logo_url, name, software_name')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (data) setCompany(data)
        // If query fails, fallback constants above will be used
      })
  }, [])

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

  const propertyName = company?.name || FALLBACK_NAME
  const softwareName = company?.software_name
    ? `${company.software_name} ERP`
    : FALLBACK_SOFTWARE
  const logoUrl = (company?.logo_url || FALLBACK_LOGO)

  return (
    <div className="min-h-screen flex items-center justify-center bg-pine relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, #fff 28px)' }}
      />

      <div className="card w-full max-w-sm p-8 relative shadow-2xl">

        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-20 h-20 rounded-2xl mb-4 overflow-hidden shadow-md bg-white flex items-center justify-center">
            {!imgFailed ? (
              <img
                src={logoUrl}
                alt={propertyName}
                className="w-full h-full object-contain p-1"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="w-full h-full bg-forest flex items-center justify-center">
                <span className="text-3xl font-bold text-white select-none">
                  {propertyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-pine leading-tight">{softwareName}</h1>
          <p className="text-sm text-pine/60 mt-1">Welcome to {propertyName}</p>
        </div>

        <div className="border-t border-leaf mb-6" />

        <div className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
            />
          </div>

          {err && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {err}
            </div>
          )}

          <button
            className="btn-primary w-full justify-center mt-2"
            onClick={signIn}
            disabled={busy || !username || !password}
          >
            <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-xs text-pine/40 text-center pt-1">
            Staff accounts are created by the administrator in Settings → Staff &amp; roles.
          </p>
        </div>
      </div>
    </div>
  )
}
