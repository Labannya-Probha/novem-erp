import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4' }) {
  const [portalNode, setPortalNode] = useState(null)

  useEffect(() => {
    const node = document.createElement('div')
    node.id = 'print-portal-container'
    document.body.appendChild(node)
    setPortalNode(node)

    const style = document.createElement('style')
    style.id = '__print-portal-page-style__'
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      @page {
        size: ${type === 'thermal' ? '80mm auto' : 'A4'};
        margin: ${type === 'thermal' ? '0' : '10mm'};
      }
      @media print {
        body > div:not(#print-portal-container) { display: none !important; }
        html, body { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow-y: visible !important; }
        .no-print { display: none !important; }
        
        #print-root {
          font-family: 'Inter', sans-serif !important;
          display: block !important;
          width: 100% !important;
          max-width: ${type === 'thermal' ? '72mm' : '190mm'} !important;
          margin: 0 auto !important;
          padding: 0 !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          color: #111 !important;
          box-shadow: none !important;
        }

        #print-footer {
          display: block !important;
          position: ${type === 'thermal' ? 'relative' : 'fixed'} !important;
          bottom: 10px !important;
          width: 100% !important;
          text-align: center !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 8px !important;
          color: #666 !important;
          page-break-after: avoid !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.getElementById('__print-portal-page-style__')?.remove()
      if (node.parentNode) node.parentNode.removeChild(node)
    }
  }, [type])

  const handleExportPDF = () => {
    window.print();
  }

  if (!portalNode) return null

  return createPortal(
    <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-auto p-6">
      {/* বর্ডার ও শ্যাডো রিমুভ করা হয়েছে */}
      <div className="bg-white max-w-3xl w-full my-4 relative overflow-hidden">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 sticky top-0 bg-white z-10 no-print">
          <h3 className="font-semibold text-gray-800 font-sans">{title}</h3>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700" onClick={handleExportPDF}>
              <Download size={14} /> Export PDF
            </button>
            <button className="flex items-center gap-1 bg-gray-800 text-white px-3 py-1.5 rounded text-sm hover:bg-black" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            <button className="px-3 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-100" onClick={onClose}>
              <X size={14} /> Close
            </button>
          </div>
        </div>

        {/* Print Content Wrapper */}
        <div id="print-root" className={`p-8 ${type === 'thermal' ? 'epos-receipt' : 'print-doc'}`}>
          {children}
        </div>

      </div>
    </div>,
    portalNode
  )
}
