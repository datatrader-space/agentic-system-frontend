// A Let's Code project's sandbox can be asleep. Its file and Source control endpoints then answer at once with
// 503 + code RUNNER_STARTING + Retry-After instead of holding the request until the web worker dies (backend
// 4101aaa3). This waits the time the server asked for and tries again, telling the caller it is waiting, and
// passes every other answer (success or a real error) straight through.

const MAX_WAIT_SECONDS = 900          // the platform's own wake limit; after that the error is shown

export function isStarting(error) {
  const r = error?.response
  return r?.status === 503 && r?.data?.code === 'RUNNER_STARTING'
}

function retryAfterSeconds(error) {
  const header = Number(error?.response?.headers?.['retry-after'])
  const body = Number(error?.response?.data?.retry_after_seconds)
  const s = Number.isFinite(header) && header > 0 ? header : (Number.isFinite(body) && body > 0 ? body : 15)
  return Math.min(Math.max(s, 2), 60)
}

/**
 * Run `call` (a function returning an axios promise), retrying while the sandbox is starting.
 * `onWaiting(seconds)` is called before each wait, and `onWaiting(0)` once the call has an answer.
 * `isCancelled()` stops the waiting (a component that unmounted).
 */
export async function whileSandboxStarts(call, { onWaiting = () => {}, isCancelled = () => false } = {}) {
  let waited = 0
  for (;;) {
    try {
      const res = await call()
      onWaiting(0)
      return res
    } catch (e) {
      if (!isStarting(e) || waited >= MAX_WAIT_SECONDS || isCancelled()) {
        onWaiting(0)
        throw e
      }
      const s = retryAfterSeconds(e)
      onWaiting(s)
      await new Promise((resolve) => setTimeout(resolve, s * 1000))
      waited += s
      if (isCancelled()) {
        onWaiting(0)
        throw e
      }
    }
  }
}
