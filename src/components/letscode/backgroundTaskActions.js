// Stop and Open for a background task (ADM-1360 release), shared by the panel's rows, the drawer and the chat's event
// card. Only those lazy components import this file. The app's own confirm dialog, never a native one.
import { confirm } from '@/composables/useConfirm'
import { notify } from '@/composables/useNotify'
import { kindNoun, openType } from './backgroundTaskText'

function stopMessage(task) {
  const name = task.name ? `“${task.name}”` : `This ${kindNoun(task.kind)}`
  switch (task.kind) {
    case 'subagent': return `${name} stops where it is. What it did so far stays in its transcript.`
    case 'workflow': return `${name} is cancelled. Steps that already ran are not undone.`
    case 'wakeup': return `${name} is cancelled: this chat is not continued at that time.`
    case 'schedule': return `${name} is cancelled: it does not run again.`
    case 'monitor': return `${name} stops watching. What it reported so far stays here.`
    default: return `${name} stops now. Its output so far stays here.`
  }
}

// Asks first, then stops. True when the server took the stop (or sent an approval card for it).
export async function stopWithConfirm(ctl, task) {
  if (!ctl || !task || ctl.stopping) return false
  const ok = await confirm({
    title: `Stop this background ${kindNoun(task.kind)}?`,
    message: stopMessage(task),
    confirmText: 'Stop',
    cancelText: 'Keep running',
    danger: true,
  })
  if (!ok) return false
  const res = await ctl.stop(task)
  // A refusal (409: it cannot be stopped) is kept on the controller and shown in the task's own row and drawer.
  if (res.ok && res.needsApproval) {
    notify.info(`An approval card was sent to the chat. Allow it there to stop ${task.name ? `“${task.name}”` : 'the task'}.`)
  }
  return !!res.ok
}

// The workflow run's own page, in a new browser tab so the editor stays open.
export function workflowRunHref(task) {
  const id = task && task.open && task.open.workflow_run_id
  return id != null && id !== '' ? `/dashboard/workflow-runs?run=${encodeURIComponent(id)}` : ''
}

// Open from a row or an event card: a workflow run is a link (the caller renders it); everything else opens the drawer.
export function openTask(ctl, task) {
  if (!ctl || !task || openType(task) === 'workflow_run') return
  ctl.open(task)
}
