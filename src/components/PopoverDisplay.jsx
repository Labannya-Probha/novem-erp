import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { Button } from './ui/button'
import { usePopover } from '../contexts/PopoverContext'
import { CheckCircle, Info, AlertTriangle, XCircle, Heart, Zap } from 'lucide-react'

const typeConfig = {
  notification: {
    success: { icon: <CheckCircle size={20} />, color: 'text-forest', bg: 'bg-forest/10' },
    info: { icon: <Info size={20} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    warning: { icon: <AlertTriangle size={20} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    error: { icon: <XCircle size={20} />, color: 'text-red-500', bg: 'bg-red-500/10' },
  },
  action: {
    icon: <Zap size={20} />,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  welcome: {
    icon: <Heart size={20} />,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
}

export function PopoverDisplay() {
  const { popover, close } = usePopover()

  if (!popover || !popover.isOpen) return null

  const handleConfirm = () => {
    if (popover.onConfirm) popover.onConfirm()
    close()
  }

  const handleCancel = () => {
    if (popover.onCancel) popover.onCancel()
    close()
  }

  const renderContent = () => {
    const config = popover.type === 'notification' 
      ? typeConfig.notification[popover.subType || 'info']
      : typeConfig[popover.type]

    return (
      <div className="w-80 p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`${config.bg} ${config.color} p-2 rounded-lg`}>
            {config.icon}
          </div>
          {popover.title && (
            <h3 className="font-semibold text-gray-900">{popover.title}</h3>
          )}
        </div>

        {/* Content */}
        {popover.content && (
          <div className="ml-11 mb-4 text-sm text-gray-600">
            {typeof popover.content === 'string' ? (
              <p>{popover.content}</p>
            ) : (
              popover.content
            )}
          </div>
        )}

        {/* Actions */}
        {(popover.onConfirm || popover.onCancel || popover.type !== 'notification') && (
          <div className="ml-11 flex gap-2 justify-end">
            {popover.type !== 'notification' && popover.onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                {popover.cancelLabel}
              </Button>
            )}
            {popover.type !== 'notification' && popover.onConfirm && (
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-forest hover:bg-forest/90"
              >
                {popover.confirmLabel}
              </Button>
            )}
            {popover.type === 'notification' && (
              <button
                onClick={close}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Popover open={popover.isOpen} onOpenChange={close}>
      <PopoverTrigger asChild>
        <div className="hidden" />
      </PopoverTrigger>
      <PopoverContent 
        side={popover.side} 
        align={popover.align}
        className="w-auto p-0 border-0 shadow-xl"
      >
        {renderContent()}
      </PopoverContent>
    </Popover>
  )
}
