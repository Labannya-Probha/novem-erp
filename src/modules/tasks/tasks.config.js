import { ListChecks, LayoutList, Bot } from 'lucide-react'

export const TASK_TABS = [
  { id: 'my',  label: 'My Tasks',  icon: ListChecks },
  { id: 'all', label: 'All Tasks', icon: LayoutList  },
  { id: 'ai',  label: 'AI Tasker', icon: Bot         },
]

export const DEFAULT_TAB = 'my'
