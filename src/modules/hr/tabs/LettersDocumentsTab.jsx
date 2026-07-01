import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtDate, todayISO } from '../../../lib/helpers'
import { FileText, Plus } from 'lucide-react'

const DOC_TYPES = ['LETTER', 'MEMO', 'NOTICE', 'CIRCULAR', 'INWARD', 'OUTWARD']

export default function LettersDocumentsTab({ flash, userName, view, setView }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ doc_date: todayISO(), department: 'GEN', doc_type: view && DOC_TYPES.includes(view) ? view : 'LETTER', subject: '', party: '' })

  const load = async () => {
    let q = supabase.from('doc_register').select('*').order('created_at', { ascending: false })
    if (view && DOC_TYPES.includes(view)) q = q.eq('doc_type', view)
    const { data } = await q
    setRows(data || [])
  }
  useEffect(() => { load() }, [view])

  const add = async () => {
    if (!f.subject) return
    const { error } = await supabase.from('doc_register').insert({ ...f, created_by: userName })
    if (error) flash(error.message)
    else { setF({ doc_date: todayISO(), department: 'GEN', doc_type: f.doc_type, subject: '', party: '' }); load() }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-leaf/60 flex-wrap">
        {[{ key: '', label: 'All' }, ...DOC_TYPES.map((t) => ({ key: t, label: t }))].map((sv) => (
          <button key={sv.key} onClick={() => setView(sv.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t flex items-center gap-1 ${sv.key === (view || '') ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            <FileText size={11} /> {sv.label}
          </button>
        ))}
      </div>

      <div className="card p-4 grid grid-cols-6 gap-2">
        <input type="date" className="input" value={f.doc_date} onChange={(e) => setF({ ...f, doc_date: e.target.value })} />
        <input className="input" placeholder="Dept" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
        <select className="input" value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })}>
          {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <input className="input" placeholder="Party" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Register</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Docket No</th><th className="th">Date</th><th className="th">Type</th><th className="th">Subject</th><th className="th">Party</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td money text-xs font-semibold">{r.doc_no}</td>
                <td className="td money text-xs">{fmtDate(r.doc_date)}</td>
                <td className="td text-xs">{r.doc_type}</td>
                <td className="td text-sm">{r.subject}</td>
                <td className="td text-xs">{r.party || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No documents registered.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
