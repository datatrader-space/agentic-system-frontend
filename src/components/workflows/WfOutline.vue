<!--
  The Outline (plan §3.6): the same workflow as a keyboard list, the non-visual equivalent of the canvas. Steps are
  listed in run order (each after the steps it waits for), with their state and where they lead. Up and Down move
  between steps, Enter opens one, and "Show" brings it into view on the canvas.
-->
<template>
  <AppSheet :open="open" title="Outline" description="Every step in run order. Up and Down move, Enter opens a step." side="right" size="md" @update:open="emit('update:open', $event)">
    <div class="wfb-root wfb-layer wfb-outline">
      <p v-if="!rows.length" class="wfb-console__empty">This workflow has no steps yet.</p>
      <ol v-else ref="listEl" class="wfb-outline__list" aria-label="Workflow steps" @keydown="onKey">
        <li v-for="(r, i) in rows" :key="r.id" class="wfb-outline__item">
          <button type="button" class="wfb-outline__open" :data-index="i" :tabindex="i === active ? 0 : -1" :aria-label="r.aria" @click="emit('open-node', r.id)" @focus="active = i">
            <span class="wfb-outline__tile" :style="{ color: `var(${r.token})`, background: `var(${r.token}-soft)` }" aria-hidden="true"><Icon :icon="r.icon" /></span>
            <span class="wfb-outline__text">
              <span class="wfb-outline__title">{{ r.title }}</span>
              <span class="wfb-outline__meta">{{ r.kind }} · {{ r.stateLabel }}<template v-if="r.next.length"> · leads to {{ r.next.join(', ') }}</template></span>
              <span v-if="r.issue" class="wfb-outline__issue">{{ r.issue }}</span>
            </span>
          </button>
          <button type="button" class="wfb-icon-btn" :aria-label="`Show ${r.title} on the canvas`" title="Show on the canvas" tabindex="-1" @click="emit('focus-node', r.id)">
            <Icon icon="lucide:locate-fixed" aria-hidden="true" />
          </button>
        </li>
      </ol>
    </div>
  </AppSheet>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'
import AppSheet from '@/components/common/AppSheet.vue'
import { WF_CATEGORIES, wfCategory, wfIcon, wfDef } from '@/config/wfNodeDefinitions'
import { NODE_STATUS_LABELS, nodeAriaLabel, nodeStatusState } from '@/utils/wfNodeView'
import { nodeTitle } from './wfNodeData'

const props = defineProps({
  open: { type: Boolean, default: false },
  doc: { type: Object, required: true },
  run: { type: Object, required: true },
})
const emit = defineEmits(['update:open', 'open-node', 'focus-node'])

/** Steps in run order: Kahn's order over the connections, ties by canvas position (left to right, top to bottom). */
function runOrder(nodes, edges) {
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) if (indeg.has(e.target) && indeg.has(e.source)) indeg.set(e.target, indeg.get(e.target) + 1)
  const pos = (n) => [n.position.x, n.position.y]
  const byPlace = (a, b) => pos(a)[0] - pos(b)[0] || pos(a)[1] - pos(b)[1]
  const ready = nodes.filter((n) => indeg.get(n.id) === 0).sort(byPlace)
  const out = []
  const seen = new Set()
  while (ready.length) {
    const n = ready.shift()
    if (seen.has(n.id)) continue
    seen.add(n.id)
    out.push(n)
    for (const e of edges.filter((x) => x.source === n.id)) {
      if (!indeg.has(e.target)) continue
      indeg.set(e.target, indeg.get(e.target) - 1)
      if (indeg.get(e.target) === 0) { ready.push(nodes.find((x) => x.id === e.target)); ready.sort(byPlace) }
    }
  }
  // A step in a loop never reaches in-degree 0: it is listed after the rest rather than left out.
  return [...out, ...nodes.filter((n) => !seen.has(n.id)).sort(byPlace)]
}

const rows = computed(() => {
  const nodes = props.doc.nodes.value
  const edges = props.doc.edges.value
  const issues = props.doc.issues.value || {}
  const states = props.run.nodeStates.value || {}
  const title = (id) => { const n = nodes.find((x) => x.id === id); return n ? nodeTitle(n.type, n.data) : id }
  return runOrder(nodes, edges).map((n) => {
    const state = nodeStatusState(n.type, n.data, { status: states[n.id]?.status || null, invalid: !!issues[n.id] })
    const next = edges.filter((e) => e.source === n.id).map((e) => (e.sourceHandle ? `${title(e.target)} (${e.sourceHandle})` : title(e.target)))
    const cat = WF_CATEGORIES[wfCategory(n.type)]
    return {
      id: n.id, title: nodeTitle(n.type, n.data), icon: wfIcon(n.type), token: cat.token,
      kind: wfDef(n.type)?.label || n.type, stateLabel: NODE_STATUS_LABELS[state] || state, issue: issues[n.id] || '', next,
      aria: `${nodeAriaLabel(n.type, n.data, state)}${next.length ? `, leads to ${next.join(', ')}` : ''}${issues[n.id] ? `, ${issues[n.id]}` : ''}`,
    }
  })
})

const active = ref(0)
const listEl = ref(null)
function move(i) {
  active.value = Math.max(0, Math.min(rows.value.length - 1, i))
  nextTick(() => listEl.value?.querySelector(`[data-index="${active.value}"]`)?.focus())
}
function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(active.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(active.value - 1) }
  else if (e.key === 'Home') { e.preventDefault(); move(0) }
  else if (e.key === 'End') { e.preventDefault(); move(rows.value.length - 1) }
}
</script>
