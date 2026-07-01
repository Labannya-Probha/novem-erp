import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default function PrintPortal({ title, onClose, children, type = 'A4', primaryColor, accentColor, autoPrint = false }) {
  const [portalNode, setPortalNode] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const printRootRef = useRef(null)

  // Tenant brand colors — falls back to the original hardcoded Novem pine/forest
  // if no company-specific colors are passed in (so nothing breaks for callers
  // that haven't been updated yet).
  const brandPrimary = primaryColor || '#1B4D2E'
  const brandAccent = accentColor || '#2E7D32'

  // Supports: A4, A3, A4-landscape, A3-landscape, thermal, thermal-58, thermal-80
  const normalizedType = String(type || 'A4').toLowerCase()
  const isThermal = normalizedType === 'thermal' || normalizedType === 'thermal-58' || normalizedType === 'thermal-80'
  const isA3Portrait = normalizedType === 'a3'
  const isA3Landscape = normalizedType === 'a3-landscape'
  const isA4Landscape = normalizedType === 'a4-landscape'
  const thermalPaperWidth = normalizedType === 'thermal-80' ? '80mm' : '58mm'
  const thermalContentMaxWidth = normalizedType === 'thermal-80' ? '72mm' : '52mm'
  const pageSize = isThermal
    ? `${thermalPaperWidth} auto`
    : isA3Landscape
      ? 'A3 landscape'
      : isA3Portrait
        ? 'A3 portrait'
        : isA4Landscape
          ? 'A4 landscape'
          : 'A4 portrait'
  const printRootMaxWidth = isThermal
    ? thermalContentMaxWidth
    : isA3Landscape
      ? '400mm'
      : isA3Portrait
        ? '281mm'
        : isA4Landscape
          ? '277mm'
          : '194mm'
  const modalMaxWidth = isThermal ? '420px' : isA3Landscape ? '1560px' : isA3Portrait ? '1120px' : isA4Landscape ? '1180px' : '900px'

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
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap');
      @page {
        size: ${pageSize};
        margin: ${isThermal ? '0' : '8mm'};
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
      #print-root .print-copy + .print-copy {
        margin-top: 16mm !important;
        padding-top: 8mm !important;
        border-top: 1px dashed var(--print-line);
      }
      #print-root .copy-badge {
        color: var(--print-primary) !important;
        border-color: var(--print-line) !important;
      }
      #print-root .print-copy {
        overflow: visible;
      }
      #print-root.print-pos-58,
      #print-root.print-pos-80 {
        color: #000 !important;
        background: #fff !important;
        box-sizing: border-box;
        overflow: visible;
      }
      #print-root.print-pos-58 .print-copy,
      #print-root.print-pos-80 .print-copy {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      #print-root.print-pos-58 *,
      #print-root.print-pos-80 * {
        color: #000 !important;
        max-width: 100%;
        box-sizing: border-box;
      }
      #print-root.print-pos-58 img,
      #print-root.print-pos-80 img {
        filter: grayscale(1) saturate(0) contrast(2) !important;
      }
      #print-root .mushak-63-doc {
        color: #000 !important;
      }
      #print-root .mushak-63-doc table th,
      #print-root .mushak-63-doc table td {
        background: #fff !important;
        color: #000 !important;
        border-color: #111 !important;
        overflow-wrap: anywhere;
        word-break: normal;
      }
      #print-root .mushak-grid-table {
        table-layout: fixed !important;
      }
      @media print {
        body > div:not(#print-portal-container) { display: none !important; }
        html, body { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow-y: visible !important; }
        .no-print { display: none !important; }

        #print-root {
          font-family: 'Inter', sans-serif !important;
          display: block !important;
          color: var(--print-ink) !important;
          width: 100% !important;
          max-width: ${printRootMaxWidth} !important;
          margin: 0 auto !important;
          padding: ${isThermal ? '0' : '0 0 8mm'} !important;
          overflow: visible !important;
        }
        #print-root.print-doc.print-a4 {
          max-width: ${printRootMaxWidth} !important;
        }
        #print-root .print-a4-doc {
          width: 100% !important;
          max-width: ${isA3Landscape ? '392mm' : isA3Portrait ? '273mm' : isA4Landscape ? '269mm' : '186mm'} !important;
          margin: 0 auto !important;
        }
        #print-root .mushak-63-doc {
          width: 194mm !important;
          max-width: 194mm !important;
          min-height: 281mm !important;
          font-family: 'Noto Sans Bengali', 'Inter', sans-serif !important;
        }
        #print-root .print-copy + .print-copy {
          margin-top: 0 !important;
          padding-top: 0 !important;
          border-top: 0 !important;
        }
        #print-root .print-copy-break {
          page-break-before: always !important;
          break-before: page !important;
        }
        #print-root table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: auto !important;
        }
        #print-root .mushak-grid-table {
          table-layout: fixed !important;
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

        /* Thermal specific tuning for 58mm / 80mm receipts */
        #print-root.epos-receipt,
        #print-root.print-pos-58 {
          width: 52mm !important;
          max-width: 52mm !important;
          min-width: 52mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
          color: #000 !important;
          background: #fff !important;
          overflow: visible !important;
          box-sizing: border-box !important;
        }

        #print-root.print-pos-80 {
          width: 72mm !important;
          max-width: 72mm !important;
          min-width: 72mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
          color: #000 !important;
          background: #fff !important;
          overflow: visible !important;
          box-sizing: border-box !important;
        }

        #print-root.print-pos-58 table,
        #print-root.print-pos-80 table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        #print-root.print-pos-58 th,
        #print-root.print-pos-58 td,
        #print-root.print-pos-80 th,
        #print-root.print-pos-80 td {
          padding: 2px 3px !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
          vertical-align: top !important;
        }

        #print-root.print-pos-58 .pos-receipt-items th:nth-child(n+2),
        #print-root.print-pos-58 .pos-receipt-items td.pos-num,
        #print-root.print-pos-80 .pos-receipt-items th:nth-child(n+2),
        #print-root.print-pos-80 .pos-receipt-items td.pos-num {
          white-space: nowrap !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          text-align: right !important;
        }

        #print-root.print-pos-58 .pos-receipt-items .pos-item-name,
        #print-root.print-pos-80 .pos-receipt-items .pos-item-name {
          word-break: normal !important;
          overflow-wrap: anywhere !important;
        }

        #print-root.print-pos-58 *,
        #print-root.print-pos-80 * {
          box-shadow: none !important;
          text-shadow: none !important;
          color: #000 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        #print-root.print-pos-58 img,
        #print-root.print-pos-80 img {
          height: auto !important;
          object-fit: contain !important;
          filter: grayscale(1) contrast(1.2) !important;
        }

        #print-root.print-pos-58 .no-pos-print,
        #print-root.print-pos-80 .no-pos-print {
          display: none !important;
        }

        #print-root.print-pos-58 .print-copy-break,
        #print-root.print-pos-80 .print-copy-break {
          page-break-before: always !important;
          break-before: page !important;
        }

        #print-root .print-footer,
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
  }, [type, brandPrimary, brandAccent, isThermal, thermalPaperWidth, thermalContentMaxWidth, pageSize, printRootMaxWidth, isA3Landscape, isA3Portrait, isA4Landscape])

  useEffect(() => {
    if (!portalNode) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    const closeAfterPrint = () => onClose?.()

    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('afterprint', closeAfterPrint)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('afterprint', closeAfterPrint)
    }
  }, [portalNode, onClose])

  useEffect(() => {
    if (!portalNode || !autoPrint) return undefined
    const timer = setTimeout(() => { handlePrint() }, 300)
    return () => clearTimeout(timer)
  }, [portalNode, autoPrint])

  const handleExportPDF = async () => {
    const el = printRootRef.current
    if (!el) return
    setPdfBusy(true)
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const isTherm = isThermal
      const orientation = isTherm ? 'portrait' : (normalizedType.includes('landscape') ? 'landscape' : 'portrait')
      const format = isTherm ? [80, (canvas.height / canvas.width) * 80] : (normalizedType === 'a3' || normalizedType === 'a3-landscape' ? 'a3' : 'a4')
      const pdf = new jsPDF({ orientation, unit: 'mm', format })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height / canvas.width) * pdfW
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      const safeName = (title || 'document').replace(/[^a-zA-Z0-9_\-. ]/g, '_').slice(0, 80)
      pdf.save(`${safeName}.pdf`)
    } catch (e) {
      console.error('PDF export failed:', e)
    }
    setPdfBusy(false)
  }

  const handlePrint = () => {
    const el = printRootRef.current
    if (!el) return
    const printWin = window.open('', '_blank', 'width=900,height=700')
    if (!printWin) { window.print(); return }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((s) => s.outerHTML).join('\n')
    // Wrap in #print-portal-container so the @media print rule
    // `body > div:not(#print-portal-container) { display:none }` does NOT hide
    // the content in the popup window — which was the cause of blank pages.
    // Register onload BEFORE document.write to avoid missing the event.
    printWin.onload = () => {
      printWin.focus()
      printWin.print()
      printWin.addEventListener('afterprint', () => printWin.close())
    }
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body style="margin:0;padding:0"><div id="print-portal-container">${el.outerHTML}</div></body></html>`)
    printWin.document.close()
  }

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) onClose?.()
  }

  if (!portalNode) return null
  return createPortal(
    <div
      id="print-modal-overlay"
      className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center overflow-auto overscroll-contain p-3 sm:p-6"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="bg-white w-full my-0 sm:my-4 relative overflow-visible rounded-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col"
        style={{
          border: `1px solid rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.22)`,
          maxWidth: modalMaxWidth,
        }}
      >

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b sticky top-0 bg-white z-10 no-print"
          style={{ borderColor: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.22)` }}
        >
          <h3 className="font-semibold font-sans min-w-0 flex-1 truncate" style={{ color: brandPrimary }}>{title}</h3>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" className="flex items-center gap-1 text-white px-3 py-1.5 rounded text-sm" style={{ background: brandPrimary }} onClick={handleExportPDF} disabled={pdfBusy}>
              <Download size={14} /> {pdfBusy ? 'Generating…' : 'Download PDF'}
            </button>
            <button type="button" className="flex items-center gap-1 text-white px-3 py-1.5 rounded text-sm" style={{ background: brandAccent }} onClick={handlePrint}>
              <Printer size={14} /> Print
            </button>
            <button type="button" className="px-3 py-1.5 rounded text-sm border hover:bg-gray-100" style={{ borderColor: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.24)`, color: brandPrimary }} onClick={onClose}>
              <X size={14} /> Close
            </button>
          </div>
        </div>
        {/* Print Content Wrapper */}
        <div
          ref={printRootRef}
          id="print-root"
          className={`p-4 sm:p-8 overflow-auto ${
            isThermal
              ? normalizedType === 'thermal-80'
                ? 'epos-receipt print-pos-80'
                : 'epos-receipt print-pos-58'
              : 'print-doc print-a4'
          }`}
        >
          {children}
        </div>
      </div>
    </div>,
    portalNode
  )
}
