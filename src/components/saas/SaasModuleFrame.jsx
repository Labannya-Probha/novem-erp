import { LockKeyhole } from 'lucide-react'
import { SAAS_MODULES, moduleForNav } from '../../lib/saasModules'

export function SaasModuleFrame({
  moduleId,
  company,
  children,
}) {
  const module = SAAS_MODULES[moduleId] || moduleForNav(moduleId)
  const Icon = module.icon

  return (
    <div className="saas-module-page">
      <section className="no-print saas-module-hero">
        <div className="min-w-0">
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
