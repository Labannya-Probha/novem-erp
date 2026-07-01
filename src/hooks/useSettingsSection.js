import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PATHS } from '../app/paths'

export function useSettingsSection(sections) {
  const location = useLocation()
  const navigate = useNavigate()
  const sectionIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections])
  const activeSection = useMemo(() => {
    const requested = new URLSearchParams(location.search).get('section')
    if (requested && sectionIds.has(requested)) return requested
    return sections[0]?.id || null
  }, [location.search, sectionIds, sections])

  const openSection = (sectionId) => {
    navigate(`${PATHS.SETTINGS}?section=${sectionId}`, { replace: true })
  }

  return { activeSection, openSection }
}
