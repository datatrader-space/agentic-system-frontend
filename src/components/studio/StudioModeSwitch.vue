<template>
  <div class="sm-switch" role="radiogroup" aria-label="Who picks the settings" data-test="studio-mode">
    <button v-for="mode in ['agent','manual']" :key="mode" type="button" role="radio" :aria-checked="video.studioMode === mode" :tabindex="video.studioMode === mode ? 0 : -1" :data-test="`studio-mode-${mode}`" @click="video.setStudioMode(mode)" @keydown="navigate($event, mode)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path :d="mode === 'agent' ? 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3' : 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4'" /></svg>{{ mode === 'agent' ? 'Agent' : 'Manual' }}
    </button>
  </div>
</template>
<script setup>
import { useVideoStore } from '../../stores/useVideoStore'
const video = useVideoStore()
function navigate(event, mode) {
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 'agent' : event.key === 'End' ? 'manual' : mode === 'agent' ? 'manual' : 'agent'
  video.setStudioMode(next)
  event.currentTarget.parentElement.querySelector(`[data-test="studio-mode-${next}"]`)?.focus()
}
</script>
<style scoped>
.sm-switch{display:flex;gap:3px;padding:3px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface-2);align-self:flex-start}.sm-switch button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:7px 14px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.sm-switch button[aria-checked=true]{background:var(--vm-surface);border-color:var(--vm-line);color:var(--vm-ink)}.sm-switch svg{width:16px;height:16px}@media(max-width:1023px){.sm-switch{width:100%}.sm-switch button{flex:1;min-height:44px}}
</style>
