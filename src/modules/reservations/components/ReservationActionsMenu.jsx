import { MoreHorizontal } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'

export default function ReservationActionsMenu({ label = 'Actions', actions = [] }) {
  const enabledActions = actions.filter((action) => !action.hidden)

  if (!enabledActions.length) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {enabledActions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.disabled}
            onClick={action.onSelect}
            className="flex items-center gap-2"
          >
            {action.icon ? <action.icon className="size-4" /> : null}
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
