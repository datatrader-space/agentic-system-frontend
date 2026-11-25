<!--
  A Data Table's rows (ADM-1363): filters (column, operator, value; All or Any), an order, pages read with the
  server's next_cursor ("Load more", never a cut list), inline add and edit, delete one, delete the selected, delete
  all (the table's name typed to confirm, with the count first), CSV import (each refused row and column said) and CSV
  export.

  Who may: adding and editing rows needs `can.write`; deleting rows by hand is the table's creator's and the workspace
  Admins' (`can.manage`). An archived table is read only. The server enforces all of it; a 402 says writes are paused.
-->
<template>
  <section ref="rootEl" class="trg" aria-labelledby="trg-h">
    <div class="trg-head">
      <h3 id="trg-h" class="trg-h">Rows</h3>
      <p class="trg-count" aria-live="polite">{{ countText }}</p>
      <div class="trg-tools">
        <button type="button" class="tp-btn" :aria-expanded="filtersOpen ? 'true' : 'false'" aria-controls="trg-filters" @click="filtersOpen = !filtersOpen">
          <Icon icon="lucide:list-filter" aria-hidden="true" />Filters<span v-if="applied.length" class="tp-chip tp-chip--info">{{ applied.length }}</span>
        </button>
        <button v-if="canWrite" type="button" class="tp-btn" :disabled="!!draft || busy" @click="startAdd"><Icon icon="lucide:plus" aria-hidden="true" />Add row</button>
        <button v-if="canWrite" type="button" class="tp-btn" :disabled="busy" @click="fileInput?.click()"><Icon icon="lucide:file-up" aria-hidden="true" />Import CSV</button>
        <input ref="fileInput" type="file" accept=".csv,text/csv" class="tp-sr" tabindex="-1" aria-hidden="true" @change="onFile">
        <button type="button" class="tp-btn" :disabled="exporting" @click="exportCsv"><Icon icon="lucide:file-down" aria-hidden="true" />{{ exporting ? 'Exporting…' : 'Export CSV' }}</button>
        <button v-if="canManage && selected.size" type="button" class="tp-btn tp-btn--danger" :disabled="busy" @click="deleteSelected">
          <Icon icon="lucide:trash-2" aria-hidden="true" />Delete {{ selected.size }} selected
        </button>
        <button v-if="canManage" type="button" class="tp-btn tp-btn--danger" :disabled="busy || !table.row_count" @click="openDeleteAll">
          <Icon icon="lucide:trash-2" aria-hidden="true" />Delete all rows
        </button>
      </div>
    </div>

    <!-- filters and order -->
    <form v-show="filtersOpen" id="trg-filters" class="trg-filters" @submit.prevent="applyFilters">
      <div v-for="(f, i) in filterDraft" :key="i" class="trg-frow">
        <select v-model="f.column" class="trg-in mono" :aria-label="`Filter ${i + 1}: column`">
          <option v-for="c in allColumns" :key="c.key" :value="c.key">{{ c.key }}</option>
        </select>
        <select v-model="f.op" class="trg-in" :aria-label="`Filter ${i + 1}: operator`">
          <option v-for="o in FILTER_OPS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <input v-if="!NO_VALUE_OPS.includes(f.op)" v-model="f.value" class="trg-in" type="text" :aria-label="`Filter ${i + 1}: value`" autocomplete="off">
        <span v-else class="trg-none">No value needed</span>
        <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Remove filter ${i + 1}`" @click="filterDraft.splice(i, 1)"><Icon icon="lucide:x" aria-hidden="true" /></button>
      </div>
      <div class="trg-fbar">
        <button type="button" class="tp-btn" @click="addFilter"><Icon icon="lucide:plus" aria-hidden="true" />Add filter</button>
        <label class="trg-lab">Rows must match
          <select v-model="matchDraft" class="trg-in trg-auto"><option value="all">All filters</option><option value="any">Any filter</option></select>
        </label>
        <label class="trg-lab">Order by
          <select v-model="orderByDraft" class="trg-in trg-auto mono">
            <option v-for="c in allColumns" :key="c.key" :value="c.key">{{ c.key }}</option>
          </select>
        </label>
        <select v-model="orderDraft" class="trg-in trg-auto" aria-label="Order"><option value="asc">Ascending</option><option value="desc">Descending</option></select>
        <button type="submit" class="tp-btn tp-btn--primary">Apply</button>
        <button v-if="applied.length" type="button" class="tp-btn" @click="clearFilters">Clear filters</button>
      </div>
    </form>

    <p v-if="loadError" class="trg-error" role="alert">
      <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ loadError }}</span>
      <button type="button" class="tp-btn" @click="reload">Try again</button>
    </p>

    <div class="trg-scroll" tabindex="0" role="region" aria-label="Rows of the table">
      <table class="trg-table">
        <thead>
          <tr>
            <th v-if="canManage" scope="col" class="trg-sel">
              <input type="checkbox" :checked="allSelected" :indeterminate="someSelected" aria-label="Select every row shown" :disabled="!rows.length" @change="toggleAll($event.target.checked)">
            </th>
            <th scope="col" class="mono">id</th>
            <th v-for="c in columns" :key="c.key" scope="col">
              <span class="trg-th">{{ c.label || c.key }}<span v-if="c.required" class="trg-req" title="Required" aria-label="required">*</span></span>
              <span class="trg-th-sub mono">{{ c.key }} · {{ typeLabel(c.type) }}</span>
            </th>
            <th scope="col">Updated</th>
            <th scope="col" class="trg-act"><span class="tp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <!-- the new row -->
          <tr v-if="draft" class="is-editing">
            <td v-if="canManage" />
            <td class="mono trg-faint">new</td>
            <td v-for="c in columns" :key="c.key">
              <CellInput :column="c" :model-value="draft.texts[c.key]" :error="draft.errors[c.key]" :row-label="'new row'" @update:model-value="draft.texts[c.key] = $event" @enter="saveDraft" @escape="draft = null" />
            </td>
            <td />
            <td class="trg-act">
              <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" aria-label="Save the new row" title="Save (Enter)" :disabled="busy" @click="saveDraft"><Icon icon="lucide:check" aria-hidden="true" /></button>
              <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" aria-label="Cancel the new row" title="Cancel (Esc)" @click="draft = null"><Icon icon="lucide:x" aria-hidden="true" /></button>
            </td>
          </tr>
          <tr v-for="row in rows" :key="row.id" :class="{ 'is-editing': editing?.id === row.id, 'is-selected': selected.has(row.id) }">
            <td v-if="canManage" class="trg-sel">
              <input type="checkbox" :checked="selected.has(row.id)" :aria-label="`Select row ${row.id}`" @change="toggle(row.id, $event.target.checked)">
            </td>
            <td class="mono trg-faint">{{ row.id }}</td>
            <td v-for="c in columns" :key="c.key" :class="{ mono: c.type === 'json' || c.type === 'number' }">
              <CellInput
                v-if="editing?.id === row.id" :column="c" :model-value="editing.texts[c.key]" :error="editing.errors[c.key]" :row-label="`row ${row.id}`"
                @update:model-value="editing.texts[c.key] = $event" @enter="saveEdit(row)" @escape="editing = null"
              />
              <span v-else class="trg-cell" :title="displayCell(c.type, row[c.key])">{{ displayCell(c.type, row[c.key]) }}</span>
            </td>
            <td class="trg-faint trg-nowrap">{{ displayCell('datetime', row.updated_at) }}</td>
            <td class="trg-act">
              <template v-if="editing?.id === row.id">
                <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Save row ${row.id}`" title="Save (Enter)" :disabled="busy" @click="saveEdit(row)"><Icon icon="lucide:check" aria-hidden="true" /></button>
                <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Cancel editing row ${row.id}`" title="Cancel (Esc)" @click="editing = null"><Icon icon="lucide:x" aria-hidden="true" /></button>
              </template>
              <template v-else>
                <button v-if="canWrite" type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Edit row ${row.id}`" title="Edit" :disabled="busy" @click="startEdit(row)"><Icon icon="lucide:pencil" aria-hidden="true" /></button>
                <button v-if="canManage" type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Delete row ${row.id}`" title="Delete" :disabled="busy" @click="deleteRow(row)"><Icon icon="lucide:trash-2" aria-hidden="true" /></button>
              </template>
            </td>
          </tr>
          <tr v-if="!loading && !rows.length && !draft">
            <td :colspan="colspan" class="trg-empty">
              <Icon icon="lucide:rows-3" aria-hidden="true" />
              <span v-if="applied.length">No row matches the filters.</span>
              <span v-else>No rows yet.<template v-if="canWrite"> Add one, import a CSV, or write rows from a workflow's Data table step.</template></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="trg-foot">
      <span v-if="loading" class="trg-faint" role="status"><Icon icon="lucide:loader-circle" class="spin" aria-hidden="true" /> Loading rows…</span>
      <button v-else-if="nextCursor" type="button" class="tp-btn" @click="loadMore">Load more rows</button>
    </div>

    <!-- delete all: the count first, then the table's name typed -->
    <AppDialog v-model:open="deleteAllOpen" :title="`Delete every row of ${table.name}?`" size="sm">
      <div class="trg-dlg">
        <p v-if="deleteAllCount === null" role="status">Counting the rows…</p>
        <p v-else>This deletes <strong>{{ deleteAllCount }}</strong> {{ deleteAllCount === 1 ? 'row' : 'rows' }}. The columns stay. This cannot be undone.</p>
        <label class="trg-confirm" :for="`${uid}-confirm`">Type the table's name, <strong>{{ table.name }}</strong>, to confirm</label>
        <input :id="`${uid}-confirm`" v-model="deleteAllTyped" class="trg-in" type="text" autocomplete="off" spellcheck="false">
      </div>
      <template #footer>
        <button type="button" class="tp-btn" @click="deleteAllOpen = false">Cancel</button>
        <button type="button" class="tp-btn tp-btn--danger" :disabled="busy || deleteAllTyped !== table.name" @click="confirmDeleteAll">
          <Icon icon="lucide:trash-2" aria-hidden="true" />Delete all rows
        </button>
      </template>
    </AppDialog>

    <!-- a CSV the server refused: every row and column it names -->
    <AppDialog v-model:open="importErrorsOpen" title="The CSV was not imported" description="Nothing was added. Fix these and import the file again." size="md">
      <ul class="trg-errlist">
        <li v-for="(line, i) in importErrors" :key="i">{{ line }}</li>
      </ul>
      <template #footer><button type="button" class="tp-btn tp-btn--primary" @click="importErrorsOpen = false">Close</button></template>
    </AppDialog>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '../common/AppDialog.vue'
import CellInput from './TableCellInput.vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { saveBlob, filenameFrom } from '@/utils/saveBlob'
import { FILTER_OPS, NO_VALUE_OPS, apiErrorText, csvErrorLines, displayCell, editText, rowChanges, typeLabel } from './tableData'
import './workflow-tables.css'

const props = defineProps({ table: { type: Object, required: true } })
const emit = defineEmits(['changed'])

const PAGE_SIZE = 100
const uid = `trg-${useId()}`

const canWrite = computed(() => !!props.table.can?.write && !props.table.archived)
const canManage = computed(() => !!props.table.can?.manage && !props.table.archived)
const columns = computed(() => props.table.columns || [])
const allColumns = computed(() => [{ key: 'id' }, ...columns.value, { key: 'created_at' }, { key: 'updated_at' }])
const colspan = computed(() => columns.value.length + 3 + (canManage.value ? 1 : 0))

// ── reading ──
const rows = ref([])
const count = ref(null)
const total = ref(null)
const nextCursor = ref(null)
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
let readSeq = 0

const filtersOpen = ref(false)
const filterDraft = ref([])
const matchDraft = ref('all')
const orderByDraft = ref('id')
const orderDraft = ref('asc')
const applied = ref([])
const query = reactive({ match: 'all', order_by: 'id', order: 'asc' })

const countText = computed(() => {
  if (count.value === null) return ''
  const shown = rows.value.length
  const matching = applied.value.length ? `${count.value} ${count.value === 1 ? 'row matches' : 'rows match'}` : `${total.value ?? count.value} ${(total.value ?? count.value) === 1 ? 'row' : 'rows'}`
  return shown < count.value ? `${matching}, ${shown} shown` : matching
})

function params(cursor) {
  const p = { filters: applied.value, match: query.match, order_by: query.order_by, order: query.order, page_size: PAGE_SIZE }
  if (cursor) p.cursor = cursor
  return p
}
async function read(cursor) {
  const seq = ++readSeq
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.getWorkflowTableRows(props.table.id, params(cursor))
    if (seq !== readSeq) return
    rows.value = cursor ? [...rows.value, ...(data.rows || [])] : (data.rows || [])
    count.value = data.count ?? rows.value.length
    total.value = data.total ?? null
    nextCursor.value = data.next_cursor || null
  } catch (e) {
    if (seq === readSeq) loadError.value = apiErrorText(e, 'The rows could not be loaded')
  } finally {
    if (seq === readSeq) loading.value = false
  }
}
function reload() { selected.value = new Set(); return read(null) }
function loadMore() { if (nextCursor.value) read(nextCursor.value) }

function addFilter() { filterDraft.value.push({ column: columns.value[0]?.key || 'id', op: 'eq', value: '' }) }
function applyFilters() {
  applied.value = filterDraft.value.filter((f) => f.column).map((f) => (NO_VALUE_OPS.includes(f.op) ? { column: f.column, op: f.op } : { column: f.column, op: f.op, value: f.value }))
  Object.assign(query, { match: matchDraft.value, order_by: orderByDraft.value, order: orderDraft.value })
  reload()
}
function clearFilters() { filterDraft.value = []; applied.value = []; reload() }

// ── selection ──
const selected = ref(new Set())
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)))
const someSelected = computed(() => selected.value.size > 0 && !allSelected.value)
function toggle(id, on) { const s = new Set(selected.value); if (on) s.add(id); else s.delete(id); selected.value = s }
function toggleAll(on) { selected.value = on ? new Set(rows.value.map((r) => r.id)) : new Set() }

// ── writing ──
const draft = ref(null)
const editing = ref(null)
function textsFor(row) { return Object.fromEntries(columns.value.map((c) => [c.key, editText(c.type, row ? row[c.key] : null)])) }
// Focus moves into the row being edited: the button pressed is gone, and the grid scrolls back to the first field.
const rootEl = ref(null)
async function focusEditedRow() { await nextTick(); rootEl.value?.querySelector('tr.is-editing :is(input, select, textarea)')?.focus() }
function startAdd() { editing.value = null; draft.value = { texts: textsFor(null), errors: {} }; focusEditedRow() }
function startEdit(row) { draft.value = null; editing.value = { id: row.id, texts: textsFor(row), errors: {} }; focusEditedRow() }

async function write(fn, failText) {
  busy.value = true
  try {
    const out = await fn()
    emit('changed')
    return out ?? true
  } catch (e) {
    notify.error(apiErrorText(e, failText))
    return null
  } finally {
    busy.value = false
  }
}

async function saveDraft() {
  if (!draft.value) return
  const { values, errors } = rowChanges(columns.value, null, draft.value.texts)
  draft.value.errors = errors
  if (Object.keys(errors).length) return
  const done = await write(() => api.addWorkflowTableRows(props.table.id, { values }), 'The row was not added')
  if (done) {
    draft.value = null
    notify.success('Row added')
    reload()
  }
}
async function saveEdit(row) {
  if (!editing.value) return
  const { values, errors } = rowChanges(columns.value, row, editing.value.texts)
  editing.value.errors = errors
  if (Object.keys(errors).length) return
  if (!Object.keys(values).length) { editing.value = null; return }
  const res = await write(() => api.updateWorkflowTableRow(props.table.id, row.id, values), 'The row was not saved')
  if (res) {
    const updated = res.data?.row
    if (updated) rows.value = rows.value.map((r) => (r.id === row.id ? updated : r))
    editing.value = null
  }
}
async function deleteRow(row) {
  const ok = await confirm({ title: `Delete row ${row.id}?`, message: 'This cannot be undone.', confirmText: 'Delete row', danger: true })
  if (!ok) return
  if (await write(() => api.deleteWorkflowTableRow(props.table.id, row.id), 'The row was not deleted')) {
    notify.success('Row deleted')
    reload()
  }
}
async function deleteSelected() {
  const ids = [...selected.value]
  const ok = await confirm({
    title: `Delete ${ids.length} ${ids.length === 1 ? 'row' : 'rows'}?`, message: 'The selected rows are deleted. This cannot be undone.',
    confirmText: 'Delete', danger: true,
  })
  if (!ok) return
  const res = await write(() => api.deleteWorkflowTableRows(props.table.id, { row_ids: ids }), 'The rows were not deleted')
  if (res) {
    notify.success(`Deleted ${res.data?.count ?? ids.length} rows`)
    reload()
  }
}

const deleteAllOpen = ref(false)
const deleteAllCount = ref(null)
const deleteAllTyped = ref('')
async function openDeleteAll() {
  deleteAllTyped.value = ''
  deleteAllCount.value = null
  deleteAllOpen.value = true
  try {
    const { data } = await api.deleteAllWorkflowTableRows(props.table.id, { dry_run: true })
    // The server always answers {count}; without a number the dialog would promise "0 rows" before a real delete.
    if (!Number.isInteger(data?.count)) {
      deleteAllOpen.value = false
      notify.error('The rows could not be counted: the server did not say how many there are. Nothing was deleted.')
      return
    }
    deleteAllCount.value = data.count
  } catch (e) {
    deleteAllOpen.value = false
    notify.error(apiErrorText(e, 'The rows could not be counted'))
  }
}
async function confirmDeleteAll() {
  if (deleteAllTyped.value !== props.table.name) return
  const res = await write(() => api.deleteAllWorkflowTableRows(props.table.id, { confirm: true }), 'The rows were not deleted')
  if (res) {
    deleteAllOpen.value = false
    notify.success(`Deleted ${res.data?.count ?? 0} rows`)
    reload()
  }
}

// ── CSV ──
const fileInput = ref(null)
const importErrors = ref([])
const importErrorsOpen = ref(false)
async function onFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  if (file.size > 25 * 1024 * 1024) { notify.error('A CSV file is 25 MB at most.'); return }
  busy.value = true
  try {
    const { data } = await api.importWorkflowTableCsv(props.table.id, file)
    notify.success(`Imported ${data?.count ?? 0} rows`)
    emit('changed')
    reload()
  } catch (e) {
    const d = e?.response?.data
    if (d?.code === 'csv_invalid' && Array.isArray(d.errors) && d.errors.length) {
      importErrors.value = csvErrorLines(d.errors)
      importErrorsOpen.value = true
    } else {
      notify.error(apiErrorText(e, 'The CSV was not imported'))
    }
  } finally {
    busy.value = false
  }
}
const exporting = ref(false)
async function exportCsv() {
  exporting.value = true
  try {
    const res = await api.exportWorkflowTableCsv(props.table.id)
    saveBlob(res.data, filenameFrom(res.headers, `${props.table.name || 'table'}.csv`))
  } catch (e) {
    notify.error(apiErrorText(e, 'The CSV could not be exported'))
  } finally {
    exporting.value = false
  }
}

// A new table starts with no filter, no edit and its first page (declared last: it reads every state above).
watch(() => props.table.id, () => { draft.value = null; editing.value = null; applied.value = []; filterDraft.value = []; reload() }, { immediate: true })

defineExpose({ reload })
</script>

<style scoped>
.trg { display: grid; gap: 10px; min-width: 0; }
.trg-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.trg-h { margin: 0; font-size: 14px; font-weight: 700; color: var(--vm-ink); }
.trg-count { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.trg-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.trg :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.trg-filters { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft); }
.trg-frow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr) 36px; gap: 6px; align-items: center; }
.trg-fbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.trg-lab { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vm-ink-soft); }
.trg-col { display: grid; gap: 4px; }
.trg-in { width: 100%; min-width: 0; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.trg-in.mono, .mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.trg-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.trg-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.trg-auto { width: auto; }
.trg-none { font-size: 12px; color: var(--vm-ink-faint); }
.trg-error { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-red-soft); color: var(--vm-red-ink); font-size: 12px; }
.trg-scroll { overflow-x: auto; border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface); }
.trg-scroll:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.trg-table { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--vm-ink); }
.trg-table th { position: sticky; top: 0; padding: 8px 10px; border-bottom: 1px solid var(--vm-line-2); background: var(--vm-surface-soft); text-align: left; font-weight: 600; vertical-align: bottom; white-space: nowrap; }
.trg-th { display: block; font-size: 12px; color: var(--vm-ink); }
.trg-th-sub { display: block; font-size: 11px; font-weight: 400; color: var(--vm-ink-faint); }
.trg-req { margin-left: 2px; color: var(--vm-red-ink); }
.trg-table td { padding: 6px 10px; border-bottom: 1px solid var(--vm-line); vertical-align: top; }
.trg-table tbody tr:hover { background: var(--vm-surface-soft); }
.trg-table tr.is-selected { background: var(--vm-primary-soft); }
.trg-table tr.is-editing { background: var(--vm-surface-soft); }
.trg-cell { display: block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trg-sel { width: 36px; }
.trg-sel input { width: 16px; height: 16px; accent-color: var(--vm-primary); }
.trg-act { width: 1%; white-space: nowrap; text-align: right; }
.trg-faint { color: var(--vm-ink-faint); }
.trg-nowrap { white-space: nowrap; }
.trg-empty { padding: 28px 12px !important; text-align: center; color: var(--vm-ink-soft); }
.trg-empty :deep(svg) { display: block; width: 22px; height: 22px; margin: 0 auto 6px; color: var(--vm-ink-faint); }
.trg-foot { display: flex; justify-content: center; min-height: 36px; align-items: center; }
.trg-foot span { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; }
.trg-dlg { display: grid; gap: 10px; font-size: 13px; color: var(--vm-ink-soft); }
.trg-dlg p { margin: 0; }
.trg-confirm { font-size: 12px; color: var(--vm-ink-soft); }
.trg-confirm strong { color: var(--vm-ink); }
.trg-errlist { display: grid; gap: 4px; max-height: 50vh; overflow: auto; margin: 0; padding: 0 0 0 18px; font-size: 12px; color: var(--vm-ink); }
@media (max-width: 640px) {
  .trg-tools { margin-left: 0; }
  .trg-frow { grid-template-columns: minmax(0, 1fr) 36px; }
  .trg-frow > :not(button) { grid-column: 1; }
  .trg-frow > button { grid-column: 2; grid-row: 1; }
}
@media (pointer: coarse) { .trg-in { min-height: 44px; } .trg-sel input { width: 20px; height: 20px; } }
</style>
