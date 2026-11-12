<!--
  The chat mic, shared by every composer (the Chat page, a conversation, Let's Code, the agent emulator). Tap to record a
  voice note; while recording it shows the time, a cancel button and a send button (Esc cancels). The recording is
  handed to the composer as a voice note (`voice-note`), which sends it like any message (VOICE_NOTES_PLAN.md).
  When the agent has no transcription model the button stays visibly off and a tap says why.
-->
<template>
  <div class="vnm" :class="{ 'is-rec': voice.recording.value }">
    <template v-if="voice.recording.value">
      <button type="button" class="vnm-btn vnm-cancel" aria-label="Cancel voice note" title="Cancel (Esc)"
              data-test="voice-note-cancel" @click="voice.cancel()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <span class="vnm-live" role="status" aria-live="polite">
        <span class="vnm-dot" aria-hidden="true"></span>
        <span class="vnm-time">{{ clock(voice.elapsed.value) }}</span>
        <span class="sr-only">Recording a voice note</span>
      </span>
      <button type="button" class="vnm-btn vnm-send" aria-label="Send voice note" title="Send"
              data-test="voice-note-send" @click="voice.stop()">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53L15 12l-11.58 1.87z"/></svg>
      </button>
    </template>
    <button v-else type="button" class="vnm-btn vnm-mic" :class="{ off: !voice.enabled.value }"
            :aria-disabled="voice.enabled.value ? 'false' : 'true'" :disabled="disabled"
            :aria-label="voice.enabled.value ? 'Record a voice note' : 'Voice notes are off'"
            :title="voice.enabled.value ? 'Record a voice note' : voice.disabledMessage.value"
            data-test="voice-note-mic" @click="voice.toggle()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
    </button>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useVoiceInput } from '../../composables/useVoiceInput'
import { clock } from '../../utils/voiceNotes'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['voice-note'])

const voice = useVoiceInput({
  agentId: () => props.agentId || null,
  onVoiceNote: (note, seconds) => emit('voice-note', note, seconds),
})

function onKey(e) { if (e.key === 'Escape' && voice.recording.value) { e.stopPropagation(); voice.cancel() } }
onMounted(() => document.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))

defineExpose({ refresh: () => voice.refresh?.() })
</script>

<style scoped>
.vnm { display: inline-flex; align-items: center; gap: 6px; }
.vnm-btn { display: grid; width: 30px; height: 30px; place-items: center; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--vm-ink-faint); cursor: pointer; transition: background-color .15s ease, color .15s ease; }
.vnm-btn svg { width: 16px; height: 16px; }
.vnm-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.vnm-mic:hover:not(:disabled) { color: var(--vm-violet); background: var(--vm-violet-soft); }
.vnm-mic.off { color: var(--vm-line-2); cursor: help; }
.vnm-mic.off:hover { color: var(--vm-ink-faint); background: transparent; }
.vnm-mic:disabled { cursor: default; opacity: .5; }
.vnm-cancel { color: var(--vm-ink-soft); background: var(--vm-surface-soft); }
.vnm-cancel:hover { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.vnm-send { color: #fff; background: var(--vm-violet); }
.vnm-send:hover { background: var(--vm-violet-d); }
.vnm-send svg { width: 14px; height: 14px; }
.vnm-live { display: inline-flex; align-items: center; gap: 6px; min-width: 52px; color: var(--vm-red-ink);
  font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.vnm-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: vnmPulse 1.2s ease-in-out infinite; }
@keyframes vnmPulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (pointer: coarse) { .vnm-btn { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .vnm-dot { animation: none; } .vnm-btn { transition: none; } }
</style>
