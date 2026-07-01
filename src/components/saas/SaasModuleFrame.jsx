import { LockKeyhole } from 'lucide-react'
import { SAAS_MODULES, moduleForNav } from '../../lib/saasModules'

export function SaasModuleFrame({ children }) {
  return children
}

export function SaasModuleBlocked({ moduleId, company }) {
  const module = SAAS_MODULES[moduleId] || moduleForNav(moduleId)
  const Icon = module.icon || LockKeyhole
  return (
    <div className="min-h-[55vh] flex items-center justify-center">
      <div className="card max-w-xl p-7 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          <Icon size={24} />
        </div>
        <h1 className="font-display text-xl font-bold text-pine">{module.title} is not enabled</h1>
        <p className="text-sm text-pine/60 mt-2">
          This module is disabled for {company?.name || 'this tenant'} under the current SaaS subscription package.
        </p>
      </div>
    </div>
  )
}
