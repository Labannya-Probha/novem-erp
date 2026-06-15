import { useEffect } from 'react'
import { X, Printer } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4' }) {
  // Inject @page into <head> and clean up on unmount
  useEffect(() => {
    const style = document.createElement('style')
    style.id = '__print-portal-page-style__'
    style.innerHTML = `
      @page {
        size: ${type === 'thermal' ? '80mm auto' : 'A4'};
        margin: ${type === 'thermal' ? '0' : '12mm'};
      }
    `
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById('__print-portal-page-style__')
      if (el) el.remove()
    }
  }, [type])

  return (
    <>
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #print-root, #print-root * { visibility: visible !important; }
          #print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: ${type === 'thermal' ? '72mm' : '186mm'};
          }
          .no-print { display: none !important; }

          #print-root.print-doc,
          #print-root.epos-receipt {
            display: flex !important;
            flex-direction: column !important;
            min-height: ${type === 'thermal' ? '100vh' : '270mm'} !important;
            width: ${type === 'thermal' ? '72mm' : '186mm'} !important;
            max-width: ${type === 'thermal' ? '72mm' : '186mm'} !important;
            margin: 0 auto !important;
            font-size: ${type === 'thermal' ? '10px' : '11px'};
            color: #000 !important;
          }

          /* Valid ::after — footer stamp on every print */
          #print-root.print-doc::after,
          #print-root.epos-receipt::after {
            content: "Powered by Aura Stay";
            display: block;
            text-align: center;
            font-size: 9px;
            margin-top: auto;
            border-top: 1px solid #ccc;
            padding-top: 5px;
            color: #666;
            flex-shrink: 0;
          }

          #print-root * { box-sizing: border-box; }
          #print-root table { width: 100% !important; border-collapse: collapse; }
          #print-root img { max-width: 100%; }
          #print-root tr,
          #print-root table,
          #print-root svg { page-break-inside: avoid; }
        }
      `}</style>

      {/* 
        Single source of truth: this div is BOTH the on-screen preview 
        and the print target. No portal, no double-render.
        
        NOTE: id="print-root" must NOT also exist in index.html —
        remove it if you added it there previously. This component
        owns the id while it is mounted.
      */}

      {/* Overlay / modal wrapper — hidden during print via .no-print */}
      <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-auto p-6 no-print">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-4">

          {/* Toolbar — hidden during print */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-leaf sticky top-0 bg-white rounded-t-xl z-10 no-print">
            <h3 className="font-display font-semibold text-pine">{title}</h3>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print / Save PDF
              </button>
              <button className="btn-ghost" onClick={onClose}>
                <X size={16} /> Close
              </button>
            </div>
          </div>

          {/* 
            #print-root: single render of children.
            The @media print CSS above makes only this div visible when printing.
          */}
          <div
            id="print-root"
            className={type === 'thermal' ? 'epos-receipt' : 'print-doc'}
            style={{ padding: '24px', fontSize: 12, color: '#000' }}
          >
            {children}
          </div>

        </div>
      </div>
    </>
  )
}
