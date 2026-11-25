<!--
  Share a database connection (ADM-1363): the people who "can use" it in their workflows. They never see its details
  or secrets, and cannot change it. Owner only (the server refuses anyone else).
-->
<template>
  <AppDialog :open="open" :title="`Share ${connection?.name || 'connection'}`" description="People you share with can use this connection in their workflows. They never see its address, user or password, and cannot change it." size="md" @update:open="emit('update:open', $event)">
    <div class="dsd">
      <form class="dsd-add" @submit.prevent="add">
        <label class="dsd-label" :for="`${uid}-email`">Email of a member of this workspace</label>
        <div class="dsd-row">
          <input :id="`${uid}-email`" v-model="email" class="dsd-in" type="email" autocomplete="off" placeholder="name@company.com">
          <button type="submit" class="tp-btn tp-btn--primary" :disabled="busy || !email.trim()"><Icon icon="lucide:user-plus" aria-hidden="true" />Share</button>
        </div>
      </form>
      <p v-if="error" class="dsd-err" role="alert">{{ error }}</p>
      <PageLoader v-if="loading" label="Loading who can use it…" />
      <ul v-else class="dsd-list" aria-label="People who can use this connection">
        <li v-for="p in people" :key="p.id ?? p.user_id ?? p.email" class="dsd-person">
          <span class="dsd-name"><strong>{{ p.name || p.email }}</strong><span v-if="p.name && p.email">{{ p.email }}</span></span>
          <span class="tp-chip tp-chip--muted">Can use</span>
          <button type="button" class="tp-btn tp-btn--icon tp-btn--ghost" :aria-label="`Stop sharing with ${p.name || p.email}`" title="Stop sharing" :disabled="busy" @click="remove(p)">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
        </li>
        <li v-if="!people.length" class="dsd-empty">Only you can use this connection.</li>
      </ul>
    </div>
    <template #footer><button type="button" class="tp-btn" @click="emit('update:open', false)">Done</button></template>
  </AppDialog>
</template>

<script setup>
import { ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '../common/AppDialog.vue'
import PageLoader from '../common/PageLoader.vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { connectionErrorText } from './databaseConnectionForm'
import '../workflow-tables/workflow-tables.css'

const props = defineProps({ open: { type: Boolean, default: false }, connection: { type: Object, default: null } })
const emit = defineEmits(['update:open', 'changed'])

const uid = `dsd-${useId()}`
const people = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const email = ref('')

const listOf = (data) => (Array.isArray(data?.shared_with) ? data.shared_with : [])
const userId = (p) => p.id ?? p.user_id

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getDatabaseConnectionShares(props.connection.id)
    people.value = listOf(data)
  } catch (e) {
    error.value = connectionErrorText(e, 'Who can use it could not be loaded')
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (o) => { if (o && props.connection) { email.value = ''; load() } }, { immediate: true })

async function add() {
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.addDatabaseConnectionShare(props.connection.id, { email: email.value.trim() })
    people.value = listOf(data)
    notify.success(`Shared with ${email.value.trim()}`)
    email.value = ''
    emit('changed')
  } catch (e) {
    error.value = connectionErrorText(e, 'The connection was not shared')
  } finally {
    busy.value = false
  }
}
async function remove(p) {
  busy.value = true
  error.value = ''
  try {
    await api.removeDatabaseConnectionShare(props.connection.id, userId(p))
    people.value = people.value.filter((x) => userId(x) !== userId(p))
    emit('changed')
  } catch (e) {
    error.value = connectionErrorText(e, 'Sharing was not stopped')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.dsd { display: grid; gap: 12px; }
.dsd-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.dsd-add { display: grid; gap: 4px; }
.dsd-row { display: flex; gap: 8px; }
.dsd-in { flex: 1; min-width: 0; min-height: 36px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.dsd-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.dsd-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.dsd-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.dsd-person { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--vm-line); border-radius: 8px; }
.dsd-name { display: grid; flex: 1; min-width: 0; font-size: 13px; color: var(--vm-ink); }
.dsd-name span { font-size: 12px; color: var(--vm-ink-faint); overflow-wrap: anywhere; }
.dsd-empty { font-size: 12px; color: var(--vm-ink-faint); }
.dsd :deep(svg) { width: 14px; height: 14px; }
@media (pointer: coarse) { .dsd-in { min-height: 44px; } }
</style>
