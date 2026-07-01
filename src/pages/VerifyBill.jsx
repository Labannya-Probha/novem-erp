import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { PosReceipt } from '../components/print/PosDocs.jsx'
import { Download, Printer } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default function VerifyBill() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const printRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: o, error: oe } = await supabase
          .from('pos_orders')
          .select('*')
          .or(`order_no.eq.${id},id.eq.${id}`)
          .limit(1)
          .single()
        if (oe || !o) { setError('Order not found.'); setLoading(false); return }
        setOrder(o)
        const { data: oi } = await supabase.from('pos_order_items').select('*').eq('order_id', o.id)
        setItems(oi || [])
        const { data: co } = await supabase.from('company_settings').select('*').limit(1).maybeSingle()
        setCompany(co || null)
      } catch (e) {
        setError(e.message || 'Failed to load order.')
      }
      setLoading(false)
    }
    if (id) load()
  }, [id])

  const handleDownloadPDF = async () => {
    const el = printRef.current
    if (!el) return
    setPdfBusy(true)
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, (canvas.height / canvas.width) * 80] })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height / canvas.width) * pdfW
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      pdf.save(`Bill-${order?.order_no || id}.pdf`)
    } catch (e) {
      console.error('PDF export failed:', e)
    }
    setPdfBusy(false)
  }

  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const printWin = window.open('', '_blank', 'width=900,height=700')
    if (!printWin) return
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((s) => s.outerHTML).join('\n')
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body style="margin:0;padding:0">${el.outerHTML}</body></html>`)
    printWin.document.close()
    printWin.focus()
    printWin.print()
    printWin.close()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-pine/50 text-sm">Loading bill…</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600 text-sm">{error || 'Order not found.'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-3">
      <div className="max-w-sm mx-auto">
        <div className="flex gap-2 mb-4 justify-center">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            className="flex items-center gap-1 bg-pine text-white px-4 py-2 rounded text-sm font-semibold"
          >
            <Download size={14} /> {pdfBusy ? 'Generating…' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 bg-forest text-white px-4 py-2 rounded text-sm font-semibold"
          >
            <Printer size={14} /> Print
          </button>
        </div>
        <div ref={printRef} style={{ background: '#fff', padding: 8 }}>
          <PosReceipt order={order} items={items} company={company} singleCopy copyLabel="CUSTOMER_COPY" />
        </div>
      </div>
    </div>
  )
}
