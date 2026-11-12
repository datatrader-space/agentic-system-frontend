// The chat mic: records a VOICE NOTE (backend agentic-docs/VOICE_NOTES_PLAN.md, ADM-1235).
//
// The recording is handed back to the caller as an attachment (`onVoiceNote`), and the caller sends it like any
// message, with `voiceNote` set: the chat shows the playable note, the server hears it with the agent's Audio
// transcription model (agent/services/voice_notes.py), and the agent answers in text and in a voice note. Nothing is
// transcribed in the browser and the words are never put in the text box.
//
// The mic is on when the agent has an Audio transcription model for this person (`GET .../voice-input/`). Otherwise
// the button stays visibly off and CLICKING IT EXPLAINS WHY (a popup, not a dead control), which is also why the
// button must not carry the DOM `disabled` attribute: a disabled button swallows the click.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import apiService from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { voiceNoteAttachment } from '@/utils/voiceNotes'

// Container preference: Opus in WebM (Chrome/Edge/Firefox), Ogg (older Firefox), then MP4 (Safari). The server
// keeps every voice note as AAC .m4a, which plays everywhere.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
]

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

// One in-memory answer per agent, cleared by `refresh()` after an agent save so assigning a model lights the mic up
// without a page reload.
const modeCache = new Map()

export function clearVoiceInputCache(agentId) {
  if (agentId == null) modeCache.clear()
  else modeCache.delete(String(agentId))
}

/**
 * @param {object} o
 * @param {() => (string|number|null)} o.agentId   the agent that will hear the note (and answer)
 * @param {(note: object, seconds: number) => any} o.onVoiceNote  the recording, as an attachment, to send
 */
export function useVoiceInput({ agentId, onVoiceNote } = {}) {
  const state = ref('idle')          // idle | requesting | recording
  const elapsed = ref(0)             // seconds recorded, for the timer
  const info = ref(null)             // server answer: { enabled, model_name, max_seconds, message }
  const supported = canRecord()

  let recorder = null
  let stream = null
  let chunks = []
  let ticker = null
  let stopTimer = null
  let cancelled = false
  let startedAt = 0

  const maxSeconds = computed(() => info.value?.max_seconds || 120)
  const enabled = computed(() => supported && !!info.value?.enabled)
  const disabledMessage = computed(() => {
    if (!supported) return 'Voice notes need a browser with microphone recording support (try Chrome, Edge, Firefox or Safari).'
    if (info.value && !info.value.enabled) return info.value.message || 'Audio transcription model not configured.'
    return ''
  })
  const busy = computed(() => state.value === 'requesting')

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
      // Unreachable config endpoint = mic stays off. Never guess "enabled" and then fail while the person speaks.
      info.value = { enabled: false, message: 'Voice notes are unavailable right now. Please try again.' }
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
      title: !supported ? 'Voice notes not supported' : 'Audio transcription model not configured',
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
    if (!enabled.value || busy.value || state.value === 'recording') return
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
      const seconds = startedAt ? (Date.now() - startedAt) / 1000 : elapsed.value
      releaseMic()
      state.value = 'idle'
      if (cancelled) return
      const blob = new Blob(chunks, { type })
      chunks = []
      if (!blob.size) { notify.info('Nothing was recorded.'); return }
      onVoiceNote?.(voiceNoteAttachment(blob, type), seconds)
    }
    recorder.start()
    startedAt = Date.now()
    state.value = 'recording'
    ticker = setInterval(() => { elapsed.value += 1 }, 1000)
    // Hard stop at the server's limit, so a forgotten recording can't run forever; it is sent like a tap on Send.
    stopTimer = setTimeout(() => { if (state.value === 'recording') stop() }, maxSeconds.value * 1000)
  }

  /** Stop recording and send the voice note. */
  function stop() {
    if (state.value !== 'recording' || !recorder) return
    try { recorder.stop() } catch { releaseMic(); state.value = 'idle' }
  }

  /** Throw the recording away (the cancel button, Esc, unmount, agent switch). */
  function cancel() {
    cancelled = true
    if (recorder && state.value === 'recording') {
      try { recorder.stop() } catch { /* ignore */ }
    }
    releaseMic()
    chunks = []
    if (state.value !== 'idle') state.value = 'idle'
  }

  function toggle() {
    if (!enabled.value) return explainDisabled()
    if (state.value === 'recording') return stop()
    if (busy.value) return undefined
    return start()
  }

  onBeforeUnmount(cancel)

  return {
    supported, enabled, disabledMessage, state, elapsed, maxSeconds, info,
    recording: computed(() => state.value === 'recording'),
    toggle, start, stop, cancel, explainDisabled, refresh,
  }
}

export default useVoiceInput
