import { useEffect, useState } from 'react'
import { BarChart3, BedDouble, FileText, Shield } from 'lucide-react'
import { Button } from './ui/button'

export function WelcomePopover({ isOpen, userName = 'Welcome', onClose }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setAnimate(false)
      return undefined
    }
    const timer = window.setTimeout(() => setAnimate(true), 50)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  if (!isOpen) return null

  const features = [
    { icon: <BedDouble className="h-5 w-5" />, title: 'Front Office', description: 'Rooms, arrivals, and check-ins' },
    { icon: <BarChart3 className="h-5 w-5" />, title: 'Reports', description: 'Operations and accounts at a glance' },
    { icon: <FileText className="h-5 w-5" />, title: 'Billing', description: 'Guest folios and printable docs' },
    { icon: <Shield className="h-5 w-5" />, title: 'Secure', description: 'Tenant-scoped access and controls' },
  ]

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/30 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
        className={`w-full max-w-sm border-0 p-0 shadow-2xl transition-all duration-300 ${animate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
      >
        <div className="rounded-xl border border-white/70 bg-white p-6" style={{
          background: 'linear-gradient(135deg, rgba(var(--tenant-primary-rgb),0.08), #fff 48%, rgba(var(--tenant-accent-rgb),0.08))',
        }}>
          <div className="mb-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="rounded-full p-3" style={{ background: 'rgba(var(--tenant-primary-rgb),0.14)' }}>
                <BedDouble className="h-6 w-6" style={{ color: 'var(--brand-color)' }} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-pine">Welcome, {userName}!</h2>
            <p className="mt-2 text-sm text-pine/60">Your tenant theme is active across the workspace.</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-[--border-color] bg-white/70 p-3 backdrop-blur transition-colors hover:border-[rgba(var(--tenant-primary-rgb),0.30)]">
                <div className="mb-2 w-fit rounded-lg p-2 text-white" style={{ background: 'var(--brand-color)' }}>
                  {feature.icon}
                </div>
                <h4 className="text-sm font-semibold text-pine">{feature.title}</h4>
                <p className="mt-1 text-xs text-pine/55">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-lg border border-[--border-color] p-3" style={{ background: 'rgba(var(--tenant-primary-rgb),0.06)' }}>
            <p className="text-xs font-medium text-pine">Pro Tip</p>
            <p className="mt-1 text-xs text-pine/65">Use the sidebar groups to jump between Front Office, Reports, and Operations.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
              Maybe Later
            </Button>
            <Button size="sm" onClick={onClose} className="flex-1">
              Let's Go
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">You'll see this once per session.</p>
        </div>
      </div>
    </div>
  )
}
