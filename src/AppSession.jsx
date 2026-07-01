/* ------------------------------------------------------------------ */
/*  APP SESSION — auth state, company & profile loading                */
/* ------------------------------------------------------------------ */
import { useCallback, useEffect, useState } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { applyBrandTheme, buildBrandTheme, DEFAULT_THEME, resolveBrandTheme } from './lib/branding'
import { setCurrency } from './lib/helpers'
import { getTenantId, setTenantId } from './lib/tenant'
import { PATHS } from './app/paths'
import Login from './components/Login.jsx'
import { GuestPosKiosk } from './pages/RestaurantPOS.jsx'
import VerifyBill from './pages/VerifyBill.jsx'
import AppShell from './AppLayout.jsx'

export default function AppSession() {
  const location = useLocation()
  const [session,    setSession]    = useState(undefined)
  const [profile,    setProfile]    = useState(null)
  const [company,    setCompany]    = useState(null)
  const [privileges, setPrivileges] = useState(null)
  const [brandTheme, setBrandTheme] = useState(buildBrandTheme(DEFAULT_THEME))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // FIX 1 & 2: loadCompany defined BEFORE the useEffect that calls it,
  // and wrapped in useCallback so it has a stable reference for the dep array.
  const loadCompany = useCallback(async (forceTenantId) => {
    let tenantId = forceTenantId || getTenantId()
    if (!tenantId) {
      const firstPathPart = location.pathname.split('/').filter(Boolean)[0]
      const reservedPaths = new Set(Object.values(PATHS)
        .filter((path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('/:'))
        .map((path) => path.split('/').filter(Boolean)[0])
        .filter(Boolean))
      if (firstPathPart && !reservedPaths.has(firstPathPart.toLowerCase())) {
        const { data: slugProperty } = await supabase.from('properties').select('id').eq('slug', firstPathPart).maybeSingle()
        tenantId = slugProperty?.id || null
      }
    }
    if (!tenantId) {
      setCompany(null)
      return
    }
    const { data } = await supabase.from('company_settings').select('*').eq('tenant_id', tenantId).limit(1).maybeSingle()
    if (data) {
      setCurrency(data.currency || '৳')
      let propertyQuery = supabase.from('properties').select('slug')
      if (tenantId) propertyQuery = propertyQuery.eq('id', tenantId)
      const { data: prop } = await propertyQuery.limit(1).maybeSingle()
      setCompany({ ...data, slug: prop?.slug || null })
    }
  }, [location.pathname])

  useEffect(() => {
    if (!session) {
      setTenantId(null)
      setCompany(null)
      const fallbackTheme = buildBrandTheme(DEFAULT_THEME)
      setBrandTheme(fallbackTheme)
      applyBrandTheme(fallbackTheme)
      return
    }
    supabase.from('app_users').select('*').eq('auth_id', session.user.id).maybeSingle()
      .then(({ data }) => {
        const fallbackProfile = { role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] }
        const nextProfile = data || fallbackProfile
        setProfile(nextProfile)
        const tid = data?.tenant_id || null
        setTenantId(tid)
        loadCompany(tid)
      })
      .catch(() => {
        setProfile({ role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] })
        setTenantId(null)
        loadCompany(null)
      })
  }, [session?.user?.id, loadCompany])

  useEffect(() => {
    let active = true
    resolveBrandTheme(company)
      .then((theme) => {
        if (!active) return
        setBrandTheme(theme)
        applyBrandTheme(theme)
      })
      .catch(() => {
        if (!active) return
        const fallbackTheme = buildBrandTheme(DEFAULT_THEME)
        setBrandTheme(fallbackTheme)
        applyBrandTheme(fallbackTheme)
      })
    return () => { active = false }
  }, [
    company?.logo_url,
    company?.primary_color,
    company?.secondary_color,
    company?.accent_color,
    company?.brand_primary,
    company?.brand_accent,
    company?.sidebar_bg_color,
    company?.sidebar_text_color,
    company?.button_color,
    company?.table_header_color,
    company?.report_header_color,
    company?.font_family,
    company?.theme_mode,
  ])

  useEffect(() => {
    const role = profile?.role
    if (!role) return

    const tenantId = getTenantId()

    let query = supabase
      .from('role_privileges')
      .select('module, can_create, can_view, can_edit, can_delete')
      .eq('role', role)
    if (tenantId) query = query.eq('tenant_id', tenantId)

    // FIX 4 (confirmed): callback is async — await inside .then() is safe here.
    // Also replaced the nested supabase.auth.getUser() call with a direct userId
    // captured from session at effect-run time, avoiding an extra round-trip.
    const userId = profile?.id  // app_users.id matches auth user id
    query.then(async ({ data: basePrivs }) => {
      let privs = basePrivs || []

      if (role === 'ADMIN') {
        let adminAccessQuery = supabase
          .from('admin_feature_access')
          .select('module, can_access')
          .eq('user_id', userId) // ✅ FIX 4: no extra getUser() call needed
        if (tenantId) adminAccessQuery = adminAccessQuery.eq('tenant_id', tenantId)
        const { data: accessRows } = await adminAccessQuery

        if (accessRows && accessRows.length > 0) {
          const restricted = new Set(
            accessRows.filter(r => r.can_access === false).map(r => r.module)
          )
          if (restricted.size > 0) {
            privs = privs.map(p =>
              restricted.has(p.module)
                ? { ...p, can_view: false, can_create: false, can_edit: false, can_delete: false }
                : p
            )
          }
        }
      }

      setPrivileges(privs)
    })
  }, [profile?.role, profile?.id])

  // No-show sweep is now handled server-side via the auto-no-show Supabase
  // Edge Function scheduled by pg_cron. See:
  //   supabase/functions/auto-no-show/index.ts
  //   supabase/migrations/20260701000007_noshow_pg_cron.sql

  if (session === undefined) return (
    <div className="min-h-screen flex items-center justify-center text-pine/60">Loading…</div>
  )

  if (location.pathname.endsWith(PATHS.LOGIN)) {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const slug = pathParts.length > 1 ? pathParts[0] : undefined
    if (!session) return <Login slug={slug} />
    return <Navigate to={PATHS.FRONTOFFICE} replace />
  }

  if (!session && location.pathname.startsWith(PATHS.GUEST_KIOSK)) return <GuestPosKiosk />
  if (!session && location.pathname.startsWith(PATHS.VERIFY_BILL.replace(':id', ''))) return <VerifyBill />
  if (!session) return <Login />
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-pine/60">Loading profile...</div>
  )

  const role     = profile?.role || 'FRONT_OFFICE'
  const isAdmin  = role === 'ADMIN' || role === 'SUPERUSER'
  const userName = profile?.full_name || session.user?.email?.split('@')[0] || 'User'

  const themedCompany = company ? {
    ...company,
    primary_color: company.primary_color || brandTheme.primary,
    accent_color:  company.accent_color  || brandTheme.accent,
    brand_primary: company.brand_primary || brandTheme.printPrimary,
    brand_accent:  company.brand_accent  || brandTheme.printAccent,
  } : null

  return (
    <AppShell
      company={themedCompany}
      role={role}
      isAdmin={isAdmin}
      userName={userName}
      userId={profile?.auth_id || profile?.id}
      loadCompany={loadCompany}
      privileges={privileges}
    />
  )
}
