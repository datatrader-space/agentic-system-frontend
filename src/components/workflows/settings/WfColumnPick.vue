<!--
  One column, or several, of the table a Data step reads (ADM-1363): Get one's unique column, Get rows' order, the SQL
  step's columns and upsert match, a database trigger's cursor column. The value is saved as the step stores it:
  one name, or names joined by ", " (`multiple`). A saved name the table no longer has stays and is marked. While the
  columns are not known it is a plain text field.

    <WfColumnPick :id :field="field" :columns="cols" />              one name
    <WfColumnPick :id :field="field" :columns="cols" multiple />     "id, email"
-->
<template>
  <div class="wcp">
    <template v-if="!columns">
      <input
        :id="id" class="wcp-in mono" type="text" :value="current" :placeholder="field.placeholder || ''" autocomplete="off" spellcheck="false"
        :aria-describedby="describedby || undefined"
        @focus="editor.begin(title)" @blur="editor.end()" @input="editor.set(field.key, $event.target.value, title)"
      >
    </template>
    <select
      v-else-if="!multiple" :id="id" class="wcp-in mono" :value="singleChoice" :aria-describedby="describedby || undefined"
      @change="pickOne($event.target.value)"
    >
      <option value="">{{ emptyLabel }}</option>
      <option v-if="singleChoice === SAVED" :value="SAVED">{{ current }} (not in the table)</option>
      <option v-for="c in choices" :key="c.key" :value="c.key">{{ label(c) }}</option>
    </select>
    <div v-else :id="id" class="wcp-chips" role="group" :aria-label="title" :aria-describedby="describedby || undefined">
      <button
        v-for="c in choices" :key="c.key" type="button" class="wcp-chip" :class="{ on: picked.includes(c.key) }"
        :aria-pressed="picked.includes(c.key) ? 'true' : 'false'" @click="toggle(c.key)"
      >
        <Icon v-if="picked.includes(c.key)" icon="lucide:check" aria-hidden="true" />{{ c.key }}
      </button>
      <span v-for="name in unknown" :key="`u-${name}`" class="wcp-chip is-unknown" :title="`${name} is not in the table`">
        {{ name }} (not in the table)
        <button type="button" class="wcp-x" :aria-label="`Remove ${name}`" @click="toggle(name)"><Icon icon="lucide:x" aria-hidden="true" /></button>
      </span>
      <span v-if="!choices.length" class="wcp-none">The table has no columns to choose.</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useNodeEditor } from './nodeEditor'

const props = defineProps({
  id: { type: String, required: true },
  field: { type: Object, required: true },
  columns: { type: Array, default: null },
  multiple: { type: Boolean, default: false },
  // Only the table's unique columns (Get one, Upsert).
  uniqueOnly: { type: Boolean, default: false },
  emptyLabel: { type: String, default: 'Choose a column…' },
  describedby: { type: String, default: '' },
})

const SAVED = '__saved__'
const editor = useNodeEditor()
const title = computed(() => props.field.title || props.field.key)
const current = computed(() => String(editor.data.value[props.field.key] ?? ''))
const choices = computed(() => (props.columns || []).filter((c) => !props.uniqueOnly || c.unique || c.key === 'id'))
const label = (c) => [c.key, c.type].filter(Boolean).join(' · ')

/** "a, b" -> ['a', 'b'] (empty entries dropped). */
const split = (text) => String(text || '').split(',').map((x) => x.trim()).filter(Boolean)
const picked = computed(() => split(current.value))
const unknown = computed(() => picked.value.filter((n) => !choices.value.some((c) => c.key === n)))
const singleChoice = computed(() => {
  if (!current.value) return ''
  return choices.value.some((c) => c.key === current.value) ? current.value : SAVED
})

function pickOne(value) {
  if (value === SAVED) return
  editor.set(props.field.key, value, title.value)
}
function toggle(name) {
  const next = picked.value.includes(name) ? picked.value.filter((n) => n !== name) : [...picked.value, name]
  editor.set(props.field.key, next.join(', '), title.value)
}
</script>

<style scoped>
.wcp { min-width: 0; }
.wcp-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.wcp-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.wcp-in:hover { border-color: var(--vm-ink-faint); }
.wcp-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wcp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.wcp-chip {
  display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 4px 10px; border: 1px solid var(--vm-line-2);
  border-radius: 999px; background: var(--vm-surface); color: var(--vm-ink-soft);
  font: 500 12px/1.2 var(--vm-font-mono, ui-monospace, monospace); cursor: pointer;
  transition: background-color .15s var(--vm-ease2), border-color .15s var(--vm-ease2);
}
.wcp-chip:hover { border-color: var(--vm-primary-line); }
.wcp-chip.on { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); color: var(--vm-link); }
.wcp-chip.is-unknown { cursor: default; background: var(--vm-amber-soft); border-color: transparent; color: var(--vm-amber-ink); }
.wcp-chip:focus-visible, .wcp-x:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wcp-chip :deep(svg) { width: 12px; height: 12px; }
.wcp-x { display: grid; place-items: center; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; }
.wcp-none { font-size: 12px; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .wcp-in, .wcp-chip { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .wcp-chip { transition: none; } }
</style>
