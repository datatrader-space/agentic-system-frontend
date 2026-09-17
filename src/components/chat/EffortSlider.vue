<template>
  <!-- Per-turn reasoning effort. A row inside the agent's picker dropdown, where the other per-run
       settings already live — one place to open, not another chip competing for composer width.
       Offers only what is true (from /agents/:id/reasoning-options/): nothing for a model that does not
       reason, a fixed Off when the agent's configuration has reasoning off, else Auto + the levels the
       model's provider accepts. -->
  <template v-if="!hidden">
    <div v-if="locked" class="eff" data-test="composer-effort" title="Reasoning is off in this agent's settings">
      <svg class="eff-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" aria-hidden="true">
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>
      </svg>
      <span class="eff-label">Effort</span>
      <span class="eff-value" data-test="effort-locked-off">(Off)</span>
    </div>
    <div v-else class="eff" :class="{ 'is-set': index > 0 }" data-test="composer-effort">
      <svg class="eff-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" aria-hidden="true">
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>
      </svg>
      <span class="eff-label">Effort</span>
      <span class="eff-value">({{ stop.label }})</span>

      <div ref="trackEl" class="eff-track" role="slider" tabindex="0"
           :aria-valuemin="0" :aria-valuemax="stops.length - 1" :aria-valuenow="index"
           :aria-valuetext="stop.label" aria-label="Reasoning effort" :title="stop.hint"
           :data-pointer="pointerFocus || null"
           @keydown="onKeydown" @pointerdown="onPointerDown" @blur="pointerFocus = false">
        <span class="eff-rail" aria-hidden="true"></span>
        <span v-for="(s, i) in stops" :key="s.value || 'auto'" class="eff-dot"
              :class="{ 'is-on': i === index, 'is-past': i < index }"
              :data-test="'effort-' + (s.value || 'auto')" aria-hidden="true"></span>
      </div>
    </div>
  </template>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  // { enabled, supported, levels } from useReasoningOptions, or null while unknown (full range shown).
  options: { type: Object, default: null },
})

// Ordered low→high, so "further right" always means "think harder". `''` is AUTO — the absence of a choice: the
// backend's routing call, which has read the message, picks the level for it (else the agent's default).
// `off` is a CHOICE that switches reasoning off even on an agent configured to reason. Those are different
// answers and the backend treats them differently — never collapse them.
const ALL_STOPS = [
  { value: '',        label: 'Auto',    hint: 'Auto — picks how hard to think for each message' },
  { value: 'off',     label: 'Off',     hint: 'Off — no reasoning tokens, fastest and cheapest' },
  { value: 'minimal', label: 'Minimal', hint: 'Minimal — a brief think before answering' },
  { value: 'low',     label: 'Low',     hint: 'Low — light reasoning' },
  { value: 'medium',  label: 'Medium',  hint: 'Medium — balanced' },
  { value: 'high',    label: 'High',    hint: 'High — think hard; slower and more expensive' },
]

// A model that cannot reason gets no control at all; one whose agent has reasoning off gets a fixed Off.
const hidden = computed(() => !!props.options && !props.options.supported)
const locked = computed(() => !!props.options && props.options.supported && !props.options.enabled)
// Known options: Auto + exactly the levels this provider accepts. Unknown: the full legacy range.
const stops = computed(() => {
  const o = props.options
  if (!o || !o.supported || !o.enabled) return ALL_STOPS
  const allowed = new Set(o.levels || [])
  return ALL_STOPS.filter((st) => st.value === '' || allowed.has(st.value))
})

const chat = useChatStore()
const trackEl = ref(null)
// Clicking focuses the track so arrow keys keep working straight after — but a mouse user should not be
// left staring at a keyboard focus ring, so the ring is suppressed for pointer-initiated focus only.
const pointerFocus = ref(false)

// A choice this model does not offer (or any choice when reasoning is off/unavailable) falls back to Auto, so
// the composer never sends a level the control is not showing.
watch([stops, hidden, locked], () => {
  const current = chat.reasoningEffort || ''
  if ((hidden.value || locked.value) && current) chat.reasoningEffort = ''
  else if (!stops.value.some((st) => st.value === current)) chat.reasoningEffort = ''
}, { immediate: true })

// Resolve by VALUE, never by a stored index: a stale or unknown value from anywhere else reads as Auto
// rather than throwing or landing on an arbitrary level.
const index = computed(() => {
  const at = stops.value.findIndex(st => st.value === (chat.reasoningEffort || ''))
  return at < 0 ? 0 : at
})
const stop = computed(() => stops.value[index.value])

const setIndex = (i) => {
  chat.reasoningEffort = stops.value[Math.min(stops.value.length - 1, Math.max(0, i))].value
}

// Nearest stop to the pointer, so the whole strip is a target — not just the 6px dots.
const setFromX = (clientX) => {
  const box = trackEl.value?.getBoundingClientRect()
  if (!box || box.width <= 0) return
  const ratio = (clientX - box.left) / box.width
  setIndex(Math.round(ratio * (stops.value.length - 1)))
}

const onPointerDown = (e) => {
  pointerFocus.value = true
  trackEl.value?.focus({ preventScroll: true })
  setFromX(e.clientX)
  // Capture so a drag that leaves the pill keeps tracking, and always ends.
  const move = (ev) => setFromX(ev.clientX)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  e.preventDefault()
}

const onKeydown = (e) => {
  pointerFocus.value = false   // keyboard use from here on — show the ring
  const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
  if (step) setIndex(index.value + step)
  else if (e.key === 'Home') setIndex(0)
  else if (e.key === 'End') setIndex(stops.value.length - 1)
  else return
  e.preventDefault()
}
</script>

<style scoped>
.eff {
  display: flex; align-items: center; gap: 8px;
  width: 100%; min-height: 36px; padding: 7px 10px;
  color: #292929; font-size: 12.5px; font-weight: 500; line-height: 1;
}

.eff-ic { width: 15px; height: 15px; flex: 0 0 auto; color: #878787; }
.eff-label { font-weight: 570; }
.eff-value { margin-left: auto; color: #858585; font-size: 11.5px; white-space: nowrap; }
.eff.is-set .eff-value { color: #2563eb; }

.eff-track {
  position: relative; display: flex; align-items: center; justify-content: space-between;
  width: 84px; height: 20px; flex: 0 0 auto; padding: 0 2px;
  cursor: pointer; touch-action: none; border-radius: 6px;
}
.eff-track:focus-visible:not([data-pointer]) { outline: 2px solid rgba(37, 99, 235, .42); outline-offset: 2px; }

.eff-rail {
  position: absolute; left: 3px; right: 3px; top: 50%; height: 2px; margin-top: -1px;
  border-radius: 2px; background: #e8e8e8;
}
.eff-dot {
  position: relative; width: 5px; height: 5px; border-radius: 50%;
  background: #d4d4d4;
  transition: transform .14s var(--vm-ease2, ease), background-color .14s var(--vm-ease2, ease);
}
.eff-dot.is-past { background: #93b4f5; }
.eff-dot.is-on {
  width: 11px; height: 11px; background: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .14), 0 1px 2px rgba(0, 0, 0, .18);
}
/* Auto is "no preference" — show it as a resting knob, not an active setting. */
.eff:not(.is-set) .eff-dot.is-on { background: #9a9a9a; box-shadow: none; }

@media (prefers-reduced-motion: reduce) {
  .eff, .eff-dot { transition: none; }
}
</style>
