import { useEffect, useState } from 'react'
import { Users, UserCheck, CalendarClock, ClipboardList } from 'lucide-react'
import { supabase } from '../../supabase'
import { todayISO } from '../../lib/helpers'
import { HR_TABS } from './hr.config'
import { useHrTabs } from './hooks/useHrTabs'
import EmployeesTab        from './tabs/EmployeesTab'
import AttendanceTab       from './tabs/AttendanceTab'
import LeaveTab            from './tabs/LeaveTab'
import PayrollTab          from './tabs/PayrollTab'
import LettersDocumentsTab from './tabs/LettersDocumentsTab'
import ComplianceTab       from './tabs/ComplianceTab'

function KpiStrip() {
  const [kpi, setKpi] = useState({ headcount: null, present: null, total: null, pendingLeave: null })

  useEffect(() => {
    const load = async () => {
      const today = todayISO()
      const [{ count: headcount }, { data: att }, { count: pendingLeave }] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('attendance_records').select('status').eq('att_date', today),
        supabase.from('leave_applications').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      ])
      const present = (att || []).filter((r) => r.status === 'P').length
      const total   = (att || []).length
      setKpi({ headcount, present, total, pendingLeave })
    }
    load()
  }, [])

  const attPct = kpi.total > 0 ? Math.round((kpi.present / kpi.total) * 100) : null

  const tiles = [
    {
      label: 'Active Employees',
      value: kpi.headcount ?? '—',
      icon: Users,
      color: 'text-forest',
      bg: 'bg-forest/10',
    },
    {
      label: "Today's Attendance",
      value: attPct != null ? `${attPct}%` : kpi.total === 0 ? 'Not marked' : '—',
      sub: kpi.total > 0 ? `${kpi.present} / ${kpi.total} present` : null,
      icon: UserCheck,
      color: attPct != null && attPct < 70 ? 'text-red-600' : 'text-forest',
      bg: 'bg-forest/10',
    },
    {
      label: 'Leave Pending',
      value: kpi.pendingLeave ?? '—',
      icon: CalendarClock,
      color: kpi.pendingLeave > 0 ? 'text-amber' : 'text-forest',
      bg: kpi.pendingLeave > 0 ? 'bg-amber/10' : 'bg-forest/10',
    },
    {
      label: 'Payroll',
      value: 'Phase 2',
      icon: ClipboardList,
      color: 'text-pine/40',
      bg: 'bg-leaf/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl p-4 ${t.bg} flex items-start gap-3`}>
          <div className={`mt-0.5 ${t.color}`}><t.icon size={18} /></div>
          <div className="min-w-0">
            <div className={`text-xl font-bold font-display ${t.color}`}>{t.value}</div>
            {t.sub && <div className="text-[10px] text-pine/50 leading-tight">{t.sub}</div>}
            <div className="text-[11px] text-pine/50 mt-0.5">{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HrPayrollPage({ userName, role, isAdmin }) {
  const { tab, view, setTab, setView } = useHrTabs('employees')
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }
  const canApprove = isAdmin || role === 'MANAGER' || role === 'HR'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Users className="text-forest" /> HR &amp; Payroll
        </h1>
        <p className="text-sm text-pine/60">
          Employees, attendance, leave, payroll, documents and compliance — all in one place.
        </p>
      </div>

      <KpiStrip />

      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      {/* Main tab bar */}
      <div className="flex gap-0.5 border-b border-leaf flex-wrap">
        {HR_TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key}
              onClick={() => setTab(t.key, '')}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors
                ${tab === t.key
                  ? 'bg-white border border-leaf border-b-white text-forest -mb-px'
                  : 'text-pine/60 hover:text-pine'}`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'employees'  && <EmployeesTab flash={flash} isAdmin={isAdmin} />}
      {tab === 'attendance' && <AttendanceTab flash={flash} />}
      {tab === 'leave'      && <LeaveTab flash={flash} userName={userName} canApprove={canApprove} view={view} setView={setView} />}
      {tab === 'payroll'    && <PayrollTab view={view} setView={setView} />}
      {tab === 'letters'    && <LettersDocumentsTab flash={flash} userName={userName} view={view} setView={setView} />}
      {tab === 'compliance' && <ComplianceTab flash={flash} userName={userName} view={view} setView={setView} />}
    </div>
  )
}
