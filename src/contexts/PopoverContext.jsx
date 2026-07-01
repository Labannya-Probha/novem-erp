import { createContext, useContext, useState, useCallback } from 'react'

const PopoverContext = createContext(null)

export function PopoverProvider({ children }) {
  const [popover, setPopover] = useState(null)

  const open = useCallback((config) => {
    setPopover({
      id: Date.now() + Math.random(),
      type: config.type, // 'notification', 'action', 'welcome'
      title: config.title,
      content: config.content,
      trigger: config.trigger,
      side: config.side || 'top',
      align: config.align || 'center',
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
      confirmLabel: config.confirmLabel || 'OK',
      cancelLabel: config.cancelLabel || 'Cancel',
      isOpen: true,
      autoClose: config.autoClose, // for notifications
    })
  }, [])

  const close = useCallback(() => {
    setPopover(prev => prev ? { ...prev, isOpen: false } : null)
    setTimeout(() => setPopover(null), 300) // allow animation
  }, [])

  const notify = useCallback((config) => {
    open({
      type: 'notification',
      autoClose: config.duration || 4000,
      ...config,
    })
    if (config.duration !== false) {
      setTimeout(() => close(), config.duration || 4000)
    }
  }, [open, close])

  const confirm = useCallback((config) => {
    open({
      type: 'action',
      ...config,
    })
  }, [open])

  const welcome = useCallback((config) => {
    open({
      type: 'welcome',
      ...config,
    })
  }, [open])

  return (
    <PopoverContext.Provider value={{ popover, open, close, notify, confirm, welcome }}>
      {children}
    </PopoverContext.Provider>
  )
}

export function usePopover() {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('usePopover must be used inside <PopoverProvider>')
  return ctx
}
