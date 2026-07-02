import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LogIn, Eye, EyeOff } from 'lucide-react'

// Hardcoded fallback — used if the slug lookup fails or no slug is given
const FALLBACK_LOGO     = null
const FALLBACK_NAME     = 'Aura Stay'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'

// Default slug when accessing the root domain (www.erp.aurastay.bd with no path).
// Set VITE_DEFAULT_SLUG in your .env (see .env.example) to override.
const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_SLUG || 'novemecoresort'

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f0f4f8]">

      {/* ── Left branding panel (desktop only) ── */}
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[46%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, var(--tenant-dark) 0%, var(--tenant-primary) 100%)' }}
      >
        {/* decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 overflow-hidden flex-shrink-0">
            {!imgFailed && logoUrl ? (
              <img src={logoUrl} alt={propertyName} className="w-full h-full object-contain" onError={() => setImgFailed(true)} />
            ) : (
              <span className="text-lg font-bold text-white">{propertyName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">{softwareName}</div>
            <div className="text-white/60 text-xs">{propertyName}</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <h2 className="text-white font-bold text-3xl xl:text-4xl leading-tight mb-3">
            Hospitality<br />management,<br />simplified.
          </h2>
          <p className="text-white/65 text-sm leading-relaxed max-w-xs">
            A complete ERP platform for hotels, resorts and hospitality groups — from reservations to accounting.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Front Office', 'Reservations', 'Accounting', 'HR & Payroll', 'Reports'].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/15">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} Aura Stay · Enterprise ERP
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">

        {/* Video bg (mobile / when configured) */}
        {company?.login_background_video_url && (
          <>
            <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
              <source src={company.login_background_video_url} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}

        <div className="relative z-10 w-full max-w-sm">

          {/* Mobile logo (shown when left panel is hidden) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg bg-white ring-1 ring-black/8 flex items-center justify-center mb-3">
              {!imgFailed && logoUrl ? (
                <img src={logoUrl} alt={propertyName} className="w-full h-full object-contain" onError={() => setImgFailed(true)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--tenant-dark)' }}>
                  <span className="text-2xl font-bold text-white">{propertyName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <h1 className="font-bold text-xl text-slate-900">{softwareName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{propertyName}</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
            </div>

            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); signIn() }}>
              {/* Username */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="input"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
                  <span className="shrink-0 mt-px">⚠</span>
                  <span>{err}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !username || !password}
              >
                <LogIn size={16} />
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Bottom note */}
          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Aura Stay &nbsp;·&nbsp;
            Powered by <span className="font-semibold text-slate-500">Aura Stay ERP</span>
          </p>
        </div>
      </div>
    </div>
  )
}
