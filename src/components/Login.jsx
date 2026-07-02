import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Eye, EyeOff, Shield, LogIn } from 'lucide-react'

// Hardcoded fallback — used if the slug lookup fails or no slug is given
const FALLBACK_LOGO     = null
const FALLBACK_NAME     = 'Aura Stay'
const FALLBACK_SOFTWARE = 'Aura Stay ERP'

// Default slug when accessing the root domain (www.erp.aurastay.bd with no path).
// Set VITE_DEFAULT_SLUG in your .env (see .env.example) to override.
const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_SLUG || 'novemecoresort'

// Fallback background image shown while the video loads or if no video is configured
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80'

export default function Login({ slug }) {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [tenantCode,   setTenantCode]   = useState(slug || DEFAULT_SLUG)
  const [rememberMe,   setRememberMe]   = useState(false)
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
    setTenantCode(effectiveSlug)

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
      const uname = email.trim().toLowerCase()
      if (!uname) throw new Error('Enter your email or username')
      const slugToUse = tenantCode.trim() || resolvedSlug
      const { data: resolvedEmail, error: re } = await supabase.rpc('email_for_username', {
        p_username: uname,
        p_slug:     slugToUse,
      })
      if (re) throw re
      if (!resolvedEmail) throw new Error('No active account found for this username')
      const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
      if (error) throw new Error('Wrong username or password')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' })

  const signInWithMicrosoft = () =>
    supabase.auth.signInWithOAuth({ provider: 'azure' })

  const logoUrl   = company?.logo_url || FALLBACK_LOGO
  const videoUrl  = company?.login_background_video_url || null

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-[#0a2614]">

      {/* ── Video background ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={FALLBACK_POSTER}
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      >
        {videoUrl && <source src={videoUrl} type="video/mp4" />}
      </video>

      {/* ── Dark overlay ── */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, rgba(10,38,20,0.88) 0%, rgba(27,77,46,0.78) 50%, rgba(13,32,32,0.90) 100%)' }}
        aria-hidden="true"
      />

      {/* ── Login card ── */}
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto animate-fade-in-up">

        {/* Logo + title above the card */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl ring-1 ring-white/20 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}
          >
            {!imgFailed && logoUrl ? (
              <img
                src={logoUrl}
                alt="Aura Stay logo"
                className="w-full h-full object-contain"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className="text-3xl font-extrabold text-white select-none">A</span>
            )}
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">Aura Stay ERP</span>
        </div>

        {/* Glassmorphism card */}
        <div
          className="rounded-3xl border border-white/20 p-8 shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
          style={{ background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          <h2 className="text-white font-bold text-xl mb-6 leading-tight">
            Sign in to Aura Stay ERP
          </h2>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); signIn() }}>

            {/* Email / Username */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Email / Username
              </label>
              <input
                id="login-email"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email or username"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/70 focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/70 focus:border-transparent transition-all pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Property / Tenant Code */}
            <div className="space-y-1.5">
              <label htmlFor="login-tenant" className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Property / Tenant Code
              </label>
              <input
                id="login-tenant"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="organization"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                placeholder="Enter your property code"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/70 focus:border-transparent transition-all"
              />
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 cursor-pointer accent-[#2E7D32]"
                />
                <span className="text-sm text-white/65">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm text-white/65 hover:text-white transition-colors underline underline-offset-2 decoration-white/30 hover:decoration-white/70"
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {err && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 flex items-start gap-2">
                <span className="shrink-0 mt-px" aria-hidden="true">⚠</span>
                <span role="alert">{err}</span>
              </div>
            )}

            {/* Sign In */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 shadow-lg disabled:opacity-55 disabled:cursor-not-allowed mt-1"
              style={{ background: busy || !email || !password ? undefined : 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)' }}
              disabled={busy || !email || !password}
            >
              <LogIn size={16} aria-hidden="true" />
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-white/15" />
            <span className="text-[11px] text-white/40 uppercase tracking-widest">or continue with</span>
            <div className="flex-1 border-t border-white/15" />
          </div>

          {/* SSO Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/20 text-white text-sm font-medium transition-all duration-200"
            >
              {/* Google icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={signInWithMicrosoft}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/20 text-white text-sm font-medium transition-all duration-200"
            >
              {/* Microsoft icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022"/>
                <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00"/>
                <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF"/>
                <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </button>
          </div>

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-white/35 text-xs">
            <Shield size={12} aria-hidden="true" />
            <span>Secure multi-tenant ERP access</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-white/25">
          © 2026 Aura Stay ERP. All rights reserved.
        </p>
      </div>
    </div>
  )
}
