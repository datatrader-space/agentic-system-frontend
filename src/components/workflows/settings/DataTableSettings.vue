<!--
  A Data table step's settings (data.table, ADM-1363). The fields are the registry's (SchemaForm, with `showIf` per
  operation); this component gives them what the generic form cannot:
  - the values, mapping and filters choose their COLUMN from the chosen table (WfColumnRows), Get one / Upsert choose a
    unique column, Get rows its order, "only when changed" its columns (WfColumnPick);
  - choosing the operation rewires the step's outputs in the SAME history entry: Exists has two outputs, exists and
    missing (like a condition's true / false), every other operation one. Switching to Exists moves the plain
    connections onto "exists"; switching away moves the exists / missing connections onto the one output, so no
    connection is left on an output that is no longer drawn (and Undo brings both back);
  - a table the workspace no longer has, and a workspace with no tables, are said, with the way to the Tables page.
-->
<template>
  <div class="dts">
    <SchemaForm :fields="fields">
      <template #field-operation="{ id }">
        <select :id="id" class="dts-in" :value="operation" @change="pickOperation($event.target.value)">
          <option v-for="o in operationOptions" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
      </template>
      <template #field-values="{ field }">
        <WfColumnRows :field="field" :columns="ownColumns" fill-all :check-required="operation === 'insert'" empty-text="No values yet. Add one per column." />
      </template>
      <template #field-mapping="{ field }">
        <WfColumnRows :field="field" :columns="ownColumns" fill-all empty-text="No mapping: each item is written as it is." />
      </template>
      <template #field-filters="{ field }">
        <WfColumnRows :field="field" :columns="allColumns" :empty-text="filterEmptyText" />
      </template>
      <template #field-column="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="allColumns" unique-only empty-label="Choose a unique column…" />
      </template>
      <template #field-order_by="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="allColumns" empty-label="id (the order rows were added)" />
      </template>
      <template #field-compare_columns="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="ownColumns" multiple />
      </template>
    </SchemaForm>

    <p v-if="tableGone" class="dts-warn" role="alert">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      <span>This workspace has no table {{ savedTable }} any more (it was archived or deleted). Choose another, or restore it on the Tables page.</span>
    </p>
    <p v-else-if="noTables" class="dts-note">
      <Icon icon="lucide:table-2" aria-hidden="true" />
      <span>This workspace has no tables yet.</span>
    </p>

    <div v-if="operation === 'exists'" class="dts-branches" aria-live="polite">
      <strong>Two outputs:</strong>{{ ' ' }}<span class="dts-b is-exists"><Icon icon="lucide:circle-check" aria-hidden="true" />exists</span> runs when a row matches the filters,
      <span class="dts-b is-missing"><Icon icon="lucide:circle-dashed" aria-hidden="true" />missing</span> when none does. Connect each on the canvas.
    </div>
    <p v-if="operation === 'delete_all'" class="dts-warn" role="note">
      <Icon icon="lucide:shield-alert" aria-hidden="true" />
      <span>Deleting every row always asks first: the run waits on an approval card that says how many rows it would delete.</span>
    </p>

    <RouterLink class="dts-link" :to="{ name: 'dashboard-workflow-tables' }">
      <Icon icon="lucide:table-properties" aria-hidden="true" />Open Tables: create a table, change its columns, see its rows
    </RouterLink>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import SchemaForm from '../SchemaForm.vue'
import WfColumnRows from './WfColumnRows.vue'
import WfColumnPick from './WfColumnPick.vue'
import { useNodeEditor } from './nodeEditor'
import { findTable, tableColumns, tablesState } from './dataLists'
import { wfBranchHandles, WF_NODE_DEFS } from '@/config/wfNodeDefinitions'

const editor = useNodeEditor()
const data = computed(() => editor.data.value)
const fields = computed(() => WF_NODE_DEFS[editor.type.value]?.fields || [])
const operation = computed(() => data.value.operation || 'insert')
const operationOptions = computed(() => (fields.value.find((f) => f.key === 'operation')?.options || [])
  .map((o) => (Array.isArray(o) ? [o[0], o[1]] : [o, String(o)])))

const workspace = computed(() => editor.doc.meta.workspace ?? null)
const list = computed(() => tablesState(workspace.value))
const savedTable = computed(() => data.value.table)
const table = computed(() => findTable(workspace.value, savedTable.value))
// Columns are known once a chosen table is in the list; until then the column fields are plain text.
const ownColumns = computed(() => (table.value ? tableColumns(table.value) : null))
const allColumns = computed(() => (table.value ? tableColumns(table.value, { withSystem: true }) : null))
const loaded = computed(() => Array.isArray(list.value.items) && !list.value.loading)
const tableGone = computed(() => loaded.value && savedTable.value !== null && savedTable.value !== undefined && savedTable.value !== '' && !table.value)
const noTables = computed(() => loaded.value && !list.value.items.length)
const filterEmptyText = computed(() => (['update', 'delete'].includes(operation.value)
  ? 'No filter yet. Update and Delete need at least one.'
  : 'No filter: every row matches.'))

/** The operation and the step's outgoing connections, in one history entry (see the header). */
function pickOperation(value) {
  if (editor.readOnly.value || value === operation.value) return
  const node = editor.node.value
  if (!node) return
  const before = wfBranchHandles(node.type, data.value)
  const after = wfBranchHandles(node.type, { ...data.value, operation: value })
  const ops = [{ op: 'update_node', id: node.id, data: { operation: value } }]
  const out = (editor.doc.edges.value || []).filter((e) => e.source === node.id)
  if (before.length && !after.length) {
    for (const e of out) if (before.includes(e.sourceHandle)) ops.push({ op: 'update_edge', id: e.id, patch: { sourceHandle: undefined } })
  } else if (!before.length && after.length) {
    for (const e of out) if (!e.sourceHandle) ops.push({ op: 'update_edge', id: e.id, patch: { sourceHandle: after[0] } })
  }
  editor.history.run('Edit Operation', ops)
}
</script>

<style scoped>
.dts { display: grid; gap: 14px; }
.dts-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.dts-in:hover { border-color: var(--vm-ink-faint); }
.dts-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.dts-warn, .dts-note {
  display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px;
  font-size: 12px; line-height: 1.5;
}
.dts-warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.dts-note { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.dts-warn :deep(svg), .dts-note :deep(svg), .dts-link :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.dts-branches {
  padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-soft);
  font-size: 12px; line-height: 1.7; color: var(--vm-ink-soft);
}
.dts-b { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; }
.dts-b :deep(svg) { width: 12px; height: 12px; }
.dts-b.is-exists { color: var(--vm-green-ink); }
.dts-b.is-missing { color: var(--vm-amber-ink); }
.dts-link { display: inline-flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--vm-link); text-decoration: none; }
.dts-link:hover { text-decoration: underline; }
.dts-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
@media (pointer: coarse) { .dts-in { min-height: 44px; } }
</style>
