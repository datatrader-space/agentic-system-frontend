<!--
  A step's output as a tree (ADM-1333, plan §3.3), on vue-json-pretty 2.6.0.

    <OutputTree :value="output" base="nodes.fetch.output" mode="schema" label="Fetch page" @pick="insert" />

  NOTHING IS CUT (owner's rule). Every key and every list item is drawn; a large value (more rows than
  `virtualThreshold`) is drawn with virtual scrolling instead of being shortened. The old tree showed only the first
  five items of a list.

  mode 'json' shows the values; 'schema' shows each key's type, a list as its merged item (`items[0].sku`).
  When `base` is set, every row that the engine can address carries an "Insert" button: Enter or a click emits
  pick(token), and the button (or the key) can be dragged into a field (drag payload WF_VAR_MIME and text/plain).
  Nothing here closes or unmounts on dragstart (F19): Chrome cancels a drag whose source leaves the page.
  Emits: pick(token), drag-start(token), drag-end().

  IMAGES (ADM-1351). In the values view, every image in the value is shown above the tree as a thumbnail, and every
  detections value as its image with the boxes drawn on it and "N objects: ..." in words (WfImagePreview). Nothing is
  cut: a step that made 50 crops shows 50 thumbnails. The registry's samples ('(image)') are shapes and show none.
-->
<template>
  <div class="otree" :class="{ 'otree--virtual': virtual }" :aria-label="label || undefined" role="group">
    <p v-if="value === undefined" class="otree-empty">No value.</p>
    <ul v-if="media.length" class="otree-media" :class="{ 'otree-media--grid': media.every((m) => m.kind === 'image') }" aria-label="Images">
      <li v-for="m in media" :key="m.path">
        <WfImagePreview
          :image="m.kind === 'image' ? m.value : null" :detections="m.kind === 'detections' ? m.value : null"
          :label="m.path"
        />
      </li>
    </ul>
    <VueJsonPretty
      v-if="value !== undefined"
      :data="shown"
      :deep="Infinity"
      :show-length="true"
      :show-icon="true"
      :show-line="true"
      :virtual="virtual"
      :height="height"
      :item-height="22"
      :dynamic-height="true"
      :theme="theme"
      :render-node-key="renderKey"
      :render-node-actions="insertable && base ? renderActions : false"
    />
  </div>
</template>

<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import { Icon } from '@iconify/vue'
import { WF_VAR_MIME, countRows, prettyPathToEngine, schemaOf, tokenFor } from './wfNodeModalModel'
import WfImagePreview from './WfImagePreview.vue'
import { findMedia } from '@/utils/wfImages'

const props = defineProps({
  value: { type: null, default: undefined },
  base: { type: String, default: '' },
  mode: { type: String, default: 'json', validator: (v) => ['json', 'schema'].includes(v) },
  label: { type: String, default: '' },
  insertable: { type: Boolean, default: true },
  virtualThreshold: { type: Number, default: 200 },
  height: { type: Number, default: 320 },
  // Show the value's images above the tree (values view only).
  images: { type: Boolean, default: true },
})
const emit = defineEmits(['pick', 'drag-start', 'drag-end'])

const shown = computed(() => (props.mode === 'schema' ? schemaOf(props.value) : props.value))
const virtual = computed(() => countRows(shown.value) > props.virtualThreshold)
const media = computed(() => (props.images && props.mode === 'json' && props.value !== undefined ? findMedia(props.value) : []))

// The app's theme, so the library's own colours (overridden below with tokens) never fight it.
const theme = ref('light')
let observer = null
function readTheme() { theme.value = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }
onMounted(() => {
  readTheme()
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(readTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
})
onBeforeUnmount(() => observer?.disconnect())

function tokenOf(node) {
  if (!node || /End$/.test(node.type)) return null
  const path = prettyPathToEngine(node.path)
  return path === null ? null : tokenFor(props.base, path)
}

function dragHandlers(token) {
  return {
    draggable: 'true',
    onDragstart: (e) => {
      e.dataTransfer.setData(WF_VAR_MIME, token)
      e.dataTransfer.setData('text/plain', token)
      e.dataTransfer.effectAllowed = 'copy'
      emit('drag-start', token)
    },
    onDragend: () => emit('drag-end'),
  }
}

function renderKey({ node, defaultKey }) {
  const token = props.insertable && props.base ? tokenOf(node) : null
  if (!token) return defaultKey
  return h('span', { class: 'otree-key', title: token, ...dragHandlers(token) }, defaultKey)
}

function renderActions({ node }) {
  const token = tokenOf(node)
  if (!token) return null
  return h('button', {
    type: 'button',
    class: 'otree-insert',
    'aria-label': `Insert ${token}`,
    title: `Insert ${token}`,
    'data-token': token,
    ...dragHandlers(token),
    onClick: (e) => { e.stopPropagation(); emit('pick', token) },
  }, [h(Icon, { icon: 'lucide:corner-down-left', 'aria-hidden': 'true' })])
}
</script>

<style scoped>
.otree { min-width: 0; font-size: 12px; color: var(--vm-ink); }
.otree-empty { margin: 0; padding: 6px 2px; color: var(--vm-ink-faint); }
.otree-media { display: grid; gap: 10px; margin: 0 0 8px; padding: 0; list-style: none; }
.otree-media--grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); align-items: start; }
.otree :deep(.vjs-tree) { font-family: var(--vm-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 1.5; }
.otree :deep(.vjs-tree-node) { position: relative; align-items: flex-start; border-radius: 4px; padding-right: 2px; }
.otree :deep(.vjs-tree-node:hover), .otree :deep(.vjs-tree-node.is-highlight), .otree :deep(.vjs-tree-node.dark:hover) { background-color: var(--vm-surface-soft); }
.otree :deep(.vjs-key) { color: var(--vm-ink-soft); }
.otree :deep(.vjs-value) { overflow-wrap: anywhere; white-space: pre-wrap; }
.otree :deep(.vjs-value-string) { color: var(--vm-green-ink); }
.otree :deep(.vjs-value-number), .otree :deep(.vjs-value-boolean) { color: var(--vm-link); }
.otree :deep(.vjs-value-null), .otree :deep(.vjs-value-undefined) { color: var(--vm-violet-ink); }
.otree :deep(.vjs-comment), .otree :deep(.vjs-tree-brackets) { color: var(--vm-ink-faint); }
.otree :deep(.vjs-tree-brackets:hover), .otree :deep(.vjs-carets:hover) { color: var(--vm-link); }
.otree :deep(.vjs-indent-unit.has-line) { border-left-color: var(--vm-line-2); }
/* The insert button is always shown (a hidden button cannot be reached by keyboard). */
.otree :deep(.vjs-tree-node .vjs-tree-node-actions) {
  display: inline-flex; position: static; margin-left: auto; padding: 0; background: none;
}
.otree :deep(.otree-key) { cursor: grab; }
.otree :deep(.otree-insert) {
  display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 4px;
  background: none; color: var(--vm-ink-faint); cursor: grab;
}
.otree :deep(.otree-insert svg) { width: 14px; height: 14px; }
.otree :deep(.otree-insert:hover) { color: var(--vm-link); border-color: var(--vm-primary-line); background: var(--vm-primary-soft); }
.otree :deep(.otree-insert:focus-visible) { outline: 2px solid var(--vm-focus); outline-offset: 1px; color: var(--vm-link); }
.otree--virtual :deep(.vjs-tree) { overscroll-behavior: contain; }
@media (pointer: coarse) { .otree :deep(.otree-insert) { width: 44px; height: 44px; } }
</style>
