import { useEffect, useMemo, useState } from 'react'
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
import { getVisibleSettingsSections, SETTINGS_SECTIONS } from '../app/navigation/settingsSections'
import { useSettingsSection } from '../hooks/useSettingsSection'

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
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin          // Admin or above
  const canManage   = isAdminPlus || role === 'MANAGER'
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
  const sectionContents = useMemo(() => ({
    'my-account': <MyAccountCard userName={userName} />,
    'saas-admin': <SaasTenantAdminCard />,
    'branding': <BrandingCard reloadCompany={reloadCompany} />,
    'pos-print': <PosPrintSettingsCard tenantId={myTenantId} />,
    'tax-policy': <TaxPolicyCard tenantId={myTenantId} isAdmin={isAdminPlus} />,
    'allowance': <AllowanceCard />,
    'role-permissions': <RolePrivilegesCard />,
    'admin-feature-access': <AdminFeatureAccessCard />,
    'staff': <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} />,
    'reservation-policy': <ReservationPolicyCard />,
    'data-system': <DataWipeCard />,
  }), [isAdminPlus, isSuperuser, myTenantId, reloadCompany, userName])

  const sectionIcons = {
    'my-account': KeyRound,
    'saas-admin': Building2,
    'branding': Image,
    'pos-print': Printer,
    'tax-policy': FileText,
    'allowance': Percent,
    'role-permissions': ShieldCheck,
    'admin-feature-access': Lock,
    'staff': Users,
    'reservation-policy': Calendar,
    'data-system': AlertTriangle,
  }

  const sections = getVisibleSettingsSections({ role, isAdmin }).map((section) => ({
    ...section,
    title: section.label,
    icon: sectionIcons[section.id],
    content: sectionContents[section.id],
  }))

  const { activeSection, openSection } = useSettingsSection(sections)

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

export { SETTINGS_SECTIONS }
