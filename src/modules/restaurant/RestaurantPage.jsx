import { useEffect, useMemo, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { isModuleEnabled } from 'src/lib/saasModules'
import { getTenantId } from 'src/lib/tenant'
import { supabase } from 'src/supabase'
import Breadcrumb from 'src/components/layout/Breadcrumb'
import KpiStrip from 'src/components/layout/KpiStrip'
import ModuleTabs from 'src/components/layout/ModuleTabs'
import PageHeader from 'src/components/layout/PageHeader'
import PosOrdersTab from './tabs/PosOrdersTab'
import TableViewTab from './tabs/TableViewTab'
import MenuManagementTab from './tabs/MenuManagementTab'
import PrintCenterTab from './tabs/PrintCenterTab'
import DayCloseReportsTab from './tabs/DayCloseReportsTab'
import { useRestaurantTabs } from './hooks/useRestaurantTabs'

function withTenant(query) {
  const tenantId = getTenantId()
  return tenantId ? query.eq('tenant_id', tenantId) : query
}

export default function RestaurantPage({ userName, isAdmin, role, modulesEnabled, company }) {
  const canManageMenu = isModuleEnabled('menu-management', modulesEnabled, role) && (isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT')
  const { activeTab, tabs, setTab } = useRestaurantTabs({ canManageMenu })
  const [kpis, setKpis] = useState([])

  useEffect(() => {
    let isMounted = true

    async function loadKpis() {
      const [ordersRes, openRes, menuRes] = await Promise.all([
        withTenant(supabase.from('pos_orders').select('*', { count: 'exact', head: true })),
        withTenant(supabase.from('pos_orders').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'ACCEPTED', 'READY'])),
        withTenant(supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      ])

      if (!isMounted) return
      if (ordersRes.error || openRes.error || menuRes.error) return

      setKpis([
        { label: 'Total Orders', value: ordersRes.count ?? 0, icon: UtensilsCrossed },
        { label: 'Open Orders', value: openRes.count ?? 0, icon: UtensilsCrossed },
        { label: 'Active Menu Items', value: menuRes.count ?? 0, icon: UtensilsCrossed },
      ])
    }

    loadKpis()
    return () => { isMounted = false }
  }, [])

  const tabContent = useMemo(() => {
    if (activeTab === 'tables') return <TableViewTab />
    if (activeTab === 'menu') return <MenuManagementTab isAdmin={isAdmin} canManageMenu={canManageMenu} />
    if (activeTab === 'print') return <PrintCenterTab company={company} userName={userName} />
    if (activeTab === 'reports') return <DayCloseReportsTab />
    return <PosOrdersTab userName={userName} isAdmin={isAdmin} role={role} />
  }, [activeTab, canManageMenu, company, isAdmin, role, userName])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant"
        subtitle="Unified restaurant operations and POS controls."
        breadcrumb={<Breadcrumb items={[{ label: 'Modules' }, { label: 'Restaurant', current: true }]} />}
        kpiStrip={<KpiStrip items={kpis} />}
        tabs={<ModuleTabs tabs={tabs} activeTab={activeTab} onChange={setTab} />}
      />
      <section id={`module-tab-panel-${activeTab}`} role="tabpanel" aria-labelledby={`module-tab-${activeTab}`}>
        {tabContent}
      </section>
    </div>
  )
}

