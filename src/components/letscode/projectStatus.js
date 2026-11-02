// Let's Code project status: one place that turns the backend's pipeline fields
// (phase, failed_step, clone_ready, error_message) into what the page shows.
//
// phase ∈ queued | cloning | indexing | switching | ready | error
// failed_step ∈ 'clone' | 'index' | '' (set when phase === 'error')

const LABELS = {
  queued: 'Queued',
  cloning: 'Cloning',
  indexing: 'Indexing',
  switching: 'Switching branch',
  ready: 'Ready',
  error: 'Failed',
}

/** Short status word for a project (pill text). */
export function phaseLabel(p) {
  return LABELS[p?.phase] || 'Preparing'
}

/** Colour family for the status pill: ok | run | wait | err. */
export function phaseTone(p) {
  const phase = p?.phase
  if (phase === 'ready') return 'ok'
  if (phase === 'error') return 'err'
  if (phase === 'queued') return 'wait'
  return 'run'
}

/** True only when the editor and the coding agent can be used. */
export function isReady(p) {
  return !!p && p.phase === 'ready' && !!p.clone_ready
}

/** The step a failed project stopped at: 'clone' or 'index'. */
export function failedStep(p) {
  if (p?.failed_step === 'clone' || p?.failed_step === 'index') return p.failed_step
  return p?.clone_ready ? 'index' : 'clone'
}

const STEPS = [
  { key: 'clone', label: 'Clone', detail: 'Copy the repository into your workspace' },
  { key: 'index', label: 'Index', detail: 'Read the code so the agent can find its way around' },
  { key: 'ready', label: 'Ready', detail: 'The editor and the coding agent open' },
]

/**
 * The three-step pipeline Clone → Index → Ready, each with a state:
 * 'done' | 'current' | 'failed' | 'pending'.
 */
export function pipelineSteps(p) {
  const phase = p?.phase
  let doneUpTo = -1      // index of the last finished step
  let currentAt = -1     // index of the step in progress
  let failedAt = -1      // index of the step that failed

  if (phase === 'ready') {
    doneUpTo = 2
  } else if (phase === 'error') {
    failedAt = failedStep(p) === 'clone' ? 0 : 1
    doneUpTo = failedAt - 1
  } else if (phase === 'indexing' || phase === 'switching') {
    doneUpTo = 0; currentAt = 1
  } else if (phase === 'queued' || phase === 'cloning') {
    currentAt = 0
  } else {
    // Unknown or missing phase: infer from whether the files exist yet.
    if (p?.clone_ready) { doneUpTo = 0; currentAt = 1 } else { currentAt = 0 }
  }

  return STEPS.map((s, i) => {
    let state = 'pending'
    if (i === failedAt) state = 'failed'
    else if (i === currentAt) state = 'current'
    else if (i <= doneUpTo) state = 'done'
    let detail = s.detail
    if (s.key === 'clone' && phase === 'queued' && state === 'current') detail = 'Waiting for a free worker'
    if (s.key === 'index' && phase === 'switching' && state === 'current') detail = `Checking out ${p?.branch || 'the branch'} and indexing it again`
    return { ...s, detail, state }
  })
}

/** "2 days ago" from an ISO timestamp; '' when missing or unparseable. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((t - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const abs = Math.abs(sec)
  if (abs < 60) return rtf.format(sec, 'second')
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), 'month')
  return rtf.format(Math.round(sec / (86400 * 365)), 'year')
}

/** Browser URL for a GitHub repository (clone URLs end in .git). */
export function githubWebUrl(url) {
  return String(url || '').replace(/\.git$/, '')
}
