import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { cn } from '../lib/utils'

// Hardcoded fallback — used if the slug lookup fails or no slug is given
const FALLBACK_LOGO     = null
const FALLBACK_NAME     = 'Aura Stay'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'

// Default slug when accessing the root domain (www.erp.aurastay.bd with no path)
const DEFAULT_SLUG = 'novemecoresort'

export default function Login({ slug }) {
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [err,          setErr]          = useState('')
  const [busy,         setBusy]         = useState(false)
  const [company,      setCompany]      = useState(null)
  const [property,     setProperty]     = useState(null)
  const [resolvedSlug, setResolvedSlug] = useState(slug || DEFAULT_SLUG)
  const [imgFailed,    setImgFailed]    = useState(false)

  // Effective slug: use URL slug if present, otherwise fall back to default property
  const effectiveSlug = slug || DEFAULT_SLUG

  useEffect(() => {
    setImgFailed(false)
    setProperty(null)
    setCompany(null)
    setResolvedSlug(effectiveSlug)

    const loadProperty = async (slugToTry) => {
      const { data: prop } = await supabase
        .from('properties')
        .select('id, slug, name, is_active')
        .eq('slug', slugToTry)
        .maybeSingle()

      if (prop?.is_active) {
        setProperty(prop)
        setResolvedSlug(prop.slug)
        const { data: cs } = await supabase
          .from('company_settings')
          .select('logo_url, name, software_name, login_background_video_url')
          .eq('tenant_id', prop.id)
          .maybeSingle()
        if (cs) setCompany(cs)
        return
      }

      // If the explicit slug wasn't found, fall back to the default property
      if (slugToTry !== DEFAULT_SLUG) {
        loadProperty(DEFAULT_SLUG)
      }
      // If DEFAULT_SLUG also fails, the login form shows with fallback branding
    }

    loadProperty(effectiveSlug)
  }, [effectiveSlug])

  const signIn = async () => {
    setBusy(true); setErr('')
    try {
      const uname = username.trim().toLowerCase()
      if (!uname) throw new Error('Enter your username')
      const { data: email, error: re } = await supabase.rpc('email_for_username', {
        p_username: uname,
        p_slug: resolvedSlug,
      })
      if (re) throw re
      if (!email) throw new Error('No active account found for this username')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error('Wrong username or password')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const propertyName = company?.name || property?.name || FALLBACK_NAME
  const softwareName = company?.software_name
    ? `${company.software_name} ERP`
    : FALLBACK_SOFTWARE
  const logoUrl = company?.logo_url || FALLBACK_LOGO

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper relative overflow-hidden">
      {/* Background */}
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
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(46,125,50,0.08), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.55), rgba(247,245,242,0.95))',
          }}
        />
      )}

      {/* Login Card */}
      <div className="card relative w-full max-w-sm border border-leaf/80 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col items-center text-center pb-5">
          {/* Logo / Avatar */}
          <div className={cn(
            'w-24 h-24 rounded-2xl mb-4 overflow-hidden shadow-sm bg-white flex items-center justify-center ring-1 ring-leaf/70',
          )}>
            {!imgFailed && logoUrl ? (
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

        <div className="h-px w-full bg-pine/10 mb-6" />

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); signIn() }}
          >
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="label mb-0 min-h-0">Username</label>
              <input
                id="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username"
                className="input"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="label mb-0 min-h-0">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={busy || !username || !password}
            >
              <LogIn size={16} />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            {/* Footer */}
            <div className="pt-1 flex items-center justify-between text-xs text-pine/40">
              <span>© {new Date().getFullYear()} Aura Stay</span>
              <span>
                Powered by <span className="font-semibold text-pine/60">Aura Stay</span>
              </span>
            </div>
          </form>
      </div>
    </div>
  )
}
