<template>
  <!-- Top-of-viewport navigation progress bar. Appears only when a navigation takes longer than the
       show-delay (so cached/instant navigations never flash), trickles asymptotically, and completes
       with a quick fill + fade. Driven by router hooks in main.js via startNavProgress()/doneNavProgress(). -->
  <div v-if="state.visible" class="nav-progress" role="progressbar" aria-label="Page loading">
    <div class="nav-progress__bar" :style="{ width: state.progress + '%', opacity: state.fading ? 0 : 1 }"></div>
  </div>
</template>

<script>
import { reactive } from 'vue'

// Module-scope state: ONE bar for the whole app, controllable from plain JS (router hooks) without
// any component wiring. The component just renders this.
const state = reactive({ visible: false, progress: 0, fading: false })

const SHOW_DELAY_MS = 120   // don't flash on instant (cached) navigations
let _showTimer = null
let _trickleTimer = null
let _fadeTimer = null

function _clearTimers() {
  if (_showTimer) { clearTimeout(_showTimer); _showTimer = null }
  if (_trickleTimer) { clearInterval(_trickleTimer); _trickleTimer = null }
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null }
}

export function startNavProgress() {
  _clearTimers()
  state.visible = false
  state.progress = 0
  state.fading = false
  _showTimer = setTimeout(() => {
    state.visible = true
    state.progress = 12
    // Asymptotic trickle toward ~85%: fast at first, slower as it climbs — the familiar
    // "something is happening" signal without ever pretending to finish.
    _trickleTimer = setInterval(() => {
      const remaining = 85 - state.progress
      state.progress = Math.min(85, state.progress + Math.max(0.4, remaining * 0.08))
    }, 160)
  }, SHOW_DELAY_MS)
}

export function doneNavProgress() {
  const wasVisible = state.visible
  _clearTimers()
  if (!wasVisible) { state.visible = false; state.progress = 0; return }
  state.progress = 100
  state.fading = true
  _fadeTimer = setTimeout(() => {
    state.visible = false
    state.progress = 0
    state.fading = false
  }, 260)
}

export default {
  name: 'NavProgress',
  setup() {
    return { state }
  },
}
</script>

<style scoped>
.nav-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 9999;           /* above AppShell, modals sit below the viewport chrome anyway */
  pointer-events: none;
  background: transparent;
}
.nav-progress__bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #6d5ef1, #8b5cf6, #a78bfa);
  box-shadow: 0 0 8px rgba(139, 92, 246, .55);
  border-radius: 0 2px 2px 0;
  transition: width .18s ease, opacity .22s ease;
}
</style>
