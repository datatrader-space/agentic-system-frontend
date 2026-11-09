<template>
  <main class="lcp" :aria-busy="state === 'working'">
    <section class="lcp-card" aria-live="polite">
      <div class="lcp-head">
        <Icon icon="lucide:monitor-play" class="lcp-icon" aria-hidden="true" />
        <h1 class="lcp-title">Opening the preview</h1>
      </div>
      <p class="lcp-sub">Port {{ port }} of your Let's Code project</p>

      <div v-if="state === 'working'" class="lcp-status">
        <span class="lcp-spin" aria-hidden="true"></span>
        <span>{{ message }}</span>
      </div>

      <div v-else class="lcp-error" role="alert">
        <p>{{ message }}</p>
        <div class="lcp-actions">
          <button v-if="retryable" type="button" class="lcp-btn lcp-btn-primary" @click="open">Try again</button>
          <router-link class="lcp-btn" :to="{ name: 'dashboard-lets-code' }">Back to Let's Code</router-link>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
// AADML's preview page for a Let's Code app (owner, 2026-11-09). Opened from the chat's "Open preview" button, and
// safe to reload or bookmark: every visit asks AADML for a FRESH signed link, for the signed-in person's own project
// only. AADML wakes a parked sandbox and starts a stopped app again before it hands the link out, so the person never
// lands on a dead sandbox address ("HTTP ERROR 502").
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '@/services/api'

const route = useRoute()
const repoId = Number(route.params.repoId)
const port = Number(route.params.port)

const state = ref('working')        // 'working' | 'error'
const message = ref('Checking the app…')
const retryable = ref(true)

// How long the page keeps waiting for a sandbox to wake and an app to start before it says so.
const GIVE_UP_MS = 5 * 60 * 1000
const WAITING = {
  RUNNER_STARTING: 'Waking your project\'s sandbox… this can take a minute.',
  APP_STARTING: 'Starting the app again…',
}
let timer = null
let gone = false

function wait(seconds) {
  return new Promise((resolve) => { timer = setTimeout(resolve, Math.min(Math.max(seconds, 2), 30) * 1000) })
}

async function open() {
  state.value = 'working'
  message.value = 'Checking the app…'
  const started = Date.now()
  while (!gone) {
    try {
      const { data } = await api.getProjectPreview(repoId, port)
      if (data?.url) {
        window.location.replace(data.url)     // the fresh link replaces this page; Back returns to the chat
        return
      }
      throw new Error('no link')
    } catch (e) {
      const status = e?.response?.status
      const body = e?.response?.data || {}
      if (status === 503 && WAITING[body.code] && Date.now() - started < GIVE_UP_MS) {
        message.value = WAITING[body.code]
        await wait(Number(body.retry_after_seconds) || 5)
        continue
      }
      state.value = 'error'
      retryable.value = status !== 404
      message.value = status === 404
        ? 'This preview is not one of your projects.'
        : status === 503
          ? 'The app is taking too long to start. Try again, or ask the Coding Agent to start it.'
          : body.error || 'The preview could not be opened. Try again.'
      return
    }
  }
}

onMounted(() => {
  if (!Number.isInteger(repoId) || !(port >= 1 && port <= 65535)) {
    state.value = 'error'
    retryable.value = false
    message.value = 'This preview link is not complete.'
    return
  }
  open()
})
onBeforeUnmount(() => { gone = true; clearTimeout(timer) })
</script>

<style scoped>
.lcp { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--vm-bg); color: var(--vm-ink-soft); }
.lcp-card { width: 100%; max-width: 440px; padding: 28px 24px; border: 1px solid var(--vm-line); border-radius: 14px; background: var(--vm-surface); box-shadow: 0 8px 24px rgba(15, 23, 42, .06); }
.lcp-head { display: flex; align-items: center; gap: 10px; }
.lcp-icon { width: 22px; height: 22px; color: var(--vm-violet); flex: 0 0 auto; }
.lcp-title { margin: 0; font-size: 18px; font-weight: 650; color: var(--vm-ink); text-wrap: balance; }
.lcp-sub { margin: 6px 0 20px; font-size: 13.5px; color: var(--vm-ink-faint); }
.lcp-status { display: flex; align-items: center; gap: 10px; font-size: 14.5px; line-height: 1.5; }
.lcp-spin { width: 18px; height: 18px; flex: 0 0 auto; border: 2px solid var(--vm-violet-soft); border-top-color: var(--vm-violet); border-radius: 50%; animation: lcp-turn .8s linear infinite; }
.lcp-error p { margin: 0 0 16px; font-size: 14.5px; line-height: 1.5; color: var(--vm-red-ink); }
.lcp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.lcp-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); color: var(--vm-ink); font: 600 14px inherit; text-decoration: none; cursor: pointer; transition: background-color .15s, filter .15s; }
.lcp-btn:hover { background: var(--vm-surface-soft); }
.lcp-btn-primary { border-color: transparent; background: var(--vm-violet); color: #fff; }
.lcp-btn-primary:hover { background: var(--vm-violet-d); }
.lcp-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
@keyframes lcp-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .lcp-spin { animation: none; border-top-color: var(--vm-violet-soft); } }
</style>
