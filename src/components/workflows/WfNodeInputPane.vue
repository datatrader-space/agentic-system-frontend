<!--
  The node window's left pane: what this step can read (ADM-1333, plan §3.3).

  It lists the trigger, the workflow's variables, every ANCESTOR step (the engine accepts nothing else) and, for a
  for-each step, the current item. Values come from the live or viewed run over the last finished run (contract C4,
  `node_runs`), never from the run timeline. A step that has not run shows its declared output shape, marked "Sample".
  Tool and MCP outputs are { text, result, … }; `result` is shown as the structure it is.

  When nothing has run, or the draft changed since the last run, "Run upstream (test)" runs the DRAFT as a dry run up
  to the parent step (D4), so real values appear here.

  Each key can be dragged into a field, or picked with Enter (it goes into the field focused last).
-->
<template>
  <section class="ip" :aria-labelledby="`${uid}-h`">
    <header class="ip-head">
      <h3 :id="`${uid}-h`" class="ip-title">Input</h3>
      <div class="ip-view" role="group" aria-label="Show values as">
        <button
          v-for="v in VIEWS" :key="v.id" type="button" class="ip-view-btn"
          :aria-pressed="view === v.id ? 'true' : 'false'" @click="view = v.id"
        >{{ v.label }}</button>
      </div>
    </header>

    <p class="ip-run" role="status">{{ runLine }}</p>
    <p v-if="lastRunError" class="ip-err" role="alert">
      {{ lastRunError }}
      <button type="button" class="ip-btn" @click="$emit('reload-last-run')">Retry</button>
    </p>

    <div v-if="needsUpstream && parents.length && editor.canRun.value" class="ip-upstream">
      <p class="ip-help">Run the earlier steps as a test (no real side effects) to see their real output here.</p>
      <button
        v-for="p in parents" :key="p.id" type="button" class="ip-btn ip-btn--primary"
        :disabled="run.running.value || run.starting.value" @click="runUpstream(p.id)"
      >
        <Icon icon="lucide:play" aria-hidden="true" />
        {{ parents.length > 1 ? `Run upstream to ${p.label} (test)` : 'Run upstream (test)' }}
      </button>
      <p v-if="testInputsNote" class="ip-help">{{ testInputsNote }}</p>
    </div>

    <p v-if="!sources.length" class="ip-empty">No earlier steps. Connect a step before this one to use its output here.</p>

    <ul v-else class="ip-list">
      <li v-for="src in sources" :key="src.id" class="ip-src">
        <button
          type="button" class="ip-src-head" :aria-expanded="isOpen(src.id) ? 'true' : 'false'"
          :aria-controls="`${uid}-${src.id}`" @click="toggle(src.id)"
        >
          <Icon :icon="isOpen(src.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
          <span class="ip-src-label">{{ src.label }}</span>
          <code v-if="src.nodeId" class="ip-src-id" translate="no">{{ src.nodeId }}</code>
          <span v-if="!src.real" class="ip-tag">Sample</span>
          <span v-else-if="src.fromLastRun" class="ip-tag ip-tag--soft">Last run</span>
          <span v-if="src.status" class="ip-tag" :class="`ip-tag--${src.status}`">{{ src.status }}</span>
        </button>
        <div v-show="isOpen(src.id)" :id="`${uid}-${src.id}`" class="ip-src-body">
          <OutputTree
            :value="src.value" :base="src.base" :mode="view" :label="`${src.label} output`"
            @pick="pick"
          />
        </div>
      </li>
    </ul>
    <p class="ip-help ip-foot">Drag a key into a field, or choose a field and press Enter on a key.</p>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import OutputTree from './OutputTree.vue'
import { useNodeEditor } from './settings/nodeEditor'
import { parentIds } from './wfNodeModalModel'

defineProps({ lastRunError: { type: String, default: '' } })
defineEmits(['reload-last-run'])

const VIEWS = [{ id: 'schema', label: 'Schema' }, { id: 'json', label: 'JSON' }]
const editor = useNodeEditor()
const run = editor.run
const uid = `ip-${useId()}`
const view = ref('schema')
const sources = computed(() => editor.sources.value)

const closed = ref(new Set())
const isOpen = (id) => !closed.value.has(id)
function toggle(id) {
  const next = new Set(closed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  closed.value = next
}

const parents = computed(() => {
  const nodes = editor.doc.nodes.value
  return parentIds(editor.node.value?.id, nodes, editor.doc.edges.value).map((id) => {
    const n = nodes.find((x) => x.id === id)
    return { id, label: n?.data?.label || id }
  })
})

const lastRun = computed(() => run.lastRun.value)
const needsUpstream = computed(() => !lastRun.value || lastRun.value.draftChangedSince)
const dateFmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
const runLine = computed(() => {
  if (run.live.value && run.running.value) return `Run #${run.live.value.id} is ${run.live.value.status}…`
  // A past run on screen: its values are shown, over the last finished run for the steps it did not reach.
  const viewed = run.viewed.value
  if (viewed) return `Values from run #${viewed.id} (${viewed.status}), the run on screen.`
  if (!lastRun.value) return 'Nothing has run yet. Steps show their declared output shape.'
  const when = lastRun.value.finishedAt || lastRun.value.startedAt
  const at = when && dateFmt ? dateFmt.format(new Date(when)) : ''
  const base = `Values from run #${lastRun.value.runId} (${lastRun.value.status}${at ? `, ${at}` : ''}).`
  return lastRun.value.draftChangedSince ? `${base} The draft has changed since.` : base
})

// A test from here uses each manual input's declared default value; with an image input, or in a frame workflow, it
// asks for the values (the photo) first.
const testInputsNote = computed(() => {
  if (!editor.manualInputs.value.length) return ''
  if (editor.frameWorkflow.value) return 'The test asks for a photo first: it stands in for the camera frame, {{trigger.image}}.'
  if (editor.needsPhoto.value) return "The test asks for the trigger's inputs first, including a photo."
  return `The test uses each input's default: ${editor.manualInputs.value.map((i) => `${i.key} = ${JSON.stringify(i.default ?? '')}`).join(', ')}.`
})
function runUpstream(parentId) { editor.testUpTo(parentId) }
function pick(token) { editor.insertIntoActive(token) }

</script>

<style scoped>
.ip { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.ip-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ip-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.ip-view { display: inline-flex; border: 1px solid var(--vm-line-2); border-radius: 6px; overflow: hidden; }
.ip-view-btn {
  min-height: 28px; padding: 3px 10px; border: 0; background: var(--vm-surface); color: var(--vm-ink-soft);
  font: inherit; font-size: 12px; cursor: pointer;
}
.ip-view-btn + .ip-view-btn { border-left: 1px solid var(--vm-line-2); }
.ip-view-btn[aria-pressed='true'] { background: var(--vm-primary-soft); color: var(--vm-link); font-weight: 600; }
.ip-view-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.ip-run, .ip-help, .ip-empty { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.ip-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.ip-upstream { display: grid; gap: 6px; padding: 10px; border: 1px dashed var(--vm-primary-line); border-radius: 8px; background: var(--vm-primary-soft); }
.ip-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 5px 10px;
  border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink-soft);
  font: inherit; font-size: 12px; cursor: pointer;
}
.ip-btn :deep(svg) { width: 14px; height: 14px; }
.ip-btn--primary { border-color: var(--vm-primary); background: var(--vm-primary); color: var(--wf-on-accent, #fff); font-weight: 600; }
.ip-btn--primary:hover:not(:disabled) { background: var(--vm-primary-d); }
.ip-btn:disabled { opacity: .55; cursor: not-allowed; }
.ip-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.ip-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ip-src { border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface); min-width: 0; }
.ip-src-head {
  display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 6px 8px; border: 0; border-radius: 8px;
  background: none; color: var(--vm-ink); font: inherit; font-size: 12.5px; font-weight: 600; text-align: left; cursor: pointer;
}
.ip-src-head :deep(svg) { width: 14px; height: 14px; color: var(--vm-ink-faint); flex-shrink: 0; }
.ip-src-head:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.ip-src-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip-src-id { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 11px; font-weight: 400; color: var(--vm-ink-faint); }
.ip-tag { margin-left: auto; flex-shrink: 0; padding: 1px 6px; border-radius: 4px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font-size: 11px; font-weight: 500; }
.ip-tag + .ip-tag { margin-left: 4px; }
.ip-tag--soft { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.ip-tag--succeeded { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.ip-tag--failed { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.ip-tag--running, .ip-tag--queued { background: var(--vm-primary-soft); color: var(--vm-link); }
.ip-src-body { padding: 0 6px 6px; min-width: 0; }
.ip-foot { margin-top: auto; }
@media (pointer: coarse) { .ip-btn, .ip-view-btn, .ip-src-head { min-height: 44px; } }
</style>
