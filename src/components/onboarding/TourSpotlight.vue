<template>
  <teleport to="body">
    <div class="tour-root" role="dialog" aria-modal="true" :aria-label="`Tour step ${index + 1} of ${total}`">
      <!-- Click-catcher: blocks page interaction while the tour is up. Use Skip / ESC to exit
           (deliberately does NOT dismiss on outside click — avoids accidental loss of the tour). -->
      <div class="tour-catcher"></div>

      <!-- Spotlight hole — a transparent rounded rect with a massive box-shadow that dims
           everything outside it. Purely visual (pointer-events: none). Hidden on centered steps. -->
      <div
        v-if="hasTarget && rect"
        class="tour-hole"
        :style="{ top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
      ></div>

      <!-- Tooltip card -->
      <div
        class="tour-card"
        :class="{ centered: !hasTarget || !rect }"
        :style="cardStyle"
        @click.stop
      >
        <div class="tour-progress">
          <span v-for="i in total" :key="i" class="dot" :class="{ on: i - 1 === index }"></span>
        </div>
        <h3 class="tour-title">{{ step.title }}</h3>
        <p class="tour-desc">{{ step.description }}</p>
        <!-- Concrete, do-this-now instructions for the step. -->
        <ol v-if="step.howto && step.howto.length" class="tour-howto">
          <li v-for="(h, i) in step.howto" :key="i"><span class="hn">{{ i + 1 }}</span><span v-html="h"></span></li>
        </ol>
        <div class="tour-actions">
          <button type="button" class="tour-skip" @click="$emit('skip')">Skip tour</button>
          <div class="tour-nav">
            <button v-if="index > 0" type="button" class="tour-back" @click="$emit('back')">Back</button>
            <button v-if="index < total - 1" type="button" class="tour-next" @click="$emit('next')">Next</button>
            <button v-else type="button" class="tour-next" @click="$emit('finish')">{{ step.finishLabel || 'Finish' }}</button>
          </div>
        </div>
        <span class="tour-count">{{ index + 1 }} / {{ total }}</span>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  step: { type: Object, required: true }, // { target?, title, description, placement?, finishLabel? }
  index: { type: Number, required: true },
  total: { type: Number, required: true },
})
const emit = defineEmits(['next', 'back', 'skip', 'finish'])

const PAD = 8 // breathing room around the highlighted element
const GAP = 14 // distance between the highlight and the tooltip
const CARD_W = 340
const CARD_H = 340 // rough estimate for placement math (card is auto-height; instructional steps are tall)

const rect = ref(null) // { top, left, width, height } of the padded target
const cardStyle = ref({})

const hasTarget = computed(() => !!props.step?.target)

// The sidebar is rendered twice (desktop + mobile drawer), so a selector can match a
// hidden duplicate. Pick the first match that's actually visible on screen.
function firstVisible(selector) {
  const els = document.querySelectorAll(selector)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if ((r.width > 0 || r.height > 0) && el.offsetParent !== null) return el
  }
  return els[0] || null
}

// Resolve the target element, retrying briefly in case a route change hasn't painted it yet.
function findTarget(attempt = 0) {
  if (!hasTarget.value) {
    rect.value = null
    placeCard(null)
    return
  }
  const el = firstVisible(props.step.target)
  if (!el) {
    if (attempt < 20) { setTimeout(() => findTarget(attempt + 1), 60); return }
    // Give up → fall back to a centered card so the step is never lost.
    rect.value = null
    placeCard(null)
    return
  }
  // Bring it into view (sidebar items rarely need it, but content anchors might).
  try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }) } catch { /* ignore */ }
  nextTick(() => measure(el))
}

function measure(el) {
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) { rect.value = null; placeCard(null); return }
  rect.value = {
    top: Math.max(4, r.top - PAD),
    left: Math.max(4, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
  placeCard(rect.value)
}

// Pick the side with the most room: right → bottom → top → left → centered.
function placeCard(target) {
  if (!target) {
    cardStyle.value = {}
    return
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const style = {}

  const spaceRight = vw - (target.left + target.width)
  const spaceBelow = vh - (target.top + target.height)

  if (spaceRight >= CARD_W + GAP) {
    style.left = `${target.left + target.width + GAP}px`
    style.top = `${clamp(target.top, 8, vh - CARD_H - 8)}px`
  } else if (spaceBelow >= CARD_H + GAP) {
    style.top = `${target.top + target.height + GAP}px`
    style.left = `${clamp(target.left, 8, vw - CARD_W - 8)}px`
  } else if (target.top >= CARD_H + GAP) {
    style.top = `${target.top - CARD_H - GAP}px`
    style.left = `${clamp(target.left, 8, vw - CARD_W - 8)}px`
  } else {
    // Last resort: pin to the right edge, vertically centered.
    style.left = `${vw - CARD_W - 16}px`
    style.top = `${clamp((vh - CARD_H) / 2, 8, vh - CARD_H - 8)}px`
  }
  cardStyle.value = style
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Re-measure on scroll/resize so the spotlight tracks layout shifts.
function reflow() {
  if (!hasTarget.value) return
  const el = firstVisible(props.step.target)
  if (el) measure(el)
}

const onKey = (e) => {
  if (e.key === 'Escape') { e.preventDefault(); emit('skip') }
}

onMounted(() => {
  findTarget()
  window.addEventListener('resize', reflow)
  window.addEventListener('scroll', reflow, true)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', reflow)
  window.removeEventListener('scroll', reflow, true)
  window.removeEventListener('keydown', onKey)
})

// Re-resolve whenever the step changes.
watch(() => props.step, () => findTarget(), { deep: true })
</script>

<style scoped>
.tour-root { position: fixed; inset: 0; z-index: 4000; font-family: var(--vm-font-sans); }
.tour-catcher { position: fixed; inset: 0; background: transparent; }

.tour-hole {
  position: fixed;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 3px var(--vm-violet, #7c3aed);
  pointer-events: none;
  transition: top .25s var(--vm-ease2, ease), left .25s var(--vm-ease2, ease),
              width .25s var(--vm-ease2, ease), height .25s var(--vm-ease2, ease);
}

.tour-card {
  position: fixed;
  width: 340px;
  max-width: calc(100vw - 32px);
  padding: 18px 18px 16px;
  background: var(--vm-surface, #fff);
  border: 1.5px solid var(--vm-line, #e7eaf0);
  border-radius: 16px;
  box-shadow: var(--vm-shadow-l, 0 20px 50px rgba(15, 23, 42, .25));
  animation: tourPop .28s var(--vm-ease, cubic-bezier(.2,.8,.2,1)) both;
}
.tour-card.centered {
  /* No target → dim the whole screen and center the card. */
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  box-shadow: var(--vm-shadow-l, 0 20px 50px rgba(15, 23, 42, .25)), 0 0 0 9999px rgba(15, 23, 42, 0.55);
}

.tour-progress { display: flex; gap: 6px; margin-bottom: 12px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-line-2, #cbd5e1); transition: all .2s; }
.dot.on { width: 20px; border-radius: 99px; background: var(--vm-g-brand, linear-gradient(90deg,#7c3aed,#0ea5e9)); }

.tour-title {
  font-family: var(--vm-font-display, inherit);
  font-size: 1.0625rem; font-weight: 700; color: var(--vm-ink, #0f172a); margin: 0 0 6px;
}
.tour-desc { font-size: 0.875rem; line-height: 1.5; color: var(--vm-ink-soft, #475569); margin: 0 0 12px; }

.tour-howto { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.tour-howto li {
  display: flex; align-items: flex-start; gap: 9px;
  font-size: 0.8125rem; line-height: 1.4; color: var(--vm-ink, #0f172a);
}
.tour-howto .hn {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 18px; height: 18px; margin-top: 1px; border-radius: 50%;
  font-size: 0.6875rem; font-weight: 700; color: #fff;
  background: var(--vm-g-brand, linear-gradient(135deg,#7c3aed,#0ea5e9));
}
.tour-howto :deep(strong), .tour-howto :deep(b) { font-weight: 700; color: var(--vm-violet-d, #6d28d9); }

.tour-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tour-nav { display: flex; align-items: center; gap: 8px; }
.tour-skip {
  font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink-faint, #94a3b8);
  background: none; border: none; cursor: pointer; padding: 6px 2px;
}
.tour-skip:hover { color: var(--vm-ink-soft, #475569); }
.tour-back {
  font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink-soft, #475569); cursor: pointer;
  background: var(--vm-glass-strong, #f1f5f9); border: 1px solid var(--vm-line, #e7eaf0);
  border-radius: 10px; padding: 8px 14px;
}
.tour-back:hover { background: var(--vm-bg, #e2e8f0); }
.tour-next {
  font-size: 0.8125rem; font-weight: 700; color: #fff; cursor: pointer;
  background: var(--vm-g-cool, linear-gradient(90deg,#0ea5e9,#7c3aed)); border: none;
  border-radius: 10px; padding: 8px 16px; box-shadow: var(--vm-glow-v, 0 6px 16px rgba(124,58,237,.3));
  transition: transform .15s var(--vm-ease, ease);
}
.tour-next:hover { transform: translateY(-1px); }
.tour-count {
  position: absolute; top: 16px; right: 18px;
  font-size: 0.6875rem; font-weight: 700; color: var(--vm-ink-faint, #94a3b8);
}

@keyframes tourPop {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.tour-card.centered { animation: none; }
</style>
