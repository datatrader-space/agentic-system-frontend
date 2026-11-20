<!--
  A condition step's settings (ADM-1333, F3). The engine (executor.py `_run_condition`) reads either RULES
  (`conditions`: [{ field, operator, value }] joined by `join` AND/OR) or one free-text `expression`; rules win when
  there are any. So the window offers the two as one choice, and editing one REPLACES the other in the same change,
  never leaving a hidden second definition behind.

  F3 fixes: rows are read without writing during render (an empty step shows one draft rule that is saved only when
  edited), every change is a history operation, no demo text, and no "Case sensitive" option (comparisons are
  case-sensitive, and the window says so).
-->
<template>
  <div class="cs">
    <fieldset class="cs-mode">
      <legend class="cs-label">Write the condition as</legend>
      <label class="cs-radio"><input type="radio" :name="`${uid}-mode`" value="rules" :checked="mode === 'rules'" @change="mode = 'rules'"> Rules</label>
      <label class="cs-radio"><input type="radio" :name="`${uid}-mode`" value="expression" :checked="mode === 'expression'" @change="mode = 'expression'"> Expression</label>
    </fieldset>

    <template v-if="mode === 'rules'">
      <p v-if="hasExpression" class="cs-note">This step also has an expression. Your first change to the rules replaces it.</p>
      <fieldset v-for="(row, i) in rows" :key="i" class="cs-row">
        <legend class="cs-row-h">Rule {{ i + 1 }}</legend>
        <div class="cs-cell">
          <label class="cs-label" :for="`${uid}-f${i}`">Value to test</label>
          <WfVarField
            :id="`${uid}-f${i}`" :label="`Rule ${i + 1} value to test`" mono placeholder="{{nodes.<id>.output.score}}"
            v-bind="editor.bindCustom(`Condition rule ${i + 1}`, () => row.field, (v) => setRow(i, { field: v }))"
          />
        </div>
        <div class="cs-cell cs-op">
          <label class="cs-label" :for="`${uid}-o${i}`">Operator</label>
          <select :id="`${uid}-o${i}`" class="cs-in" :value="row.operator || '='" @change="setRow(i, { operator: $event.target.value })">
            <option v-for="op in OPERATORS" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
        </div>
        <div class="cs-cell">
          <label class="cs-label" :for="`${uid}-v${i}`">Compare with</label>
          <WfVarField
            :id="`${uid}-v${i}`" :label="`Rule ${i + 1} compare with`" placeholder="50"
            v-bind="editor.bindCustom(`Condition rule ${i + 1}`, () => row.value, (v) => setRow(i, { value: v }))"
          />
        </div>
        <button v-if="saved.length" type="button" class="cs-icon-btn" :aria-label="`Remove rule ${i + 1}`" @click="removeRow(i)">
          <Icon icon="lucide:trash-2" aria-hidden="true" />
        </button>
      </fieldset>

      <div v-if="rows.length > 1" class="cs-cell">
        <label class="cs-label" :for="`${uid}-join`">When there are several rules</label>
        <select :id="`${uid}-join`" class="cs-in" :value="join" @change="writeRows(rows, $event.target.value)">
          <option value="AND">All rules must match (AND)</option>
          <option value="OR">Any rule may match (OR)</option>
        </select>
      </div>
      <button type="button" class="cs-add" @click="addRow"><Icon icon="lucide:plus" aria-hidden="true" />Add rule</button>
      <p class="cs-help">Text comparisons are case-sensitive. Numbers are compared as numbers. Each token's value is read when the step runs.</p>
    </template>

    <template v-else>
      <p v-if="saved.length" class="cs-note">This step has rules. Your first change to the expression replaces them.</p>
      <div class="cs-cell">
        <label class="cs-label" :for="`${uid}-expr`">Expression</label>
        <WfVarField
          :id="`${uid}-expr`" label="Expression" mono :describedby="`${uid}-expr-help`"
          placeholder="{{nodes.<id>.output.score}} > 50 and {{trigger.plan}} == 'pro'"
          v-bind="editor.bindCustom('Condition expression', () => editor.data.value.expression, writeExpression)"
        />
        <p :id="`${uid}-expr-help`" class="cs-help">
          Operators: == != &lt; &lt;= &gt; &gt;= in, not in, contains, startswith, endswith, matches; combine with and, or, not.
          Put text in quotes, as in <code translate="no">{{ exampleQuoted }}</code>.
        </p>
      </div>
    </template>

    <div class="cs-summary" aria-live="polite">
      <strong>The True path runs when:</strong>
      <code v-if="summary" translate="no">{{ summary }}</code>
      <span v-else>nothing is set yet. Add a rule above.</span>
    </div>
    <p class="cs-help">Connect the True and False handles on the canvas to the step for each case.</p>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import WfVarField from '../WfVarField.vue'
import { useNodeEditor } from './nodeEditor'

// The builder's operator words; the engine maps `=` to `==` (executor.py `_compare_row`).
const OPERATORS = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'does not equal (!=)' },
  { value: '>', label: 'is more than (>)' },
  { value: '>=', label: 'is at least (>=)' },
  { value: '<', label: 'is less than (<)' },
  { value: '<=', label: 'is at most (<=)' },
  { value: 'contains', label: 'contains' },
  { value: 'startswith', label: 'starts with' },
  { value: 'endswith', label: 'ends with' },
  { value: 'matches', label: 'matches the pattern' },
]
const EMPTY_ROW = Object.freeze({ field: '', operator: '=', value: '' })
const exampleQuoted = "{{trigger.name}} == 'Acme Ltd'"

const editor = useNodeEditor()
const uid = `cs-${useId()}`

const saved = computed(() => (Array.isArray(editor.data.value.conditions) ? editor.data.value.conditions : []))
// Read only: an empty step shows one draft rule, written the first time it is edited.
const rows = computed(() => (saved.value.length ? saved.value : [EMPTY_ROW]))
const join = computed(() => (String(editor.data.value.join || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND'))
const hasExpression = computed(() => !!String(editor.data.value.expression || '').trim())
const hasRules = computed(() => saved.value.some((r) => String(r?.field || '').trim()))

const initialMode = () => (hasRules.value ? 'rules' : hasExpression.value ? 'expression' : 'rules')
const mode = ref(initialMode())
watch(() => editor.node.value?.id, () => { mode.value = initialMode() })

function writeRows(next, nextJoin = join.value) {
  const values = { conditions: next.map((r) => ({ field: r.field ?? '', operator: r.operator || '=', value: r.value ?? '' })) }
  if (next.length > 1 || 'join' in editor.data.value) values.join = nextJoin
  if ('expression' in editor.data.value) values.expression = undefined
  editor.patch(values, 'Condition')
}
function setRow(i, change) { writeRows(rows.value.map((r, j) => (j === i ? { ...r, ...change } : r))) }
function addRow() { writeRows([...rows.value, { ...EMPTY_ROW }]) }
function removeRow(i) { writeRows(rows.value.filter((_, j) => j !== i)) }

function writeExpression(v) {
  const values = { expression: v }
  if ('conditions' in editor.data.value) values.conditions = undefined
  if ('join' in editor.data.value) values.join = undefined
  editor.patch(values, 'Condition')
}

const summary = computed(() => {
  if (mode.value === 'expression') return String(editor.data.value.expression || '').trim()
  const set = saved.value.filter((r) => String(r?.field || '').trim())
  return set.map((r) => `${r.field} ${r.operator || '='} ${r.value ?? ''}`.trim()).join(join.value === 'OR' ? ' or ' : ' and ')
})
</script>

<style scoped>
.cs { display: grid; gap: 14px; }
.cs-mode { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; border: 0; }
.cs-mode legend { width: 100%; margin-bottom: 4px; }
.cs-radio { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; font-size: 13px; color: var(--vm-ink); cursor: pointer; }
.cs-radio input { accent-color: var(--vm-primary); width: 16px; height: 16px; }
.cs-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.cs-row {
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(120px, .8fr) minmax(0, 1fr) auto; gap: 8px; align-items: end;
  margin: 0; padding: 10px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft);
}
.cs-row-h { padding: 0 4px; font-size: 11px; font-weight: 600; color: var(--vm-ink-faint); }
.cs-cell { display: grid; gap: 5px; min-width: 0; }
.cs-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.cs-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.cs-icon-btn {
  display: grid; place-items: center; width: 32px; height: 34px; border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.cs-icon-btn:hover { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.cs-icon-btn:focus-visible, .cs-add:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.cs-icon-btn :deep(svg), .cs-add :deep(svg) { width: 14px; height: 14px; }
.cs-add {
  justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 10px;
  border: 1px dashed var(--vm-line-2); border-radius: 6px; background: none; color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.cs-add:hover { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); }
.cs-note { margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font-size: 12px; }
.cs-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.cs-help code, .cs-summary code { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; overflow-wrap: anywhere; }
.cs-summary { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--vm-line); border-radius: 8px; font-size: 12px; color: var(--vm-ink-soft); }
.cs-summary code { color: var(--vm-ink); }
@media (max-width: 720px) { .cs-row { grid-template-columns: 1fr; } .cs-icon-btn { justify-self: end; } }
@media (pointer: coarse) { .cs-in, .cs-icon-btn, .cs-add, .cs-radio { min-height: 44px; } .cs-icon-btn { width: 44px; } }
</style>
