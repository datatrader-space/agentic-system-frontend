<template>
  <!-- The live view of the browser an agent is driving (BROWSER_LIVE_VIEW_PLAN.md).
       Watching is read-only. The page takes a person's mouse and keys only after they take control,
       which pauses the agent; handing back gives it the page again. -->
  <section class="bl" data-test="bl-panel">
    <header class="bl-head">
      <span class="bl-dot" :class="dotClass" aria-hidden="true"></span>
      <div class="bl-titles">
        <div class="bl-site" data-test="bl-site">{{ site || 'Browser' }}</div>
        <div v-if="address" class="bl-addr" :title="address">{{ address }}</div>
      </div>
      <span v-if="showLive" class="bl-live" data-test="bl-live">LIVE</span>
      <span v-else-if="browser.ended" class="bl-ended" data-test="bl-ended">Ended</span>
    </header>

    <div v-if="needsPersonText" class="bl-banner" data-test="bl-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
      <span>{{ needsPersonText }}</span>
    </div>

    <!-- The stage takes focus while a person drives, so keys go to the remote page and not to ours. -->
    <div ref="stageEl" class="bl-stage" :class="{ driving: browser.mine }" tabindex="0"
         data-test="bl-stage"
         @keydown="onKey($event, 'down')" @keyup="onKey($event, 'up')"
         @paste="onPaste" @compositionend="onComposed">
      <div class="bl-frame" :class="{ lit: browser.mine }">
        <img v-show="hasPicture" ref="imgEl" class="bl-img" :src="pictureUrl" draggable="false"
             alt="The page the agent's browser is showing" data-test="bl-img"
             @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
             @pointercancel="onPointerUp" @contextmenu.prevent @dragstart.prevent />
        <div v-if="masked" class="bl-plate" data-test="bl-plate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          <span>Filling in a saved credential</span>
        </div>
        <div v-else-if="overlayText" class="bl-overlay" :class="{ soft: hasPicture }" data-test="bl-overlay">
          <span v-if="overlaySpins" class="bl-spin" aria-hidden="true"></span>
          <span>{{ overlayText }}</span>
        </div>
      </div>
    </div>

    <footer class="bl-foot">
      <span class="bl-hint" data-test="bl-hint">{{ hint }}</span>
      <button v-if="browser.mine" class="bl-btn primary" :disabled="browser.busy" data-test="bl-release"
              @click="handBack">Hand back to the agent</button>
      <button v-else-if="canTake" class="bl-btn" :disabled="browser.busy" data-test="bl-take"
              @click="takeControl">Take control</button>
    </footer>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBrowserStore } from '../../stores/useBrowserStore'
import { createBrowserLive } from '../../composables/useBrowserLive'
import { confirm as confirmDialog } from '../../composables/useConfirm'
import {
  challengeLabel, keyAction, pointerEvent, textEvent, toRemotePoint, wheelEvent,
} from '../../utils/browserLive'

// `active` is false while the dock is showing another tab: the pane stays mounted and the stream pauses.
const props = defineProps({ active: { type: Boolean, default: true } })

const browser = useBrowserStore()

const stageEl = ref(null)
const imgEl = ref(null)
const pictureUrl = ref('')
const hasPicture = ref(false)
const masked = ref(false)
const phase = ref('connecting')      // connecting | live | reconnecting | unavailable | closed | ended
const phaseCode = ref('')
const liveAddress = ref('')
const viewport = ref({ w: 0, h: 0 })

let connectedTo = null

const live = createBrowserLive({
  onFrame(header, jpeg) {
    if (header.w && header.h) viewport.value = { w: header.w, h: header.h }
    if (header.address) liveAddress.value = header.address
    if (header.masked) { masked.value = true; return }
    masked.value = false
    if (!jpeg || !jpeg.byteLength) return
    // The picture lives in an object URL for exactly as long as it is on screen, and nowhere else.
    const next = URL.createObjectURL(new Blob([jpeg], { type: 'image/jpeg' }))
    const previous = pictureUrl.value
    pictureUrl.value = next
    hasPicture.value = true
    if (previous) URL.revokeObjectURL(previous)
  },
  onStatus(next, code) { phase.value = next; phaseCode.value = code || '' },
  onSession(card) { if (card) browser.applySession(card) },
  onEnd(reason) { phase.value = reason === 'denied' ? 'unavailable' : 'ended' },
})

// ── what is shown ───────────────────────────────────────────────────────────
const site = computed(() => (browser.session && browser.session.site) || '')
const address = computed(() => liveAddress.value || (browser.session && browser.session.address) || '')
const showLive = computed(() => phase.value === 'live' && !browser.ended)
const heldElsewhere = computed(() => {
  const c = browser.session && browser.session.control
  return !!(c && c.holder === 'human' && !c.mine)
})
const canTake = computed(() => browser.watchable && !browser.ended && !heldElsewhere.value && phase.value !== 'unavailable')
const needsPersonText = computed(() => (browser.needsPerson && !browser.mine
  ? challengeLabel(browser.session.challenge) : ''))

const dotClass = computed(() => {
  if (browser.ended || phase.value === 'ended' || phase.value === 'unavailable') return 'off'
  if (browser.mine) return 'you'
  if (browser.needsPerson) return 'wait'
  return phase.value === 'live' ? 'on' : 'busy'
})

const overlaySpins = computed(() => phase.value === 'connecting' || phase.value === 'reconnecting')
const overlayText = computed(() => {
  if (browser.ended || phase.value === 'ended') return hasPicture.value ? '' : 'This browser session has ended.'
  if (phase.value === 'unavailable') {
    if (phaseCode.value === 'TOO_MANY_VIEWERS') return 'This browser is already open in three other windows.'
    if (phaseCode.value === 'BROWSER_DISABLED') return 'Browsing is switched off right now.'
    if (phaseCode.value === 'NOT_RUNNING') return hasPicture.value ? '' : 'The browser is no longer running.'
    return 'The live view is not available right now.'
  }
  if (phase.value === 'connecting') return 'Connecting to the browser…'
  if (phase.value === 'reconnecting') return 'Reconnecting…'
  return hasPicture.value ? '' : 'Waiting for the first picture…'
})

const hint = computed(() => {
  if (browser.ended || phase.value === 'ended') return 'This browser session has ended.'
  if (phase.value === 'unavailable' && phaseCode.value === 'NOT_RUNNING') return 'The browser is no longer running. This is the last picture of it.'
  if (browser.mine) return 'You are in control. The agent is paused until you hand back.'
  if (heldElsewhere.value) return 'This browser is being controlled from another window.'
  if (browser.needsPerson) return 'The agent is waiting for you to finish this step.'
  return 'The agent is driving. Click the page to take control.'
})

// ── the connection follows the session and the pane's visibility ────────────
function follow() {
  const id = browser.open ? browser.sessionId : null
  if (id === connectedTo) return
  connectedTo = id
  if (!id) { live.close(); return }
  hasPicture.value = false
  masked.value = false
  liveAddress.value = ''
  phase.value = 'connecting'
  live.connect(id)
  live.setHidden(document.hidden || !props.active)
}
watch(() => [browser.open, browser.sessionId], follow, { immediate: true })

// Frames are only worth sending to a pane somebody can see: this tab on top, in a visible window.
const onVisibility = () => live.setHidden(document.hidden || !props.active)
watch(() => props.active, onVisibility)

// ── taking and handing back ─────────────────────────────────────────────────
async function takeControl() {
  if (!canTake.value || browser.busy) return
  const ok = await confirmDialog({
    title: 'Take control of the browser?',
    message: 'The agent pauses while you drive. What you type is not recorded and is not shown to the agent. Hand back when you are done.',
    confirmText: 'Take control',
  })
  if (!ok) return
  if (await browser.takeControl()) {
    live.sync()
    if (stageEl.value) stageEl.value.focus()
  }
}

async function handBack() {
  if (await browser.releaseControl()) live.sync()
}

// ── a person's input, once they hold control ────────────────────────────────
const pointAt = (e) => (imgEl.value
  ? toRemotePoint(e.clientX, e.clientY, imgEl.value.getBoundingClientRect(), viewport.value) : null)

// A finger scrolls; a mouse points. For touch, a drag becomes wheel turns and a tap becomes a click.
let touch = null

function onPointerDown(e) {
  if (!browser.mine) { takeControl(); return }
  e.preventDefault()
  if (stageEl.value) stageEl.value.focus()
  const point = pointAt(e)
  if (!point) return
  if (e.pointerType === 'touch') { touch = { x: e.clientX, y: e.clientY, moved: false, point }; return }
  try { e.target.setPointerCapture(e.pointerId) } catch (err) { /* not every browser allows it */ }
  live.input(pointerEvent('down', point, e.button, e.detail))
}

function onPointerMove(e) {
  if (!browser.mine) return
  const point = pointAt(e)
  if (!point) return
  if (e.pointerType === 'touch') {
    if (!touch) return
    const dx = touch.x - e.clientX
    const dy = touch.y - e.clientY
    if (Math.abs(dx) + Math.abs(dy) < 6 && !touch.moved) return
    touch.moved = true
    touch.x = e.clientX
    touch.y = e.clientY
    const rect = imgEl.value.getBoundingClientRect()
    const scale = rect.height ? viewport.value.h / rect.height : 1
    live.input({ t: 'wheel', x: point.x, y: point.y, dx: Math.round(dx * scale), dy: Math.round(dy * scale) })
    return
  }
  live.input(pointerEvent('move', point))
}

function onPointerUp(e) {
  if (!browser.mine) return
  if (e.pointerType === 'touch') {
    const t = touch
    touch = null
    if (t && !t.moved) {
      live.input(pointerEvent('down', t.point, 0, 1))
      live.input(pointerEvent('up', t.point, 0, 1))
    }
    return
  }
  const point = pointAt(e)
  if (point) live.input(pointerEvent('up', point, e.button, e.detail || 1))
}

// Registered by hand because it must be able to stop the page scrolling, and Vue's listener is passive.
function onWheel(e) {
  if (!browser.mine) return
  e.preventDefault()
  live.input(wheelEvent(pointAt(e), e))
}

function onKey(e, kind) {
  if (!browser.mine) return
  const action = keyAction(e, kind)
  if (!action) return
  if (action.paste) return            // our own `paste` event carries the text
  e.preventDefault()
  live.input(action.event)
}

function onPaste(e) {
  if (!browser.mine) return
  e.preventDefault()
  live.input(textEvent(e.clipboardData ? e.clipboardData.getData('text') : ''))
}

function onComposed(e) {
  if (browser.mine) live.input(textEvent(e.data))
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  if (stageEl.value) stageEl.value.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  if (stageEl.value) stageEl.value.removeEventListener('wheel', onWheel)
  live.close()
  if (pictureUrl.value) URL.revokeObjectURL(pictureUrl.value)
})
</script>

<style scoped>
.bl { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); }

.bl-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.bl-dot { width: 9px; height: 9px; border-radius: 9999px; background: var(--vm-ink-soft, #94a3b8); flex: 0 0 auto; }
.bl-dot.on { background: #16a34a; }
.bl-dot.busy { background: #f59e0b; }
.bl-dot.wait { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, .18); }
.bl-dot.you { background: var(--vm-violet, #2563eb); box-shadow: 0 0 0 4px rgba(37, 99, 235, .18); }
.bl-dot.off { background: var(--vm-ink-soft, #94a3b8); }
.bl-titles { min-width: 0; flex: 1 1 auto; }
.bl-site { font-size: 13.5px; font-weight: 700; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl-addr { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 11.5px; color: var(--vm-ink-soft, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl-live, .bl-ended { flex: 0 0 auto; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; padding: 3px 8px; border-radius: 9999px; }
.bl-live { background: #0f172a; color: #fff; }
.bl-ended { background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); }

.bl-banner { display: flex; align-items: center; gap: 8px; padding: 9px 14px; font-size: 12.5px; background: #fffbeb; color: #92400e; border-bottom: 1px solid #fde68a; }
.bl-banner svg { width: 16px; height: 16px; flex: 0 0 auto; }

.bl-stage { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 16px; outline: none; display: flex; align-items: flex-start; justify-content: center;
  background: var(--vm-bg, #f8fafc); }
.bl-stage:focus-visible .bl-frame { box-shadow: 0 0 0 3px rgba(37, 99, 235, .35), var(--vm-shadow-m, 0 8px 24px rgba(15, 23, 42, .12)); }
.bl-frame { position: relative; width: 100%; max-width: 1280px; min-height: 180px; border-radius: 12px; overflow: hidden; background: #fff;
  border: 1px solid var(--vm-line-2, #e5e7eb); box-shadow: var(--vm-shadow-m, 0 8px 24px rgba(15, 23, 42, .12)); }
.bl-frame.lit { border-color: var(--vm-violet, #2563eb); }
.bl-img { display: block; width: 100%; height: auto; user-select: none; -webkit-user-drag: none; touch-action: none; cursor: pointer; }
.bl-stage.driving .bl-img { cursor: default; }

.bl-overlay, .bl-plate { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; text-align: center;
  font-size: 13px; font-weight: 600; color: var(--vm-ink, #0f172a); background: var(--vm-surface, #fff); }
.bl-overlay.soft { background: rgba(255, 255, 255, .72); }
.bl-plate { background: #0f172a; color: #e2e8f0; }
.bl-plate svg { width: 18px; height: 18px; }
.bl-spin { width: 16px; height: 16px; border-radius: 9999px; border: 2px solid var(--vm-line-2, #cbd5e1); border-top-color: var(--vm-violet, #2563eb); animation: bl-spin .8s linear infinite; }
@keyframes bl-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .bl-spin { animation: none; } }

.bl-foot { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--vm-line-2, #e5e7eb); }
.bl-hint { flex: 1 1 auto; min-width: 0; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.bl-btn { flex: 0 0 auto; border: 1px solid var(--vm-line-2, #cbd5e1); background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a);
  border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.bl-btn:hover:not(:disabled) { background: var(--vm-surface-2, #f1f5f9); }
.bl-btn.primary { background: var(--vm-violet, #2563eb); border-color: var(--vm-violet, #2563eb); color: #fff; }
.bl-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d, #1d4ed8); }
.bl-btn:disabled { opacity: .6; cursor: default; }
.bl-btn:focus-visible { outline: 2px solid var(--vm-violet, #2563eb); outline-offset: 2px; }

@media (max-width: 480px) {
  .bl-stage { padding: 8px; }
  .bl-foot { flex-direction: column; align-items: stretch; }
  .bl-btn { width: 100%; }
}
</style>
