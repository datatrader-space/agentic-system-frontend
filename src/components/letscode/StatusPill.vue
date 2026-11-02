<template>
  <!-- Project status: a coloured dot AND the status word, so colour is never the only signal. -->
  <span class="lc-pill" :class="'t-' + tone">
    <span class="lc-pill-dot" aria-hidden="true"></span>{{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { phaseLabel, phaseTone } from './projectStatus'

const props = defineProps({
  project: { type: Object, required: true },
})
const label = computed(() => phaseLabel(props.project))
const tone = computed(() => phaseTone(props.project))
</script>

<style scoped>
.lc-pill {
  --tone: var(--vm-ink-faint);
  display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
  font: 600 12px/1 var(--vm-font-sans); white-space: nowrap;
  padding: 5px 10px; border-radius: 999px;
  color: color-mix(in srgb, var(--tone) 62%, var(--vm-ink));
  background: color-mix(in srgb, var(--tone) 13%, transparent);
}
.lc-pill.t-ok { --tone: var(--vm-green); }
.lc-pill.t-run { --tone: var(--vm-amber); }
.lc-pill.t-err { --tone: var(--vm-danger); }
.lc-pill.t-wait { --tone: var(--vm-ink-faint); color: var(--vm-ink-soft); }
.lc-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tone); flex: 0 0 auto; }
.lc-pill.t-run .lc-pill-dot { animation: lc-pill-pulse 1.6s ease-in-out infinite; }
@keyframes lc-pill-pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .lc-pill.t-run .lc-pill-dot { animation: none; }
}
</style>
