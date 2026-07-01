import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog'
import { cn } from 'src/lib/utils'

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/**
 * @param {{
 *   open: boolean
 *   onOpenChange?: (open: boolean) => void
 *   title: string
 *   subtitle?: string
 *   children: import('react').ReactNode
 *   footer?: import('react').ReactNode
 *   size?: 'sm'|'md'|'lg'|'xl'
 *   className?: string
 * }} props
 */
export default function DrawerForm({ open, onOpenChange, title, subtitle, children, footer, size = 'md', className }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'left-auto right-0 top-0 h-dvh w-full -translate-x-0 -translate-y-0 rounded-none p-0 sm:max-w-none',
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
          className
        )}
      >
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer ? <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">{footer}</DialogFooter> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
