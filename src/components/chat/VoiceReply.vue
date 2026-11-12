<!--
  The agent's answer to a voice note, spoken back (backend agent/services/voice_replies.py): "Recording voice reply…"
  while it is made, then the playable note, or the reason there is none. The text answer above is never held up.
-->
<template>
  <div class="vr" data-test="voice-reply">
    <VoiceNotePlayer v-if="reply.state === 'ready'" :src="reply.url" tone="plain" label="voice reply" />
    <p v-else-if="reply.state === 'failed'" class="vr-note vr-failed" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <span>{{ reply.message }}</span>
    </p>
    <p v-else class="vr-note vr-pending" role="status" aria-live="polite">
      <span class="vr-dot" aria-hidden="true"></span>
      <span>Recording voice reply…</span>
    </p>
  </div>
</template>

<script setup>
import VoiceNotePlayer from './VoiceNotePlayer.vue'

defineProps({ reply: { type: Object, required: true } })
</script>

<style scoped>
.vr { margin-top: 10px; }
.vr-note { display: inline-flex; align-items: center; gap: 7px; margin: 0; font-size: 12.5px; line-height: 1.4; }
.vr-pending { color: var(--vm-ink-soft); }
.vr-failed { color: var(--vm-ink-soft); }
.vr-failed svg { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-red-ink); }
.vr-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vm-violet); animation: vrPulse 1.2s ease-in-out infinite; }
@keyframes vrPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
@media (prefers-reduced-motion: reduce) { .vr-dot { animation: none; } }
</style>
