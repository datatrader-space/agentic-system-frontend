// A fresh signed link to the app on port N of the person's OWN Let's Code project (owner, 2026-11-09; ADM-1205 phase
// D). AADML wakes a parked sandbox and starts a stopped app again before it hands the link out, answering 503
// RUNNER_STARTING / APP_STARTING with how long to wait; this waits and asks again, up to five minutes. Used by the
// full-page preview (views/LetsCodePreview.vue) and the IDE's Preview tab (components/letscode/PreviewPanel.vue).
import api from '@/services/api'

export const GIVE_UP_MS = 5 * 60 * 1000
export const WAITING = {
  RUNNER_STARTING: 'Waking your project\'s sandbox… this can take a minute.',
  APP_STARTING: 'Starting the app again…',
}

const pause = (seconds) => new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(seconds, 2), 30) * 1000))

// { url, expiresIn } | { error, retryable, status } | { gone: true } (the caller stopped waiting: `gone()` is true).
export async function fetchPreviewLink(repoId, port, { onWaiting = () => {}, gone = () => false, sleep = pause } = {}) {
  const started = Date.now()
  while (!gone()) {
    try {
      const { data } = await api.getProjectPreview(repoId, port)
      if (gone()) break
      if (data?.url) return { url: data.url, expiresIn: Number(data.expires_in) || 0 }
      return { error: 'The preview could not be opened. Try again.', retryable: true, status: 200 }
    } catch (e) {
      if (gone()) break
      const status = e?.response?.status
      const body = e?.response?.data || {}
      if (status === 503 && WAITING[body.code] && Date.now() - started < GIVE_UP_MS) {
        onWaiting(WAITING[body.code])
        await sleep(Number(body.retry_after_seconds) || 5)
        continue
      }
      return {
        status,
        retryable: status !== 404,
        error: status === 404
          ? 'This preview is not one of your projects.'
          : status === 503
            ? 'The app is taking too long to start. Try again, or ask the Coding Agent to start it.'
            : body.error || 'The preview could not be opened. Try again.',
      }
    }
  }
  return { gone: true }
}
