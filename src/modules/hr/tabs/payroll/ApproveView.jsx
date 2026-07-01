import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import { fmtBDT } from '../../../../lib/helpers'
import { postJournal } from '../../../../lib/posting'
import { CheckCircle, BookOpen } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonth(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export default function ApproveView({ flash, userName, canApprove }) {
  const [runs, setRuns] = useState([])
  const [busy, setBusy] = useState(null)

  const load = () => {
    supabase.from('payroll_runs').select('*')
      .in('status', ['DRAFT','APPROVED'])
      .order('pay_month', { ascending: false })
      .then(({ data }) => setRuns(data || []))
  }
  useEffect(() => { load() }, [])

  const approve = async (run) => {
    if (!canApprove) { flash('অনুমোদনের অনুমতি নেই।'); return }
    setBusy(run.id)
    const { error } = await supabase.from('payroll_runs')
      .update({ status: 'APPROVED', approved_by: userName })
      .eq('id', run.id)
    if (error) flash(error.message)
    else { flash(`${fmtMonth(run.pay_month)} payroll approved.`); load() }
    setBusy(null)
  }

  const postLedger = async (run) => {
    if (!canApprove) { flash('অনুমোদনের অনুমতি নেই।'); return }
    setBusy(run.id + '_post')
    try {
      const jvId = await postJournal({
        jv_date: run.pay_month,
        source: 'PAYROLL',
        posted_by: userName,
        narration: `Payroll — ${fmtMonth(run.pay_month)}`,
        lines: [
          { account_code: '500914', debit: run.total_gross, credit: 0 },
          { account_code: '200201', debit: 0, credit: run.total_gross },
        ],
      })
      await supabase.from('payroll_runs')
        .update({ status: 'POSTED', jv_id: jvId })
        .eq('id', run.id)
      flash(`${fmtMonth(run.pay_month)} payroll posted to ledger.`)
      load()
    } catch (e) {
      flash(e.message)
    }
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      {runs.length === 0 && (
        <div className="card p-6 text-center text-pine/40 text-sm">No pending payroll runs.</div>
      )}
      {runs.map((run) => (
        <div key={run.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold text-pine">{fmtMonth(run.pay_month)}</div>
            <div className="text-xs text-pine/50 mt-0.5">
              Gross: {fmtBDT(run.total_gross)} &nbsp;|&nbsp; Net: {fmtBDT(run.total_net)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-chip ${run.status === 'APPROVED' ? 'bg-leaf/30 text-forest' : 'bg-amber/20 text-amber'}`}>
              {run.status}
            </span>
            {run.status === 'DRAFT' && canApprove && (
              <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                onClick={() => approve(run)} disabled={busy === run.id}>
                <CheckCircle size={13} /> {busy === run.id ? 'Approving…' : 'Approve'}
              </button>
            )}
            {run.status === 'APPROVED' && canApprove && (
              <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 bg-forest"
                onClick={() => postLedger(run)} disabled={busy === run.id + '_post'}>
                <BookOpen size={13} /> {busy === run.id + '_post' ? 'Posting…' : 'Post to Ledger'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
