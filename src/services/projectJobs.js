// The Let's Code editor's long buttons run as background jobs (ADM-1269): Check project, commit, push, pull, publish,
// a pull request, and packing a download or a backup. The press answers at once (202, `{ job, started }`); the job
// runs on AADML's worker, so no request waits past the 60 s the aadml.com front server allows. This follows a job
// until it finishes and gives the caller the button's own answer, as the request used to:
//   resolves  { data: <the answer>, status: <its status> }
//   rejects   an error with { response: { status, data } }, read like an axios error (`whileSandboxStarts` too).
// The project's socket says when a job changes (event `job`, `notifyProjectJob`); asking every few seconds is the
// backstop, so a lost message only delays the answer.

const FINISHED = new Set(['done', 'failed'])
const POLL_MS = [1000, 2000, 3000]             // then every 3 s
const MAX_POLL_ERRORS = 5                      // a network that keeps failing is said, not waited on forever

const waiting = new Map()                      // job id -> wake(payload)
const following = new Set()                    // the jobs this page is waiting for

export function isFinished(job) { return !!job && FINISHED.has(job.state) }

// Whether this page already waits for the job (a job found running after a reload is followed once).
export function isFollowed(id) { return following.has(id) }

// The page's project socket got `{ event: 'job', data: <job> }`.
export function notifyProjectJob(job) {
  const wake = job?.id && waiting.get(job.id)
  if (wake) wake(job)
}

function sleepOrWake(id, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { waiting.delete(id); resolve(null) }, ms)
    waiting.set(id, (job) => { clearTimeout(timer); waiting.delete(id); resolve(job) })
  })
}

// The finished job as the button's answer.
export function answerOf(job) {
  const data = job.result ?? {}
  const status = job.status_code || (job.state === 'done' ? 200 : 500)
  if (job.state === 'done' && status < 400) return { data, status, job }
  const err = new Error(data.error || 'This did not finish.')
  err.response = { status, data, headers: {} }
  err.job = job
  throw err
}

/**
 * Wait for `job` (a job payload) to finish. `read(id)` is an axios call for `GET …/jobs/<id>/`.
 * `onUpdate(job)` hears each change (queued -> running -> done); `isCancelled()` stops the wait.
 */
export async function waitForJob(job, read, opts = {}) {
  following.add(job.id)
  try {
    return await _wait(job, read, opts)
  } finally {
    following.delete(job.id)
  }
}

async function _wait(job, read, { onUpdate = () => {}, isCancelled = () => false } = {}) {
  let current = job
  let errors = 0
  for (let i = 0; !isFinished(current); i++) {
    if (isCancelled()) {
      const err = new Error('cancelled')
      err.name = 'AbortError'
      throw err
    }
    const pushed = await sleepOrWake(current.id, POLL_MS[Math.min(i, POLL_MS.length - 1)])
    if (pushed && isFinished(pushed)) { current = pushed; onUpdate(current); break }
    try {
      const { data } = await read(current.id)
      current = data.job
      errors = 0
    } catch (e) {
      if (e?.response?.status === 404 || ++errors >= MAX_POLL_ERRORS) throw e
      continue
    }
    onUpdate(current)
  }
  return answerOf(current)
}

/** `start()` is the press (an axios promise). Its 202 job is followed to its answer; any other answer passes. */
export async function runProjectJob(start, read, opts = {}) {
  const res = await start()
  const job = res?.status === 202 ? res?.data?.job : null
  if (!job) return res
  opts.onUpdate?.(job)
  return waitForJob(job, read, opts)
}
