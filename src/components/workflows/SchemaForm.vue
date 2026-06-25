<template>
  <div class="schema-form">
    <template v-for="grp in groups" :key="grp.name">
      <div v-if="grp.name" class="sf-group-h">{{ grp.name }}</div>
      <template v-for="(f, fi) in grp.fields" :key="f.key || ('note' + fi)">
        <template v-if="!f.showIf || f.showIf(data)">
          <!-- info note (no data binding) -->
          <p v-if="f.type === 'note'" class="ins-note">{{ f.text }}</p>

          <template v-else>
          <!-- label (+ insert-variable button) -->
          <div v-if="f.insertable" class="lbl-row">
            <label class="ins-l">{{ f.title }}</label>
            <button type="button" class="insvar" @click="$emit('insert', f.key)">＋ Insert variable</button>
          </div>
          <label v-else-if="f.title" class="ins-l">{{ f.title }}</label>

          <!-- controls -->
          <textarea v-if="f.type === 'textarea'" class="ins-in" :class="{ mono: f.mono }" :rows="f.rows || 4"
            :placeholder="f.placeholder" :value="data[f.key]"
            @input="set(f, $event.target.value)" @blur="$emit('blur', f.key, $event)"
            @dragover.prevent @drop="onDrop(f, $event)"></textarea>

          <select v-else-if="f.type === 'enum'" class="ins-in" :value="data[f.key]"
            @change="set(f, $event.target.value)">
            <option v-if="f.placeholder" :value="''" disabled>{{ f.placeholder }}</option>
            <option v-for="o in normOptions(fieldOptions(f))" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>

          <!-- key/value list editor (e.g. manual-trigger inputs) -->
          <div v-else-if="f.type === 'kv'" class="sf-kv">
            <div v-for="(row, ri) in (data[f.key] || [])" :key="ri" class="kv-row">
              <input v-for="c in f.cols" :key="c.key" class="ins-in" :class="{ mono: c.mono }"
                :placeholder="c.ph" :value="row[c.key]" @input="kvSet(f, ri, c.key, $event.target.value)" />
              <button type="button" class="kv-del" @click="kvDel(f, ri)" title="Remove">×</button>
            </div>
            <button type="button" class="kv-add" @click="kvAdd(f)">{{ f.addLabel || '+ Add' }}</button>
          </div>

          <label v-else-if="f.type === 'boolean'" class="sf-switch">
            <input type="checkbox" :checked="!!data[f.key]" @change="set(f, $event.target.checked)" />
            <span>{{ f.switchLabel || 'Enabled' }}</span>
          </label>

          <template v-else-if="f.type === 'number'">
            <input class="ins-in" type="number" :min="f.min" :max="f.max" :placeholder="f.placeholder"
              :value="data[f.key]" @input="set(f, $event.target.value)" @blur="$emit('blur', f.key, $event)" />
          </template>

          <template v-else>
            <!-- string / password -->
            <input class="ins-in" :class="{ mono: f.mono }" :type="f.type === 'password' ? 'password' : 'text'"
              :list="f.list ? 'sf-list-' + f.key : undefined" :placeholder="f.placeholder"
              :value="data[f.key]" @input="set(f, $event.target.value)" @blur="$emit('blur', f.key, $event)"
              @dragover.prevent @drop="onDrop(f, $event)" />
            <datalist v-if="f.list && lists[f.list]" :id="'sf-list-' + f.key">
              <option v-for="opt in lists[f.list]" :key="opt" :value="opt" />
            </datalist>
          </template>

          <p v-if="f.help" class="ins-hint">{{ f.help }}</p>
          </template>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { insertAt } from '../../utils/wfVarExpr'

const props = defineProps({
  // The node's `data` object — mutated in place (same ref the parent inspector binds to).
  data: { type: Object, required: true },
  // Field schema (from wfFields(type)).
  fields: { type: Array, default: () => [] },
  // Named lists for datalists, e.g. { tools: ['GITHUB_...', ...] }.
  lists: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['change', 'insert', 'blur'])

// Group + order fields Flow Weaver-style (ungrouped fields keep registry order in one '' group).
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

function normOptions(options) {
  return (options || []).map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: o }))
}
// enum options: static `options` OR dynamic from `lists[optionsKey]` (e.g. owned graphs/agents).
function fieldOptions(field) {
  return field.optionsKey ? (props.lists[field.optionsKey] || []) : field.options
}

function set(field, raw) {
  let val = raw
  if (field.type === 'number') val = raw === '' || raw === null ? null : Number(raw)
  props.data[field.key] = val
  emit('change', field.key, val)   // (key, value) so the parent can derive companion fields
}

// key/value list editor
function kvAdd(field) {
  if (!Array.isArray(props.data[field.key])) props.data[field.key] = []
  const row = {}; (field.cols || []).forEach((c) => { row[c.key] = '' })
  props.data[field.key].push(row); emit('change', field.key)
}
function kvSet(field, ri, col, val) { props.data[field.key][ri][col] = val; emit('change', field.key) }
function kvDel(field, ri) { props.data[field.key].splice(ri, 1); emit('change', field.key) }

// Drag-to-insert: a variable dragged from the Data Picker tree drops into this field at the caret.
function onDrop(field, e) {
  const expr = e.dataTransfer.getData('application/x-wf-var') || e.dataTransfer.getData('text/plain')
  if (!expr) return
  e.preventDefault()
  const el = e.target
  const cur = String(props.data[field.key] ?? '')
  props.data[field.key] = insertAt(cur, el.selectionStart, el.selectionEnd, expr)
  emit('change')
}
</script>

<style scoped>
.sf-group-h { margin-top: 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; }
.sf-switch { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #334155; margin-bottom: 4px; }
</style>
