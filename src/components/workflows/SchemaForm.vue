<!--
  The schema-driven settings of a node (ADM-1333, plan §3.3): the fields declared in wfNodeDefinitions.js, inside the
  node window. It reads the node from the node editor (useNodeEditor) and NEVER changes it in place: every change is
  a history operation (D1 rule 1), one entry per field edit (a text field batches its typing from focus to blur).

    <SchemaForm :fields="wfFields(type)" :lists="{ tools }" :derive="(key, value) => ({ graph_name })" />

  - Text and textarea fields are WfVarField (variable pills, {{ or @ picker, drop and keyboard insert); a field with a
    `list` (tool names) is a plain input with suggestions; a password field is a plain password input.
  - An enum saves the option's DECLARED value, so a number stays a number (F5). A saved value the list no longer
    offers stays selected and is marked.
  - A number is saved as a number and min/max are enforced with an inline error (F5, NumberField).
  - Changing `operation` clears a media-route field in the same change (F4: the route list itself never clears it).
  - `derive(key, value, data)` returns companion keys to write with a change (graph_id → graph_name).
  - `showIf` is data from the server's registry (ADM-1351): { field: value | [values] }; see wfFieldShown.
  - A kv column with `options` is a select (a manual input's type: Text or Image); a new row takes its first option.
  - An enum whose options come from a list the editor loads (`optionsKey`, e.g. visionModels) says while it loads and
    shows a failed load with a Retry; the saved value is kept.
  - A text field whose typed input (the registry's `inputs`) takes the `images` kind is a LIST of references (a Model
    call's Images): an inserted variable is set apart with ", " (WfVarField `separator`).
  Slots: `field-<key>` ({ field, id }) replaces a field's control, keeping its label and help.
-->
<template>
  <div class="schema-form">
    <template v-for="grp in groups" :key="grp.name">
      <h4 v-if="grp.name" class="sf-group-h">{{ grp.name }}</h4>
      <template v-for="(f, fi) in grp.fields" :key="f.key || ('note' + fi)">
        <template v-if="wfFieldShown(f, data)">
          <p v-if="f.type === 'note'" class="sf-note">{{ f.text }}</p>

          <div v-else class="sf-field">
            <span v-if="f.type === 'kv'" class="sf-label">{{ f.title || f.key }}</span>
            <label v-else-if="f.type !== 'boolean'" class="sf-label" :for="fieldId(f)">{{ f.title || f.key }}</label>

            <slot :name="`field-${f.key}`" :field="f" :id="fieldId(f)">
              <WfVarField
                v-if="f.type === 'textarea' || ((f.type === 'string' || !f.type) && !f.list)"
                :id="fieldId(f)"
                :label="f.title || f.key"
                :multiline="f.type === 'textarea'"
                :rows="f.rows || 4"
                :mono="!!f.mono"
                :placeholder="f.placeholder || ''"
                :describedby="f.help ? helpId(f) : ''"
                :separator="listField(f) ? ', ' : ''"
                v-bind="editor.bindText(f.key, f.title || f.key)"
              />

              <template v-else-if="f.type === 'string' && f.list">
                <input
                  :id="fieldId(f)" class="sf-in" :class="{ mono: f.mono }" type="text" :list="`${uid}-list-${f.key}`"
                  :placeholder="f.placeholder" :value="data[f.key] ?? ''" autocomplete="off" spellcheck="false"
                  :aria-describedby="f.help ? helpId(f) : undefined"
                  @focus="editor.begin(f.title || f.key)" @blur="editor.end()"
                  @input="write(f, $event.target.value)"
                >
                <datalist :id="`${uid}-list-${f.key}`">
                  <option v-for="opt in allLists[f.list] || []" :key="opt" :value="opt" />
                </datalist>
              </template>

              <input
                v-else-if="f.type === 'password'"
                :id="fieldId(f)" class="sf-in" type="password" :placeholder="f.placeholder" :value="data[f.key] ?? ''"
                autocomplete="new-password" :aria-describedby="f.help ? helpId(f) : undefined"
                @focus="editor.begin(f.title || f.key)" @blur="editor.end()"
                @input="write(f, $event.target.value)"
              >

              <MediaRouteSelect
                v-else-if="f.type === 'media-route'"
                :id="fieldId(f)" :operation="data.operation" :model-value="data[f.key]"
                @update:model-value="write(f, $event)"
              />

              <select
                v-else-if="f.type === 'enum'"
                :id="fieldId(f)" class="sf-in" :value="enumIndex(f)"
                :aria-describedby="f.help ? helpId(f) : undefined"
                @change="pickEnum(f, $event.target.value)"
              >
                <option v-if="enumIndex(f) === ''" value="" disabled>{{ listState(f)?.loading ? 'Loading…' : (f.placeholder || 'Choose…') }}</option>
                <option v-if="enumIndex(f) === 'saved'" value="saved">Saved: {{ data[f.key] }} (no longer in the list)</option>
                <option v-for="(o, oi) in enumOptions(f)" :key="oi" :value="String(oi)">{{ o.label }}</option>
              </select>
              <p v-if="f.type === 'enum' && listState(f)?.error" class="sf-list-error" role="alert">
                <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ listState(f).error }}</span>
                <button type="button" class="sf-add" @click="listState(f).retry()">
                  <Icon icon="lucide:refresh-cw" aria-hidden="true" />Retry
                </button>
              </p>

              <div v-else-if="f.type === 'kv'" class="sf-kv" role="group" :aria-label="f.title">
                <div v-for="(row, ri) in kvRows(f)" :key="ri" class="sf-kv-row">
                  <template v-for="c in f.cols" :key="c.key">
                    <select
                      v-if="Array.isArray(c.options)" class="sf-in sf-kv-select" :aria-label="`${f.title} ${ri + 1}: ${c.ph}`"
                      :value="kvOption(c, row[c.key])" @change="kvSet(f, ri, c.key, $event.target.value)"
                    >
                      <option v-for="o in colOptions(c)" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                    <input
                      v-else class="sf-in" :class="{ mono: c.mono }" type="text"
                      :placeholder="c.ph" :aria-label="`${f.title} ${ri + 1}: ${c.ph}`" :value="row[c.key] ?? ''"
                      autocomplete="off" spellcheck="false"
                      @focus="editor.begin(f.title || f.key)" @blur="editor.end()"
                      @input="kvSet(f, ri, c.key, $event.target.value)"
                    >
                  </template>
                  <button type="button" class="sf-icon-btn" :aria-label="`Remove ${f.title} ${ri + 1}`" @click="kvDel(f, ri)">
                    <Icon icon="lucide:x" aria-hidden="true" />
                  </button>
                </div>
                <button type="button" class="sf-add" @click="kvAdd(f)">
                  <Icon icon="lucide:plus" aria-hidden="true" />{{ addLabel(f) }}
                </button>
              </div>

              <label v-else-if="f.type === 'boolean'" class="sf-switch" :for="fieldId(f)">
                <input :id="fieldId(f)" type="checkbox" :checked="!!data[f.key]" @change="write(f, $event.target.checked)">
                <span>{{ f.title || f.switchLabel || 'Enabled' }}</span>
              </label>

              <NumberField
                v-else-if="f.type === 'number'"
                :id="fieldId(f)" :label="f.title || f.key" :model-value="data[f.key]"
                :min="f.min ?? null" :max="f.max ?? null" :integer="!!f.integer" :optional="f.optional !== false"
                :placeholder="f.placeholder || ''" :describedby="f.help ? helpId(f) : ''"
                @update:model-value="write(f, $event)"
              />
            </slot>

            <p v-if="f.help" :id="helpId(f)" class="sf-help">{{ f.help }}</p>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Icon } from '@iconify/vue'
import WfVarField from './WfVarField.vue'
import MediaRouteSelect from './MediaRouteSelect.vue'
import NumberField from './settings/NumberField.vue'
import { useNodeEditor } from './settings/nodeEditor'
import { wfFieldShown } from '@/config/wfNodeDefinitions'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  // Named lists besides the editor's own (graphs, scripts): e.g. { tools: ['GITHUB_…', …] }.
  lists: { type: Object, default: () => ({}) },
  derive: { type: Function, default: null },
})

const editor = useNodeEditor()
const uid = `sf-${useId()}`
const data = computed(() => editor.data.value)
const allLists = computed(() => ({ ...editor.lists.value, ...props.lists }))
// The load state of a list the editor fetches ({ loading, error, retry }), or null for a list that is simply there.
const listState = (f) => (f.optionsKey ? editor.listStates?.value?.[f.optionsKey] || null : null)
const fieldId = (f) => `${uid}-${f.key}`
const helpId = (f) => `${uid}-${f.key}-help`
const addLabel = (f) => String(f.addLabel || 'Add').replace(/^\+\s*/, '')
// A field that takes a list of images (its typed input accepts the `images` kind) holds several references.
const listField = (f) => {
  const kinds = editor.def?.value?.inputs?.[f.key]
  return Array.isArray(kinds) && kinds.includes('images')
}

// Group and order fields (ungrouped fields keep the registry order in one '' group).
const groups = computed(() => {
  const map = new Map()
  props.fields.forEach((f, i) => {
    const name = f.group || ''
    if (!map.has(name)) map.set(name, { name, order: f.groupOrder ?? 0, fields: [] })
    map.get(name).fields.push({ ...f, _i: i })
  })
  const arr = [...map.values()]
  arr.forEach((g) => g.fields.sort((a, b) => (a.fieldOrder ?? a._i) - (b.fieldOrder ?? b._i)))
  arr.sort((a, b) => a.order - b.order)
  return arr
})

function write(field, value) {
  const values = { [field.key]: value }
  if (field.key === 'operation' && value !== data.value.operation) {
    for (const f of props.fields) if (f.type === 'media-route') values[f.key] = ''
  }
  if (props.derive) Object.assign(values, props.derive(field.key, value, data.value) || {})
  editor.patch(values, field.title || field.key)
}

// ── enum: the option's declared value is saved, never the <select>'s text ──
function enumOptions(field) {
  const opts = field.optionsKey ? (allLists.value[field.optionsKey] || []) : (field.options || [])
  return opts.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: String(o) }))
}
function enumIndex(field) {
  const v = data.value[field.key]
  if (v === '' || v === null || v === undefined) return ''
  const opts = enumOptions(field)
  let i = opts.findIndex((o) => o.value === v)
  if (i === -1) i = opts.findIndex((o) => String(o.value) === String(v))
  return i === -1 ? 'saved' : String(i)
}
function pickEnum(field, index) {
  if (index === '' || index === 'saved') return
  const opt = enumOptions(field)[Number(index)]
  if (opt) write(field, opt.value)
}

// ── key/value rows: the whole list is written each time ──
const kvRows = (field) => (Array.isArray(data.value[field.key]) ? data.value[field.key] : [])
const colOptions = (c) => c.options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: String(o) }))
// A row saved before the column existed (no type) shows the first option, which is what the engine reads it as.
const kvOption = (c, v) => (v === undefined || v === null || v === '' ? colOptions(c)[0]?.value ?? '' : v)
function kvAdd(field) {
  const row = Object.fromEntries((field.cols || []).map((c) => [c.key, Array.isArray(c.options) ? (colOptions(c)[0]?.value ?? '') : '']))
  write(field, [...kvRows(field), row])
}
function kvSet(field, ri, col, value) {
  write(field, kvRows(field).map((row, i) => (i === ri ? { ...row, [col]: value } : row)))
}
function kvDel(field, ri) { write(field, kvRows(field).filter((_, i) => i !== ri)) }
</script>

<style scoped>
.schema-form { display: grid; gap: 14px; }
.sf-group-h { margin: 6px 0 0; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--vm-ink-faint); }
.sf-field { display: grid; gap: 5px; min-width: 0; }
.sf-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.sf-note, .sf-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.sf-note { color: var(--vm-ink-soft); }
.sf-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.sf-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.sf-in::placeholder { color: var(--vm-ink-faint); }
.sf-in:hover { border-color: var(--vm-ink-faint); }
.sf-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.sf-kv { display: grid; gap: 6px; }
.sf-kv-row { display: flex; gap: 6px; align-items: center; }
.sf-kv-row .sf-in { flex: 1; min-width: 0; }
.sf-kv-row .sf-kv-select { flex: 0 0 auto; width: auto; min-width: 84px; }
.sf-list-error { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; font-size: 12px; line-height: 1.45; color: var(--vm-red-ink); }
.sf-list-error > :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.sf-icon-btn {
  display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.sf-icon-btn:hover { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.sf-icon-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.sf-icon-btn :deep(svg), .sf-add :deep(svg) { width: 14px; height: 14px; }
.sf-add {
  justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 10px;
  border: 1px dashed var(--vm-line-2); border-radius: 6px; background: none; color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.sf-add:hover { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); }
.sf-add:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.sf-switch { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 13px; color: var(--vm-ink-soft); cursor: pointer; }
.sf-switch input { width: 16px; height: 16px; accent-color: var(--vm-primary); }
@media (pointer: coarse) { .sf-in { min-height: 44px; } .sf-icon-btn, .sf-add { min-width: 44px; min-height: 44px; } }
</style>
