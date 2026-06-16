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
        /* A4-এর জন্য মার্জিন রাখা হলো, থার্মালের জন্য 0 */
        margin: ${type === 'thermal' ? '0' : '10mm 10mm 15mm 10mm'};
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
          /* "Fit to page" নিশ্চিত করতে এক্সট্রা মার্জিন ও প্যাডিং জিরো করা হলো এবং horizontal overflow বন্ধ করা হলো */
          html, body { 
            width: 100% !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: #fff !important; 
            overflow-x: hidden !important; 
          }
          
          body * { visibility: hidden !important; }

          #print-modal-overlay, #print-modal-overlay * { visibility: visible !important; }

          #print-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          #print-modal-overlay > div {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
          }

          .no-print { display: none !important; }

          /* Content Fit to Page Logic */
          #print-root {
            display: block !important;
            width: 100% !important;
            /* A4 এর প্রিন্টেবল এরিয়া (190mm) এবং থার্মালের (72mm) লিমিট সেট করে দেওয়া হলো যেন বাইরে না যায় */
            max-width: ${type === 'thermal' ? '72mm' : '190mm'} !important; 
            margin: 0 auto !important;
            padding: 0 !important;
            font-size: ${type === 'thermal' ? '10px' : '11px'};
            color: #000 !important;
            box-sizing: border-box !important;
          }

          /* ভিতরের সমস্ত কন্টেন্ট যেন 100% এর বেশি জায়গা না নেয় */
          #print-root * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          table { 
            width: 100% !important; 
            max-width: 100% !important; 
            border-collapse: collapse; 
          }
          
          tr, td, th, img, svg { 
            page-break-inside: avoid; 
            break-inside: avoid; 
          }

          /* Footer */
          #print-footer {
            display: block !important;
            position: ${type === 'thermal' ? 'relative' : 'fixed'} !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            text-align: center !important;
            font-size: 9px !important;
            color: #666 !important;
            border-top: 1px solid #ccc !important;
            padding-top: 5px !important;
            margin-top: ${type === 'thermal' ? '15px' : '0'} !important;
            background: #fff !important;
            z-index: 9999 !important;
          }
        }
      `}</style>

      {/* Wrapper ID */}
      <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-4 relative">

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

          {/* Print Content Wrapper */}
          <div
            id="print-root"
            className={`p-6 ${type === 'thermal' ? 'epos-receipt' : 'print-doc'}`}
          >
            {children}
          </div>

          {/* Dedicated Print Footer */}
          <div id="print-footer" className="hidden print:block">
            Powered by Aura Stay
          </div>

        </div>
      </div>
    </>
  )
}
