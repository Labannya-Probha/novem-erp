import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

const styles = {
  success: { bar: 'bg-forest',  icon: <CheckCircle size={16} />,    text: 'text-white' },
  info:    { bar: 'bg-blue-500', icon: <Info size={16} />,           text: 'text-white' },
  warning: { bar: 'bg-amber-500',icon: <AlertTriangle size={16} />,  text: 'text-white' },
  error:   { bar: 'bg-red-500',  icon: <XCircle size={16} />,        text: 'text-white' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const s = styles[t.type] || styles.info
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl ${s.bar} ${s.text}
                pointer-events-auto animate-slide-in`}
            >
              <span className="mt-0.5 shrink-0 opacity-90">{s.icon}</span>
              <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100 mt-0.5">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
