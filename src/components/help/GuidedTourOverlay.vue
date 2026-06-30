<template>
  <div v-if="state.active" class="gt-root">
    <!-- Spotlight backdrop: a box at the target rect with a huge surrounding shadow. -->
    <div v-if="rect" class="gt-spotlight" :style="spotStyle"></div>
    <!-- Dimming layer when there is no anchored element (fallback / center). -->
    <div v-else class="gt-dim"></div>

    <!-- Tooltip / fallback card -->
    <div class="gt-card" :class="{ centered: !rect }" :style="cardStyle">
      <div class="gt-head">
        <span class="gt-count">Step {{ state.index + 1 }} of {{ state.steps.length }}</span>
        <button class="gt-x" @click="onSkip" aria-label="Close tour"><Icon icon="lucide:x" /></button>
      </div>
      <h3 class="gt-title">{{ step.title }}</h3>
      <p class="gt-body">{{ rect ? step.body : (step.fallback_text || step.body) }}</p>
      <p v-if="step.action_hint && rect" class="gt-hint"><Icon icon="lucide:mouse-pointer-click" /> {{ step.action_hint }}</p>
      <p v-if="!rect && step.target_selector" class="gt-missing"><Icon icon="lucide:info" /> Continue when you’re on the right screen.</p>

      <div class="gt-actions">
        <button v-if="state.index > 0" class="gt-btn ghost" @click="back">{{ step.back_button_label || 'Back' }}</button>
        <span class="gt-spacer" />
        <button v-if="step.skippable" class="gt-btn link" @click="onSkip">Skip</button>
        <button class="gt-btn primary" @click="next">
          {{ isLast ? 'Finish' : (step.next_button_label || 'Next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useGuidedTour } from '../../composables/useGuidedTour'

const router = useRouter()
const { state, next, back, skip, registerRouter } = useGuidedTour()
registerRouter(router)

const rect = ref(null)
let _locateTimer = null
let _retries = 0

const step = computed(() => state.steps[state.index] || {})
const isLast = computed(() => state.index >= state.steps.length - 1)

function onSkip() { skip() }

function locate() {
  const sel = step.value?.target_selector
  if (!sel) { rect.value = null; return }
  const el = document.querySelector(sel)
  if (el) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) { rect.value = null; return }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // Re-read after scroll settles.
    rect.value = { top: r.top, left: r.left, width: r.width, height: r.height }
  } else {
    rect.value = null
  }
}

// After a step change (and possible route navigation), the target may take a moment
// to render. Retry a few times, then gracefully fall back to the centered card.
function relocateWithRetries() {
  clearTimeout(_locateTimer)
  _retries = 0
  const tick = () => {
    locate()
    if (!rect.value && step.value?.target_selector && _retries < 8) {
      _retries += 1
      _locateTimer = setTimeout(tick, 250)
    }
  }
  nextTick(tick)
}

const PAD = 6
const spotStyle = computed(() => rect.value ? {
  top: `${rect.value.top - PAD}px`, left: `${rect.value.left - PAD}px`,
  width: `${rect.value.width + PAD * 2}px`, height: `${rect.value.height + PAD * 2}px`,
} : {})

const cardStyle = computed(() => {
  if (!rect.value) return {}
  const r = rect.value
  const cardW = 320, gap = 14
  const place = step.value?.placement || 'bottom'
  let top, left
  if (place === 'top') { top = r.top - gap; left = r.left; }
  else if (place === 'left') { top = r.top; left = r.left - cardW - gap; }
  else if (place === 'right') { top = r.top; left = r.left + r.width + gap; }
  else { top = r.top + r.height + gap; left = r.left; } // bottom (default)
  // Keep within viewport horizontally.
  left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12))
  top = Math.max(12, Math.min(top, window.innerHeight - 40))
  const style = { top: `${top}px`, left: `${left}px`, width: `${cardW}px` }
  if (place === 'top') style.transform = 'translateY(-100%)'
  return style
})

function onScrollResize() { if (state.active && step.value?.target_selector) locate() }
function onKey(e) { if (e.key === 'Escape' && state.active) skip() }

watch(() => state.index, relocateWithRetries)
watch(() => state.active, (v) => { if (v) relocateWithRetries(); else rect.value = null })
watch(() => router.currentRoute.value.fullPath, () => { if (state.active) relocateWithRetries() })

onMounted(() => {
  window.addEventListener('scroll', onScrollResize, true)
  window.addEventListener('resize', onScrollResize)
  window.addEventListener('keydown', onKey)
  if (state.active) relocateWithRetries()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollResize, true)
  window.removeEventListener('resize', onScrollResize)
  window.removeEventListener('keydown', onKey)
  clearTimeout(_locateTimer)
})
</script>

<style scoped>
.gt-root { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
.gt-dim { position: absolute; inset: 0; background: rgba(15, 23, 42, .55); pointer-events: auto; }
.gt-spotlight {
  position: fixed; border-radius: 10px; pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, .55), 0 0 0 2px #6366f1;
  transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease;
}
.gt-card {
  position: fixed; pointer-events: auto; background: #fff; border-radius: 14px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, .3); padding: 16px 18px; max-width: 92vw;
}
.gt-card.centered { top: 50%; left: 50%; width: 380px; transform: translate(-50%, -50%); }
.gt-head { display: flex; align-items: center; justify-content: space-between; }
.gt-count { font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .04em; color: #6366f1; }
.gt-x { border: 0; background: transparent; color: #94a3b8; cursor: pointer; } .gt-x svg { width: 16px; height: 16px; }
.gt-title { margin: 8px 0 0; font-size: 16px; font-weight: 850; }
.gt-body { margin: 7px 0 0; color: #475569; font-size: 13.5px; line-height: 1.55; }
.gt-hint { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; color: #4f46e5; font-size: 12px; font-weight: 700; }
.gt-hint svg, .gt-missing svg { width: 14px; height: 14px; }
.gt-missing { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; color: #94a3b8; font-size: 11.5px; }
.gt-actions { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.gt-spacer { flex: 1; }
.gt-btn { height: 34px; border-radius: 9px; padding: 0 14px; font-size: 12.5px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
.gt-btn.primary { background: #4f46e5; color: #fff; }
.gt-btn.ghost { background: #fff; border-color: #dbe4f0; color: #334155; }
.gt-btn.link { background: transparent; color: #64748b; }
</style>
