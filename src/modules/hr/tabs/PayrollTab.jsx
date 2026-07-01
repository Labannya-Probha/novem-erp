import ConfigView   from './payroll/ConfigView'
import GenerateView from './payroll/GenerateView'
import RegisterView from './payroll/RegisterView'
import ApproveView  from './payroll/ApproveView'

const SUB_VIEWS = [
  { key: '',         label: 'Overview'  },
  { key: 'config',   label: 'Config'    },
  { key: 'generate', label: 'Generate'  },
  { key: 'register', label: 'Register'  },
  { key: 'approve',  label: 'Approve'   },
]

export default function PayrollTab({ view, setView, flash, userName, canApprove }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-leaf/60">
        {SUB_VIEWS.map((sv) => (
          <button key={sv.key} onClick={() => setView(sv.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t ${sv.key === (view || '') ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {sv.label}
          </button>
        ))}
      </div>

      {(view === '' || view === 'overview') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5 space-y-1">
            <div className="text-xs font-semibold text-pine/50 uppercase tracking-wide">Config</div>
            <div className="text-sm text-pine/70">Set per-designation allowances that feed into payroll generation.</div>
            <button className="btn-ghost text-xs mt-2" onClick={() => setView('config')}>Open Config →</button>
          </div>
          <div className="card p-5 space-y-1">
            <div className="text-xs font-semibold text-pine/50 uppercase tracking-wide">Generate</div>
            <div className="text-sm text-pine/70">Compute monthly salary for all active employees and create a draft payroll run.</div>
            <button className="btn-ghost text-xs mt-2" onClick={() => setView('generate')}>Generate →</button>
          </div>
          <div className="card p-5 space-y-1">
            <div className="text-xs font-semibold text-pine/50 uppercase tracking-wide">Register</div>
            <div className="text-sm text-pine/70">View all payroll runs and individual payslips. Print payroll register.</div>
            <button className="btn-ghost text-xs mt-2" onClick={() => setView('register')}>View Register →</button>
          </div>
          <div className="card p-5 space-y-1">
            <div className="text-xs font-semibold text-pine/50 uppercase tracking-wide">Approve &amp; Post</div>
            <div className="text-sm text-pine/70">Approve draft runs and post to the general ledger (EXPENSE + LIABILITY).</div>
            <button className="btn-ghost text-xs mt-2" onClick={() => setView('approve')}>Approve →</button>
          </div>
        </div>
      )}

      {view === 'config'   && <ConfigView flash={flash} />}
      {view === 'generate' && <GenerateView flash={flash} userName={userName} />}
      {view === 'register' && <RegisterView />}
      {view === 'approve'  && <ApproveView flash={flash} userName={userName} canApprove={canApprove} />}
    </div>
  )
}
