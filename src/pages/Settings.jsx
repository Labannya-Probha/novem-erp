import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  ChevronDown, ShieldCheck, KeyRound, Image, Printer, FileText,
  Percent, Lock, Users, Calendar, AlertTriangle, Building2,
} from 'lucide-react'
import BrandingCard from '../components/settings/BrandingCard'
import MyAccountCard from '../components/settings/MyAccountCard'
import SaasTenantAdminCard from '../components/settings/SaasTenantAdminCard'
import PosPrintSettingsCard from '../components/settings/PosPrintSettingsCard'
import AllowanceCard from '../components/settings/AllowanceCard'
import RolePrivilegesCard from '../components/settings/RolePrivilegesCard'
import StaffCard from '../components/settings/StaffCard'
import TaxPolicyCard from '../components/settings/TaxPolicyCard'
import AdminFeatureAccessCard from '../components/settings/AdminFeatureAccessCard'
import DataWipeCard from '../components/settings/DataWipeCard'
import ReservationPolicyCard from '../components/settings/ReservationPolicyCard'

export const SETTINGS_SECTIONS = [
  { id: 'my-account', label: 'My Account' },
  { id: 'saas-admin', label: 'SaaS Tenants', superuserOnly: true },
  { id: 'branding', label: 'Branding', adminOnly: true },
  { id: 'pos-print', label: 'POS Print Settings', adminOnly: true },
  { id: 'tax-policy', label: 'Tax Policy' },
  { id: 'allowance', label: 'Allowance Configuration', superuserOnly: true },
  { id: 'role-permissions', label: 'Role Permissions', superuserOnly: true },
  { id: 'admin-feature-access', label: 'Admin Feature Access', superuserOnly: true },
  { id: 'staff', label: 'Staff Management' },
  { id: 'accounting-integrations', label: 'Accounting Integrations', adminOnly: true },
  { id: 'data-system', label: 'Data & System', superuserOnly: true },
]

/* ------------------------------------------------------------------ */
/*  COLLAPSIBLE SECTION wrapper — click header to expand/collapse       */
/* ------------------------------------------------------------------ */
function CollapsibleSection({ title, icon: Icon, children, open, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-1 mb-1 group"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pine/50 group-hover:text-pine/80 transition-colors">
          {Icon && <Icon size={13} className="text-forest/70" />}
          {title}
        </span>
        <ChevronDown size={13} className={`text-pine/35 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ROOT — role-gated entry point                                       */
/* ------------------------------------------------------------------ */
export default function Settings({ userName, role, isAdmin, reloadCompany }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin          // Admin or above
  const canManage   = isAdminPlus || role === 'MANAGER'
  const [activeSection, setActiveSection] = useState(null)
  const [myTenantId, setMyTenantId]       = useState(null)
    useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u?.user?.id) return
      supabase.from('app_users')
        .select('tenant_id')
        .eq('id', u.user.id)
        .single()
        .then(({ data }) => { if (data?.tenant_id) setMyTenantId(data.tenant_id) })
    })
  }, [])
  if (!canManage) {
    return (
      <div className="card p-8 max-w-xl">
        <h1 className="font-display text-xl font-bold text-pine mb-2 flex items-center gap-2">
          <ShieldCheck size={20} /> Access restricted
        </h1>
        <p className="text-sm text-pine/60">Settings can only be accessed by managers or administrators.</p>
      </div>
    )
  }

  const sections = [
    { id: 'my-account', title: 'My Account', icon: KeyRound, visible: true, content: <MyAccountCard userName={userName} /> },
    { id: 'saas-admin', title: 'SaaS Tenants', icon: Building2, visible: isSuperuser, content: <SaasTenantAdminCard /> },
    { id: 'branding', title: 'Branding', icon: Image, visible: isAdminPlus, content: <BrandingCard reloadCompany={reloadCompany} /> },
    { id: 'pos-print', title: 'POS Print Settings', icon: Printer, visible: isAdminPlus, content: <PosPrintSettingsCard tenantId={myTenantId} /> },
    { id: 'tax-policy', title: 'Tax Policy', icon: FileText, visible: true, content: <TaxPolicyCard tenantId={myTenantId} isAdmin={isAdminPlus} /> },
    { id: 'allowance', title: 'Allowance Configuration', icon: Percent, visible: isSuperuser, content: <AllowanceCard /> },
    { id: 'role-permissions', title: 'Role Permissions', icon: ShieldCheck, visible: isSuperuser, content: <RolePrivilegesCard /> },
    { id: 'admin-feature-access', title: 'Admin Feature Access', icon: Lock, visible: isSuperuser, content: <AdminFeatureAccessCard /> },
    { id: 'staff', title: 'Staff Management', icon: Users, visible: true, content: <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} /> },
    { id: 'reservation-policy', title: 'Reservation Policy', icon: Calendar, visible: isAdminPlus, content: <ReservationPolicyCard /> },
    { id: 'data-system', title: 'Data & System', icon: AlertTriangle, visible: isSuperuser, content: <DataWipeCard /> },
  ].filter((s) => s.visible)

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('section')
    if (requested && sections.some((s) => s.id === requested)) {
      setActiveSection(requested)
      return
    }
    if (!activeSection || !sections.some((s) => s.id === activeSection)) {
      setActiveSection(sections[0]?.id || null)
    }
  }, [location.search, activeSection, isSuperuser, isAdminPlus])

  const openSection = (sectionId) => {
    setActiveSection(sectionId)
    navigate(`/settings?section=${sectionId}`, { replace: true })
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Settings</h1>
      <p className="text-sm text-pine/60 mb-6">Branding, tax rates, staff and system configuration.</p>
      <div className="space-y-4">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            open={activeSection === section.id}
            onToggle={() => openSection(section.id)}
          >
            {section.content}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}
