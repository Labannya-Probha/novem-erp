import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TASK_TABS, DEFAULT_TAB } from '../tasks.config'

const VALID = new Set(TASK_TABS.map((t) => t.id))

export function useTaskTabs() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') || DEFAULT_TAB
  const tab = VALID.has(raw) ? raw : DEFAULT_TAB

  const setTab = useCallback(
    (id) => setParams({ tab: id }, { replace: true }),
    [setParams]
  )

  return { tab, setTab }
}
