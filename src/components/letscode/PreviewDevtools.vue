<template>
  <section class="pd" aria-label="Console and network">
    <div class="pd-bar">
      <div class="pd-tabs" role="tablist" aria-label="Preview tools">
        <button type="button" role="tab" class="pd-tab" :class="{ on: tab === 'console' }" :aria-selected="tab === 'console' ? 'true' : 'false'"
                @click="tab = 'console'">
          Console<span v-if="errorCount" class="pd-count err" :aria-label="`${errorCount} errors`">{{ errorCount }}</span>
        </button>
        <button type="button" role="tab" class="pd-tab" :class="{ on: tab === 'network' }" :aria-selected="tab === 'network' ? 'true' : 'false'"
                @click="tab = 'network'">
          Network<span v-if="network.length" class="pd-count" aria-hidden="true">{{ network.length }}</span>
        </button>
      </div>
      <label class="pd-filter">
        <span class="sr-only">{{ tab === 'console' ? 'Filter the console' : 'Filter the requests' }}</span>
        <Icon icon="lucide:filter" aria-hidden="true" />
        <input v-model="query" type="search" name="preview-filter" autocomplete="off" spellcheck="false"
               :placeholder="tab === 'console' ? 'Filter messages…' : 'Filter by address or method…'" />
      </label>
      <label v-if="tab === 'console'" class="pd-level">
        <span class="sr-only">Which messages</span>
        <select v-model="level">
          <option value="all">All levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info and logs</option>
        </select>
      </label>
      <label v-else class="pd-check">
        <input v-model="failedOnly" type="checkbox" name="preview-failed" />
        <span>Failed only</span>
      </label>
      <button type="button" class="pd-tool" :aria-label="tab === 'console' ? 'Clear the console' : 'Clear the requests'"
              title="Clear" @click="clear">
        <Icon icon="lucide:ban" aria-hidden="true" />
      </button>
    </div>

    <div v-if="tab === 'network'" class="pd-head" aria-hidden="true">
      <span class="c-method">Method</span><span class="c-url">Address</span><span class="c-status">Status</span>
      <span class="c-type">Type</span><span class="c-ms">Time</span><span class="c-size">Size</span>
    </div>
    <div ref="scroller" class="pd-list vm-scroll" role="tabpanel" :aria-label="tab === 'console' ? 'Console messages' : 'Network requests'"
         tabindex="0" @scroll="onScroll">
      <p v-if="!shown.length" class="pd-empty">{{ emptyText }}</p>
      <ul v-else class="pd-rows" :style="{ height: `${shown.length * rowHeight}px` }">
        <li v-for="item in windowed" :key="item.entry.id" class="pd-row-li" :style="{ top: `${item.index * rowHeight}px`, height: `${rowHeight}px` }"
            :aria-setsize="shown.length" :aria-posinset="item.index + 1">
          <button v-if="tab === 'console'" type="button" class="pd-row" :class="[item.entry.level, { on: picked === item.entry.id, mark: item.entry.mark }]"
                  @click="pick(item.entry)">
            <span class="c-time">{{ formatTime(item.entry.at) }}</span>
            <Icon v-if="!item.entry.mark" :icon="levelIcon(item.entry.level)" class="c-ic" aria-hidden="true" />
            <span class="sr-only">{{ item.entry.mark ? '' : item.entry.level }}</span>
            <span class="c-text" translate="no">{{ item.entry.text }}</span>
          </button>
          <button v-else type="button" class="pd-row net" :class="{ on: picked === item.entry.id, bad: failed(item.entry) }" @click="pick(item.entry)">
            <span class="c-method">{{ item.entry.method }}</span>
            <span class="c-url" translate="no">{{ item.entry.url }}</span>
            <span class="c-status">{{ item.entry.status == null ? (item.entry.error ? 'failed' : '—') : (item.entry.status || 'failed') }}</span>
            <span class="c-type">{{ item.entry.type }}</span>
            <span class="c-ms">{{ item.entry.ms == null ? '—' : `${item.entry.ms} ms` }}</span>
            <span class="c-size">{{ formatSize(item.entry.size) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="detail" class="pd-detail" role="region" aria-label="The selected entry">
      <button type="button" class="pd-tool pd-close" aria-label="Close the details" title="Close" @click="picked = null">
        <Icon icon="lucide:x" aria-hidden="true" />
      </button>
      <pre v-if="tab === 'console'" class="pd-full" translate="no">{{ detail.text }}</pre>
      <dl v-else class="pd-facts">
        <dt>Address</dt><dd translate="no">{{ detail.url }}</dd>
        <dt>Method</dt><dd>{{ detail.method }}</dd>
        <dt>Status</dt><dd>{{ detail.status == null ? '—' : (detail.status || 'failed') }}<template v-if="detail.error"> ({{ detail.error }})</template></dd>
        <dt>Type</dt><dd>{{ detail.type }}</dd>
        <dt>Time</dt><dd>{{ detail.ms == null ? '—' : `${detail.ms} ms` }}, at {{ formatTime(detail.at) }}</dd>
        <dt>Size</dt><dd>{{ formatSize(detail.size) }}</dd>
      </dl>
    </div>
  </section>
</template>

<script setup>
// The Preview tab's Console and Network panes (ADM-1318). Every entry is kept (never capped); a long list draws only
// the rows in view. The entries come from the app's own page (PreviewPanel checks each message); they are shown as text.
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { formatSize, formatTime } from './previewInspector'

const props = defineProps({
  console: { type: Array, default: () => [] },     // [{ id, level, text, at, mark? }]
  network: { type: Array, default: () => [] },     // [{ id, method, url, status, type, ms, size, at, error }]
})
const emit = defineEmits(['clear'])
const tab = defineModel('tab', { type: String, default: 'console' })

const query = ref('')
const level = ref('all')
const failedOnly = ref(false)
const picked = ref(null)
const scroller = ref(null)
const scrollTop = ref(0)
const viewHeight = ref(0)
const narrow = ref(false)
const rowHeight = computed(() => (narrow.value ? 44 : 24))
const OVERSCAN = 10

const errorCount = computed(() => props.console.reduce((n, e) => n + (e.level === 'error' ? 1 : 0), 0))
const failed = (e) => e.status === 0 || (e.status != null && e.status >= 400) || !!e.error
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (tab.value === 'console') {
    const want = level.value
    return props.console.filter((e) => (want === 'all' || e.mark || (want === 'info' ? ['log', 'info', 'debug'].includes(e.level) : e.level === want))
      && (!q || e.text.toLowerCase().includes(q)))
  }
  return props.network.filter((e) => (!failedOnly.value || failed(e))
    && (!q || e.url.toLowerCase().includes(q) || e.method.toLowerCase().includes(q)))
})
const windowed = computed(() => {
  const h = rowHeight.value
  const start = Math.max(0, Math.floor(scrollTop.value / h) - OVERSCAN)
  const count = Math.ceil((viewHeight.value || 480) / h) + OVERSCAN * 2
  return shown.value.slice(start, start + count).map((entry, i) => ({ entry, index: start + i }))
})
const detail = computed(() => (picked.value == null ? null
  : (tab.value === 'console' ? props.console : props.network).find((e) => e.id === picked.value) || null))
const emptyText = computed(() => {
  const all = tab.value === 'console' ? props.console : props.network
  if (all.length) return 'Nothing matches the filter.'
  return tab.value === 'console' ? 'No console messages yet. The app\'s console.log, warnings and errors show here.'
    : 'No requests yet. The page\'s requests show here as it loads them.'
})

function levelIcon(l) {
  return l === 'error' ? 'lucide:circle-x' : l === 'warn' ? 'lucide:triangle-alert' : l === 'info' ? 'lucide:info' : 'lucide:chevron-right'
}
function pick(e) { picked.value = picked.value === e.id ? null : e.id }
function clear() { picked.value = null; emit('clear', tab.value) }

function measure() {
  const el = scroller.value
  if (!el) return
  scrollTop.value = el.scrollTop
  viewHeight.value = el.clientHeight
}
function onScroll() { measure() }

// New entries keep the list at its end when it was there (as browser DevTools do).
watch(() => shown.value.length, async (n, before) => {
  const el = scroller.value
  const atEnd = !el || el.scrollTop + el.clientHeight >= (before || 0) * rowHeight.value - rowHeight.value * 2
  await nextTick()
  if (atEnd && scroller.value) { scroller.value.scrollTop = n * rowHeight.value; measure() }
})
watch(tab, () => { picked.value = null; query.value = ''; nextTick(measure) })

let media = null
const onMedia = () => { narrow.value = !!media?.matches }
let resize = null
onMounted(() => {
  media = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 640px)') : null
  onMedia()
  media?.addEventListener?.('change', onMedia)
  if (typeof ResizeObserver !== 'undefined' && scroller.value) {
    resize = new ResizeObserver(measure)
    resize.observe(scroller.value)
  }
  measure()
})
onBeforeUnmount(() => { media?.removeEventListener?.('change', onMedia); resize?.disconnect() })
</script>

<style scoped>
.pd { display: flex; flex-direction: column; min-height: 0; height: 100%; background: var(--vm-surface); }
.pd-bar { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-bottom: 1px solid var(--vm-line); flex: 0 0 auto; flex-wrap: wrap; }
.pd-tabs { display: flex; gap: 2px; }
.pd-tab {
  display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 10px; border: none; border-radius: 6px;
  background: transparent; color: var(--vm-ink-soft); font: 600 12px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, color .15s;
}
.pd-tab:hover { color: var(--vm-ink); background: color-mix(in srgb, var(--vm-ink) 6%, transparent); }
.pd-tab.on { color: var(--vm-ink); background: color-mix(in srgb, var(--vm-violet) 14%, transparent); }
.pd-count { min-width: 18px; padding: 0 5px; border-radius: 9px; background: color-mix(in srgb, var(--vm-ink) 12%, transparent); font: 600 10.5px var(--vm-font-mono); text-align: center; font-variant-numeric: tabular-nums; }
.pd-count.err { background: var(--vm-danger); color: #fff; }
.pd-filter { display: flex; align-items: center; gap: 4px; flex: 1 1 160px; min-width: 120px; color: var(--vm-ink-faint); }
.pd-filter :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.pd-filter input, .pd-level select {
  width: 100%; min-height: 26px; padding: 0 6px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface);
  color: var(--vm-ink); font: 12px var(--vm-font-sans);
}
.pd-level select { width: auto; cursor: pointer; }
.pd-level select option { background: var(--vm-surface); color: var(--vm-ink); }
.pd-check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--vm-ink-soft); cursor: pointer; }
.pd-tool {
  display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; flex: 0 0 auto;
}
.pd-tool:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.pd-tool :deep(svg) { width: 14px; height: 14px; }
.pd-tab:focus-visible, .pd-tool:focus-visible, .pd-row:focus-visible, .pd-filter input:focus-visible, .pd-level select:focus-visible,
.pd-check input:focus-visible, .pd-list:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: -2px; }
.pd-head, .pd-row.net { display: grid; grid-template-columns: 64px minmax(0, 1fr) 56px 76px 64px 70px; gap: 8px; align-items: center; }
.pd-head { padding: 2px 10px; border-bottom: 1px solid var(--vm-line); font: 600 11px var(--vm-font-sans); color: var(--vm-ink-faint); flex: 0 0 auto; }
.pd-list { flex: 1 1 auto; min-height: 0; overflow: auto; position: relative; overscroll-behavior: contain; }
.pd-empty { margin: 10px 12px; font-size: 12.5px; color: var(--vm-ink-faint); line-height: 1.5; }
.pd-rows { position: relative; list-style: none; margin: 0; padding: 0; }
.pd-row-li { position: absolute; left: 0; right: 0; }
.pd-row {
  width: 100%; height: 100%; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: none; border-bottom: 1px solid color-mix(in srgb, var(--vm-line) 60%, transparent);
  background: transparent; color: var(--vm-ink); font: 12px/1 var(--vm-font-mono); text-align: left; cursor: pointer; transition: background-color .15s;
}
.pd-row:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.pd-row.on { background: color-mix(in srgb, var(--vm-violet) 14%, transparent); }
.pd-row.warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.pd-row.error, .pd-row.bad { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.pd-row.mark { color: var(--vm-ink-faint); font-family: var(--vm-font-sans); font-style: italic; }
.c-time { color: var(--vm-ink-faint); flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.c-ic { width: 12px; height: 12px; flex: 0 0 auto; }
.c-text, .c-url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-text { flex: 1 1 auto; }
.c-status, .c-ms, .c-size { font-variant-numeric: tabular-nums; text-align: right; }
.c-type, .c-method { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-detail { position: relative; flex: 0 0 auto; max-height: 40%; overflow: auto; border-top: 1px solid var(--vm-line); padding: 6px 34px 6px 10px; }
.pd-close { position: absolute; top: 4px; right: 4px; }
.pd-full { margin: 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.5 var(--vm-font-mono); color: var(--vm-ink); user-select: text; }
.pd-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 12px; margin: 0; font-size: 12px; }
.pd-facts dt { color: var(--vm-ink-faint); }
.pd-facts dd { margin: 0; word-break: break-all; color: var(--vm-ink); font-family: var(--vm-font-mono); }
.pd-tab, .pd-tool, .pd-row, .pd-check { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.pd-detail { overscroll-behavior: contain; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .pd-tab, .pd-filter input, .pd-level select { min-height: 44px; }
  .pd-tool { width: 44px; height: 44px; }
  .pd-check { min-height: 44px; }
  .pd-head { display: none; }
  .pd-row.net { grid-template-columns: 52px minmax(0, 1fr) 48px; }
  .pd-row.net .c-type, .pd-row.net .c-ms, .pd-row.net .c-size { display: none; }
}
@media (prefers-reduced-motion: reduce) { .pd-tab, .pd-tool, .pd-row { transition: none; } }
</style>
