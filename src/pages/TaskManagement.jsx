import { useEffect, useState } from 'react'
import { supabase, SUPABASE_CONFIG } from '../supabase'
import { fmtDate, todayISO, parseWorkflowMeta, routeAiIntent, buildWorkflowDescription, updateDescriptionStage } from '../lib/helpers'
import KPICards from '../components/KPICards.jsx'
import { ListChecks, Plus, Sparkles, Search, Clock, User, X, Bot, ArrowRight, RefreshCcw } from 'lucide-react'

const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']
const STATUS_STYLE = {
  OPEN: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE: 'bg-forest/15 text-forest',
  CANCELLED: 'bg-stone-200 text-stone-500',
}
const PRIORITY_STYLE = {
  LOW: 'bg-leaf/50 text-pine/60',
  MEDIUM: 'bg-sky-100 text-sky-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
}

const STAGE_STATUS = {
  COMPLETED: 'DONE',
  SERVED: 'DONE',
  DONE: 'DONE',
}

function AITaskerBoard({ userName }) {
  const [rawIntent, setRawIntent] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [tasks, setTasks] = useState([])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, task_no, title, description, status, priority, source, created_at, due_date')
      .in('source', ['AI_ROUTED', 'GUEST_POS_ORDER', 'CHECKOUT_CLEARANCE'])
      .order('created_at', { ascending: false })
      .limit(250)
    if (error) { flash(error.message); return }
    setTasks(data || [])
  }

  useEffect(() => { load() }, [])

  const byDepartment = { RESTAURANT: [], HOUSEKEEPING: [], FRONT_OFFICE: [], MAINTENANCE: [] }
  tasks.forEach((task) => {
    const meta = parseWorkflowMeta(task)
    const row = { ...task, meta }
    if (!byDepartment[meta.department]) byDepartment[meta.department] = []
    byDepartment[meta.department].push(row)
  })

  const createIntentTask = async () => {
    if (!rawIntent.trim()) { flash('Write the guest request first.'); return }
    setBusy(true)
    const routed = routeAiIntent(rawIntent)
    const description = buildWorkflowDescription('', {
      department: routed.department,
      stage: routed.stage,
      workflow: routed.workflow,
      intent: rawIntent,
      reference: `Created by ${userName || 'AI Tasker'} on ${todayISO()}`,
    })
    const payload = {
      title: routed.title,
      description,
      priority: routed.priority,
      status: 'OPEN',
      due_date: todayISO(),
      source: 'AI_ROUTED',
      created_by: userName || 'AI Tasker',
      raw_input: rawIntent,
      ai_reasoning: `Department routed: ${routed.department}`,
      ai_suggested_priority: routed.priority,
    }
    const { error } = await supabase.from('tasks').insert(payload)
    setBusy(false)
    if (error) { flash(error.message); return }
    setRawIntent('')
    flash(`${routed.department.replace('_', ' ')} queue তে task routed হয়েছে.`)
    load()
  }

  const advanceStage = async (taskRow) => {
    const { workflow, stage } = taskRow.meta
    const idx = workflow.indexOf(stage)
    if (idx < 0 || idx === workflow.length - 1) return
    const nextStage = workflow[idx + 1]
    const nextStatus = STAGE_STATUS[nextStage] || 'IN_PROGRESS'
    const patch = {
      status: nextStatus,
      description: updateDescriptionStage(taskRow.description || '', nextStage),
      updated_at: new Date().toISOString(),
    }
    if (nextStatus === 'DONE') {
      patch.completed_at = new Date().toISOString()
      patch.completed_by = userName || 'AI Tasker'
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', taskRow.id)
    if (error) { flash(error.message); return }
    load()
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Bot size={22} className="text-forest" /> AI Tasker
        </h1>
        <p className="text-sm text-pine/60 mt-1">Route guest intent to department queue and track workflow stages.</p>
        {msg && <div className="mt-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2">
          <textarea
            className="input min-h-[92px]"
            placeholder="Example: Room 305 থেকে towel change দরকার urgently"
            value={rawIntent}
            onChange={(e) => setRawIntent(e.target.value)}
          />
          <button className="btn-primary self-end" onClick={createIntentTask} disabled={busy}>
            <Sparkles size={15} /> {busy ? 'Routing...' : 'Route Intent'}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-ghost !py-1" onClick={load}><RefreshCcw size={13} /> Refresh tracking</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Object.entries(byDepartment).map(([department, rows]) => (
          <div key={department} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-semibold text-pine">{department.replace('_', ' ')}</h3>
              <span className="status-chip bg-pine/10 text-pine">{rows.length}</span>
            </div>
            <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
              {rows.map((taskRow) => {
                const nextStage = taskRow.meta.workflow[taskRow.meta.workflow.indexOf(taskRow.meta.stage) + 1]
                return (
                  <div key={taskRow.id} className="rounded-lg border border-leaf p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-pine/40 font-mono">{taskRow.task_no || taskRow.id.slice(0, 8)}</p>
                        <p className="text-sm font-semibold text-pine">{taskRow.title}</p>
                        <p className="text-xs text-pine/50 mt-0.5">{fmtDate(taskRow.created_at)}</p>
                      </div>
                      <span className="status-chip bg-sky-100 text-sky-700">{taskRow.meta.stage}</span>
                    </div>
                    <div className="mt-2 text-xs text-pine/55">Status: {taskRow.status}</div>
                    {nextStage ? (
                      <button onClick={() => advanceStage(taskRow)} className="btn-ghost !py-1 mt-2 w-full justify-center">
                        Next: {nextStage} <ArrowRight size={13} />
                      </button>
                    ) : (
                      <div className="mt-2 text-xs text-forest font-medium">Workflow completed</div>
                    )}
                  </div>
                )
              })}
              {rows.length === 0 && <p className="text-sm text-pine/45 py-3">No active tasks.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TaskManagement({ userName, aiTaskerMode = false }) {
  if (aiTaskerMode) return <AITaskerBoard userName={userName} />

  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks')
      .select(
        'id, task_no, title, description, priority, status, due_date, source, created_at, ' +
        'category:task_categories(id,name), assignee:employees!tasks_assigned_to_fkey(id,full_name)'
      )
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.from('task_categories').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setCategories(data || []))
    supabase.from('employees').select('id,full_name').eq('status', 'ACTIVE').order('full_name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  const filtered = rows.filter((r) =>
    (filter === 'ALL' || r.status === filter) &&
    (!q || [r.task_no, r.title, r.description, r.assignee?.full_name].join(' ').toLowerCase().includes(q.toLowerCase()))
  )

  const quickStatus = async (id, status) => {
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'DONE') { patch.completed_at = new Date().toISOString(); patch.completed_by = userName }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    await supabase.from('tasks').update(patch).eq('id', id)
  }

  return (
    <div>
      <KPICards module="tasks" />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-pine flex items-center gap-2">
          <ListChecks className="text-forest" /> Task Management
        </h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New task
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9 w-full" placeholder="Search task, assignee…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === s ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70 hover:bg-leaf/40'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-pine/40 text-sm">Loading tasks…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const wf = parseWorkflowMeta(t)
            return (
            <div key={t.id} className="card p-4 flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-pine/40">{t.task_no}</span>
                  <span className={`status-chip ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                  {t.category?.name && <span className="text-xs text-pine/50">· {t.category.name}</span>}
                  {(t.source === 'NLP' || t.source === 'AI_ROUTED') && (
                    <span className="text-[10px] flex items-center gap-0.5 text-forest font-medium">
                      <Sparkles size={10} /> AI
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-pine/10 text-pine">{wf.department.replace('_', ' ')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-700">{wf.stage}</span>
                </div>
                <div className="font-semibold text-sm truncate">{t.title}</div>
                {t.description && <div className="text-xs text-pine/60 mt-0.5 line-clamp-2">{t.description}</div>}
                <div className="flex items-center gap-3 text-xs text-pine/50 mt-1.5 flex-wrap">
                  {t.assignee?.full_name && (
                    <span className="flex items-center gap-1"><User size={11} /> {t.assignee.full_name}</span>
                  )}
                  {t.due_date && (
                    <span className="flex items-center gap-1"><Clock size={11} /> {fmtDate(t.due_date)}</span>
                  )}
                </div>
              </div>
              <select
                value={t.status}
                onChange={(e) => quickStatus(t.id, e.target.value)}
                className={`status-chip border-0 cursor-pointer shrink-0 ${STATUS_STYLE[t.status]}`}
              >
                {['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-pine/40 text-sm">
              No tasks yet. Click <span className="font-semibold">+ New task</span> to begin.
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewTask
          categories={categories}
          employees={employees}
          userName={userName}
          close={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}

function NewTask({ categories, employees, userName, close }) {
  const [mode, setMode] = useState('ai') // 'ai' | 'manual'
  const [rawInput, setRawInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [aiMeta, setAiMeta] = useState(null)

  const [f, setF] = useState({
    title: '', description: '', category_id: '', priority: 'MEDIUM',
    assigned_to: '', due_date: '',
  })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const parseWithAI = async () => {
    if (!rawInput.trim()) { setParseErr('কিছু লিখুন আগে।'); return }
    setParsing(true); setParseErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/parse-task-nlp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ raw_input: rawInput }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Parse failed.')
      setF((p) => ({
        ...p,
        title: json.title || '',
        description: json.description || '',
        category_id: json.category_id || '',
        priority: json.priority || 'MEDIUM',
        due_date: json.due_date || '',
        assigned_to: json.suggested_assignee_id || '',
      }))
      setAiMeta({
        confidence: json.confidence,
        reasoning: json.reasoning,
        suggested_assignee_name: json.suggested_assignee_name,
      })
      setMode('manual') // switch to review/edit form pre-filled with AI's suggestion
    } catch (e) {
      setParseErr(e.message)
    }
    setParsing(false)
  }

  const save = async () => {
    if (!f.title.trim()) { setErr('Title লাগবে।'); return }
    setBusy(true); setErr('')
    const routed = routeAiIntent(`${f.title} ${f.description || ''}`)
    const descriptionWithFlow = buildWorkflowDescription(f.description || '', {
      department: routed.department,
      stage: routed.stage,
      workflow: routed.workflow,
      intent: rawInput || `${f.title} ${f.description || ''}`,
    })
    const { error } = await supabase.from('tasks').insert({
      title: f.title.trim(),
      description: descriptionWithFlow || null,
      category_id: f.category_id || null,
      priority: f.priority,
      assigned_to: f.assigned_to || null,
      due_date: f.due_date || null,
      source: aiMeta ? 'NLP' : 'MANUAL',
      raw_input: aiMeta ? rawInput : null,
      ai_confidence: aiMeta?.confidence ?? null,
      ai_suggested_priority: aiMeta ? f.priority : null,
      ai_suggested_assignee_id: aiMeta ? (f.assigned_to || null) : null,
      ai_reasoning: aiMeta?.reasoning || null,
      created_by: userName,
    })
    setBusy(false)
    if (error) setErr(error.message)
    else close()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-center overflow-auto p-3 sm:p-6">
      <div className="card max-w-xl w-full p-4 sm:p-6 my-3 sm:my-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-pine">New task</h2>
          <button onClick={close} className="text-pine/40 hover:text-pine"><X size={18} /></button>
        </div>

        {mode === 'ai' && !aiMeta && (
          <div>
            <label className="label flex items-center gap-1.5">
              <Sparkles size={14} className="text-forest" /> সহজ ভাষায় লিখুন
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="যেমন: Room 12-এর AC ঠিক করতে হবে, urgent, আগামীকালের মধ্যে"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
            {parseErr && <p className="text-sm text-red-600 mt-2">{parseErr}</p>}
            <div className="flex justify-between items-center mt-3">
              <button className="text-xs text-pine/50 underline" onClick={() => setMode('manual')}>
                বা ম্যানুয়ালি লিখি
              </button>
              <button className="btn-primary" onClick={parseWithAI} disabled={parsing}>
                <Sparkles size={15} /> {parsing ? 'AI ভাবছে…' : 'AI দিয়ে Parse করুন'}
              </button>
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="space-y-3">
            {aiMeta && (
              <div className="px-3 py-2 rounded-lg bg-forest/10 text-xs text-forest flex items-start gap-1.5">
                <Sparkles size={13} className="mt-0.5 shrink-0" />
                <span>AI suggestion (confidence {Math.round((aiMeta.confidence || 0) * 100)}%): {aiMeta.reasoning}</span>
              </div>
            )}
            <div>
              <label className="label">Title *</label>
              <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Assign to</label>
                <select className="input" value={f.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due date</label>
                <input type="date" className="input" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          {mode === 'manual' && (
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Create task'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
