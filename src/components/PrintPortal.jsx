import { createPortal } from 'react-dom'
import { X, Printer } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4' }) {
  return (
    <>
      <style>{`
        @page { size: ${type === 'thermal' ? '80mm auto' : 'A4'}; margin: ${type === 'thermal' ? '0' : '12mm'}; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #print-root, #print-root * { visibility: visible !important; }
          #print-root { position: absolute; left: 0; top: 0; width: ${type === 'thermal' ? '72mm' : '186mm'}; }
          .no-print { display: none !important; }
          
          #print-root .print-doc, #print-root .epos-receipt {
            display: flex !important;
            flex-direction: column !important;
            min-height: ${type === 'thermal' ? 'auto' : '100vh'} !important;
            width: ${type === 'thermal' ? '72mm' : '186mm'} !important; 
            max-width: ${type === 'thermal' ? '72mm' : '186mm'} !important;
            margin: 0 auto !important; font-size: ${type === 'thermal' ? '11px' : '11px'}; color: #000 !important;
          }

          #print-root .print-doc > div:first-child, 
          #print-root .epos-receipt > div:first-child {
            flex: 1 !important;
          }
          
          #print-root .print-doc::after, #print-root .epos-receipt::after {
            content: "Powered by Aura Stay";
            display: block; text-align: center; font-size: 9px;
            margin-top: auto !important; border-top: 1px solid #ccc;
            padding-top: 5px; color: #666;
          }

          #print-root .print-doc * { box-sizing: border-box; }
          #print-root .print-doc table { width: 100% !important; border-collapse: collapse; }
          #print-root .print-doc img { max-width: 100%; }
          #print-root .print-doc tr, #print-root .print-doc table, #print-root .print-doc svg { page-break-inside: avoid; }
        }
      `}</style>

      {createPortal(<div className={type === 'thermal' ? 'epos-receipt' : 'print-doc'}>{children}</div>, document.getElementById('print-root'))}

      <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6 no-print">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-4">
          <div className="flex items-center justify-between px-5 py-3 border-b border-leaf sticky top-0 bg-white rounded-t-xl z-10">
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
          <div className="p-6 overflow-auto" style={{ fontSize: 12, color: '#000' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
