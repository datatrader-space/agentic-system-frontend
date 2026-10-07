<template>
  <!-- "The agent is using a browser": a small picture of the page, where it is, and a way to watch.
       Drawn once per conversation above the messages, not once per tool call. -->
  <button class="blc" type="button" :class="{ on: browser.open, wait: browser.needsPerson }"
          :aria-pressed="browser.open" data-test="bl-card" @click="browser.toggle()">
    <span class="blc-thumb" aria-hidden="true">
      <img v-if="thumbOk" :key="browser.thumbTick" :src="browser.thumbUrl" alt="" draggable="false"
           data-test="bl-card-thumb" @error="thumbOk = false" />
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
    </span>
    <span class="blc-text">
      <span class="blc-site" data-test="bl-card-site">{{ site }}</span>
      <span class="blc-state" data-test="bl-card-state">
        <span class="blc-dot" :class="dot"></span>{{ browser.label }}
      </span>
    </span>
    <span class="blc-cta">{{ browser.open ? 'Hide' : (browser.needsPerson ? 'Open' : 'Watch') }}</span>
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
.blc { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 420px; margin: 8px auto 0; padding: 8px 12px 8px 8px; text-align: left;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a);
  cursor: pointer; box-shadow: var(--vm-shadow-s, 0 1px 2px rgba(15, 23, 42, .06)); }
.blc:hover { border-color: var(--vm-violet, #2563eb); }
.blc.on { border-color: var(--vm-violet, #2563eb); background: var(--vm-violet-soft, #eef2ff); }
.blc.wait { border-color: #f59e0b; }
.blc:focus-visible { outline: 2px solid var(--vm-violet, #2563eb); outline-offset: 2px; }

.blc-thumb { flex: 0 0 auto; width: 72px; height: 45px; border-radius: 7px; overflow: hidden; display: grid; place-items: center;
  background: var(--vm-surface-2, #f1f5f9); border: 1px solid var(--vm-line-2, #e5e7eb); color: var(--vm-ink-soft, #64748b); }
.blc-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.blc-thumb svg { width: 20px; height: 20px; }

.blc-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.blc-site { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blc-state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.blc-dot { width: 7px; height: 7px; border-radius: 9999px; background: var(--vm-ink-soft, #94a3b8); }
.blc-dot.on { background: #16a34a; }
.blc-dot.wait { background: #f59e0b; }
.blc-dot.you { background: var(--vm-violet, #2563eb); }

.blc-cta { flex: 0 0 auto; font-size: 12px; font-weight: 700; color: var(--vm-violet-d, #1d4ed8); }
</style>
