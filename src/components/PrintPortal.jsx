import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download } from 'lucide-react'

export default function PrintPortal({ title, onClose, children, type = 'A4', primaryColor, accentColor }) {
  const [portalNode, setPortalNode] = useState(null)

  // Tenant brand colors — falls back to the original hardcoded Novem pine/forest
  // if no company-specific colors are passed in (so nothing breaks for callers
  // that haven't been updated yet).
  const brandPrimary = primaryColor || '#1B4D2E'
  const brandAccent = accentColor || '#2E7D32'

  const hexToRgb = (hex, fallback) => {
    const safe = (hex || '').replace('#', '').trim()
    if (/^[0-9a-fA-F]{6}$/.test(safe)) {
      return {
        r: parseInt(safe.slice(0, 2), 16),
        g: parseInt(safe.slice(2, 4), 16),
        b: parseInt(safe.slice(4, 6), 16),
      }
    }
    return fallback
  }

  const primaryRgb = hexToRgb(brandPrimary, { r: 27, g: 77, b: 46 })
  const accentRgb = hexToRgb(brandAccent, { r: 46, g: 125, b: 50 })

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
        margin: ${type === 'thermal' ? '0' : '8mm'};
      }
      #print-root {
        --print-primary: ${brandPrimary};
        --print-accent: ${brandAccent};
        --print-primary-rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b};
        --print-accent-rgb: ${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b};
        --print-line: rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.24);
        --print-soft: rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.08);
        --print-ink: #111827;
        --print-muted: #4b5563;
      }
      #print-root .print-doc,
      #print-root .print-a4-doc {
        color: var(--print-ink);
      }
      #print-root h1,
      #print-root h2,
      #print-root h3,
      #print-root .print-title {
        color: var(--print-primary) !important;
      }
      #print-root table th,
      #print-root .print-heading {
        background: var(--print-soft) !important;
        color: var(--print-primary) !important;
        border-color: var(--print-line) !important;
      }
      #print-root table td,
      #print-root table th,
      #print-root .print-box,
      #print-root .print-card {
        border-color: var(--print-line) !important;
      }
      #print-root .print-accent {
        color: var(--print-accent) !important;
      }
      #print-root .print-accent-bg {
        background: var(--print-soft) !important;
      }
      @media print {
        body > div:not(#print-portal-container) { display: none !important; }
        html, body { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow-y: visible !important; }
        .no-print { display: none !important; }
        
        #print-root {
          font-family: 'Inter', sans-serif !important;
          display: block !important;
          width: 100% !important;
          max-width: ${type === 'thermal' ? '72mm' : '194mm'} !important;
          margin: 0 auto !important;
          padding: ${type === 'thermal' ? '0' : '0 0 8mm'} !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          color: var(--print-ink) !important;
          box-shadow: none !important;
        }
        #print-root .print-a4-doc {
          width: 100% !important;
          max-width: 186mm !important;
          margin: 0 auto !important;
        }
        #print-root table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed;
        }
        #print-root thead { display: table-header-group; }
        #print-root tfoot { display: table-row-group; }
        #print-root tr, #print-root img { page-break-inside: avoid; break-inside: avoid; }
        #print-root .print-avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
        #print-root .print-signature-grid {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 9mm !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #print-footer {
          display: block !important;
          position: relative !important;
          bottom: unset !important;
          width: 100% !important;
          text-align: center !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 8px !important;
          color: var(--print-muted) !important;
          page-break-after: avoid !important;
          margin-top: 10mm !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.getElementById('__print-portal-page-style__')?.remove()
      if (node.parentNode) node.parentNode.removeChild(node)
    }
  }, [type, brandPrimary, brandAccent])

  const handleExportPDF = () => {
    window.print();
  }

  if (!portalNode) return null
  return createPortal(
    <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-auto overscroll-contain p-3 sm:p-6">
      <div
        className="bg-white max-w-3xl w-full my-0 sm:my-4 relative overflow-hidden rounded-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col"
        style={{ border: `1px solid rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.22)` }}
      >
        
        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b sticky top-0 bg-white z-10 no-print"
          style={{ borderColor: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.22)` }}
        >
          <h3 className="font-semibold font-sans min-w-0 flex-1 truncate" style={{ color: brandPrimary }}>{title}</h3>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="flex items-center gap-1 text-white px-3 py-1.5 rounded text-sm" style={{ background: brandPrimary }} onClick={handleExportPDF}>
              <Download size={14} /> Export PDF
            </button>
            <button className="flex items-center gap-1 text-white px-3 py-1.5 rounded text-sm" style={{ background: brandAccent }} onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            <button className="px-3 py-1.5 rounded text-sm border hover:bg-gray-100" style={{ borderColor: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.24)`, color: brandPrimary }} onClick={onClose}>
              <X size={14} /> Close
            </button>
          </div>
        </div>
        {/* Print Content Wrapper */}
        <div id="print-root" className={`p-4 sm:p-8 overflow-auto ${type === 'thermal' ? 'epos-receipt' : 'print-doc'}`}>
          {children}
        </div>
      </div>
    </div>,
    portalNode
  )
}
