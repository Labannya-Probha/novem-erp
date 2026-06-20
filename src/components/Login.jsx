import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn } from 'lucide-react'

// Hardcoded fallback — used if the slug lookup fails or no slug is given
const FALLBACK_LOGO = 'https://gwllsoembqacolzfrquu.supabase.co/storage/v1/object/public/branding/logo_1781457117977.png'
const FALLBACK_NAME = 'Novem Eco Resort'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'

export default function Login({ slug }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [busy, setBusy]         = useState(false)
  const [company, setCompany]   = useState(null)
  const [property, setProperty] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setImgFailed(false)
    if (slug) {
      // Resolve slug -> property -> branding, all pre-auth (RLS allows public read on both)
      supabase
        .from('properties')
        .select('id, slug, name, is_active')
        .eq('slug', slug)
        .maybeSingle()
        .then(({ data: prop }) => {
          if (!prop || !prop.is_active) { setNotFound(true); return }
          setProperty(prop)
          return supabase
            .from('company_settings')
            .select('logo_url, name, software_name')
            .eq('tenant_id', prop.id)
            .maybeSingle()
        })
        .then((res) => { if (res?.data) setCompany(res.data) })
    } else {
      // No slug in the URL — fall back to the single default property lookup
      supabase
        .from('company_settings')
        .select('logo_url, name, software_name')
        .eq('id', 1)
        .single()
        .then(({ data }) => { if (data) setCompany(data) })
    }
  }, [slug])

  const signIn = async () => {
  setBusy(true); setErr('')
  try {
    const uname = username.trim()
    if (!uname) throw new Error('Enter your username')
    const { data: email, error: re } = await supabase.rpc('email_for_username', { p_username: uname, p_slug: slug || null })  // <-- this line
    if (re) throw re
    if (!email) throw new Error('No active account found for this username')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('Wrong username or password')
  } catch (e) { setErr(e.message) }
  setBusy(false)
}

  if (slug && notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pine">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="font-display text-xl font-bold text-pine mb-2">Property not found</h1>
          <p className="text-sm text-pine/60">No active property matches this link. Please check the URL or contact your administrator.</p>
        </div>
      </div>
    )
  }

  const propertyName = company?.name || property?.name || FALLBACK_NAME
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
      <div className="h-20 min-w-[5rem] max-w-[14rem] px-3 rounded-2xl mb-4 overflow-hidden shadow-md bg-white flex items-center justify-center">
  {!imgFailed ? (
    <img
      src={logoUrl}
      alt={propertyName}
      className="h-full w-auto max-w-full object-contain py-2"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span className="text-3xl font-bold text-forest select-none px-2">
      {propertyName.charAt(0).toUpperCase()}
    </span>
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
