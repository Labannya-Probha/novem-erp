import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4' }) {
  const [portalNode, setPortalNode] = useState(null)

  // Inject @page into <head>, create portal node, and clean up on unmount
  useEffect(() => {
    // ১. React-এর মেইন রুটের বাইরে বডিতে একটি নতুন কন্টেইনার তৈরি করা হলো
    const node = document.createElement('div')
    node.id = 'print-portal-container'
    document.body.appendChild(node)
    setPortalNode(node)

    // ২. পেজ সাইজ এবং মেইন অ্যাপ হাইড করার গ্লোবাল স্টাইল
    const style = document.createElement('style')
    style.id = '__print-portal-page-style__'
    style.innerHTML = `
      @page {
        size: ${type === 'thermal' ? '80mm auto' : 'A4'};
        /* A4-এর জন্য মার্জিন রাখা হলো, থার্মালের জন্য 0 */
        margin: ${type === 'thermal' ? '0' : '10mm 10mm 15mm 10mm'};
      }
      @media print {
        /* ম্যাজিক: মেইন অ্যাপটিকে সম্পূর্ণ হাইড (display: none) করা হলো যেন এটি কোনো এক্সট্রা পেজ না নেয় */
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
          /* এক্সট্রা ব্ল্যাঙ্ক পেজ এবং ওভারফ্লো ঠেকানোর জন্য height এবং overflow ফিক্স */
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

          /* Content Fit to Page Logic */
          #print-root {
            display: block !important;
            width: 100% !important;
            /* A4 এর প্রিন্টেবল এরিয়া (190mm) এবং থার্মালের (72mm) লিমিট */
            max-width: ${type === 'thermal' ? '72mm' : '190mm'} !important; 
            margin: 0 auto !important;
            padding: 0 !important; /* প্রিন্টের সময় প্যাডিং জিরো করা হলো যেন এক্সট্রা জায়গা না নেয় */
            font-size: ${type === 'thermal' ? '10px' : '11px'};
            color: #000 !important;
            box-sizing: border-box !important;
          }

          /* ভিতরের সমস্ত কন্টেন্ট যেন 100% এর বেশি জায়গা না নেয় */
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

          /* Footer: page-break-after avoid করা হয়েছে এক্সট্রা পেজ ঠেকানোর জন্য */
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
            page-break-after: avoid !important; 
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Wrapper ID */}
      <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-auto p-6">
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
    </>,
    portalNode
  )
}
