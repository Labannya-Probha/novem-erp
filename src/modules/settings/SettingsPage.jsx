/* ------------------------------------------------------------------ */
/*  SETTINGS PAGE                                                       */
/*  Role-gated settings hub; sections are toggled via accordion.        */
/* ------------------------------------------------------------------ */
import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../supabase'
import AdminFeatureAccessCard from '../../components/settings/AdminFeatureAccessCard'
import ReservationPolicyCard from '../../components/settings/ReservationPolicyCard'
import { getVisibleSettingsSections } from '../../app/navigation/settingsSections'
import { useSettingsSection } from '../../hooks/useSettingsSection'
import { SECTION_ICONS } from './settings.config'
import { CollapsibleSection } from './settings.helpers'
import MyAccountSection from './sections/MyAccountSection'
import CompanySection from './sections/CompanySection'
import BrandingSection from './sections/BrandingSection'
import PosPrintSection from './sections/PosPrintSection'
import TaxPolicySection from './sections/TaxPolicySection'
import AccountingSetupSection from './sections/AccountingSetupSection'
import RolesPermissionsSection from './sections/RolesPermissionsSection'
import UsersStaffSection from './sections/UsersStaffSection'
import SystemDataSection from './sections/SystemDataSection'

export default function Settings({ userName, role, isAdmin, reloadCompany }) {
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin
  const canManage   = isAdminPlus || role === 'MANAGER'

  const [myTenantId, setMyTenantId] = useState(null)
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
    'my-account':           <MyAccountSection userName={userName} />,
    'saas-admin':           <CompanySection />,
    'branding':             <BrandingSection reloadCompany={reloadCompany} />,
    'pos-print':            <PosPrintSection tenantId={myTenantId} />,
    'tax-policy':           <TaxPolicySection tenantId={myTenantId} isAdmin={isAdminPlus} />,
    'allowance':            <AccountingSetupSection />,
    'role-permissions':     <RolesPermissionsSection />,
    'admin-feature-access': <AdminFeatureAccessCard />,
    'staff':                <UsersStaffSection isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} userName={userName} />,
    'reservation-policy':   <ReservationPolicyCard />,
    'data-system':          <SystemDataSection />,
  }), [isAdminPlus, isSuperuser, myTenantId, reloadCompany, userName])

  const sections = getVisibleSettingsSections({ role, isAdmin }).map((section) => ({
    ...section,
    title:   section.label,
    icon:    SECTION_ICONS[section.id],
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
