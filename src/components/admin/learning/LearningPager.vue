<!-- The pager under a Learning Monitor list: which rows are showing, 10 or 15 per page, and page buttons.
     `of` is how many exist when the API sent only the latest of them, so a list never looks complete when it
     is not. Hidden when everything fits on one page of the smallest size. -->
<template>
  <nav v-if="total > PAGE_SIZES[0]" class="pager" :aria-label="`${label} pages`">
    <span class="pager-range">
      {{ from }}–{{ to }} of {{ total }}<template v-if="of && of > total"> · latest {{ total }} of {{ of }}</template>
    </span>
    <label class="pager-size">
      <span>Rows</span>
      <select :value="size" :aria-label="`${label}: rows per page`" @change="$emit('update:size', Number($event.target.value))">
        <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>
    <div class="pager-buttons">
      <button type="button" :disabled="page <= 1" aria-label="Previous page" @click="$emit('update:page', page - 1)">‹</button>
      <button
        v-for="n in shownPages" :key="n.key" type="button"
        :class="{ active: n.page === page, gap: !n.page }" :disabled="!n.page"
        :aria-current="n.page === page ? 'page' : undefined"
        :aria-label="n.page ? `Page ${n.page}` : undefined"
        @click="n.page && $emit('update:page', n.page)"
      >{{ n.page || '…' }}</button>
      <button type="button" :disabled="page >= pages" aria-label="Next page" @click="$emit('update:page', page + 1)">›</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { PAGE_SIZES } from './usePaged'

const props = defineProps({
  page: { type: Number, required: true },
  size: { type: Number, required: true },
  total: { type: Number, required: true },
  of: { type: Number, default: null },     // how many exist, when more than were loaded
  label: { type: String, default: 'List' },
})
defineEmits(['update:page', 'update:size'])

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
const from = computed(() => (props.total ? (props.page - 1) * props.size + 1 : 0))
const to = computed(() => Math.min(props.total, props.page * props.size))

// First, last, and the pages around the current one; a gap marker where pages are skipped.
const shownPages = computed(() => {
  const n = pages.value
  const keep = new Set([1, n, props.page - 1, props.page, props.page + 1].filter((p) => p >= 1 && p <= n))
  const out = []
  let last = 0
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - last > 1) out.push({ key: `gap-${p}`, page: null })
    out.push({ key: `p-${p}`, page: p })
    last = p
  }
  return out
})
</script>

<style scoped>
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid var(--soft-line, #edf2f7); color: var(--muted, #64748b); font-size: 12px; }
.pager-range { font-variant-numeric: tabular-nums; }
.pager-size { display: inline-flex; align-items: center; gap: 6px; }
.pager-size select { height: 30px; padding: 0 6px; border: 1px solid #d8e1ec; border-radius: 7px; background: #fff; color: var(--ink, #0f172a); font: inherit; font-size: 12px; cursor: pointer; }
.pager-buttons { display: inline-flex; gap: 4px; margin-left: auto; }
.pager-buttons button { min-width: 30px; height: 30px; padding: 0 8px; border: 1px solid #d8e1ec; border-radius: 7px; background: #fff; color: #334155; font: inherit; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.pager-buttons button:hover:not(:disabled) { border-color: #a5b4fc; color: #4338ca; }
.pager-buttons button.active { border-color: var(--primary, #4f46e5); background: var(--primary, #4f46e5); color: #fff; }
.pager-buttons button.gap { border-color: transparent; background: transparent; cursor: default; }
.pager-buttons button:disabled:not(.gap) { opacity: .45; cursor: not-allowed; }
.pager-buttons button:focus-visible, .pager-size select:focus-visible { outline: 3px solid rgba(99, 102, 241, .35); outline-offset: 1px; }
@media (max-width: 560px) {
  .pager-buttons { width: 100%; justify-content: center; margin-left: 0; }
}
</style>
