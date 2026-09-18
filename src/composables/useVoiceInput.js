// Voice input for the chat composer — records the mic and has the AGENT'S OWN Audio-transcription
// model turn it into text, server-side.
//
// This replaces the old `useSpeech` (browser Web Speech API), which was honest about being
// feature-detected but shipped the user's voice to Google/Microsoft, worked in Chrome/Edge only, and
// could not be metered, budgeted or tenant-scoped. There is now ONE transcription path:
// MediaRecorder → POST /api/agent-profiles/<id>/transcribe/ → the agent's configured model.
//
// Enablement is the agent's configuration, not a feature flag: the mic is live only when the agent has
// an Audio-transcription model assigned. Otherwise the button stays visibly disabled and CLICKING IT
// EXPLAINS WHY (a popup, not a dead control) — which is also why the button must not carry the DOM
// `disabled` attribute: a disabled button swallows the click and the user learns nothing.
//
// The transcript is AUTO-SENT through the caller's own send function, so attachments, conversation
// creation, busy state and the in-session queue behave exactly as they do for a typed message.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import apiService from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

// Container preference: Opus in WebM (Chrome/Edge/Firefox), Ogg (older Firefox), then MP4 (Safari).
// Every one of these is accepted by the transcription endpoint.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
]

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' }

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch { /* older implementations throw instead of returning false */ }
  }
  return ''   // let the browser choose its own default
}

function canRecord() {
  return !!(typeof navigator !== 'undefined' && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function'
    && typeof MediaRecorder !== 'undefined')
}

// One in-memory answer per agent. Cheap, and it keeps the mic from flickering between agents; cleared
// by `refresh()` after an agent save so assigning a model lights the mic up without a page reload.
const modeCache = new Map()

export function clearVoiceInputCache(agentId) {
  if (agentId == null) modeCache.clear()
  else modeCache.delete(String(agentId))
}

/**
 * @param {object} o
 * @param {() => (string|number|null)} o.agentId        the agent that will transcribe (and answer)
 * @param {() => (string|number|null)} [o.conversationId] for cost attribution
 * @param {(text: string) => any} o.onTranscript        AUTO-SEND hook: receives the final text
 * @param {() => string} [o.getDraft]                   current draft, so typed text is never lost
 */
export function useVoiceInput({ agentId, conversationId, onTranscript, getDraft } = {}) {
  const state = ref('idle')          // idle | requesting | recording | transcribing
  const elapsed = ref(0)             // seconds recorded, for the button's timer
  const info = ref(null)             // server answer: { enabled, model_name, max_seconds, message }
  const supported = canRecord()

  let recorder = null
  let stream = null
  let chunks = []
  let ticker = null
  let stopTimer = null
  let controller = null
  let cancelled = false

  const maxSeconds = computed(() => info.value?.max_seconds || 120)
  const enabled = computed(() => supported && !!info.value?.enabled)
  const disabledMessage = computed(() => {
    if (!supported) return 'Voice input needs a browser with microphone recording support (try Chrome, Edge or Firefox).'
    if (info.value && !info.value.enabled) return info.value.message || 'Audio transcription model not configured.'
    return ''
  })
  const busy = computed(() => state.value === 'requesting' || state.value === 'transcribing')

  async function loadInfo() {
    const id = agentId?.()
    if (!id) { info.value = null; return }
    const key = String(id)
    if (modeCache.has(key)) { info.value = modeCache.get(key); return }
    try {
      const res = await apiService.getVoiceInput(key)
      const data = res?.data || null
      modeCache.set(key, data)
      // Ignore a late reply for an agent we've since switched away from.
      if (String(agentId?.() ?? '') === key) info.value = data
    } catch {
      // Unreachable config endpoint = mic stays disabled. Never guess "enabled" and then fail at the
      // moment the user is speaking.
      info.value = { enabled: false, message: 'Voice input is unavailable right now. Please try again.' }
    }
  }

  function refresh() {
    clearVoiceInputCache(agentId?.())
    return loadInfo()
  }

  // Re-resolve whenever the surface points at a different agent.
  watch(() => agentId?.(), () => { cancel(); loadInfo() }, { immediate: true })

  async function explainDisabled() {
    await confirm({
      title: !supported ? 'Voice input not supported' : 'Audio transcription model not configured',
      message: disabledMessage.value,
      confirmText: 'OK',
      hideCancel: true,
    })
  }

  function releaseMic() {
    try { stream?.getTracks?.().forEach((t) => t.stop()) } catch { /* ignore */ }
    stream = null
    recorder = null
    if (ticker) { clearInterval(ticker); ticker = null }
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  }

  async function start() {
    if (!enabled.value || busy.value) return
    cancelled = false
    chunks = []
    elapsed.value = 0
    state.value = 'requesting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      state.value = 'idle'
      const name = e?.name || ''
      notify.error(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not start the microphone.')
      return
    }
    const mime = pickMime()
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      releaseMic()
      state.value = 'idle'
      notify.error('This browser could not start an audio recorder.')
      return
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const type = recorder?.mimeType || mime || 'audio/webm'
      releaseMic()
      if (cancelled) { state.value = 'idle'; return }
      const blob = new Blob(chunks, { type })
      chunks = []
      if (!blob.size) { state.value = 'idle'; notify.info('Nothing was recorded.'); return }
      upload(blob, type)
    }
    recorder.start()
    state.value = 'recording'
    ticker = setInterval(() => { elapsed.value += 1 }, 1000)
    // Hard stop at the server's limit so a forgotten recording can't run forever.
    stopTimer = setTimeout(() => { if (state.value === 'recording') stop() }, maxSeconds.value * 1000)
  }

  function stop() {
    if (state.value !== 'recording' || !recorder) return
    try { recorder.stop() } catch { releaseMic(); state.value = 'idle' }
  }

  /** Abandon a recording without transcribing it (Esc, unmount, agent switch). */
  function cancel() {
    cancelled = true
    if (recorder && state.value === 'recording') {
      try { recorder.stop() } catch { /* ignore */ }
    }
    releaseMic()
    try { controller?.abort() } catch { /* ignore */ }
    controller = null
    chunks = []
    if (state.value !== 'idle') state.value = 'idle'
  }

  async function upload(blob, type) {
    const id = agentId?.()
    if (!id) { state.value = 'idle'; return }
    state.value = 'transcribing'
    controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    try {
      const base = String(type).split(';')[0]
      const res = await apiService.transcribeVoice(id, blob, {
        conversationId: conversationId?.() || null,
        filename: `recording.${EXT[base] || 'webm'}`,
        signal: controller?.signal,
      })
      const text = (res?.data?.text || '').trim()
      state.value = 'idle'
      if (!text) { notify.info("Didn't catch that — try again."); return }
      // AUTO-SEND, preserving whatever was already typed so a half-written message is never dropped.
      const draft = (getDraft?.() || '').trim()
      onTranscript?.(draft ? `${draft} ${text}` : text)
    } catch (e) {
      state.value = 'idle'
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError') return
      const data = e?.response?.data || {}
      notify.error(data.message || data.detail || 'Transcription failed. Please try again.')
    } finally {
      controller = null
    }
  }

  function toggle() {
    if (!enabled.value) return explainDisabled()
    if (state.value === 'recording') return stop()
    if (busy.value) return undefined
    return start()
  }

  onBeforeUnmount(cancel)

  return {
    // state
    supported, enabled, disabledMessage, state, elapsed, maxSeconds, info,
    recording: computed(() => state.value === 'recording'),
    transcribing: computed(() => state.value === 'transcribing'),
    // actions
    toggle, start, stop, cancel, explainDisabled, refresh,
  }
}

export default useVoiceInput
