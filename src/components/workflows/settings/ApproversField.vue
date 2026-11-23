<!--
  The approval step's Approvers (ADM-1339): people, not free text. The list is the people who can see this workflow
  (its owner and everyone it is shared with, GET /workflow-graphs/<id>/people/); the step stores their user ids in
  `data.approvers`. Nobody ticked means the owner decides. The server checks every id on save and decides who may
  approve; this field only writes the list.

  An old free-text value (emails, comma-separated) is no longer read by the engine: the field says so, and the first
  person ticked replaces it. An id that is no longer among the people (a share removed) is shown so it can be cleared.
-->
<template>
  <fieldset class="apf" :aria-describedby="`${uid}-help`">
    <legend class="apf-label">Approvers</legend>
    <p :id="`${uid}-help`" class="apf-help">{{ help }}</p>

    <p v-if="legacy" class="apf-msg apf-msg--warn" role="alert">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      <span>Pick the approvers again; free-text emails are no longer read. It said: <span class="apf-old" translate="no">{{ legacy }}</span></span>
    </p>
    <p v-for="i in fieldIssues" :key="i.message" class="apf-msg" :class="i.level === 'error' ? 'apf-msg--err' : 'apf-msg--warn'" :role="i.level === 'error' ? 'alert' : undefined">
      <Icon :icon="i.level === 'error' ? 'lucide:circle-alert' : 'lucide:triangle-alert'" aria-hidden="true" /><span>{{ i.message }}</span>
    </p>

    <p v-if="loading" class="apf-help" role="status">Loading the people who can see this workflow…</p>
    <p v-else-if="error" class="apf-msg apf-msg--err" role="alert">
      <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ error }}</span>
      <button type="button" class="apf-btn" @click="load">Try again</button>
    </p>

    <ul v-if="rows.length" class="apf-list">
      <li v-for="r in rows" :key="r.id">
        <label class="apf-row">
          <input type="checkbox" :checked="ids.includes(r.id)" @change="toggle(r.id, $event.target.checked)">
          <span class="apf-who">
            <span class="apf-name">{{ r.name }}</span>
            <span v-if="r.email && r.email !== r.name" class="apf-email" translate="no">{{ r.email }}</span>
          </span>
          <span class="apf-role" :class="{ 'is-gone': r.gone }">{{ r.role }}</span>
        </label>
      </li>
    </ul>
  </fieldset>
</template>

<script setup>
import { computed, onMounted, ref, shallowRef, useId } from 'vue'
import { Icon } from '@iconify/vue'
import defaultApi from '@/services/api'
import { ROLE_LABELS, personName, readApprovers, serverSentence } from '@/utils/workflowAccess'
import { useNodeEditor } from './nodeEditor'

const props = defineProps({ api: { type: Object, default: () => defaultApi } })

const editor = useNodeEditor()
const uid = `apf-${useId()}`
const people = shallowRef([])
const loading = ref(false)
const error = ref('')

const stored = computed(() => readApprovers(editor.data.value.approvers))
const ids = computed(() => stored.value.ids)
const legacy = computed(() => stored.value.legacy)
// The server's own findings about this field (validate / save: approvers.unknown, approvers.legacy_text). The
// legacy one is already said above in plain words.
const fieldIssues = computed(() => editor.issues.value.filter((i) => String(i.code || '').startsWith('approvers.')
  && !(i.code === 'approvers.legacy_text' && legacy.value)))

const rows = computed(() => {
  const out = people.value.map((p) => ({
    id: p.user_id, name: personName(p), email: p.email || '', role: ROLE_LABELS[p.role] || p.role || '', gone: false,
  }))
  for (const id of ids.value) {
    if (!out.some((r) => r.id === id)) out.push({ id, name: `Person #${id}`, email: '', role: 'No longer has access', gone: true })
  }
  return out
})

const help = computed(() => {
  if (ids.value.length === 1) return 'Only the person ticked can approve or reject this step.'
  if (ids.value.length > 1) return 'Any one of the people ticked can approve or reject this step.'
  return 'Nobody ticked: the owner decides. Share the workflow to add other people here.'
})

async function load() {
  const id = editor.doc.meta?.id
  if (id == null) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await props.api.getWorkflowPeople(id)
    if (!data || !Array.isArray(data.results)) throw new Error('The server sent the people list in a shape this page does not read.')
    people.value = data.results.filter((p) => p && Number.isInteger(p.user_id))
  } catch (e) {
    error.value = e?.response ? serverSentence(e, 'Could not load the people who can see this workflow') : (e?.message || 'Could not load the people who can see this workflow.')
  } finally {
    loading.value = false
  }
}

function toggle(id, on) {
  const next = ids.value.filter((x) => x !== id)
  if (on) next.push(id)
  editor.set('approvers', next, 'Approvers')
}

onMounted(load)
</script>

<style scoped>
.apf { display: grid; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.apf-label { padding: 0; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.apf-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.apf-msg { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; margin: 0; padding: 7px 9px; border-radius: 6px; font-size: 12px; line-height: 1.45; }
.apf-msg :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.apf-msg--warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.apf-msg--err { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.apf-old { font-family: var(--vm-font-mono, ui-monospace, monospace); overflow-wrap: anywhere; }
.apf-list { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; border: 1px solid var(--vm-line-2); border-radius: 6px; }
.apf-list li + li { border-top: 1px solid var(--vm-line); }
.apf-row { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 9px; cursor: pointer; font-size: 13px; color: var(--vm-ink); }
.apf-row input { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--vm-primary); }
.apf-row:has(input:disabled) { cursor: default; }
.apf-row:has(input:focus-visible) { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 6px; }
.apf-who { display: grid; min-width: 0; flex: 1; }
.apf-name, .apf-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.apf-email { font-size: 12px; color: var(--vm-ink-faint); }
.apf-role { flex-shrink: 0; font-size: 11px; font-weight: 600; color: var(--vm-ink-soft); }
.apf-role.is-gone { color: var(--vm-red-ink); }
.apf-btn {
  min-height: 28px; padding: 2px 10px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface);
  color: var(--vm-ink); font: inherit; font-size: 12px; cursor: pointer;
}
.apf-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .apf-row, .apf-btn { min-height: 44px; } }
</style>
