import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn } from 'lucide-react'

// Fallback logo in case storage URL fails — use inline SVG so no network request needed
function FallbackLogo({ name }) {
  return (
    <div className="w-20 h-20 rounded-2xl bg-forest flex items-center justify-center mb-4 shadow-md">
      <span className="text-3xl font-bold text-white select-none">
        {(name || 'A').charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [busy, setBusy]         = useState(false)
  const [company, setCompany]   = useState(null)
  const [logoErr, setLogoErr]   = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(false)

  useEffect(() => {
    supabase
      .from('company_settings')
      .select('logo_url, name, software_name')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setCompany(data)
          setLogoErr(false)   // reset error state when new data arrives
          setLogoLoaded(false) // reset loaded state
        }
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

  const propertyName = company?.name || 'Novem Eco Resort'
  const softwareName = company?.software_name ? `${company.software_name} ERP` : 'Aura Stay ERP'
  const logoUrl      = company?.logo_url || null

  return (
    <div className="min-h-screen flex items-center justify-center bg-pine relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, #fff 28px)' }}
      />

      <div className="card w-full max-w-sm p-8 relative shadow-2xl">

        {/* Logo + Branding */}
        <div className="flex flex-col items-center text-center mb-7">

          {/* Logo — show image if URL exists and hasn't errored */}
          {logoUrl && !logoErr ? (
            <div className="relative w-20 h-20 mb-4">
              {/* Show placeholder until image actually loads */}
              {!logoLoaded && (
                <div className="absolute inset-0 rounded-2xl bg-forest/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-forest">{propertyName.charAt(0)}</span>
                </div>
              )}
              <img
                key={logoUrl}
                src={logoUrl}
                alt={propertyName}
                className={`w-20 h-20 rounded-2xl object-contain bg-white shadow-md p-1 transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLogoLoaded(true)}
                onError={() => { setLogoErr(true); setLogoLoaded(false) }}
              />
            </div>
          ) : (
            <FallbackLogo name={propertyName} />
          )}

          <h1 className="font-display text-2xl font-bold text-pine leading-tight">{softwareName}</h1>
          <p className="text-sm text-pine/60 mt-1">Welcome to {propertyName}</p>
        </div>

        <div className="border-t border-leaf mb-6" />

        {/* Form */}
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
