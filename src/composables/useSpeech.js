// Minimal speech-to-text via the browser's Web Speech API (Chrome/Edge/Safari). Feature-detected:
// `supported` is false where the API is absent, so callers can hide the mic button instead of
// showing a dead control. Honest — no fake recording when the platform can't transcribe.
import { ref, onBeforeUnmount } from 'vue'

export function useSpeech({ onResult } = {}) {
  const Ctor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const supported = !!Ctor
  const listening = ref(false)
  let rec = null

  function stop() {
    if (rec) { try { rec.stop() } catch { /* ignore */ } }
    listening.value = false
  }

  function start() {
    if (!supported) return
    if (listening.value) { stop(); return }
    try {
      rec = new Ctor()
      rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
      rec.interimResults = false
      rec.continuous = false
      rec.onresult = (e) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript
        text = text.trim()
        if (text && typeof onResult === 'function') onResult(text)
      }
      rec.onend = () => { listening.value = false }
      rec.onerror = () => { listening.value = false }
      listening.value = true
      rec.start()
    } catch {
      listening.value = false
    }
  }

  function toggle() { listening.value ? stop() : start() }

  onBeforeUnmount(stop)

  return { supported, listening, start, stop, toggle }
}
