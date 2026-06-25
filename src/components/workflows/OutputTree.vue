<template>
  <div class="otree" :style="{ '--d': depth }">
    <div class="otree-row" draggable="true" @dragstart="onDrag" @click="$emit('pick', expr)" :title="expr">
      <button v-if="expandable" class="otree-caret" @click.stop="expanded = !expanded">{{ expanded ? '▾' : '▸' }}</button>
      <span v-else class="otree-caret otree-dot">·</span>
      <span class="otree-key">{{ node.key }}</span>
      <span class="otree-type" :class="'t-' + type">{{ type }}</span>
      <span class="otree-val">{{ preview }}</span>
      <button v-if="type === 'array' && node.value.length" class="otree-first" @click.stop="$emit('pick', firstExpr)"
        title="Insert first item">.first</button>
    </div>
    <div v-if="expandable && expanded" class="otree-children">
      <OutputTree v-for="(c, i) in children" :key="i" :node="c" :base="base" :depth="depth + 1"
        @pick="$emit('pick', $event)" @dragvar="$emit('dragvar', $event)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { valType, isExpandable, previewValue, varExpr, joinKey, joinIndex, firstOf } from '../../utils/wfVarExpr'

const props = defineProps({
  // { key: displayName, value: any, path: relativePathFromBase }
  node: { type: Object, required: true },
  base: { type: String, required: true },   // e.g. 'nodes.n_x.output' | 'trigger' | 'item'
  depth: { type: Number, default: 0 },
})
const emit = defineEmits(['pick', 'dragvar'])

const expanded = ref(props.depth < 1)   // root expanded, deeper collapsed
const type = computed(() => valType(props.node.value))
const expandable = computed(() => isExpandable(props.node.value))
const preview = computed(() => previewValue(props.node.value))
const expr = computed(() => varExpr(props.base, props.node.path))
const firstExpr = computed(() => varExpr(props.base, firstOf(props.node.path)))

const children = computed(() => {
  const v = props.node.value
  if (Array.isArray(v)) {
    return v.slice(0, 5).map((item, i) => ({ key: `[${i}]`, value: item, path: joinIndex(props.node.path, i) }))
  }
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([k, val]) => ({ key: k, value: val, path: joinKey(props.node.path, k) }))
  }
  return []
})

function onDrag(e) {
  e.dataTransfer.setData('text/plain', expr.value)
  e.dataTransfer.setData('application/x-wf-var', expr.value)
  e.dataTransfer.effectAllowed = 'copy'
  emit('dragvar', expr.value)   // lets the picker close so the field behind is a drop target
}
</script>

<style scoped>
.otree-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 6px; cursor: grab; font-size: 12px; }
.otree-row:hover { background: #f5f3ff; }
.otree-caret { width: 14px; flex-shrink: 0; font-size: 9px; color: #94a3b8; }
.otree-dot { cursor: default; color: #cbd5e1; }
.otree-key { font-family: ui-monospace, Menlo, monospace; font-weight: 600; color: #334155; flex-shrink: 0; }
.otree-type { font-size: 8.5px; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; background: #f1f5f9; color: #94a3b8; flex-shrink: 0; }
.otree-type.t-string { color: #15803d; background: #f0fdf4; }
.otree-type.t-number { color: #1d4ed8; background: #eff6ff; }
.otree-type.t-boolean { color: #b45309; background: #fffbeb; }
.otree-type.t-array, .otree-type.t-object { color: #7c3aed; background: #f5f3ff; }
.otree-val { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.otree-first { flex-shrink: 0; font-size: 9px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 1px 5px; }
.otree-first:hover { background: #d1fae5; }
.otree-children { margin-left: 12px; border-left: 1px dashed #e2e8f0; padding-left: 4px; }
</style>
