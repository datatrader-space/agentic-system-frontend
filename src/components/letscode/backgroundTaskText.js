// How a background task reads in the panel's cards, the chat's cards and the drawer (ADM-1360 release,
// CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3), as Claude Code's background-tasks sheet reads: the kind's word, the
// live elapsed time while it runs, the result word when it ended. Pure functions; imported only by lazy components.
import { isScheduledKind } from '@/stores/useBackgroundTasks'

// One SVG icon per kind, from the app's icon set (lucide). Never an emoji.
export const KIND_ICONS = {
  command: 'lucide:square-terminal',
  server: 'lucide:server',
  subagent: 'lucide:bot',
  workflow: 'lucide:workflow',
  monitor: 'lucide:scan-eye',
  wakeup: 'lucide:alarm-clock',
  schedule: 'lucide:calendar-clock',
}
// The card's kind word, as Claude Code shows it.
export const KIND_WORDS = {
  command: 'Shell',
  server: 'Server',
  subagent: 'Agent',
  workflow: 'Workflow',
  monitor: 'Monitor',
  wakeup: 'Wake-up',
  schedule: 'Schedule',
}
// The kind in a sentence ("Stop this background command?").
const KIND_NOUNS = {
  command: 'command', server: 'server', subagent: 'agent', workflow: 'workflow', monitor: 'monitor',
  wakeup: 'wake-up', schedule: 'schedule',
}
export const kindIcon = (kind) => KIND_ICONS[kind] || 'lucide:layers'
export const kindWord = (kind) => KIND_WORDS[kind] || 'Task'
export const kindNoun = (kind) => KIND_NOUNS[kind] || 'task'
// A card that shows its last output line (a command's or a watcher's).
export const showsOutput = (task) => !!task && ['command', 'server', 'monitor'].includes(task.kind)
// A card that can carry agents, tokens and phases.
export const hasPhases = (task) => !!task && Array.isArray(task.progress?.phases) && task.progress.phases.length > 0

const FAILED = new Set(['failed', 'timed_out', 'lost', 'sandbox_stopped'])

export const needsPerson = (task) => !!task && task.state === 'running' && task.status === 'needs_approval'

export function isFailed(task) {
  if (!task) return false
  return FAILED.has(task.status) || (task.exit_code != null && task.exit_code !== '' && Number(task.exit_code) !== 0)
}
export const isStopped = (task) => !!task && (task.state === 'stopped' || task.status === 'cancelled')

// The finish card's tone: done, failed or stopped (its words always say it too).
export function toneOf(task) {
  if (!task || task.state === 'running') return 'running'
  if (isStopped(task)) return 'stopped'
  return isFailed(task) ? 'failed' : 'done'
}

// 75 -> "1m 15s", 6206 -> "103m 26s" (minutes keep counting, as Claude Code's do), 9 -> "9s".
export function duration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// 231000 -> "231K", 1_900_000 -> "1.9M", 950 -> "950".
export function tokens(n) {
  const v = Math.max(0, Number(n) || 0)
  if (v < 1000) return String(Math.round(v))
  if (v < 1_000_000) return `${Math.round(v / 1000)}K`
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

// "14:30" (today) or "Nov 26, 14:30", in the person's own format.
export function clockTime(iso, now = Date.now()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return new Date(now).toDateString() === d.toDateString()
    ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

// The due time of a waiting wake-up or schedule (`due_at`, or a schedule's `next_run_at`), when the server sends it.
export const dueOf = (task) => (task && (task.due_at || task.next_run_at)) || ''

function elapsed(task, now) {
  const started = Date.parse(task.started_at || '')
  if (!Number.isNaN(started)) return duration((now - started) / 1000)
  return task.elapsed_s != null ? duration(task.elapsed_s) : ''
}

// The result word of an ended task: "Completed", "Failed (exit 1)", "Timed out", "Stopped", "Condition met",
// "Ran at 14:30".
export function resultWord(task, now = Date.now()) {
  if (!task) return ''
  if (isStopped(task)) return 'Stopped'
  if (task.status === 'matched') return 'Condition met'
  if (task.status === 'fired') {
    const at = task.finished_at ? clockTime(task.finished_at, now) : ''
    return at ? `Ran at ${at}` : 'Ran'
  }
  const exit = task.exit_code != null && task.exit_code !== '' && Number(task.exit_code) !== 0 ? ` (exit ${task.exit_code})` : ''
  if (task.status === 'timed_out') return `Timed out${exit}`
  if (task.status === 'lost') return 'Lost'
  if (task.status === 'sandbox_stopped') return 'Sandbox stopped'
  if (isFailed(task)) return `Failed${exit}`
  return 'Completed'
}

// The card's meta line after its kind word: the live elapsed time while it runs, a waiting one's time, or the result.
export function statusText(task, now = Date.now()) {
  if (!task) return ''
  if (task.state === 'running') {
    if (isScheduledKind(task)) {
      if (dueOf(task)) return `at ${clockTime(dueOf(task), now)}`
      return task.schedule_text || 'Waiting'
    }
    return elapsed(task, now)
  }
  return resultWord(task, now)
}

// "10 agents · 1.9M tokens" parts, when the server sends them.
export function statsOf(task) {
  const out = []
  if (task && task.agents != null && task.agents !== '') out.push({ n: String(task.agents), word: Number(task.agents) === 1 ? 'agent' : 'agents' })
  if (task && task.tokens != null && task.tokens !== '') out.push({ n: tokens(task.tokens), word: 'tokens' })
  return out
}

// ── Phases (a workflow's or an agent's progress) ──
const ITEM_STATES = new Set(['pending', 'running', 'done', 'failed'])
export const itemState = (item) => (ITEM_STATES.has(item && item.state) ? item.state : 'pending')
export function phaseCounts(phase) {
  const items = Array.isArray(phase?.items) ? phase.items : []
  const c = { done: 0, running: 0, failed: 0, pending: 0 }
  for (const it of items) c[itemState(it)] += 1
  const total = phase && phase.total != null ? Number(phase.total) : items.length
  const done = phase && phase.done != null ? Number(phase.done) : c.done
  return { ...c, done, total }
}
// The squares' text for a screen reader: "Verify: 2 of 5 done, 2 running".
export function phaseSummary(phase) {
  const c = phaseCounts(phase)
  const parts = [`${c.done} of ${c.total} done`]
  if (c.running) parts.push(`${c.running} running`)
  if (c.failed) parts.push(`${c.failed} failed`)
  return `${phase?.title || 'Phase'}: ${parts.join(', ')}`
}
// Every item of every phase, in order: the chat card's one row of squares.
export const allItems = (task) => (hasPhases(task) ? task.progress.phases.flatMap((p) => (Array.isArray(p.items) ? p.items : [])) : [])
export function progressSummary(task) {
  const items = allItems(task)
  const done = items.filter((i) => itemState(i) === 'done').length
  const running = items.filter((i) => itemState(i) === 'running').length
  const failed = items.filter((i) => itemState(i) === 'failed').length
  const parts = [`${done} of ${items.length} done`]
  if (running) parts.push(`${running} running`)
  if (failed) parts.push(`${failed} failed`)
  return `Progress: ${parts.join(', ')}`
}

// The finish card's title: "Background command finished · npm test · failed (exit 1)".
export function eventTitle(task) {
  if (!task) return 'Background task'
  const noun = kindNoun(task.kind)
  let verb = 'finished'
  if (isStopped(task)) verb = 'stopped'
  else if (task.status === 'fired' || isScheduledKind(task)) verb = 'fired'
  else if (needsPerson(task)) verb = 'needs you'
  else if (task.state === 'running') verb = 'reported'
  const parts = [`Background ${noun} ${verb}`]
  if (task.name) parts.push(task.name)
  if (verb === 'finished') { const r = resultWord(task); parts.push(r.charAt(0).toLowerCase() + r.slice(1)) }
  return parts.join(' · ')
}

// What opening a task shows: 'output' (its output in the drawer), 'conversation' (the agent's transcript),
// 'workflow_run' (the run's page), 'schedule' (its time and prompt). A task the server gave no target opens its output.
export function openType(task) {
  // An agent waiting on the person opens its chat, where its approval card is.
  if (needsPerson(task) && task.open && task.open.conversation_id) return 'conversation'
  const type = task && task.open && task.open.type
  return ['output', 'conversation', 'workflow_run', 'schedule'].includes(type) ? type : 'output'
}

export function openLabel(task) {
  const name = task && task.name ? `: ${task.name}` : ''
  const type = openType(task)
  if (type === 'conversation' && needsPerson(task)) return `Open the agent's chat, where it waits for you${name}`
  if (type === 'conversation') return `Open the agent's transcript${name}`
  if (type === 'workflow_run') return `Open the workflow run${name} (opens in a new tab)`
  if (type === 'schedule') return `Open the schedule${name}`
  return `Open the output${name}`
}
