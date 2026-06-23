const DEPARTMENT_WORKFLOWS = {
  RESTAURANT: ['REQUESTED', 'CONFIRMED', 'ACCEPTED', 'KOT_GENERATED', 'PREPARING', 'READY', 'SERVED'],
  HOUSEKEEPING: ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'INSPECTED', 'COMPLETED'],
  FRONT_OFFICE: ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'],
  MAINTENANCE: ['REQUESTED', 'TRIAGED', 'IN_PROGRESS', 'FIXED', 'COMPLETED'],
}

const KEYWORDS = {
  RESTAURANT: ['food', 'order', 'restaurant', 'menu', 'meal', 'breakfast', 'lunch', 'dinner', 'kot'],
  HOUSEKEEPING: ['housekeeping', 'clean', 'cleaning', 'towel', 'linen', 'bed', 'bathroom', 'laundry'],
  MAINTENANCE: ['maintenance', 'repair', 'ac', 'air condition', 'plumbing', 'electric', 'light', 'water leakage', 'generator'],
  FRONT_OFFICE: ['front office', 'checkout', 'check out', 'check-in', 'reservation', 'invoice', 'billing', 'key', 'late checkout'],
}

const PRIORITY_HINTS = {
  URGENT: ['urgent', 'immediately', 'emergency', 'asap'],
  HIGH: ['high', 'today', 'now', 'quick'],
  LOW: ['low', 'later', 'whenever'],
}

export function detectDepartment(rawText = '') {
  const text = rawText.toLowerCase()
  const hitScores = Object.keys(KEYWORDS).map((dept) => {
    const score = KEYWORDS[dept].reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0)
    return { dept, score }
  })
  hitScores.sort((a, b) => b.score - a.score)
  return hitScores[0]?.score > 0 ? hitScores[0].dept : 'FRONT_OFFICE'
}

export function detectPriority(rawText = '') {
  const text = rawText.toLowerCase()
  if (PRIORITY_HINTS.URGENT.some((k) => text.includes(k))) return 'URGENT'
  if (PRIORITY_HINTS.HIGH.some((k) => text.includes(k))) return 'HIGH'
  if (PRIORITY_HINTS.LOW.some((k) => text.includes(k))) return 'LOW'
  return 'MEDIUM'
}

export function routeAiIntent(rawText = '') {
  const clean = rawText.trim()
  const department = detectDepartment(clean)
  const workflow = DEPARTMENT_WORKFLOWS[department] || DEPARTMENT_WORKFLOWS.FRONT_OFFICE
  const priority = detectPriority(clean)
  return {
    department,
    priority,
    stage: workflow[0],
    workflow,
    title: clean.length > 72 ? `${clean.slice(0, 72).trim()}...` : clean || 'Guest assistance request',
  }
}

export function buildWorkflowDescription(baseDescription = '', meta = {}) {
  const lines = []
  if (baseDescription?.trim()) lines.push(baseDescription.trim())
  if (meta.department) lines.push(`Department: ${meta.department}`)
  if (meta.stage) lines.push(`Workflow Stage: ${meta.stage}`)
  if (meta.workflow?.length) lines.push(`Workflow Path: ${meta.workflow.join(' > ')}`)
  if (meta.intent?.trim()) lines.push(`Intent: ${meta.intent.trim()}`)
  if (meta.reference?.trim()) lines.push(`Reference: ${meta.reference.trim()}`)
  return lines.join('\n')
}

export function parseWorkflowMeta(task) {
  const description = task?.description || ''
  const lines = description.split('\n').map((line) => line.trim())
  const byPrefix = (prefix) => {
    const row = lines.find((line) => line.startsWith(prefix))
    return row ? row.slice(prefix.length).trim() : ''
  }
  const sourceFallbackDept = task?.source === 'CHECKOUT_CLEARANCE'
    ? 'HOUSEKEEPING'
    : task?.source === 'GUEST_POS_ORDER'
      ? 'RESTAURANT'
      : 'FRONT_OFFICE'
  const department = byPrefix('Department:') || sourceFallbackDept
  const stage = byPrefix('Workflow Stage:') || 'REQUESTED'
  const pathRaw = byPrefix('Workflow Path:')
  const workflow = pathRaw ? pathRaw.split('>').map((s) => s.trim()).filter(Boolean) : (DEPARTMENT_WORKFLOWS[department] || DEPARTMENT_WORKFLOWS.FRONT_OFFICE)
  return { department, stage, workflow }
}

export function updateDescriptionStage(description = '', nextStage) {
  const lines = description.split('\n')
  const stageLineIndex = lines.findIndex((line) => line.trim().startsWith('Workflow Stage:'))
  if (stageLineIndex >= 0) {
    lines[stageLineIndex] = `Workflow Stage: ${nextStage}`
    return lines.join('\n')
  }
  return [description.trim(), `Workflow Stage: ${nextStage}`].filter(Boolean).join('\n')
}

