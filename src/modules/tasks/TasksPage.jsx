import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import PageHeader from '../../components/layout/PageHeader'
import KpiStrip   from '../../components/layout/KpiStrip'
import ModuleTabs  from '../../components/layout/ModuleTabs'
import { TASK_TABS } from './tasks.config'
import { useTaskTabs } from './hooks/useTaskTabs'
import MyTasksTab  from './tabs/MyTasksTab'
import AllTasksTab from './tabs/AllTasksTab'
import AiTaskerTab from './tabs/AiTaskerTab'
import { ListChecks, Clock, CheckCircle2 } from 'lucide-react'

function useTaskKpi(userName) {
  const [kpi, setKpi] = useState({ open: null, mine: null, done: null })
  useEffect(() => {
    const load = async () => {
      const [{ count: open }, { count: mine }, { count: done }] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['OPEN', 'IN_PROGRESS']),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['OPEN', 'IN_PROGRESS']).eq('created_by', userName),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'DONE'),
      ])
      setKpi({ open, mine, done })
    }
    load()
  }, [userName])
  return kpi
}

export default function TasksPage({ userName, role, isAdmin }) {
  const { tab, setTab } = useTaskTabs()
  const kpi = useTaskKpi(userName)

  const kpiItems = [
    { label: 'Open / In Progress', value: kpi.open ?? '—', icon: Clock },
    { label: 'Created by Me',      value: kpi.mine ?? '—', icon: ListChecks },
    { label: 'Completed',          value: kpi.done ?? '—', icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Track, assign and route tasks across all departments."
        breadcrumb={[{ label: 'Tasks', current: true }]}
        kpiStrip={<KpiStrip items={kpiItems} />}
        tabs={
          <ModuleTabs
            tabs={TASK_TABS}
            activeTab={tab}
            onChange={setTab}
          />
        }
      />

      <div role="tabpanel" id={`module-tab-panel-${tab}`} aria-labelledby={`module-tab-${tab}`}>
        {tab === 'my'  && <MyTasksTab  userName={userName} role={role} isAdmin={isAdmin} />}
        {tab === 'all' && <AllTasksTab userName={userName} role={role} isAdmin={isAdmin} />}
        {tab === 'ai'  && <AiTaskerTab userName={userName} role={role} isAdmin={isAdmin} />}
      </div>
    </div>
  )
}
