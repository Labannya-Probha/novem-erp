import { useEffect, useState } from 'react'
import { fmtBDT, fmtDate, exportXLSX } from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import { FileDown, Printer, Eye, ClipboardCheck } from 'lucide-react'

export default function NightAuditReports() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null) // for printing

  useEffect(() => {
    const list = JSON.parse(localStorage.getItem('night_audit_reports') || '[]')
    setReports(list)
  }, [])

  const downloadExcel = () => {
    const data = [
      ['Novem Resort — Night Audit Reports List'],
      [],
      ['SL', 'Audited Date', 'Execution Time', 'Run By', 'Rooms Occupied', 'Room Rev', 'POS Rev', 'Other Rev', 'Total Rev', 'Payments Rec.'],
      ...reports.map((r, i) => [
        i + 1,
        r.date,
        new Date(r.run_at).toLocaleString(),
        r.run_by,
        r.rooms_occupied,
        +r.room_revenue,
        +r.pos_revenue,
        +r.other_revenue,
        +r.total_revenue,
        +r.total_payments
      ]),
    ]
    exportXLSX('Night_Audit_Reports.xlsx', [{ name: 'Audit Summary', rows: data }])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
            <ClipboardCheck size={24} className="text-forest" /> Night Audit Statements
          </h1>
          <p className="text-sm text-pine/60">
            Historical daily revenue statements, occupancy logs, and financial reports.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={downloadExcel}
          disabled={reports.length === 0}
        >
          <FileDown size={15} /> Export Reports List
        </button>
      </div>

      <div className="card overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Audited Date</th>
              <th className="th">Executed At</th>
              <th className="th">Run By</th>
              <th className="th text-right">Occupied Rooms</th>
              <th className="th text-right">Room Rev</th>
              <th className="th text-right">POS Rev</th>
              <th className="th text-right">Other Rev</th>
              <th className="th text-right font-bold">Total Daily Rev</th>
              <th className="th text-right">Payments Collected</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={i} className="hover:bg-leaf/20">
                <td className="td font-semibold money text-xs">{fmtDate(r.date)}</td>
                <td className="td text-[11px] text-pine/50">{new Date(r.run_at).toLocaleString()}</td>
                <td className="td text-xs font-semibold">{r.run_by}</td>
                <td className="td money text-right">{r.rooms_occupied}</td>
                <td className="td money text-right">{fmtBDT(r.room_revenue)}</td>
                <td className="td money text-right">{fmtBDT(r.pos_revenue)}</td>
                <td className="td money text-right">{fmtBDT(r.other_revenue)}</td>
                <td className="td money text-right font-bold text-forest">{fmtBDT(r.total_revenue)}</td>
                <td className="td money text-right text-pine font-semibold">{fmtBDT(r.total_payments)}</td>
                <td className="td text-center">
                  <button
                    className="btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => setSelectedReport(r)}
                  >
                    <Printer size={13} className="inline mr-1" /> View & Print
                  </button>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td className="td text-pine/50 text-center py-6" colSpan={10}>
                  No night audits have been run yet. Run your first audit under the <b>Night Audit</b> tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <PrintPortal title={`Daily Revenue Statement — ${selectedReport.date}`} onClose={() => setSelectedReport(null)}>
          <DailyStatementReport report={selectedReport} />
        </PrintPortal>
      )}
    </div>
  )
}

/* ---------- PRINTABLE DAILY STATEMENT ---------- */
function DailyStatementReport({ report }) {
  const cell = { borderBottom: '1px solid #ddd', padding: '6px 8px', fontSize: 11 }
  const num = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }
  const hcell = { borderBottom: '2px solid #2E7D32', padding: '6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', fontWeight: 'bold' }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', color: '#000' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #2E7D32', paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#2E7D32' }}>DAILY REVENUE STATEMENT</div>
        <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
          <b>Statement Date:</b> {fmtDate(report.date)} · <b>Run At:</b> {new Date(report.run_at).toLocaleString()} · <b>Audited By:</b> {report.run_by}
        </div>
      </div>

      {/* Overview stats table */}
      <table style={{ width: '100%', marginBottom: 15, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '50%' }}><b>Rooms Occupied:</b> {report.rooms_occupied} Rooms</td>
            <td style={{ ...cell, width: '50%', textAlign: 'right' }}><b>Auto Room Postings:</b> {report.posted_charges_count} lines</td>
          </tr>
        </tbody>
      </table>

      {/* Revenue breakdown */}
      <h4 style={{ fontSize: 12, fontWeight: 'bold', color: '#2E7D32', textTransform: 'uppercase', marginBottom: 6 }}>Revenue Summary</h4>
      <table style={{ width: '100%', marginBottom: 20, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={hcell}>Department / Source</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Total Posted Revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cell}>Room Department (Rack Rate + Drivers + Extra Pax)</td>
            <td style={num}>{Number(report.room_revenue || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style={cell}>Food & Beverage (Restaurant POS Settlements)</td>
            <td style={num}>{Number(report.pos_revenue || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style={cell}>Other Facilities (Tea, Pickle, Sports, Laundry, Miscellaneous)</td>
            <td style={num}>{Number(report.other_revenue || 0).toFixed(2)}</td>
          </tr>
          <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
            <td style={{ ...cell, borderTop: '2px solid #000' }}>TOTAL DAILY REVENUE (NET DEPARTMENTS)</td>
            <td style={{ ...num, borderTop: '2px solid #000', fontSize: 12 }}>{Number(report.total_revenue || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payments breakdown */}
      <h4 style={{ fontSize: 12, fontWeight: 'bold', color: '#2E7D32', textTransform: 'uppercase', marginBottom: 6 }}>Financial Receipts Summary</h4>
      <table style={{ width: '100%', marginBottom: 25, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={hcell}>Payment Method</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Amount Received</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(report.payment_summary || {}).length > 0 ? (
            Object.keys(report.payment_summary).map((method) => (
              <tr key={method}>
                <td style={cell}>{method} Transactions</td>
                <td style={num}>{Number(report.payment_summary[method]).toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td style={cell} colSpan={2}>No payments recorded today.</td>
            </tr>
          )}
          <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
            <td style={{ ...cell, borderTop: '2px solid #000' }}>TOTAL FINANCIAL RECEIPTS COLLECTED</td>
            <td style={{ ...num, borderTop: '2px solid #000', fontSize: 12 }}>{Number(report.total_payments || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footnote */}
      <div style={{ fontSize: 9, color: '#666', borderTop: '1px solid #ccc', paddingTop: 8, textAlign: 'center', marginTop: 30 }}>
        Novem Resort ERP · Certified Night Audit Record · Non-modifiable document.
      </div>
    </div>
  )
}
