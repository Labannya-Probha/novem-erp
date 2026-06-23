import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn } from 'lucide-react'

// Hardcoded fallback — used if the slug lookup fails or no slug is given
const FALLBACK_LOGO     = 'https://gwllsoembqacolzfrquu.supabase.co/storage/v1/object/public/branding/logo_1781457117977.png'
const FALLBACK_NAME     = 'Novem Eco Resort'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'
const LOGIN_DOMAIN      = 'aura-stay.local'

// Default slug when accessing the root domain (www.erp.aurastay.bd with no path)
const DEFAULT_SLUG = 'novemecoresort'

export default function Login({ slug }) {
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [err,        setErr]        = useState('')
  const [busy,       setBusy]       = useState(false)
  const [company,    setCompany]    = useState(null)
  const [property,   setProperty]   = useState(null)
  const [notFound,   setNotFound]   = useState(false)
  const [imgFailed,  setImgFailed]  = useState(false)

  // Effective slug: use URL slug if present, otherwise fall back to default property
  const effectiveSlug = slug || DEFAULT_SLUG

  useEffect(() => {
    setImgFailed(false)
    setNotFound(false)

    supabase
      .from('properties')
      .select('id, slug, name, is_active')
      .eq('slug', effectiveSlug)
      .maybeSingle()
      .then(({ data: prop }) => {
        // Only show "not found" if an explicit slug was given and it doesn't exist
        if (!prop || !prop.is_active) {
          if (slug) { setNotFound(true) }
          return null
        }
        setProperty(prop)
        return supabase
          .from('company_settings')
          .select('logo_url, name, software_name, login_background_video_url')
          .eq('tenant_id', prop.id)
          .maybeSingle()
      })
      .then((res) => { if (res?.data) setCompany(res.data) })
  }, [effectiveSlug])

  const signIn = async () => {
    setBusy(true); setErr('')
    try {
      const uname = username.trim().toLowerCase()
      if (!uname) throw new Error('Enter your username')
      const candidates = [
        `${uname}.${effectiveSlug}@${LOGIN_DOMAIN}`,
        `${uname}@${LOGIN_DOMAIN}`,
      ]
      let signedIn = false
      for (const email of candidates) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (!error) { signedIn = true; break }
      }
      if (!signedIn) throw new Error('Wrong username or password')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (slug && notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
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
  const logoUrl = company?.logo_url || FALLBACK_LOGO

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper relative overflow-hidden">
      {company?.login_background_video_url ? (
        <>
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src={company.login_background_video_url} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/35" />
        </>
      ) : (
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(46,125,50,0.08), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.55), rgba(247,245,242,0.95))' }}
        />
      )}

      <div className="card w-full max-w-sm p-8 relative shadow-xl border border-leaf/80">

        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-24 h-24 rounded-2xl mb-4 overflow-hidden shadow-sm bg-white flex items-center justify-center ring-1 ring-leaf/70">
            {!imgFailed ? (
              <img
                src={logoUrl}
                alt={propertyName}
                className="w-full h-full object-contain"
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

        <div className="border-t border-leaf/80 mb-6" />

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

          <div className="pt-1 flex items-center justify-between text-xs text-pine/40">
            <div>© {new Date().getFullYear()} Aura Stay</div>
            <div>Powered by <span className="font-semibold text-pine/60">Aura Stay</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
