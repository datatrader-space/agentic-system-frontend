<!--
  An existing table's columns (ADM-1363): add, rename (label and key), Required / Unique, remove. Only the table's
  creator and the workspace's Admins may (the table's `can.manage`); everyone else sees the columns. Renaming a key or
  removing a column changes what the workflows that use it read, so both ask first (the app's own confirm dialog).
-->
<template>
  <section class="tcp" aria-labelledby="tcp-h">
    <h3 id="tcp-h" class="tcp-h">Columns <span class="tcp-count">{{ table.columns.length }}</span></h3>
    <p v-if="!canManage" class="tcp-note"><Icon icon="lucide:lock" aria-hidden="true" />Only the table's creator and the workspace's Admins change its columns.</p>
    <ul class="tcp-list">
      <li v-for="c in table.columns" :key="c.key" class="tcp-row">
        <template v-if="editing === c.key">
          <div class="tcp-edit">
            <label class="tcp-small" :for="`${uid}-el`">Label</label>
            <input :id="`${uid}-el`" v-model="edit.label" class="tcp-in" type="text" autocomplete="off" @keydown.esc="editing = ''">
            <label class="tcp-small" :for="`${uid}-ek`">Key</label>
            <input :id="`${uid}-ek`" v-model="edit.key" class="tcp-in mono" type="text" autocomplete="off" spellcheck="false" :aria-invalid="editKeyError ? 'true' : 'false'" @keydown.esc="editing = ''">
            <p v-if="editKeyError" class="tcp-err">{{ editKeyError }}</p>
            <div class="tcp-actions">
              <button type="button" class="tp-btn" @click="editing = ''">Cancel</button>
              <button type="button" class="tp-btn tp-btn--primary" :disabled="busy || !!editKeyError" @click="saveRename(c)">Save</button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="tcp-name">
            <strong>{{ c.label || c.key }}</strong>
            <code translate="no">{{ c.key }}</code>
          </div>
          <span class="tp-chip tp-chip--muted">{{ typeLabel(c.type) }}</span>
          <label class="tcp-check"><input type="checkbox" :checked="!!c.required" :disabled="!canManage || busy" @change="setFlag(c, 'required', $event.target.checked)"> Required</label>
          <label class="tcp-check"><input type="checkbox" :checked="!!c.unique" :disabled="!canManage || busy" @change="setFlag(c, 'unique', $event.target.checked)"> Unique</label>
          <div v-if="canManage" class="tcp-row-actions">
            <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Rename ${c.key}`" title="Rename" :disabled="busy" @click="startRename(c)"><Icon icon="lucide:pencil" aria-hidden="true" /></button>
            <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Remove ${c.key}`" title="Remove" :disabled="busy" @click="remove(c)"><Icon icon="lucide:trash-2" aria-hidden="true" /></button>
          </div>
        </template>
      </li>
      <li v-if="!table.columns.length" class="tcp-empty">No columns yet.</li>
    </ul>

    <form v-if="canManage" class="tcp-add" @submit.prevent="addColumn">
      <div class="tcp-f">
        <label class="tcp-small" :for="`${uid}-al`">New column label</label>
        <input :id="`${uid}-al`" v-model="draft.label" class="tcp-in" type="text" autocomplete="off" @input="onDraftLabel">
      </div>
      <div class="tcp-f">
        <label class="tcp-small" :for="`${uid}-ak`">Key</label>
        <input :id="`${uid}-ak`" v-model="draft.key" class="tcp-in mono" type="text" autocomplete="off" spellcheck="false" :aria-invalid="draft.key && draftKeyError ? 'true' : 'false'" :aria-describedby="draft.key && draftKeyError ? `${uid}-ake` : undefined" @input="draft.keyEdited = true">
      </div>
      <div class="tcp-f">
        <label class="tcp-small" :for="`${uid}-at`">Type</label>
        <select :id="`${uid}-at`" v-model="draft.type" class="tcp-in">
          <option v-for="t in COLUMN_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <label class="tcp-check"><input v-model="draft.required" type="checkbox"> Required</label>
      <label class="tcp-check"><input v-model="draft.unique" type="checkbox"> Unique</label>
      <button type="submit" class="tp-btn" :disabled="busy || !draft.key || !!draftKeyError"><Icon icon="lucide:plus" aria-hidden="true" />Add column</button>
      <p v-if="draft.key && draftKeyError" :id="`${uid}-ake`" class="tcp-err tcp-wide">{{ draftKeyError }}</p>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { COLUMN_TYPES, apiErrorText, columnKeyProblem, keyFromLabel, typeLabel } from './tableData'
import './workflow-tables.css'

const props = defineProps({ table: { type: Object, required: true } })
const emit = defineEmits(['changed'])

const uid = `tcp-${useId()}`
const busy = ref(false)
const canManage = computed(() => !!props.table.can?.manage && !props.table.archived)
const keys = computed(() => props.table.columns.map((c) => c.key))

const editing = ref('')
const edit = reactive({ label: '', key: '' })
const editKeyError = computed(() => (edit.key === editing.value ? '' : columnKeyProblem(edit.key, { taken: keys.value.filter((k) => k !== editing.value) })))
function startRename(c) { editing.value = c.key; edit.label = c.label || c.key; edit.key = c.key }

const draft = reactive({ label: '', key: '', keyEdited: false, type: 'text', required: false, unique: false })
const draftKeyError = computed(() => columnKeyProblem(draft.key, { taken: keys.value }))
function onDraftLabel() { if (!draft.keyEdited) draft.key = keyFromLabel(draft.label) }

async function change(payload, done, failText) {
  busy.value = true
  try {
    const { data } = await api.changeWorkflowTableColumns(props.table.id, payload)
    emit('changed', data)
    if (done) notify.success(done)
    return true
  } catch (e) {
    notify.error(apiErrorText(e, failText))
    return false
  } finally {
    busy.value = false
  }
}

async function addColumn() {
  if (draftKeyError.value) return
  const column = { key: draft.key, label: draft.label.trim() || draft.key, type: draft.type, required: draft.required, unique: draft.unique }
  if (await change({ action: 'add', column }, `Added the column ${draft.key}`, 'The column was not added')) {
    Object.assign(draft, { label: '', key: '', keyEdited: false, type: 'text', required: false, unique: false })
  }
}

async function saveRename(c) {
  if (editKeyError.value) return
  const keyChanged = edit.key !== c.key
  if (keyChanged) {
    const ok = await confirm({
      title: `Rename the key ${c.key}?`,
      message: `Workflow steps and CSV files that name ${c.key} will need ${edit.key} instead. The values are kept.`,
      confirmText: 'Rename',
    })
    if (!ok) return
  }
  const payload = { action: 'rename', key: c.key, label: edit.label.trim() || edit.key }
  if (keyChanged) payload.new_key = edit.key
  if (await change(payload, 'Renamed', 'The column was not renamed')) editing.value = ''
}

function setFlag(c, flag, value) {
  return change({ action: 'update', key: c.key, [flag]: value }, '', `The column was not changed`)
}

async function remove(c) {
  const ok = await confirm({
    title: `Remove the column ${c.key}?`,
    message: `Its value is deleted from every row of ${props.table.name}. Workflow steps that use ${c.key} will fail until they are changed. This cannot be undone.`,
    confirmText: 'Remove column',
    danger: true,
  })
  if (!ok) return
  await change({ action: 'remove', key: c.key }, `Removed the column ${c.key}`, 'The column was not removed')
}
</script>

<style scoped>
.tcp { display: grid; gap: 10px; }
.tcp-h { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; color: var(--vm-ink); }
.tcp-count { padding: 1px 7px; border-radius: 999px; background: var(--vm-surface-soft); font-size: 11px; color: var(--vm-ink-soft); }
.tcp-note { display: flex; gap: 6px; align-items: center; margin: 0; font-size: 12px; color: var(--vm-ink-soft); }
.tcp :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.tcp-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.tcp-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface); }
.tcp-name { display: grid; flex: 1 1 160px; min-width: 0; }
.tcp-name strong { font-size: 13px; color: var(--vm-ink); overflow-wrap: anywhere; }
.tcp-name code { font: 12px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-faint); overflow-wrap: anywhere; }
.tcp-check { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; font-size: 12px; color: var(--vm-ink-soft); cursor: pointer; }
.tcp-check input { width: 16px; height: 16px; accent-color: var(--vm-primary); }
.tcp-row-actions { display: flex; gap: 2px; }
.tcp-edit { display: grid; gap: 4px; flex: 1 1 100%; }
.tcp-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
.tcp-empty { font-size: 12px; color: var(--vm-ink-faint); }
.tcp-add { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; padding: 10px; border: 1px dashed var(--vm-line-2); border-radius: 8px; }
.tcp-f { display: grid; gap: 3px; flex: 1 1 130px; min-width: 0; }
.tcp-small { font-size: 11px; color: var(--vm-ink-faint); }
.tcp-in { width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.tcp-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.tcp-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.tcp-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.tcp-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.tcp-wide { flex-basis: 100%; }
@media (pointer: coarse) { .tcp-in, .tcp-check { min-height: 44px; } }
</style>
