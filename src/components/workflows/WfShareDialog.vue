<!--
  Share a workflow with named people (ADM-1339). Opened from the builder's "More workflow actions" menu, offered only
  to the owner (the server refuses anyone else with 403 and its own sentence, which is shown here).

    <WfShareDialog v-model:open="shareOpen" :graph-id="graphId" :name="doc.name.value" />

  The owner row, then each person with a role (Viewer, Runner, Editor) that is changed at once, and Remove (asked
  first, with the app's own confirm). Add by email and role. Only members of the workflow's workspace can be added;
  the server says so when one is not, and every refusal is shown in the server's own words. A share whose person is
  no longer a member of the workspace (`active: false`) grants nothing: it is shown as inactive, and can be removed.
-->
<template>
  <AppDialog :open="open" title="Share workflow" :description="description" size="md" @update:open="emit('update:open', $event)">
    <div class="wfb-root wfb-layer wfs">
      <p v-if="error" class="wfs-msg is-error" role="alert"><Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ error }}</span></p>

      <form class="wfs-add" aria-label="Add a person" @submit.prevent="add">
        <label class="wfb-field wfs-add__email">
          <span class="wfb-field__label">Email</span>
          <input
            ref="emailEl" v-model="email" class="wfb-input" type="email" name="share-email" autocomplete="off"
            spellcheck="false" placeholder="name@company.com" required :disabled="busy"
          />
        </label>
        <label class="wfb-field wfs-add__role">
          <span class="wfb-field__label">Role</span>
          <select v-model="role" class="wfb-input" name="share-role" :disabled="busy">
            <option v-for="r in SHARE_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
          </select>
        </label>
        <button type="submit" class="wfb-btn is-primary wfs-add__btn" :disabled="busy || !email.trim()">
          <Icon :icon="adding ? 'lucide:loader-circle' : 'lucide:user-plus'" :class="{ 'wf-spin': adding }" aria-hidden="true" />{{ adding ? 'Adding…' : 'Add' }}
        </button>
      </form>
      <p class="wfb-field__help">{{ ROLE_HELP[role] }} Only members of this workflow's workspace can be added.</p>

      <h3 class="wfs-h">People with access</h3>
      <p v-if="loading" class="wfb-console__empty" role="status">Loading the people…</p>
      <p v-else-if="loadError" class="wfs-msg is-error" role="alert">
        <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ loadError }}</span>
        <button type="button" class="wfb-btn is-small" @click="load">Try again</button>
      </p>
      <ul v-else class="wfs-list">
        <li v-if="owner" class="wfs-row">
          <span class="wfs-avatar" aria-hidden="true">{{ initial(owner) }}</span>
          <span class="wfs-who">
            <span class="wfs-name">{{ personName(owner) }}</span>
            <span v-if="owner.email && owner.email !== personName(owner)" class="wfs-email" translate="no">{{ owner.email }}</span>
          </span>
          <span class="wfs-owner">Owner</span>
        </li>
        <li v-for="p in shares" :key="p.user_id" class="wfs-row" :class="{ 'is-inactive': p.active === false }">
          <span class="wfs-avatar" aria-hidden="true">{{ initial(p) }}</span>
          <span class="wfs-who">
            <span class="wfs-name">{{ personName(p) }}</span>
            <span v-if="p.email && p.email !== personName(p)" class="wfs-email" translate="no">{{ p.email }}</span>
            <span v-if="p.active === false" class="wfs-inactive">Inactive: no longer in this workspace, so this share grants nothing.</span>
          </span>
          <select
            class="wfb-input wfs-role" :value="p.role" :aria-label="`Role of ${personName(p)}`"
            :disabled="busy || pending === p.user_id" @change="changeRole(p, $event.target)"
          >
            <option v-for="r in SHARE_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
          </select>
          <button
            type="button" class="wfb-icon-btn wfs-remove" :aria-label="`Remove ${personName(p)}`" :title="`Remove ${personName(p)}`"
            :disabled="busy || pending === p.user_id" @click="remove(p)"
          ><Icon icon="lucide:user-minus" aria-hidden="true" /></button>
        </li>
        <li v-if="!shares.length" class="wfs-empty">Not shared with anyone yet. Only you can see this workflow.</li>
      </ul>
      <p class="wf-sr" aria-live="polite">{{ announcement }}</p>
    </div>
    <template #footer>
      <button type="button" class="wfb-btn" @click="emit('update:open', false)">Done</button>
    </template>
  </AppDialog>
</template>

<script setup>
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '@/components/common/AppDialog.vue'
import defaultApi from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { ROLE_HELP, ROLE_LABELS, SHARE_ROLES, personName, serverSentence } from '@/utils/workflowAccess'

const props = defineProps({
  open: { type: Boolean, default: false },
  graphId: { type: [String, Number], required: true },
  name: { type: String, default: '' },
  api: { type: Object, default: () => defaultApi },
})
const emit = defineEmits(['update:open', 'changed'])

const owner = shallowRef(null)
const shares = shallowRef([])
const loading = ref(false)
const loadError = ref('')
const error = ref('')
const email = ref('')
const role = ref('viewer')
const adding = ref(false)
const pending = ref(null)            // the user id whose role or removal is in flight
const announcement = ref('')
const emailEl = ref(null)
const busy = computed(() => loading.value || adding.value)
const description = computed(() => (props.name ? `Choose who can see, run or edit "${props.name}".` : 'Choose who can see, run or edit this workflow.'))

const initial = (p) => (personName(p).trim()[0] || '?').toUpperCase()
function announce(text) {
  announcement.value = ''
  nextTick(() => { announcement.value = text })
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await props.api.getWorkflowShares(props.graphId)
    if (!data || !Array.isArray(data.results)) throw new Error('The server sent the share list in a shape this page does not read.')
    owner.value = data.owner || null
    shares.value = data.results
  } catch (e) {
    loadError.value = e?.response ? serverSentence(e, 'Could not load who this workflow is shared with') : (e?.message || 'Could not load who this workflow is shared with.')
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (now) => {
  if (!now) return
  error.value = ''
  load()
}, { immediate: true })

async function add() {
  const value = email.value.trim()
  if (!value || busy.value) return
  adding.value = true
  error.value = ''
  try {
    const { data } = await props.api.addWorkflowShare(props.graphId, { email: value, role: role.value })
    shares.value = [...shares.value.filter((s) => s.user_id !== data?.user_id), data]
    email.value = ''
    announce(`Shared with ${personName(data)} as ${ROLE_LABELS[data?.role] || data?.role}.`)
    emit('changed')
  } catch (e) {
    error.value = serverSentence(e, 'The workflow was not shared')
    nextTick(() => emailEl.value?.focus())
  } finally {
    adding.value = false
  }
}

async function changeRole(p, select) {
  const next = select.value
  if (next === p.role) return
  pending.value = p.user_id
  error.value = ''
  try {
    const { data } = await props.api.updateWorkflowShare(props.graphId, p.user_id, next)
    const row = { ...p, ...(data && typeof data === 'object' ? data : {}), role: data?.role || next }
    shares.value = shares.value.map((s) => (s.user_id === p.user_id ? row : s))
    announce(`${personName(p)} is now ${ROLE_LABELS[row.role] || row.role}.`)
    emit('changed')
  } catch (e) {
    error.value = serverSentence(e, `The role of ${personName(p)} was not changed`)
    select.value = p.role                 // the select shows the role the server still has
  } finally {
    pending.value = null
  }
}

async function remove(p) {
  const ok = await confirm({
    title: `Remove ${personName(p)}?`,
    message: 'They can no longer see, run or edit this workflow.',
    confirmText: 'Remove', danger: true,
  })
  if (!ok) return
  pending.value = p.user_id
  error.value = ''
  try {
    await props.api.removeWorkflowShare(props.graphId, p.user_id)
    shares.value = shares.value.filter((s) => s.user_id !== p.user_id)
    announce(`Removed ${personName(p)}.`)
    emit('changed')
  } catch (e) {
    error.value = serverSentence(e, `${personName(p)} was not removed`)
  } finally {
    pending.value = null
  }
}
</script>

<style scoped>
.wfs { display: grid; gap: 10px; }
.wfs-add { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: end; }
.wfs-add__btn { min-height: 36px; }
.wfs-h { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--wf-ink); }
.wfs-msg { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.45; }
.wfs-msg.is-error { background: var(--wf-danger-soft); color: var(--wf-danger-ink); }
.wfs-msg :deep(svg) { margin-top: 1px; }
.wfs-list { display: grid; margin: 0; padding: 0; list-style: none; border: 1px solid var(--wf-line-2); border-radius: 8px; }
.wfs-row { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 10px; }
.wfs-list > li + li { border-top: 1px solid var(--wf-line); }
.wfs-avatar {
  display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 999px;
  background: var(--wf-accent-soft); color: var(--wf-accent-ink); font-size: 12px; font-weight: 700;
}
.wfs-who { display: grid; flex: 1; min-width: 0; }
.wfs-name, .wfs-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wfs-name { color: var(--wf-ink); font-weight: 550; }
.wfs-email { font-size: 12px; color: var(--wf-muted); }
.wfs-owner { flex-shrink: 0; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--wf-ink-soft); }
.wfs-role { width: auto; min-width: 104px; flex-shrink: 0; }
.wfs-empty { padding: 12px 10px; font-size: 12px; color: var(--wf-muted); }
.wfs-inactive { font-size: 12px; color: var(--wf-warn-ink); white-space: normal; }
.wfs-row.is-inactive .wfs-name { color: var(--wf-ink-soft); }
@media (max-width: 479px) {
  .wfs-add { grid-template-columns: minmax(0, 1fr) auto; }
  .wfs-add__email { grid-column: 1 / -1; }
}
@media (pointer: coarse) {
  .wfs .wfb-input, .wfs-add__btn { min-height: 44px; }
}
</style>
