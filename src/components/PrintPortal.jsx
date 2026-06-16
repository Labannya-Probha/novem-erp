import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4' }) {
  const [portalNode, setPortalNode] = useState(null)

  // Inject @page and Google Font into <head>, create portal node, and clean up on unmount
  useEffect(() => {
    const node = document.createElement('div')
    node.id = 'print-portal-container'
    document.body.appendChild(node)
    setPortalNode(node)

    const style = document.createElement('style')
    style.id = '__print-portal-page-style__'
    style.innerHTML = `
      /* 1. প্রিমিয়াম সেরিফ ফন্ট ইম্পোর্ট (Lora) */
      @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700&display=swap');
      
      @page {
        size: ${type === 'thermal' ? '80mm auto' : 'A4'};
        margin: ${type === 'thermal' ? '0' : '10mm 10mm 15mm 10mm'};
      }
      @media print {
        body > div:not(#print-portal-container) {
          display: none !important;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      const el = document.getElementById('__print-portal-page-style__')
      if (el) el.remove()
      if (node.parentNode) node.parentNode.removeChild(node)
    }
  }, [type])

  if (!portalNode) return null

  return createPortal(
    <>
      <style>{`
        @media print {
          html, body { 
            width: 100% !important;
            height: auto !important; 
            min-height: auto !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: #fff !important; 
            overflow-x: hidden !important; 
            overflow-y: visible !important; 
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

          /* =========================================
             প্রফেশনাল টাইপোগ্রাফি ও লেআউট পলিশ
             ========================================= */
          #print-root {
            display: block !important;
            width: 100% !important;
            max-width: ${type === 'thermal' ? '72mm' : '190mm'} !important; 
            margin: 0 auto !important;
            padding: 0 !important;
            
            /* 2. প্রফেশনাল ফন্ট ও রিডেবিলিটি সেটিং */
            font-family: 'Lora', 'Georgia', serif !important;
            font-size: ${type === 'thermal' ? '11px' : '12px'} !important; /* সেরিফ ফন্ট হিসেবে সাইজ একটু এডজাস্ট করা হলো */
            line-height: 1.5 !important;
            color: #111 !important; /* পিওর ব্ল্যাকের চেয়ে একটু সফট, যা চোখের জন্য আরামদায়ক */
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
            
            box-sizing: border-box !important;
          }

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

          /* Footer Polish */
          #print-footer {
            display: block !important;
            position: ${type === 'thermal' ? 'relative' : 'fixed'} !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            text-align: center !important;
            font-family: 'Lora', 'Georgia', serif !important; /* ফুটারের জন্যও সেম ফন্ট */
            font-size: 10px !important;
            font-style: italic !important; /* প্রফেশনাল লুকের জন্য ইটালিক */
            color: #555 !important;
            border-top: 1px solid #e5e7eb !important; /* গ্লাস ইফেক্টের সাথে মানানসই সফট বর্ডার */
            padding-top: 8px !important;
            margin-top: ${type === 'thermal' ? '15px' : '0'} !important;
            background: #fff !important;
            z-index: 9999 !important;
            page-break-after: avoid !important; 
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Wrapper ID */}
      <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-auto p-6 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-4 relative overflow-hidden border border-white/20">

          {/* Toolbar — hidden during print */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md rounded-t-xl z-10 no-print">
            <h3 className="font-display font-semibold text-gray-800">{title}</h3>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
              <button className="btn-ghost" onClick={onClose}>
                <X size={16} /> Close
              </button>
            </div>
          </div>

          {/* Print Content Wrapper */}
          <div
            id="print-root"
            className={`p-8 ${type === 'thermal' ? 'epos-receipt' : 'print-doc'}`}
          >
            {children}
          </div>

          {/* Dedicated Print Footer */}
          <div id="print-footer" className="hidden print:block">
            Powered by Aura Stay
          </div>

        </div>
      </div>
    </>,
    portalNode
  )
}
