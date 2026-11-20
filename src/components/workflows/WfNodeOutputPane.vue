<!--
  The node window's right pane: this step's result after a test or the last run (ADM-1333, plan §3.3), in Input,
  Output and Error tabs. Input is what the step read: the output of each step connected directly before it.
-->
<template>
  <section class="op" :aria-labelledby="`${uid}-h`">
    <header class="op-head">
      <h3 :id="`${uid}-h`" class="op-title">Output</h3>
      <span v-if="state?.status" class="op-status" :class="`op-status--${state.status}`">
        <Icon :icon="NODE_STATUS_ICONS[state.status] || 'lucide:circle'" aria-hidden="true" />
        {{ NODE_STATUS_LABELS[state.status] || state.status }}
      </span>
    </header>

    <p v-if="!state" class="op-empty">This step has not run yet. Use Test this step to see what it returns.</p>
    <template v-else>
      <p v-if="subRunId" class="op-sub" role="status">
        <Icon icon="lucide:hourglass" aria-hidden="true" />
        <span>Waiting for the sub-workflow run.
          <RouterLink class="op-link" :to="{ name: 'dashboard-workflow-runs', query: { run: String(subRunId) } }">Open run #{{ subRunId }}</RouterLink>
        </span>
      </p>
      <p v-if="state.fromLastRun" class="op-help">From the last run{{ editor.run.lastRun.value ? ` (#${editor.run.lastRun.value.runId})` : '' }}.</p>
      <div class="op-tabs" role="tablist" aria-label="Step result" @keydown="onTabKey">
        <button
          v-for="t in TABS" :id="`${uid}-tab-${t.id}`" :key="t.id" ref="tabEls" type="button" role="tab" class="op-tab"
          :aria-selected="tab === t.id ? 'true' : 'false'" :aria-controls="`${uid}-panel`" :tabindex="tab === t.id ? 0 : -1"
          @click="tab = t.id"
        >
          {{ t.label }}<span v-if="t.id === 'error' && state.error" class="op-dot" aria-label="has an error" />
        </button>
      </div>
      <div :id="`${uid}-panel`" class="op-panel" role="tabpanel" :aria-labelledby="`${uid}-tab-${tab}`" tabindex="0">
        <template v-if="tab === 'input'">
          <p v-if="!Object.keys(inputValue).length" class="op-empty">No step runs directly before this one.</p>
          <OutputTree v-else :value="inputValue" :insertable="false" label="What this step read" />
        </template>
        <template v-else-if="tab === 'output'">
          <p v-if="state.output === null || state.output === undefined" class="op-empty">No output.</p>
          <template v-else>
            <a v-if="state.output?.attachment_id && state.output?.url" class="op-link" :href="state.output.url" target="_blank" rel="noopener noreferrer">
              <Icon icon="lucide:external-link" aria-hidden="true" />Open the media result
            </a>
            <OutputTree :value="state.output" :insertable="false" label="This step's output" />
          </template>
        </template>
        <template v-else>
          <pre v-if="state.error" class="op-error">{{ state.error }}</pre>
          <p v-else class="op-empty">No error.</p>
        </template>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import OutputTree from './OutputTree.vue'
import { NODE_STATUS_ICONS, NODE_STATUS_LABELS } from '@/utils/wfNodeView'
import { useNodeEditor } from './settings/nodeEditor'
import { parentIds } from './wfNodeModalModel'

const TABS = [{ id: 'input', label: 'Input' }, { id: 'output', label: 'Output' }, { id: 'error', label: 'Error' }]
const editor = useNodeEditor()
const uid = `op-${useId()}`
const nodeId = computed(() => editor.node.value?.id)
const state = computed(() => editor.states.value[nodeId.value] || null)

// A sub-workflow step whose child run is still going waits on it ({ awaiting_subworkflow, sub_run_id }).
const subRunId = computed(() => (state.value?.status === 'waiting' && state.value.output?.awaiting_subworkflow
  ? state.value.output.sub_run_id ?? null : null))

const tab = ref('output')
watch(() => [nodeId.value, state.value?.status], () => { tab.value = state.value?.status === 'failed' ? 'error' : 'output' }, { immediate: true })

const inputValue = computed(() => {
  const out = {}
  for (const id of parentIds(nodeId.value, editor.doc.nodes.value, editor.doc.edges.value)) {
    const s = editor.states.value[id]
    if (s && s.output !== null && s.output !== undefined) out[id] = s.output
  }
  return out
})

const tabEls = ref([])
function onTabKey(e) {
  const i = TABS.findIndex((t) => t.id === tab.value)
  let next = null
  if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
  else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = TABS.length - 1
  if (next === null) return
  e.preventDefault()
  tab.value = TABS[next].id
  nextTick(() => tabEls.value[next]?.focus())
}
</script>

<style scoped>
.op { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.op-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.op-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.op-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.op-status :deep(svg) { width: 14px; height: 14px; }
.op-status--succeeded { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.op-status--failed { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.op-status--waiting { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.op-status--running, .op-status--queued { background: var(--vm-primary-soft); color: var(--vm-link); }
.op-empty, .op-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.op-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--vm-line); }
.op-tab {
  position: relative; min-height: 32px; padding: 5px 10px; border: 0; border-bottom: 2px solid transparent; background: none;
  color: var(--vm-ink-soft); font: inherit; font-size: 12.5px; cursor: pointer;
}
.op-tab[aria-selected='true'] { border-bottom-color: var(--vm-primary); color: var(--vm-ink); font-weight: 600; }
.op-tab:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.op-dot { display: inline-block; width: 6px; height: 6px; margin-left: 5px; border-radius: 50%; background: var(--vm-red-ink); vertical-align: middle; }
.op-panel { min-height: 0; overflow: auto; }
.op-panel:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.op-error {
  margin: 0; padding: 10px; border-radius: 6px; background: var(--vm-red-soft); color: var(--vm-red-ink);
  font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere;
}
.op-sub { display: flex; gap: 6px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font-size: 12px; line-height: 1.45; }
.op-sub :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.op-sub .op-link { margin: 0 0 0 4px; color: var(--vm-link); }
.op-link { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px; color: var(--vm-link); }
.op-link :deep(svg) { width: 14px; height: 14px; }
.op-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
@media (pointer: coarse) { .op-tab { min-height: 44px; } }
</style>
