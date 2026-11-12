<!--
  A voice note, played like WhatsApp's (backend agentic-docs/VOICE_NOTES_PLAN.md): play/pause, a progress bar you can
  drag or move with the arrow keys, the time, and 1x / 1.5x / 2x. Used in the person's blue bubble (tone="brand") and
  under the agent's answer (tone="plain"). Only one note plays at a time on the page.
-->
<template>
  <div class="vnp" :class="`vnp--${tone}`" role="group" :aria-label="label">
    <button type="button" class="vnp-play" :aria-label="playing ? `Pause ${label}` : `Play ${label}`"
            :disabled="!src" data-test="voice-note-play" @click="toggle">
      <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7l-10.2-6.4A1 1 0 0 0 8 5.6Z"/></svg>
    </button>
    <div class="vnp-track">
      <input class="vnp-seek" type="range" min="0" :max="duration || 0" step="0.1" :value="position"
             :style="{ '--vnp-fill': fillPct + '%' }" :disabled="!duration"
             :aria-label="`Position in ${label}`" :aria-valuetext="`${clock(position)} of ${clock(duration)}`"
             data-test="voice-note-seek" @input="seek($event.target.value)" />
      <span class="vnp-time" aria-hidden="true">{{ clock(playing || position ? position : duration) }}</span>
    </div>
    <button type="button" class="vnp-speed" :aria-label="`Playback speed ${speed} times. Change speed`"
            data-test="voice-note-speed" @click="nextSpeed">{{ speed }}×</button>
    <audio ref="el" :src="src" preload="metadata" @loadedmetadata="onMeta" @durationchange="onMeta"
           @timeupdate="onTime" @play="onPlay" @pause="playing = false" @ended="onEnded"></audio>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { clock } from '../../utils/voiceNotes'

const props = defineProps({
  src: { type: String, default: '' },
  tone: { type: String, default: 'plain' },          // brand: on the person's blue bubble · plain: on the page
  label: { type: String, default: 'voice note' },
  seconds: { type: Number, default: 0 },             // the recorded length, until the file reports its own
})

const SPEEDS = [1, 1.5, 2]
const el = ref(null)
const playing = ref(false)
const position = ref(0)
const fileDuration = ref(0)
const speed = ref(1)

// A fresh browser recording (webm) reports an unknown length until it has been played through; the recorded
// length stands in until then.
const duration = computed(() => fileDuration.value || props.seconds || 0)
const fillPct = computed(() => (duration.value ? Math.min(100, (position.value / duration.value) * 100) : 0))

function onMeta() {
  const d = el.value?.duration
  if (Number.isFinite(d) && d > 0) fileDuration.value = d
}
function onTime() { position.value = el.value?.currentTime || 0 }
function onPlay() {
  playing.value = true
  window.dispatchEvent(new CustomEvent('vm-voice-note-play', { detail: el.value }))
}
function onEnded() {
  playing.value = false
  position.value = 0
  onMeta()
}
function toggle() {
  const a = el.value
  if (!a) return
  if (a.paused) a.play().catch(() => { playing.value = false })
  else a.pause()
}
function seek(v) {
  const t = Number(v) || 0
  position.value = t
  if (el.value) el.value.currentTime = t
}
function nextSpeed() {
  speed.value = SPEEDS[(SPEEDS.indexOf(speed.value) + 1) % SPEEDS.length]
  if (el.value) el.value.playbackRate = speed.value
}

// One note at a time: starting another pauses this one.
function onOtherPlay(e) { if (e.detail !== el.value && el.value && !el.value.paused) el.value.pause() }
window.addEventListener('vm-voice-note-play', onOtherPlay)
onBeforeUnmount(() => {
  window.removeEventListener('vm-voice-note-play', onOtherPlay)
  try { el.value?.pause() } catch { /* ignore */ }
})

watch(() => props.src, () => { playing.value = false; position.value = 0; fileDuration.value = 0 })
</script>

<style scoped>
.vnp { display: flex; align-items: center; gap: 10px; min-width: 220px; max-width: 320px; }
.vnp-play { display: grid; flex: 0 0 auto; width: 36px; height: 36px; place-items: center; padding: 0; border: 0;
  border-radius: 50%; cursor: pointer; transition: background-color .15s ease, opacity .15s ease; }
.vnp-play svg { width: 16px; height: 16px; }
.vnp-play:disabled { cursor: default; opacity: .55; }
.vnp-play:focus-visible, .vnp-speed:focus-visible, .vnp-seek:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.vnp-track { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 3px; }
.vnp-seek { width: 100%; height: 18px; margin: 0; background: transparent; cursor: pointer; -webkit-appearance: none; appearance: none; }
.vnp-seek:disabled { cursor: default; }
.vnp-seek::-webkit-slider-runnable-track { height: 4px; border-radius: 4px;
  background: linear-gradient(to right, var(--vnp-on) var(--vnp-fill, 0%), var(--vnp-rail) var(--vnp-fill, 0%)); }
.vnp-seek::-moz-range-track { height: 4px; border-radius: 4px; background: var(--vnp-rail); }
.vnp-seek::-moz-range-progress { height: 4px; border-radius: 4px; background: var(--vnp-on); }
.vnp-seek::-webkit-slider-thumb { width: 12px; height: 12px; margin-top: -4px; border: 0; border-radius: 50%;
  background: var(--vnp-on); -webkit-appearance: none; appearance: none; }
.vnp-seek::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--vnp-on); }
.vnp-time { font-size: 11px; font-variant-numeric: tabular-nums; line-height: 1; }
.vnp-speed { flex: 0 0 auto; min-width: 36px; height: 24px; padding: 0 7px; border: 0; border-radius: 12px;
  font: inherit; font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; cursor: pointer;
  transition: background-color .15s ease; }

/* On the person's blue bubble: white on the brand gradient. */
.vnp--brand { --vnp-on: #fff; --vnp-rail: rgba(255, 255, 255, .35); color: #fff; }
.vnp--brand .vnp-play { background: #fff; color: var(--vm-violet); }
.vnp--brand .vnp-play:hover:not(:disabled) { background: rgba(255, 255, 255, .88); }
.vnp--brand .vnp-time { color: rgba(255, 255, 255, .9); }
.vnp--brand .vnp-speed { background: rgba(255, 255, 255, .2); color: #fff; }
.vnp--brand .vnp-speed:hover { background: rgba(255, 255, 255, .3); }

/* Under the agent's answer: the page's own surface. */
.vnp--plain { --vnp-on: var(--vm-violet); --vnp-rail: var(--vm-line-2); color: var(--vm-ink);
  padding: 7px 10px 7px 7px; border: 1px solid var(--vm-line); border-radius: 22px; background: var(--vm-surface-soft); }
.vnp--plain .vnp-play { background: var(--vm-violet); color: #fff; }
.vnp--plain .vnp-play:hover:not(:disabled) { background: var(--vm-violet-d); }
.vnp--plain .vnp-time { color: var(--vm-ink-soft); }
.vnp--plain .vnp-speed { background: var(--vm-surface); color: var(--vm-ink-soft); border: 1px solid var(--vm-line); }
.vnp--plain .vnp-speed:hover { color: var(--vm-ink); }

@media (pointer: coarse) {
  .vnp-play { width: 44px; height: 44px; }
  .vnp-speed { min-width: 44px; height: 32px; }
  .vnp-seek { height: 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .vnp-play, .vnp-speed { transition: none; }
}
</style>
