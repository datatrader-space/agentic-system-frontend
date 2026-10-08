<template>
  <!-- "The agent is using a browser": a square preview of the page, pinned in the top corner of the chat.
       One press opens the browser view LARGE, where the page can be read, watched and taken over.
       Drawn once per conversation, not once per tool call, and out of the way of the messages: it used
       to be a wide card in the middle of the chat, above the first message. -->
  <button class="blc" type="button" :class="{ on: browser.open, wait: browser.needsPerson }"
          :title="`${site} · ${browser.label} — open the browser view`"
          :aria-label="`Open the browser view: ${site}, ${browser.label}`"
          data-test="bl-card" @click="browser.expand()">
    <span class="blc-thumb" aria-hidden="true">
      <img v-if="thumbOk" :key="browser.thumbTick" :src="browser.thumbUrl" alt="" draggable="false"
           data-test="bl-card-thumb" @error="thumbOk = false" />
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
    </span>
    <span class="blc-expand" aria-hidden="true" data-test="bl-card-expand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
    </span>
    <span class="blc-text">
      <span class="blc-site" data-test="bl-card-site">{{ site }}</span>
      <span class="blc-state" data-test="bl-card-state">
        <span class="blc-dot" :class="dot"></span>{{ browser.label }}
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useBrowserStore } from '../../stores/useBrowserStore'

const browser = useBrowserStore()

// A browser that has gone answers the thumbnail with "no content", which an <img> reports as an error.
// That is not a fault to show; the card falls back to an icon until the next picture is asked for.
const thumbOk = ref(true)
watch(() => browser.thumbTick, () => { thumbOk.value = true })

const site = computed(() => (browser.session && browser.session.site) || 'Browser')
const dot = computed(() => {
  if (browser.ended) return 'off'
  if (browser.mine) return 'you'
  if (browser.needsPerson) return 'wait'
  return 'on'
})
</script>

<style scoped>
/* A square in the chat's top corner. `.chat-workspace` is the positioned ancestor; the offset clears the
   chat header. It sits over the chat's empty margin on a wide window and stays small on a narrow one. */
.blc { position: absolute; top: 72px; right: 18px; z-index: 6; width: 132px; height: 132px; padding: 0; display: flex; flex-direction: column;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a);
  text-align: left; cursor: pointer; box-shadow: var(--vm-shadow-m, 0 8px 24px rgba(15, 23, 42, .12)); }
.blc:hover { border-color: var(--vm-violet, #2563eb); }
.blc.on { border-color: var(--vm-violet, #2563eb); }
.blc.wait { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, .25), var(--vm-shadow-m, 0 8px 24px rgba(15, 23, 42, .12)); }
.blc:focus-visible { outline: 2px solid var(--vm-violet, #2563eb); outline-offset: 2px; }

.blc-thumb { flex: 1 1 auto; min-height: 0; display: grid; place-items: center; background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); }
.blc-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
.blc-thumb svg { width: 26px; height: 26px; }

/* The expand mark: always visible, so the square reads as "this opens larger" without hovering. */
.blc-expand { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center;
  background: rgba(15, 23, 42, .72); color: #fff; }
.blc-expand svg { width: 13px; height: 13px; }
.blc:hover .blc-expand { background: var(--vm-violet, #2563eb); }

.blc-text { flex: 0 0 auto; display: flex; flex-direction: column; gap: 1px; padding: 5px 8px 6px; border-top: 1px solid var(--vm-line-2, #e5e7eb); min-width: 0; }
.blc-site { font-size: 11.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blc-state { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--vm-ink-soft, #64748b); white-space: nowrap; }
.blc-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 9999px; background: var(--vm-ink-soft, #94a3b8); }
.blc-dot.on { background: #16a34a; }
.blc-dot.wait { background: #f59e0b; }
.blc-dot.you { background: var(--vm-violet, #2563eb); }

/* A narrow window has no empty margin to sit in, so the square shrinks to a picture with its mark. */
@media (max-width: 900px) {
  .blc { width: 84px; height: 84px; top: 64px; right: 10px; }
  .blc-text { display: none; }
}
</style>
