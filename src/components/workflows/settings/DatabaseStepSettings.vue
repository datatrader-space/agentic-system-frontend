<!--
  The external database steps' settings (ADM-1363): data.sql, data.mongo, data.redis and the trigger.database trigger.
  The fields are the registry's (SchemaForm, `showIf` per operation). Added here:
  - the connection says its access: a Read only connection can only read, and a write operation on one is flagged
    before saving (the database refuses it anyway);
  - the table and column fields choose from the connection's schema (GET .../schema/, "Read the tables again" asks for
    a fresh copy); changing the connection clears the table and columns in the same history entry;
  - a raw SQL query is plain text, never templates: each value goes in a parameter row, $1, $2 … in order, and is
    sent as a bound parameter. {{ }} in the text, a $n without its parameter and a parameter the text never names are
    said as the person types (the server's validation refuses the first).
-->
<template>
  <div class="dbs">
    <SchemaForm :fields="fields" :derive="derive">
      <template #field-columns="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="columns" multiple />
      </template>
      <template #field-match_columns="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="columns" multiple />
      </template>
      <template #field-cursor_column="{ field, id }">
        <WfColumnPick :id="id" :field="field" :columns="columns" />
      </template>
      <template #field-filters="{ field }">
        <WfColumnRows :field="field" :columns="columns" :empty-text="filterEmpty" />
      </template>
      <template #field-order_by="{ field }">
        <WfColumnRows :field="field" :columns="columns" empty-text="No order: the database's own." />
      </template>
      <template #field-values="{ field }">
        <WfColumnRows :field="field" :columns="columns" fill-all empty-text="No values yet. Add one per column." />
      </template>
      <template #field-query="{ field, id }">
        <textarea
          :id="id" class="dbs-in dbs-sql" :rows="field.rows || 8" :value="data.query ?? ''" :placeholder="field.placeholder || ''"
          spellcheck="false" autocomplete="off" :aria-describedby="`${id}-check`" :aria-invalid="check.templates ? 'true' : 'false'"
          @focus="editor.begin('Query')" @blur="editor.end()" @input="editor.set('query', $event.target.value, 'Query')"
        />
        <div :id="`${id}-check`" class="dbs-check" aria-live="polite">
          <p v-if="check.templates" class="dbs-bad"><Icon icon="lucide:circle-alert" aria-hidden="true" />
            <span><code translate="no">{{ BRACES }}</code> in the query text is refused. Put the value in a parameter below and write its $n here.</span>
          </p>
          <p v-if="check.missing.length" class="dbs-warn-line"><Icon icon="lucide:triangle-alert" aria-hidden="true" />
            <span>The query uses {{ check.missing.map((n) => `$${n}`).join(', ') }} without a parameter.</span>
            <button type="button" class="dbs-mini" @click="addMissingParams">Add {{ check.missing.length === 1 ? 'it' : 'them' }}</button>
          </p>
          <p v-if="check.unused.length" class="dbs-soft"><Icon icon="lucide:info" aria-hidden="true" />
            <span>{{ check.unused.map((n) => `$${n}`).join(', ') }} {{ check.unused.length === 1 ? 'is' : 'are' }} not used in the query.</span>
          </p>
          <p class="dbs-soft"><Icon icon="lucide:shield-check" aria-hidden="true" />
            <span>Values are sent as bound parameters ($1, $2 …), never written into the SQL text.</span>
          </p>
        </div>
      </template>
      <template #field-params="{ field }">
        <WfColumnRows :field="field" :columns="null" numbered empty-text="No parameters. Add one for each $n in the query." />
      </template>
    </SchemaForm>

    <!-- the connection: its access, a write on a read-only one, a connection that is gone, none at all -->
    <p v-if="connectionGone" class="dbs-warn" role="alert">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      <span>This step's connection is no longer one you can use (it was deleted or is not shared with you). Choose another.</span>
    </p>
    <p v-else-if="noConnections" class="dbs-note">
      <Icon icon="lucide:database" aria-hidden="true" />
      <span>No {{ enginesText }} connection in this workspace yet. Add one under Settings, Connectors, Databases.</span>
    </p>
    <div v-else-if="connection" class="dbs-conn">
      <span class="dbs-badge" :class="connection.access === 'read_write' ? 'is-rw' : 'is-ro'">
        <Icon :icon="connection.access === 'read_write' ? 'lucide:pencil' : 'lucide:lock'" aria-hidden="true" />
        {{ connection.access === 'read_write' ? 'Read and write' : 'Read only' }}
      </span>
      <span class="dbs-conn-text">{{ connection.engine_label || connection.engine }}<template v-if="lastTest"> · {{ lastTest }}</template></span>
      <button v-if="usesSchema" type="button" class="dbs-mini" :disabled="schema.loading" @click="refreshSchema">
        <Icon icon="lucide:refresh-cw" aria-hidden="true" />{{ schema.loading ? 'Reading the tables…' : 'Read the tables again' }}
      </button>
    </div>
    <p v-if="readOnlyWrite" class="dbs-warn" role="alert">
      <Icon icon="lucide:lock" aria-hidden="true" />
      <span>{{ writes === 'maybe'
        ? 'This connection is Read only: a query that changes data is refused by the database.'
        : 'This connection is Read only, so this operation is refused by the database. Choose a Read and write connection, or a reading operation.' }}</span>
    </p>
    <p v-if="tableGone" class="dbs-warn" role="alert">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      <span>{{ tableField?.title || 'The table' }} {{ savedTable }} is not in the database's schema (or the connection's user cannot see it).</span>
    </p>

    <RouterLink class="dbs-link" :to="{ name: 'dashboard-connectors', hash: '#databases' }">
      <Icon icon="lucide:database" aria-hidden="true" />Manage database connections
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
import { connectionsState, findConnection, loadSchema, schemaColumns, schemaState, STEP_ENGINES } from './dataLists'
import { sqlParamCheck, writesData } from './dataSteps'
import { WF_NODE_DEFS } from '@/config/wfNodeDefinitions'

const BRACES = '{' + '{ }}'
const ENGINE_NAMES = { postgres: 'PostgreSQL', mysql: 'MySQL / MariaDB', mssql: 'SQL Server', mongodb: 'MongoDB', redis: 'Redis' }

const editor = useNodeEditor()
const data = computed(() => editor.data.value)
const type = computed(() => editor.type.value)
const fields = computed(() => WF_NODE_DEFS[type.value]?.fields || [])
// The field that names the table: `table` (SQL, the trigger) or `collection` (MongoDB). Redis has none.
const tableField = computed(() => fields.value.find((f) => f.optionsKey === 'databaseTables') || null)
const usesSchema = computed(() => !!tableField.value)
const savedTable = computed(() => (tableField.value ? data.value[tableField.value.key] : ''))

const workspace = computed(() => editor.doc.meta.workspace ?? null)
const conns = computed(() => connectionsState(workspace.value))
const connectionId = computed(() => data.value.connection ?? '')
const connection = computed(() => findConnection(workspace.value, connectionId.value))
const loaded = computed(() => Array.isArray(conns.value.items) && !conns.value.loading)
const usable = computed(() => (conns.value.items || []).filter((c) => (STEP_ENGINES[type.value] || []).includes(c.engine)))
const connectionGone = computed(() => loaded.value && connectionId.value !== '' && connectionId.value !== null && !connection.value)
const noConnections = computed(() => loaded.value && !usable.value.length)
const enginesText = computed(() => (STEP_ENGINES[type.value] || []).map((e) => ENGINE_NAMES[e] || e).join(', '))
const lastTest = computed(() => {
  const t = connection.value?.last_test
  if (!t?.at) return 'not tested yet'
  return t.ok ? 'last test passed' : 'last test failed'
})

const writes = computed(() => writesData(type.value, data.value.operation))
const readOnlyWrite = computed(() => !!connection.value && connection.value.access !== 'read_write' && writes.value !== 'no')

const schema = computed(() => schemaState(connectionId.value))
const columns = computed(() => {
  if (!usesSchema.value || !savedTable.value) return null
  return schemaColumns(schema.value.items, savedTable.value)
})
const tableGone = computed(() => usesSchema.value && !!savedTable.value && Array.isArray(schema.value.items) && !schema.value.loading
  && !schema.value.items.some((t) => t.name === savedTable.value))
const filterEmpty = computed(() => (['update', 'delete'].includes(data.value.operation)
  ? 'No filter yet. Update and Delete need at least one.'
  : 'No filter: every row matches.'))

const check = computed(() => sqlParamCheck(data.value.query, data.value.params))

function refreshSchema() { if (connectionId.value !== '') loadSchema(connectionId.value, { fresh: true }) }

// A table and its columns belong to one database: a new connection clears them in the same change.
function derive(key, value, current) {
  if (key === 'connection' && String(value) !== String(current.connection ?? '')) {
    const cleared = {}
    for (const f of fields.value) {
      if (f.optionsKey === 'databaseTables') cleared[f.key] = ''
      if (['columns', 'match_columns', 'cursor_column'].includes(f.key)) cleared[f.key] = ''
    }
    return cleared
  }
  if (tableField.value && key === tableField.value.key && value !== current[key]) {
    const cleared = {}
    for (const f of fields.value) if (['columns', 'match_columns', 'cursor_column'].includes(f.key)) cleared[f.key] = ''
    return cleared
  }
  return null
}

function addMissingParams() {
  const params = Array.isArray(data.value.params) ? data.value.params : []
  editor.set('params', [...params, ...check.value.missing.map(() => ({ value: '' }))], 'Parameters')
}
</script>

<style scoped>
.dbs { display: grid; gap: 14px; }
.dbs-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; resize: vertical;
}
.dbs-sql { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.55; tab-size: 2; }
.dbs-in:hover { border-color: var(--vm-ink-faint); }
.dbs-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.dbs-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.dbs-check { display: grid; gap: 4px; }
.dbs-check p { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0; font-size: 12px; line-height: 1.45; }
.dbs-bad { color: var(--vm-red-ink); }
.dbs-warn-line { color: var(--vm-amber-ink); }
.dbs-soft { color: var(--vm-ink-faint); }
.dbs-warn, .dbs-note { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; }
.dbs-warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.dbs-note { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.dbs :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.dbs-conn { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: var(--vm-ink-soft); }
.dbs-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.dbs-badge.is-ro { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border: 1px solid var(--vm-line-2); }
.dbs-badge.is-rw { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.dbs-badge :deep(svg) { width: 12px; height: 12px; }
.dbs-mini {
  display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 3px 8px; border: 1px solid var(--vm-line-2);
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.dbs-mini:hover:not(:disabled) { background: var(--vm-primary-soft); }
.dbs-mini:disabled { opacity: .6; cursor: not-allowed; }
.dbs-mini:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.dbs-link { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; color: var(--vm-link); text-decoration: none; }
.dbs-link:hover { text-decoration: underline; }
.dbs-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
@media (pointer: coarse) { .dbs-in { min-height: 44px; } .dbs-mini { min-height: 44px; } }
</style>
