import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import { FileDown } from 'lucide-react'

export default function VatRegister() {
  const [month, setMonth] = useState(todayISO().slice(0, 7)) // YYYY-MM
  const [rows, setRows] = useState([])
  const [company, setCompany] = useState(null)

  const load = async () => {
    const start = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
    const { data } = await supabase.from('vat_sales_register')
      .select('*').gte('issue_date', start).lt('issue_date', end).order('issue_date')
    setRows(data || [])
    const { data: co } = await supabase.from('company_settings').select('*').eq('id', 1).single()
    setCompany(co)
  }
  useEffect(() => { load() }, [month])

  const totals = rows.reduce(
    (a, r) => ({
      taxable_value: a.taxable_value + Number(r.taxable_value),
      sd: a.sd + Number(r.sd),
      vat: a.vat + Number(r.vat),
      total: a.total + Number(r.total),
    }),
    { taxable_value: 0, sd: 0, vat: 0, total: 0 }
  )

  const downloadExcel = () => {
    const data = [
      ['মূসক-৬.২ · Sales Register (Mushak-6.2)'],
      [company?.legal_name || company?.name || ''],
      [`BIN: ${company?.bin || '—'}`, `Tax period: ${month}`],
      [],
      ['SL', 'Date', 'Invoice No (Mushak-6.3)', 'Buyer Name', 'Buyer BIN', 'Taxable Value', 'SD', 'VAT', 'Total'],
      ...rows.map((r, i) => [i + 1, r.issue_date, r.invoice_no, r.buyer_name || '', r.buyer_bin || '', +r.taxable_value, +r.sd, +r.vat, +r.total]),
      [],
      ['', '', '', '', 'TOTAL', totals.taxable_value, totals.sd, totals.vat, totals.total],
    ]
    exportXLSX(`Mushak-6.2_Sales_Register_${month}.xlsx`, [{ name: `6.2 ${month}`, rows: data }])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">VAT Sales Register — Mushak-6.2</h1>
          <p className="text-sm text-pine/60">Auto-populated from every Mushak-6.3 issued at checkout. This monthly view feeds your Mushak-9.1 return (Phase 4).</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Tax period (month)</label>
            <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={downloadExcel} disabled={rows.length === 0}>
            <FileDown size={15} /> Export Excel
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">SL</th><th className="th">Date</th><th className="th">Invoice No.</th>
            <th className="th">Buyer</th><th className="th">Buyer BIN</th>
            <th className="th text-right">Taxable value</th><th className="th text-right">SD</th>
            <th className="th text-right">VAT</th><th className="th text-right">Total</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-leaf/20">
                <td className="td money">{i + 1}</td>
                <td className="td money text-xs">{fmtDate(r.issue_date)}</td>
                <td className="td money font-semibold">{r.invoice_no}</td>
                <td className="td text-sm">{r.buyer_name || '—'}</td>
                <td className="td money text-xs">{r.buyer_bin || '—'}</td>
                <td className="td money text-right">{Number(r.taxable_value).toFixed(2)}</td>
                <td className="td money text-right">{Number(r.sd).toFixed(2)}</td>
                <td className="td money text-right">{Number(r.vat).toFixed(2)}</td>
                <td className="td money text-right font-semibold">{Number(r.total).toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/50" colSpan={9}>No Mushak-6.3 invoices issued in this period yet.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="bg-leaf/40 font-bold money">
              <td className="td" colSpan={5}>Period totals — output VAT payable basis</td>
              <td className="td text-right">{totals.taxable_value.toFixed(2)}</td>
              <td className="td text-right">{totals.sd.toFixed(2)}</td>
              <td className="td text-right">{totals.vat.toFixed(2)}</td>
              <td className="td text-right">{totals.total.toFixed(2)}</td>
            </tr></tfoot>
          )}
        </table>
        </div>
      </div>

      <div className="mt-4 px-4 py-3 rounded-lg bg-leaf/40 text-pine text-xs">
        <b>Monthly output VAT for this period: <span className="money">{fmtBDT(totals.vat)}</span></b> — this figure flows into Mushak-9.1 (monthly return) when the VAT suite arrives in Phase 4. Purchases (Mushak-6.1) begin auto-recording with the Inventory module in Phase 3.
      </div>
    </div>
  )
}
