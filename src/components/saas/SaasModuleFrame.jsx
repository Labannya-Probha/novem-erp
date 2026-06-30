import { Download, FileSpreadsheet, LockKeyhole, Printer, ShieldCheck } from 'lucide-react'
import { SAAS_MODULES, moduleForNav } from '../../lib/saasModules'

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--tenant-primary-rgb)/0.18)] bg-[rgb(var(--tenant-primary-rgb)/0.07)] px-2.5 py-1 text-[11px] font-semibold text-pine">
      {children}
    </span>
  )
}

export function SaasModuleFrame({
  moduleId,
  company,
  role,
  userName,
  children,
  actions = true,
}) {
  const module = SAAS_MODULES[moduleId] || moduleForNav(moduleId)
  const Icon = module.icon
  const propertyName = company?.property_name || company?.name || 'Current Property'

  return (
    <div className="saas-module-page">
      <section className="no-print saas-module-hero">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Pill><ShieldCheck size={12} /> Tenant isolated</Pill>
            <Pill><LockKeyhole size={12} /> {role || 'Role'} access</Pill>
            <Pill>{propertyName}</Pill>
          </div>
          <div className="flex items-start gap-3">
            <div className="saas-module-icon">
              {Icon && <Icon size={22} />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-pine/45">{module.category}</div>
              <h1 className="font-display text-2xl font-bold text-pine leading-tight">{module.title}</h1>
              <p className="text-sm text-pine/60 mt-1 max-w-3xl">{module.summary}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
          <div className="text-xs text-pine/55 sm:text-right">
            <div className="font-semibold text-pine">{company?.software_name || 'Aura Stay ERP'}</div>
            <div>Signed in: {userName || 'User'}</div>
          </div>
          {actions && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost saas-action-btn" type="button" onClick={() => window.print()}>
                <Printer size={14} /> Print
              </button>
              <button className="btn-ghost saas-action-btn" type="button" title="Export-ready module data">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button className="btn-ghost saas-action-btn" type="button" title="Download-ready module data">
                <Download size={14} /> CSV
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="no-print saas-module-featurebar">
        {(module.features || []).map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </section>

      <div className="saas-module-content">
        {children}
      </div>
    </div>
  )
}

export function SaasModuleBlocked({ moduleId, company }) {
  const module = SAAS_MODULES[moduleId] || moduleForNav(moduleId)
  const Icon = module.icon
  return (
    <div className="min-h-[55vh] flex items-center justify-center">
      <div className="card max-w-xl p-7 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          {Icon ? <Icon size={24} /> : <LockKeyhole size={24} />}
        </div>
        <h1 className="font-display text-xl font-bold text-pine">{module.title} is not enabled</h1>
        <p className="text-sm text-pine/60 mt-2">
          This module is disabled for {company?.name || 'this tenant'} under the current SaaS subscription package.
        </p>
      </div>
    </div>
  )
}
