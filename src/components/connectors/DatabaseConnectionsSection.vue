<!--
  Settings > Connectors > Databases (ADM-1363): the workspace's database connections the workflow steps (SQL database,
  MongoDB, Redis, New database rows) use. Each says its engine, its Access (Read only / Read and write) and its last
  test; its owner may test, edit, share ("can use") and delete it. The addresses our workers connect from are listed
  for the database's firewall. Nothing here ever shows a secret: the list's projection has none.
-->
<template>
  <section id="databases" class="dcs" aria-labelledby="dcs-h">
    <div class="dcs-head">
      <div class="dcs-titles">
        <span class="dcs-badge" aria-hidden="true"><Icon icon="lucide:database" /></span>
        <div>
          <h2 id="dcs-h" class="dcs-h">Databases</h2>
          <p class="dcs-sub">PostgreSQL, MySQL / MariaDB, SQL Server, MongoDB and Redis that your workflows read and write.</p>
        </div>
      </div>
      <button type="button" class="tp-btn tp-btn--primary" @click="openAdd"><Icon icon="lucide:plus" aria-hidden="true" />Add database</button>
    </div>

    <PageLoader v-if="loading && !connections.length" label="Loading database connections…" />
    <p v-else-if="error" class="dcs-error" role="alert">
      <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ error }}</span>
      <button type="button" class="tp-btn" @click="load">Try again</button>
    </p>
    <div v-else-if="!connections.length" class="dcs-empty">
      <Icon icon="lucide:database" aria-hidden="true" />
      <p>No database connections yet. Add one to read or write your own database from a workflow.</p>
    </div>
    <ul v-else class="dcs-list">
      <li v-for="c in connections" :key="c.id" class="dcs-item">
        <div class="dcs-main">
          <strong class="dcs-name">{{ c.name }}</strong>
          <span class="dcs-meta">
            <span class="tp-chip tp-chip--muted">{{ c.engine_label || c.engine }}</span>
            <span class="tp-chip" :class="c.access === 'read_write' ? 'tp-chip--warn' : 'tp-chip--muted'">
              <Icon :icon="c.access === 'read_write' ? 'lucide:pencil' : 'lucide:lock'" aria-hidden="true" />{{ accessLabel(c.access) }}
            </span>
            <span class="tp-chip" :class="`tp-chip--${lastTestState(c.last_test).tone}`">
              <Icon :icon="TEST_ICON[lastTestState(c.last_test).tone]" aria-hidden="true" />{{ lastTestState(c.last_test).text }}
            </span>
            <span v-if="c.ssh_enabled" class="tp-chip tp-chip--muted"><Icon icon="lucide:key-round" aria-hidden="true" />SSH tunnel</span>
            <span class="tp-chip" :title="c.has_ca_certificate ? 'Encrypted; the certificate is checked against your own CA and the public authorities' : 'Encrypted; the certificate and name are checked'"><Icon icon="lucide:shield-check" aria-hidden="true" />Encrypted{{ c.has_ca_certificate ? ' · own CA' : '' }}</span>
            <span v-if="!c.mine && c.owner" class="dcs-owner">Shared by {{ c.owner.name || c.owner.email }}</span>
          </span>
          <span v-if="c.last_test && c.last_test.ok === false && c.last_test.message" class="dcs-fail">{{ c.last_test.message }}</span>
        </div>
        <div class="dcs-actions">
          <button type="button" class="tp-btn" :disabled="testingId === c.id" @click="test(c)">
            <Icon :icon="testingId === c.id ? 'lucide:loader-circle' : 'lucide:plug-zap'" :class="{ spin: testingId === c.id }" aria-hidden="true" />{{ testingId === c.id ? 'Testing…' : 'Test' }}
          </button>
          <template v-if="c.can_manage">
            <button type="button" class="tp-btn tp-btn--icon" :aria-label="`Edit ${c.name}`" title="Edit" @click="openEdit(c)"><Icon icon="lucide:pencil" aria-hidden="true" /></button>
            <button type="button" class="tp-btn tp-btn--icon" :aria-label="`Share ${c.name}`" title="Share" @click="openShare(c)"><Icon icon="lucide:share-2" aria-hidden="true" /></button>
            <button type="button" class="tp-btn tp-btn--icon tp-btn--danger" :aria-label="`Delete ${c.name}`" title="Delete" @click="remove(c)"><Icon icon="lucide:trash-2" aria-hidden="true" /></button>
          </template>
        </div>
      </li>
    </ul>

    <p v-if="outboundIps.length" class="dcs-ips">
      <Icon icon="lucide:network" aria-hidden="true" />
      <span>Our workers connect from <code v-for="ip in outboundIps" :key="ip" translate="no">{{ ip }}</code>. Allow these in your database's firewall. {{ meta.outbound_ips_note || 'An address does not prove which customer is calling: the database user does.' }}</span>
    </p>

    <DatabaseConnectionDialog v-model:open="formOpen" :connection="editingConn" :meta="meta" :workspace="workspace" @saved="onSaved" />
    <DatabaseShareDialog v-model:open="shareOpen" :connection="sharingConn" />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PageLoader from '../common/PageLoader.vue'
import DatabaseConnectionDialog from './DatabaseConnectionDialog.vue'
import DatabaseShareDialog from './DatabaseShareDialog.vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { accessLabel, connectionErrorText, lastTestState } from './databaseConnectionForm'
import '../workflow-tables/workflow-tables.css'

const props = defineProps({
  // The workspace to list and add in; null = the one the app is in (X-Workspace-ID).
  workspace: { type: [String, Number], default: null },
})

const TEST_ICON = { ok: 'lucide:circle-check', bad: 'lucide:circle-alert', muted: 'lucide:circle-dashed' }

const connections = ref([])
const meta = ref({})
const loading = ref(false)
const error = ref('')
const testingId = ref(null)
const outboundIps = computed(() => (Array.isArray(meta.value.outbound_ips) ? meta.value.outbound_ips : []))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getDatabaseConnections(props.workspace != null ? { workspace: props.workspace } : {})
    connections.value = Array.isArray(data?.connections) ? data.connections : []
    meta.value = Object.fromEntries(Object.entries(data || {}).filter(([k]) => k !== 'connections'))
  } catch (e) {
    error.value = connectionErrorText(e, 'The database connections could not be loaded')
  } finally {
    loading.value = false
  }
}
// A link to Settings > Connectors#databases (the builder's "Manage database connections") lands on this section.
onMounted(async () => {
  await load()
  if (typeof window !== 'undefined' && window.location.hash === '#databases') {
    await nextTick()
    document.getElementById('databases')?.scrollIntoView({ block: 'start' })
  }
})

async function test(c) {
  testingId.value = c.id
  try {
    const { data } = await api.testDatabaseConnection(c.id)
    if (data?.ok) notify.success(`${c.name}: connected`)
    else notify.error(`${c.name}: ${data?.message || 'the test failed'}`)
    replace({ ...c, last_test: { at: new Date().toISOString(), ok: !!data?.ok, message: data?.message || '' } })
  } catch (e) {
    notify.error(connectionErrorText(e, 'The test could not run'))
  } finally {
    testingId.value = null
  }
}

function replace(next) {
  const i = connections.value.findIndex((x) => x.id === next.id)
  if (i === -1) connections.value = [...connections.value, next]
  else connections.value = connections.value.map((x, j) => (j === i ? { ...x, ...next } : x))
}

const formOpen = ref(false)
const editingConn = ref(null)
function openAdd() { editingConn.value = null; formOpen.value = true }
function openEdit(c) { editingConn.value = c; formOpen.value = true }
function onSaved(saved) { if (saved?.id != null) replace(saved) }

const shareOpen = ref(false)
const sharingConn = ref(null)
function openShare(c) { sharingConn.value = c; shareOpen.value = true }

async function remove(c) {
  const ok = await confirm({
    title: `Delete ${c.name}?`,
    message: 'Its address, user and password are deleted. Workflow steps and triggers that use it fail until they get another connection. This cannot be undone.',
    confirmText: 'Delete connection',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deleteDatabaseConnection(c.id)
    connections.value = connections.value.filter((x) => x.id !== c.id)
    notify.success(`Deleted ${c.name}`)
  } catch (e) {
    notify.error(connectionErrorText(e, 'The connection was not deleted'))
  }
}

defineExpose({ load })
</script>

<style scoped>
.dcs { display: grid; gap: 12px; margin-top: 24px; padding: 16px; border: 1px solid var(--vm-border); border-radius: 12px; background: var(--vm-surface); box-shadow: var(--vm-shadow-s); scroll-margin-top: 16px; }
.dcs-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
.dcs-titles { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dcs-badge { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; background: var(--vm-teal-soft); color: var(--vm-teal-ink); }
.dcs-badge :deep(svg) { width: 18px; height: 18px; }
.dcs-h { margin: 0; font-size: 16px; font-weight: 700; color: var(--vm-ink); }
.dcs-sub { margin: 2px 0 0; font-size: 12px; color: var(--vm-ink-faint); }
.dcs :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.dcs-error { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-red-soft); color: var(--vm-red-ink); font-size: 12px; }
.dcs-empty { display: grid; justify-items: center; gap: 6px; padding: 24px 12px; border: 1px dashed var(--vm-line-2); border-radius: 10px; text-align: center; color: var(--vm-ink-soft); }
.dcs-empty p { margin: 0; font-size: 13px; }
.dcs-empty :deep(svg) { width: 22px; height: 22px; color: var(--vm-ink-faint); }
.dcs-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.dcs-item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: 10px; }
.dcs-main { display: grid; gap: 4px; min-width: 0; flex: 1 1 280px; }
.dcs-name { font-size: 14px; color: var(--vm-ink); overflow-wrap: anywhere; }
.dcs-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dcs-owner { font-size: 12px; color: var(--vm-ink-faint); }
.dcs-fail { font-size: 12px; color: var(--vm-red-ink); overflow-wrap: anywhere; }
.dcs-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.dcs-ips { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-surface-soft); font-size: 12px; line-height: 1.6; color: var(--vm-ink-soft); }
.dcs-ips :deep(svg) { margin-top: 3px; }
.dcs-ips code { margin: 0 3px; padding: 1px 5px; border-radius: 4px; background: var(--vm-surface); font: 12px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); }
</style>
