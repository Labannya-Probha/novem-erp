import { useState } from 'react'
import { fmtBDT } from '../lib/helpers'
import KPICards from '../components/KPICards.jsx'

export default function ChallanForm({ res }) {
  const [challan, setChallan] = useState({ no: '', date: '', amount: '', status: 'Pending' })

  const handleSave = () => {
    console.log('Saved:', challan)
  }

  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">A-Challan Management</h2>
        <div className="flex gap-3">
          <a href="https://www.achallan.gov.bd/acs/v2/general/home" target="_blank" rel="noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Fill-up A-Challan
          </a>
          <a href="https://challanverification.finance.gov.bd/echalan/" target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Verify Challan
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <input type="text" placeholder="Challan No" className="p-3 border rounded-lg" onChange={(e) => setChallan({...challan, no: e.target.value})} />
        <input type="date" className="p-3 border rounded-lg" onChange={(e) => setChallan({...challan, date: e.target.value})} />
        <input type="number" placeholder="Amount" className="p-3 border rounded-lg" onChange={(e) => setChallan({...challan, amount: e.target.value})} />
        <button onClick={handleSave} className="p-3 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900">
          Save Challan
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="p-3 text-left border">Challan No</th>
            <th className="p-3 text-left border">Date</th>
            <th className="p-3 text-right border">Amount</th>
            <th className="p-3 text-center border">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 border">{challan.no || '—'}</td>
            <td className="p-3 border">{challan.date || '—'}</td>
            <td className="p-3 border text-right">{challan.amount ? fmtBDT(challan.amount) : '—'}</td>
            <td className="p-3 border text-center">
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">{challan.status}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
