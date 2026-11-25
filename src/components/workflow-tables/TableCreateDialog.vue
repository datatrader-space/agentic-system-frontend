<!--
  Create a Data Table (ADM-1363): a name, a description and its columns. Each column has a label, a key (made from the
  label until the person edits it; the key is what steps and CSV headers use), a type, and Required / Unique. The keys
  are checked as they are typed; the server checks them again.
-->
<template>
  <AppDialog :open="open" title="New table" description="Rows are stored in this workspace. Workflows read and write them with the Data table step." size="lg" @update:open="emit('update:open', $event)">
    <form :id="formId" class="tcd" novalidate @submit.prevent="submit">
      <div class="tcd-field">
        <label class="tcd-label" :for="`${formId}-name`">Name</label>
        <input :id="`${formId}-name`" v-model="name" class="tcd-in" type="text" maxlength="120" autocomplete="off" required :aria-invalid="nameError ? 'true' : 'false'" :aria-describedby="nameError ? `${formId}-name-err` : undefined">
        <p v-if="nameError" :id="`${formId}-name-err`" class="tcd-err">{{ nameError }}</p>
      </div>
      <div class="tcd-field">
        <label class="tcd-label" :for="`${formId}-desc`">Description (optional)</label>
        <input :id="`${formId}-desc`" v-model="description" class="tcd-in" type="text" maxlength="500" autocomplete="off">
      </div>

      <fieldset class="tcd-cols">
        <legend class="tcd-label">Columns</legend>
        <p class="tcd-help">Every row also has <code>id</code>, <code>created_at</code> and <code>updated_at</code>. You can add, rename or remove columns later.</p>
        <div v-for="(c, i) in columns" :key="c.uid" class="tcd-col">
          <div class="tcd-field">
            <label class="tcd-small" :for="`${formId}-l${i}`">Label</label>
            <input :id="`${formId}-l${i}`" v-model="c.label" class="tcd-in" type="text" autocomplete="off" @input="onLabel(c)">
          </div>
          <div class="tcd-field">
            <label class="tcd-small" :for="`${formId}-k${i}`">Key</label>
            <input
              :id="`${formId}-k${i}`" v-model="c.key" class="tcd-in mono" type="text" autocomplete="off" spellcheck="false"
              :aria-invalid="keyError(i) ? 'true' : 'false'" :aria-describedby="keyError(i) ? `${formId}-k${i}-err` : undefined"
              @input="c.keyEdited = true"
            >
          </div>
          <div class="tcd-field">
            <label class="tcd-small" :for="`${formId}-t${i}`">Type</label>
            <select :id="`${formId}-t${i}`" v-model="c.type" class="tcd-in">
              <option v-for="t in COLUMN_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <label class="tcd-check"><input v-model="c.required" type="checkbox"> Required</label>
          <label class="tcd-check"><input v-model="c.unique" type="checkbox"> Unique</label>
          <button type="button" class="tcd-icon" :aria-label="`Remove column ${c.label || c.key || i + 1}`" @click="columns.splice(i, 1)">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
          <p v-if="keyError(i)" :id="`${formId}-k${i}-err`" class="tcd-err tcd-col-err">{{ keyError(i) }}</p>
        </div>
        <button type="button" class="tcd-add" @click="addColumn"><Icon icon="lucide:plus" aria-hidden="true" />Add column</button>
      </fieldset>
      <p v-if="error" class="tcd-err" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button type="button" class="tp-btn" @click="emit('update:open', false)">Cancel</button>
      <button type="submit" class="tp-btn tp-btn--primary" :form="formId" :disabled="saving">
        <Icon v-if="saving" icon="lucide:loader-circle" class="spin" aria-hidden="true" />{{ saving ? 'Creating…' : 'Create table' }}
      </button>
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, watch, useId } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '../common/AppDialog.vue'
import api from '@/services/api'
import { COLUMN_TYPES, apiErrorText, columnKeyProblem, keyFromLabel } from './tableData'
import './workflow-tables.css'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['update:open', 'created'])

const formId = `tcd-${useId()}`
const name = ref('')
const description = ref('')
const columns = ref([])
const saving = ref(false)
const error = ref('')
const tried = ref(false)
const nameError = ref('')
let uid = 0

function blank() { return { uid: uid += 1, label: '', key: '', keyEdited: false, type: 'text', required: false, unique: false } }
function reset() {
  name.value = ''
  description.value = ''
  columns.value = [blank()]
  error.value = ''
  nameError.value = ''
  tried.value = false
}
watch(() => props.open, (o) => { if (o) reset() }, { immediate: true })

function addColumn() { columns.value.push(blank()) }
function onLabel(c) { if (!c.keyEdited) c.key = keyFromLabel(c.label) }
function keyError(i) {
  const c = columns.value[i]
  if (!tried.value && !c.key) return ''
  return columnKeyProblem(c.key, { taken: columns.value.filter((_, j) => j < i).map((x) => x.key) })
}

async function submit() {
  tried.value = true
  nameError.value = name.value.trim() ? '' : 'Give the table a name.'
  // A column row left completely empty is not a column.
  const used = columns.value.filter((c) => c.label.trim() || c.key.trim())
  columns.value = used.length ? used : columns.value.slice(0, 0)
  const problem = columns.value.some((_, i) => keyError(i))
  if (nameError.value || problem) return
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.createWorkflowTable({
      name: name.value.trim(),
      description: description.value.trim(),
      columns: columns.value.map((c) => ({ key: c.key, label: c.label.trim() || c.key, type: c.type, required: c.required, unique: c.unique })),
    })
    emit('created', data)
    emit('update:open', false)
  } catch (e) {
    error.value = apiErrorText(e, 'The table was not created')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.tcd { display: grid; gap: 14px; }
.tcd-field { display: grid; gap: 4px; min-width: 0; }
.tcd-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.tcd-small { font-size: 11px; color: var(--vm-ink-faint); }
.tcd-help { margin: 0 0 6px; font-size: 12px; color: var(--vm-ink-faint); }
.tcd-help code { font-family: var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft); }
.tcd-in {
  width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.tcd-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.tcd-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.tcd-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.tcd-cols { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.tcd-col {
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) auto auto 36px; gap: 8px; align-items: end;
  padding: 8px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft);
}
.tcd-col-err { grid-column: 1 / -1; }
.tcd-check { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-size: 12px; color: var(--vm-ink-soft); cursor: pointer; white-space: nowrap; }
.tcd-check input { width: 16px; height: 16px; accent-color: var(--vm-primary); }
.tcd-icon { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 6px; background: none; color: var(--vm-ink-faint); cursor: pointer; }
.tcd-icon:hover { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.tcd-add { justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 5px 10px; border: 1px dashed var(--vm-line-2); border-radius: 6px; background: none; color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer; }
.tcd-add:hover { background: var(--vm-primary-soft); }
.tcd-icon:focus-visible, .tcd-add:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.tcd :deep(svg) { width: 14px; height: 14px; }
.tcd-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
@media (max-width: 640px) {
  .tcd-col { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tcd-col > :nth-child(3) { grid-column: 1 / -1; }
}
@media (pointer: coarse) { .tcd-in, .tcd-check { min-height: 44px; } .tcd-icon, .tcd-add { min-width: 44px; min-height: 44px; } }
</style>
