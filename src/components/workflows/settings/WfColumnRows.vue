<!--
  A Data step's list of column rows (ADM-1363): values ({ column, value }), filters ({ column, op, value }), a mapping,
  an order ({ column, direction }) or parameters ({ value }). It is SchemaForm's key/value list with three things
  the generic one cannot do:
  - the COLUMN is chosen from the table's columns (a Data Table's, or the database schema's), so a name the table does
    not have is never typed by mistake; a saved name the table no longer has stays selected and is marked;
  - a VALUE takes templates ({{nodes.x.output.y}}) with the variable picker (WfVarField);
  - a filter whose operator needs no value (is empty, is null) shows no value field.
  While the columns are not known (no table chosen, or the list could not be read) the column is a plain text field.
  Every change writes the whole list as one history entry (typing in a field is one entry from focus to blur).

    <WfColumnRows :field="field" :columns="[{ key, label, type, required }]" fill-all />
-->
<template>
  <div class="wcr" role="group" :aria-label="field.title || field.key">
    <div v-for="(row, ri) in rows" :key="ri" class="wcr-row" :class="{ 'has-op': opCol, 'is-single': single }">
      <template v-for="c in field.cols" :key="c.key">
        <template v-if="c.key === 'column'">
          <select
            v-if="columns" class="wcr-in wcr-col" :aria-label="`${title} ${ri + 1}: column`"
            :value="columnChoice(row.column)" :title="chosenLabel(row.column) || undefined" @change="setCell(ri, 'column', $event.target.value)"
          >
            <option value="" disabled>Column…</option>
            <option v-if="columnChoice(row.column) === SAVED" :value="SAVED">{{ row.column }} (not in the table)</option>
            <option v-for="col in columns" :key="col.key" :value="col.key">{{ columnLabel(col) }}</option>
          </select>
          <input
            v-else class="wcr-in wcr-col mono" type="text" :aria-label="`${title} ${ri + 1}: column`" :placeholder="c.ph || 'column'"
            :value="row.column ?? ''" autocomplete="off" spellcheck="false"
            @focus="editor.begin(title)" @blur="editor.end()" @input="setCell(ri, 'column', $event.target.value)"
          >
        </template>
        <select
          v-else-if="Array.isArray(c.options)" class="wcr-in wcr-op" :aria-label="`${title} ${ri + 1}: ${c.ph || c.key}`"
          :value="optionValue(c, row[c.key])" @change="setCell(ri, c.key, $event.target.value)"
        >
          <option v-for="o in options(c)" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <template v-else>
          <div v-if="takesValue(row)" class="wcr-val">
            <span v-if="numbered" class="wcr-num" aria-hidden="true">${{ ri + 1 }}</span>
            <WfVarField
              :id="`${uid}-${ri}-${c.key}`" :label="numbered ? `Parameter $${ri + 1}` : `${title} ${ri + 1}: ${c.ph || c.key}`"
              :mono="!!c.mono" :placeholder="c.ph || ''"
              v-bind="editor.bindCustom(title, () => row[c.key], (v) => setCell(ri, c.key, v))"
            />
          </div>
          <span v-else class="wcr-none">No value needed</span>
        </template>
      </template>
      <button type="button" class="wcr-icon" :aria-label="`Remove ${numbered ? `parameter $${ri + 1}` : `${title} ${ri + 1}`}`" @click="remove(ri)">
        <Icon icon="lucide:x" aria-hidden="true" />
      </button>
    </div>
    <p v-if="!rows.length" class="wcr-empty">{{ emptyText }}</p>
    <div class="wcr-actions">
      <button type="button" class="wcr-add" @click="add()">
        <Icon icon="lucide:plus" aria-hidden="true" />{{ addLabel }}
      </button>
      <button v-if="fillAll && missing.length" type="button" class="wcr-add" @click="addMissing">
        <Icon icon="lucide:columns-3" aria-hidden="true" />Add every column ({{ missing.length }})
      </button>
    </div>
    <p v-if="requiredMissing.length" class="wcr-warn" role="status">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      Required: {{ requiredMissing.join(', ') }}. A row without a required value is refused.
    </p>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Icon } from '@iconify/vue'
import WfVarField from '../WfVarField.vue'
import { useNodeEditor } from './nodeEditor'

const props = defineProps({
  // The registry's kv field: { key, title, cols: [{ key, ph, mono, options }], addLabel }.
  field: { type: Object, required: true },
  // [{ key, label, type, required }] or null while the columns are not known.
  columns: { type: Array, default: null },
  // "Add every column": one row per column the list does not have yet (Insert, Update, a mapping).
  fillAll: { type: Boolean, default: false },
  // Warn about the table's required columns without a value (Insert).
  checkRequired: { type: Boolean, default: false },
  // Parameters of a query: each row is $1, $2, ... in order.
  numbered: { type: Boolean, default: false },
  emptyText: { type: String, default: 'Nothing yet.' },
})

// The operators that compare with nothing (Data Tables' and the SQL step's).
const NO_VALUE_OPS = ['is_empty', 'is_not_empty', 'is_null', 'is_not_null']
const SAVED = '__saved__'

const editor = useNodeEditor()
const uid = `wcr-${useId()}`
const title = computed(() => props.field.title || props.field.key)
const addLabel = computed(() => String(props.field.addLabel || 'Add').replace(/^\+\s*/, ''))
const single = computed(() => (props.field.cols || []).length === 1)
const opCol = computed(() => (props.field.cols || []).some((c) => c.key === 'op'))
const rows = computed(() => (Array.isArray(editor.data.value[props.field.key]) ? editor.data.value[props.field.key] : []))

const options = (c) => c.options.map((o) => (Array.isArray(o) ? { value: String(o[0]), label: o[1] } : { value: String(o), label: String(o) }))
// A row saved without the option shows the first one, which is what the engine reads it as.
const optionValue = (c, v) => (v === undefined || v === null || v === '' ? options(c)[0]?.value ?? '' : String(v))
const takesValue = (row) => !opCol.value || !NO_VALUE_OPS.includes(row.op)
const columnLabel = (col) => {
  const marks = [col.type, col.required ? 'required' : '', col.unique ? 'unique' : ''].filter(Boolean)
  const name = col.label && col.label !== col.key ? `${col.label} (${col.key})` : col.key
  return marks.length ? `${name} · ${marks.join(', ')}` : name
}
// The closed select clips a long label; its full text shows on hover.
function chosenLabel(name) { const col = (props.columns || []).find((c) => c.key === name); return col ? columnLabel(col) : '' }
function columnChoice(name) {
  if (name === undefined || name === null || name === '') return ''
  return (props.columns || []).some((c) => c.key === name) ? name : SAVED
}

const usedColumns = computed(() => new Set(rows.value.map((r) => r.column).filter(Boolean)))
const missing = computed(() => (props.columns || []).filter((c) => !c.system && !usedColumns.value.has(c.key)))
const requiredMissing = computed(() => (props.checkRequired && props.columns
  ? props.columns.filter((c) => c.required && !usedColumns.value.has(c.key)).map((c) => c.key)
  : []))

function blankRow(column = '') {
  const row = {}
  for (const c of props.field.cols || []) {
    if (c.key === 'column') row.column = column
    else row[c.key] = Array.isArray(c.options) ? (options(c)[0]?.value ?? '') : ''
  }
  return row
}
function write(next) { editor.set(props.field.key, next, title.value) }
function setCell(ri, key, value) {
  if (value === SAVED) return
  write(rows.value.map((r, i) => (i === ri ? { ...r, [key]: value } : r)))
}
function add() { write([...rows.value, blankRow()]) }
function addMissing() { write([...rows.value, ...missing.value.map((c) => blankRow(c.key))]) }
function remove(ri) { write(rows.value.filter((_, i) => i !== ri)) }
</script>

<style scoped>
.wcr { display: grid; gap: 6px; min-width: 0; }
.wcr-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) 32px; gap: 6px; align-items: start; }
.wcr-row.has-op { grid-template-columns: minmax(0, 2fr) minmax(84px, 1fr) minmax(0, 2fr) 32px; }
.wcr-row.is-single { grid-template-columns: minmax(0, 1fr) 32px; }
.wcr-in {
  width: 100%; min-width: 0; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.wcr-in.mono, .wcr-col { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
select.wcr-col { text-overflow: ellipsis; }
.wcr-in:hover { border-color: var(--vm-ink-faint); }
.wcr-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wcr-val { display: flex; gap: 6px; align-items: flex-start; min-width: 0; }
.wcr-val > :last-child { flex: 1; min-width: 0; }
.wcr-num {
  flex-shrink: 0; min-width: 30px; padding: 8px 6px; border-radius: 6px; background: var(--vm-surface-soft);
  color: var(--vm-ink-soft); font: 600 12px/1.2 var(--vm-font-mono, ui-monospace, monospace); text-align: center;
}
.wcr-none { align-self: center; font-size: 12px; color: var(--vm-ink-faint); }
.wcr-empty { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.wcr-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.wcr-icon {
  display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.wcr-icon:hover { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.wcr-icon:focus-visible, .wcr-add:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wcr-icon :deep(svg), .wcr-add :deep(svg), .wcr-warn :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.wcr-add {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 10px;
  border: 1px dashed var(--vm-line-2); border-radius: 6px; background: none; color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.wcr-add:hover { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); }
.wcr-warn { display: flex; gap: 6px; align-items: center; margin: 0; font-size: 12px; color: var(--vm-amber-ink); }
@media (max-width: 520px) {
  .wcr-row, .wcr-row.has-op { grid-template-columns: minmax(0, 1fr) 32px; }
  .wcr-row > :not(.wcr-icon) { grid-column: 1; }
  .wcr-row > .wcr-icon { grid-column: 2; grid-row: 1; }
}
@media (pointer: coarse) { .wcr-in { min-height: 44px; } .wcr-icon, .wcr-add { min-width: 44px; min-height: 44px; } }
</style>
