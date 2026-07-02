import { useSearchParams } from 'react-router-dom'
import CmsPortal from '../../../pages/CmsPortal.jsx'

const ENTITY_OPTIONS = [
  { id: 'agencies', label: 'Agencies' },
  { id: 'shareholders', label: 'Shareholders' },
]

export default function AgenciesShareholdersTab({ role, isAdmin }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const entity = searchParams.get('entity') === 'shareholders' ? 'shareholders' : 'agencies'

  const setEntity = (nextEntity) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'agencies-shareholders')
    nextParams.set('entity', nextEntity)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Select entity" className="inline-flex rounded-lg border border-leaf bg-white p-1">
        {ENTITY_OPTIONS.map((option) => {
          const active = option.id === entity
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setEntity(option.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                active
                  ? 'bg-forest text-white'
                  : 'text-pine/70 hover:text-pine hover:bg-leaf/60'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <CmsPortal role={role} isAdmin={isAdmin} entityId={entity} hidePageHeader />
    </div>
  )
}
