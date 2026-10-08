<template>
  <!-- LOOKING BACK (BROWSER_LIVE_VIEW_PLAN.md, section 6). One mark for every action the agent's browser
       took, in order. A mark with a picture can be stepped to; the pane then shows the page as that action
       left it. LIVE at the end goes back to the page as it is now. Nothing here can drive the browser. -->
  <div v-if="browser.timeline.length" class="bs" data-test="bl-scrubber">
    <div ref="trackEl" class="bs-track" role="listbox" aria-orientation="horizontal"
         aria-label="What the browser did, in order" tabindex="0"
         @keydown.left.prevent="browser.step(-1)" @keydown.right.prevent="browser.step(1)"
         @keydown.end.prevent="browser.backToLive()" @keydown.esc.prevent="browser.backToLive()">
      <button v-for="a in browser.timeline" :key="a.action_id" type="button" role="option"
              class="bs-mark" :class="{ pic: a.keyframe, on: a.action_id === browser.viewing, bad: failed(a) }"
              :disabled="!a.keyframe" :aria-selected="a.action_id === browser.viewing"
              :aria-label="tip(a)" :title="tip(a)" tabindex="-1" data-test="bl-mark"
              @click="browser.view(a.action_id)"></button>
    </div>
    <span class="bs-count" data-test="bl-count">{{ position }}</span>
    <button type="button" class="bs-live" :class="{ on: !browser.viewing }" :aria-pressed="!browser.viewing"
            data-test="bl-back-live" @click="browser.backToLive()">LIVE</button>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useBrowserStore } from '../../stores/useBrowserStore'

const browser = useBrowserStore()
const trackEl = ref(null)

// How an action ended, as far as a mark needs to say: it went through, or it did not.
const FAILED = new Set(['PROVEN_NOT_APPLIED', 'UNRESOLVED', 'BLOCKED', 'OUTCOME_UNKNOWN'])
const failed = (a) => FAILED.has(a.state)

function tip(a) {
  const where = a.title || a.address
  const what = where ? `${a.label} · ${where}` : a.label
  if (failed(a)) return `${what} (it did not go through)`
  return a.keyframe ? what : `${what} (no picture kept)`
}

// "3 of 7" among the pictured actions while looking back; how many steps there are while live.
const position = computed(() => {
  const marks = browser.pictured
  if (!browser.viewing) return `${browser.timeline.length} ${browser.timeline.length === 1 ? 'step' : 'steps'}`
  return `${marks.findIndex((a) => a.action_id === browser.viewing) + 1} of ${marks.length}`
})

// The newest marks are the ones a person wants in view; keep the end of the strip on screen as it grows,
// unless they are looking back, where the strip stays where they put it.
watch(() => browser.timeline.length, async () => {
  if (browser.viewing) return
  await nextTick()
  const el = trackEl.value
  if (el) el.scrollLeft = el.scrollWidth
})
</script>

<style scoped>
.bs { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-top: 1px solid var(--vm-line-2, #e5e7eb);
  background: var(--vm-surface, #fff); }
.bs-track { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 4px; overflow-x: auto; padding: 4px 2px;
  scrollbar-width: thin; border-radius: 8px; outline: none; }
.bs-track:focus-visible { box-shadow: 0 0 0 2px rgba(37, 99, 235, .35); }
.bs-mark { flex: 0 0 auto; width: 10px; height: 18px; padding: 0; border: 0; border-radius: 3px; cursor: default;
  background: var(--vm-line-2, #e2e8f0); }
.bs-mark.pic { cursor: pointer; background: var(--vm-ink-soft, #94a3b8); }
.bs-mark.pic:hover { background: var(--vm-ink, #475569); }
.bs-mark.bad { background: #fca5a5; }
.bs-mark.pic.bad { background: #ef4444; }
.bs-mark.on { background: var(--vm-violet, #2563eb); height: 24px; box-shadow: 0 0 0 3px rgba(37, 99, 235, .2); }
.bs-mark:focus-visible { outline: 2px solid var(--vm-violet, #2563eb); outline-offset: 2px; }
.bs-count { flex: 0 0 auto; font-size: 11.5px; color: var(--vm-ink-soft, #64748b); font-variant-numeric: tabular-nums; white-space: nowrap; }
.bs-live { flex: 0 0 auto; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; padding: 4px 9px; border-radius: 9999px; cursor: pointer;
  border: 1px solid var(--vm-line-2, #cbd5e1); background: var(--vm-surface, #fff); color: var(--vm-ink-soft, #64748b); }
.bs-live.on { background: #0f172a; border-color: #0f172a; color: #fff; }
.bs-live:focus-visible { outline: 2px solid var(--vm-violet, #2563eb); outline-offset: 2px; }

@media (max-width: 480px) {
  .bs { padding: 8px; gap: 8px; }
  .bs-mark { width: 12px; height: 22px; }
}
</style>
