import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtDate, todayISO } from '../lib/helpers'
import { routeAiIntent, buildWorkflowDescription, parseWorkflowMeta, updateDescriptionStage } from '../lib/aiTaskRouter.js'
import { Bot, Sparkles, ArrowRight, RefreshCcw } from 'lucide-react'

const STAGE_STATUS = {
  COMPLETED: 'DONE',
  SERVED: 'DONE',
  DONE: 'DONE',
}

export default function AITasker({ userName }) {
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

  const byDepartment = useMemo(() => {
    const buckets = { RESTAURANT: [], HOUSEKEEPING: [], FRONT_OFFICE: [], MAINTENANCE: [] }
    tasks.forEach((task) => {
      const meta = parseWorkflowMeta(task)
      const row = { ...task, meta }
      if (!buckets[meta.department]) buckets[meta.department] = []
      buckets[meta.department].push(row)
    })
    return buckets
  }, [tasks])

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

  const card = (taskRow) => {
    const { meta } = taskRow
    const nextStage = meta.workflow[meta.workflow.indexOf(meta.stage) + 1]
    return (
      <div key={taskRow.id} className="rounded-lg border border-leaf p-3 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-pine/40 font-mono">{taskRow.task_no || taskRow.id.slice(0, 8)}</p>
            <p className="text-sm font-semibold text-pine">{taskRow.title}</p>
            <p className="text-xs text-pine/50 mt-0.5">{fmtDate(taskRow.created_at)}</p>
          </div>
          <span className="status-chip bg-sky-100 text-sky-700">{meta.stage}</span>
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
              {rows.map(card)}
              {rows.length === 0 && <p className="text-sm text-pine/45 py-3">No active tasks.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
