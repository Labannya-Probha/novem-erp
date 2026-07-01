import { useState } from 'react'
import { supabase } from '../../supabase'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

const WIPE_MODULES = [
  {
    id: 'reservations',
    label: 'Reservations & Billing',
    description: 'Reservations, guests, folio charges, payments/refunds, invoices, quotations, VAT sales register, night audits, guest IDs, loyalty ledger, companies, agencies, shareholders',
    tables: ['folio_charges', 'payments', 'refunds', 'invoices', 'quotations', 'reservation_addons', 'reservation_guests', 'reservation_rooms', 'reservations', 'guests', 'vat_sales_register', 'night_audits', 'guest_ids', 'loyalty_ledger', 'companies', 'agencies', 'shareholders'],
    sequences: [
      { id: 'res_no_seq',        dependsOn: ['reservations'] },
      { id: 'quote_no_seq',      dependsOn: ['quotations'] },
      { id: 'guest_bill_seq',    dependsOn: ['invoices'] },
      { id: 'mushak_serial_seq', dependsOn: ['vat_sales_register'] },
    ],
  },
  {
    id: 'pos',
    label: 'Restaurant POS',
    description: 'POS orders, order items, day close summaries, menu categories/items, recipe items',
    tables: ['pos_order_items', 'pos_orders', 'day_closes', 'recipe_items', 'menu_items', 'menu_categories'],
    sequences: [
      { id: 'pos_no_seq', dependsOn: ['pos_orders'] },
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    description: 'Facility sales and facility item definitions',
    tables: ['facility_sales', 'facility_items'],
    sequences: [
      { id: 'fac_no_seq', dependsOn: ['facility_sales'] },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Attendance',
    description: 'Employees, attendance, leave, incidents, payroll runs/payslips, allowances, employee compliance records',
    tables: ['comp_leave_register', 'leave_applications', 'leave_types', 'attendance_records', 'employees', 'incident_register', 'allowance_config', 'payroll_runs', 'payslips', 'employee_compliance_records'],
    sequences: [
      { id: 'emp_no_seq', dependsOn: ['employees'] },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Procurement',
    description: 'Requisitions, purchase orders, goods receipts, stock transfers/returns, VAT purchase register, vendors, vendor payments, stock items/locations',
    tables: ['return_items', 'stock_returns', 'transfer_items', 'stock_transfers', 'grn_items', 'goods_receipts', 'po_items', 'purchase_orders', 'requisition_items', 'requisitions', 'vat_purchase_register', 'vendors', 'vendor_payments', 'inv_items', 'store_locations'],
    sequences: [
      { id: 'req_no_seq', dependsOn: ['requisitions'] },
      { id: 'po_no_seq',  dependsOn: ['purchase_orders'] },
      { id: 'grn_no_seq', dependsOn: ['goods_receipts'] },
      { id: 'trf_no_seq', dependsOn: ['stock_transfers'] },
      { id: 'rtn_no_seq', dependsOn: ['stock_returns'] },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Journal entries/lines, VAT registers, document register, fixed assets/depreciation, VDS certificates, transaction mappings, chart of accounts',
    tables: ['journal_lines', 'journal_entries', 'vat_sales_register', 'vat_purchase_register', 'doc_register', 'fixed_assets', 'asset_depreciation', 'vds_certificates', 'accounting_transaction_mapping', 'chart_of_accounts'],
    sequences: [
      { id: 'jv_no_seq',  dependsOn: ['journal_entries'] },
      { id: 'doc_no_seq', dependsOn: ['doc_register'] },
      { id: 'fa_no_seq',  dependsOn: ['fixed_assets'] },
      { id: 'vds_certificates_id_seq', dependsOn: ['vds_certificates'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations & Tasks',
    description: 'Task categories/tasks, consumption entries/lines, audit log and report definitions',
    tables: ['task_categories', 'tasks', 'consumption_lines', 'consumption_entries', 'audit_log', 'report_definitions'],
    sequences: [],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Statutory compliance items and statutory filings',
    tables: ['statutory_filings', 'statutory_compliance_items'],
    sequences: [],
  },
  {
    id: 'property-setup',
    label: 'Property Setup',
    description: 'Rooms inventory, cancellation policies and discount policies',
    tables: ['rooms', 'cancellation_policies', 'discount_policies'],
    sequences: [],
  },
]

const STEP_IDLE    = 'idle'
const STEP_RUNNING = 'running'
const STEP_DONE    = 'done'
const STEP_ERROR   = 'error'

export default function DataWipeCard() {
  const [selected, setSelected]           = useState(null)
  const [checkedTables, setCheckedTables] = useState(new Set())
  const [confirm, setConfirm]             = useState('')
  const [expanded, setExpanded]           = useState(false)
  const [phase, setPhase]                 = useState('idle')
  const [steps, setSteps]                 = useState([])
  const [result, setResult]               = useState(null)
  const [errMsg, setErrMsg]               = useState('')

  const module = WIPE_MODULES.find((m) => m.id === selected)

  const selectModule = (id) => {
    if (phase === 'wiping') return
    if (selected === id) {
      setSelected(null)
      setCheckedTables(new Set())
    } else {
      const m = WIPE_MODULES.find((mm) => mm.id === id)
      setSelected(id)
      setCheckedTables(new Set(m.tables))
    }
    setConfirm('')
    setPhase('idle')
    setSteps([])
    setResult(null)
    setErrMsg('')
  }

  const toggleTable = (t) => {
    if (phase === 'wiping') return
    setCheckedTables((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }
  const selectAllTables   = () => module && setCheckedTables(new Set(module.tables))
  const deselectAllTables = () => setCheckedTables(new Set())

  const tablesToWipe = module ? module.tables.filter((t) => checkedTables.has(t)) : []
  const eligibleSequences = module ? module.sequences.filter((s) => s.dependsOn.every((t) => checkedTables.has(t))) : []
  const skippedSequences  = module ? module.sequences.filter((s) => !s.dependsOn.every((t) => checkedTables.has(t))) : []

  const startWipe = () => {
    if (!module || confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0) return
    const allSteps = [
      ...tablesToWipe.map((t) => ({ id: t, label: t, type: 'table', state: STEP_IDLE, detail: '' })),
      ...eligibleSequences.map((s) => ({ id: s.id, label: s.id, type: 'sequence', state: STEP_IDLE, detail: '' })),
    ]
    setSteps(allSteps)
    setPhase('wiping')
    runWipe(allSteps, tablesToWipe, eligibleSequences.map((s) => s.id))
  }

  const runWipe = async (initialSteps, tables, sequences) => {
    const animated = [...initialSteps]
    for (let i = 0; i < animated.length; i++) {
      animated[i] = { ...animated[i], state: STEP_RUNNING }
      setSteps([...animated])
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 80))
    }
    try {
      const { data, error } = await supabase.rpc('wipe_module', { tables, sequences })
      if (error) throw new Error(error.message)
      const rpcResult = data
      const errMap = {}
      for (const e of rpcResult.errors || []) { errMap[e.table || e.sequence] = e.error }
      const clearedMap = {}
      for (const c of rpcResult.tables_cleared || []) { clearedMap[c.table] = c.rows_deleted }
      const resetMap = {}
      for (const r of rpcResult.sequences_reset || []) { resetMap[r.sequence] = r.restarted_at }
      const finalSteps = animated.map((s) => {
        if (s.type === 'table') {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          const rows = clearedMap[s.id]
          return { ...s, state: STEP_DONE, detail: rows !== undefined ? `${rows} rows deleted` : 'cleared' }
        } else {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          return { ...s, state: STEP_DONE, detail: 'reset to 1' }
        }
      })
      setSteps(finalSteps)
      setResult(rpcResult)
      setPhase(rpcResult.success ? 'done' : 'error')
      if (!rpcResult.success) setErrMsg(`${rpcResult.errors.length} step(s) failed — see details above.`)
    } catch (e) {
      const errSteps = animated.map((s) => ({ ...s, state: STEP_ERROR, detail: e.message }))
      setSteps(errSteps)
      setPhase('error')
      setErrMsg(e.message)
    }
  }

  const reset = () => {
    setSelected(null); setCheckedTables(new Set()); setConfirm(''); setPhase('idle')
    setSteps([]); setResult(null); setErrMsg('')
  }

  return (
    <div className="card p-5 border border-red-200">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded((v) => !v)}>
        <h2 className="font-display font-semibold text-red-600 flex items-center gap-2">
          <AlertTriangle size={18} /> Superuser: Data wipe
        </h2>
        {expanded ? <ChevronUp size={18} className="text-red-400" /> : <ChevronDown size={18} className="text-red-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-pine/70">
            Permanently delete selected data and reset its reference number sequences to 1.
            This <span className="font-semibold text-red-600">cannot be undone.</span>
          </p>

          <div className="grid grid-cols-1 gap-2">
            {WIPE_MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => selectModule(m.id)}
                disabled={phase === 'wiping'}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  selected === m.id
                    ? 'border-red-400 bg-red-50'
                    : 'border-leaf hover:border-red-300 hover:bg-red-50/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="font-medium text-sm text-pine">{m.label}</div>
                <div className="text-xs text-pine/50 mt-0.5">{m.description}</div>
              </button>
            ))}
          </div>

          {selected && module && phase === 'idle' && (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-red-700">
                  Wipe: <span className="underline">{module.label}</span>
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllTables} className="text-red-600 underline hover:text-red-700">Select all</button>
                  <span className="text-red-300">·</span>
                  <button onClick={deselectAllTables} className="text-red-600 underline hover:text-red-700">Deselect all</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-56 overflow-y-auto pr-1">
                {module.tables.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs text-pine cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-red-600 w-3.5 h-3.5"
                      checked={checkedTables.has(t)}
                      onChange={() => toggleTable(t)}
                    />
                    <span className="font-mono">{t}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-red-500">
                {tablesToWipe.length} of {module.tables.length} tables selected · {eligibleSequences.length} of {module.sequences.length} sequences will reset
              </p>

              {skippedSequences.length > 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  Not resetting: {skippedSequences.map((s) => `${s.id} (needs ${s.dependsOn.join(', ')} checked)`).join(' · ')}
                </p>
              )}

              <div>
                <label className="label text-red-700 !text-xs">Type <span className="font-mono font-bold">WIPE</span> to confirm</label>
                <input
                  className="input border-red-300 focus:ring-red-400 max-w-xs"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="WIPE"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                className="btn-primary !bg-red-600 hover:!bg-red-700"
                onClick={startWipe}
                disabled={confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0}
              >
                <AlertTriangle size={15} /> Start Wipe{tablesToWipe.length < module.tables.length ? ' (partial)' : ''}
              </button>
            </div>
          )}

          {steps.length > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  {phase === 'wiping' && (
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  )}
                  {phase === 'done' && <span className="text-forest">✓</span>}
                  {phase === 'error' && <span className="text-red-600">✗</span>}
                  {phase === 'wiping' ? `Wiping ${module.label}…` : phase === 'done' ? 'Wipe complete' : 'Wipe finished with errors'}
                </div>
                {(phase === 'done' || phase === 'error') && (
                  <button onClick={reset} className="text-xs text-pine/50 hover:text-pine underline">Reset</button>
                )}
              </div>

              <div className="grid grid-cols-2 divide-x divide-red-100">
                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Tables</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'table').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-red-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${
                            s.state === STEP_DONE  ? 'text-forest line-through opacity-60' :
                            s.state === STEP_ERROR ? 'text-red-600' :
                            s.state === STEP_RUNNING ? 'text-red-500 font-semibold' : 'text-pine/50'
                          }`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && (
                            <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Sequences → reset to 1</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'sequence').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${
                            s.state === STEP_DONE  ? 'text-forest line-through opacity-60' :
                            s.state === STEP_ERROR ? 'text-red-600' :
                            s.state === STEP_RUNNING ? 'text-amber-600 font-semibold' : 'text-pine/50'
                          }`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && (
                            <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {steps.filter((s) => s.type === 'sequence').length === 0 && (
                      <div className="text-xs text-pine/40 italic">None eligible this run.</div>
                    )}
                  </div>
                </div>
              </div>

              {phase === 'done' && result && (
                <div className="px-4 py-3 bg-forest/10 border-t border-forest/20 flex flex-wrap gap-4 text-xs">
                  <span className="font-semibold text-forest">✓ Wipe successful</span>
                  <span className="text-pine/60">{result.tables_cleared?.length || 0} tables cleared</span>
                  <span className="text-pine/60">{result.sequences_reset?.length || 0} sequences reset to 1</span>
                  <span className="text-pine/60">
                    {result.tables_cleared?.reduce((sum, t) => sum + (t.rows_deleted || 0), 0)} total rows deleted
                  </span>
                </div>
              )}
              {phase === 'error' && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-xs text-red-600">
                  ✗ {errMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
