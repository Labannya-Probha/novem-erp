import Breadcrumb from './Breadcrumb'
import { cn } from 'src/lib/utils'

/**
 * @param {{
 *   title: string
 *   subtitle?: string
 *   breadcrumb?: import('react').ReactNode | Array<{label: string, href?: string, onClick?: () => void, current?: boolean}>
 *   actions?: import('react').ReactNode
 *   kpiStrip?: import('react').ReactNode
 *   tabs?: import('react').ReactNode
 *   className?: string
 * }} props
 */
export default function PageHeader({ title, subtitle, breadcrumb, actions, kpiStrip, tabs, className }) {
  return (
    <header className={cn('space-y-4', className)}>
      {Array.isArray(breadcrumb) ? <Breadcrumb items={breadcrumb} /> : breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {kpiStrip}
      {tabs}
    </header>
  )
}
