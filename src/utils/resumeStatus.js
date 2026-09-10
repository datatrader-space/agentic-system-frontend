/**
 * The one line a returning user reads while a turn runs somewhere they cannot see.
 *
 * WHY THIS EXISTS — conversation 1319. A signal-triggered turn was running; the user closed the chat,
 * came back, and saw "Reconnected — the agent is still working…" and nothing else. True, useless, and
 * indistinguishable from a hung run: no step, no tool, no elapsed time, no way to tell progress from a
 * stall. The backend now ships the run's own snapshot on `turn_resumed` (and on `turn_progress`), so
 * this composes it into something a human can act on:
 *
 *     "Step 3 of 5: add products · running CREATE_PRODUCT · 2m"
 *
 * Every field is optional — a turn that has emitted nothing yet still gets an honest line, and the
 * generic fallback survives for an older backend that sends no snapshot at all.
 */

/** "45s" / "4m" / "1h 12m" — short enough to sit at the end of a status line. */
export function formatElapsed(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

const FALLBACK = 'Reconnected — the agent is still working…'

// The backend's own label frequently already reads "Step 2 of 3: …", so a step prefix would stutter.
const ALREADY_STEPPED = /\bstep\s+\d+\s+of\s+\d+/i

/**
 * @param {object|null} progress  the `progress` snapshot from turn_resumed / turn_progress
 * @param {string} [status]       legacy `status` string (older backends), used when there is no label
 * @returns {string} a single status line, never empty
 */
export function resumeStatusLine(progress, status = '') {
  const p = progress && typeof progress === 'object' ? progress : {}
  const label = String(p.label || status || '').trim()
  const tool = String(p.tool || '').trim()
  const total = Number(p.total) || 0
  // `step` counts COMPLETED plan steps, so the one being worked on is the next one.
  const step = total ? Math.min((Number(p.step) || 0) + 1, total) : 0

  let head = label
  if (!head) head = tool ? `Running ${tool}` : ''
  if (step && !ALREADY_STEPPED.test(head)) {
    head = head ? `Step ${step} of ${total}: ${head}` : `Step ${step} of ${total}`
  }
  if (!head) {
    // Nothing named yet. A tool count is still more informative than the generic line.
    const done = Number(p.tools_done) || 0
    head = done ? `Working — ${done} step${done === 1 ? '' : 's'} done` : ''
  }
  if (!head) head = FALLBACK

  const detail = []
  // Only append the tool when it isn't already what the head is about.
  if (tool && !head.includes(tool)) detail.push(`running ${tool}`)
  const elapsed = Number(p.elapsed_seconds)
  if (Number.isFinite(elapsed) && elapsed > 0) detail.push(formatElapsed(elapsed))

  return detail.length ? `${head} · ${detail.join(' · ')}` : head
}

export { FALLBACK as RESUME_FALLBACK }
