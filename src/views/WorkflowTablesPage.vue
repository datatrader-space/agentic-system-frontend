<!--
  Workflows > Tables (ADM-1363): the workspace's Data Tables, the rows workflows store and read with the Data table
  step. /dashboard/workflow-tables lists them with their rows and storage, and the usage meter (100 MB free, then
  charged per GB-month from the balance); /dashboard/workflow-tables/<id> is one table: its rows and its columns.
  The workspace is the one the app is in (X-Workspace-ID). The server decides every permission (`can`, `can_create`).
-->
<template>
  <div class="wtp">
    <div class="wtp-wrap">
      <!-- ── one table ── -->
      <template v-if="tableId">
        <RouterLink class="wtp-back" :to="{ name: 'dashboard-workflow-tables' }"><Icon icon="lucide:arrow-left" aria-hidden="true" />All tables</RouterLink>
        <PageLoader v-if="tableLoading && !table" label="Loading the table…" />
        <div v-else-if="tableError" class="wtp-state" role="alert">
          <Icon icon="lucide:circle-alert" aria-hidden="true" />
          <p>{{ tableError }}</p>
          <button type="button" class="tp-btn" @click="loadTable">Try again</button>
        </div>
        <template v-else-if="table">
          <header class="wtp-head">
            <div class="wtp-titles">
              <h1 class="wtp-h1"><Icon icon="lucide:table-2" aria-hidden="true" />{{ table.name }}</h1>
              <p v-if="table.description" class="wtp-sub">{{ table.description }}</p>
              <p class="wtp-meta">
                <span>{{ table.row_count }} {{ table.row_count === 1 ? 'row' : 'rows' }}</span>
                <span>{{ formatBytes(table.bytes) }}</span>
                <span v-if="table.updated_at">Changed {{ when(table.updated_at) }}</span>
                <span v-if="table.archived" class="tp-chip tp-chip--warn"><Icon icon="lucide:archive" aria-hidden="true" />Archived: read only</span>
              </p>
            </div>
            <div v-if="table.can?.manage" class="wtp-actions">
              <button v-if="!table.archived" type="button" class="tp-btn" @click="openRename"><Icon icon="lucide:pencil" aria-hidden="true" />Rename</button>
              <button type="button" class="tp-btn" :disabled="busy" @click="toggleArchive">
                <Icon :icon="table.archived ? 'lucide:archive-restore' : 'lucide:archive'" aria-hidden="true" />{{ table.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </header>
          <p v-if="usage?.writes_refused" class="wtp-paused" role="alert">
            <Icon icon="lucide:circle-alert" aria-hidden="true" />
            Writes paused: the balance could not pay for table storage. Top up or delete rows; reading keeps working.
            <RouterLink to="/dashboard/settings/billing">Top up</RouterLink>
          </p>
          <div class="wtp-detail">
            <TableRowsGrid ref="grid" :table="table" class="wtp-rows" @changed="afterRowsChanged" />
            <aside class="wtp-aside">
              <TableColumnsPanel :table="table" @changed="onTableChanged" />
            </aside>
          </div>
        </template>
      </template>

      <!-- ── the list ── -->
      <template v-else>
        <header class="wtp-head">
          <div class="wtp-titles">
            <RouterLink class="wtp-back" :to="{ name: 'dashboard-workflow-builder' }"><Icon icon="lucide:arrow-left" aria-hidden="true" />Workflows</RouterLink>
            <h1 class="wtp-h1"><Icon icon="lucide:table-2" aria-hidden="true" />Tables</h1>
            <p class="wtp-sub">Rows your workflows store and read<template v-if="workspace"> in {{ workspace.name }}</template>. A workflow uses them with the Data table step.</p>
          </div>
          <div class="wtp-actions">
            <label class="wtp-toggle"><input v-model="showArchived" type="checkbox" @change="loadList"> Show archived</label>
            <button v-if="canCreate" type="button" class="tp-btn tp-btn--primary" @click="createOpen = true"><Icon icon="lucide:plus" aria-hidden="true" />New table</button>
          </div>
        </header>

        <TableUsageMeter v-if="usage" :usage="usage" />

        <PageLoader v-if="listLoading && !tables.length" label="Loading tables…" />
        <div v-else-if="listError" class="wtp-state" role="alert">
          <Icon icon="lucide:circle-alert" aria-hidden="true" />
          <p>{{ listError }}</p>
          <button type="button" class="tp-btn" @click="loadList">Try again</button>
        </div>
        <div v-else-if="!tables.length" class="wtp-empty">
          <Icon icon="lucide:table-2" aria-hidden="true" />
          <h2>No tables yet</h2>
          <p>A table keeps rows between runs: contacts a workflow has seen, orders to follow up, counts from a camera.</p>
          <button v-if="canCreate" type="button" class="tp-btn tp-btn--primary" @click="createOpen = true"><Icon icon="lucide:plus" aria-hidden="true" />New table</button>
          <p v-else class="wtp-faint">Ask an Admin of this workspace to create one.</p>
        </div>
        <div v-else class="wtp-scroll" tabindex="0" role="region" aria-label="Tables">
          <table class="wtp-table">
            <caption class="tp-sr">The workspace's tables</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Columns</th><th scope="col" class="num">Rows</th><th scope="col" class="num">Size</th><th scope="col">Changed</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in tables" :key="t.id" :class="{ 'is-archived': t.archived }">
                <td>
                  <RouterLink class="wtp-link" :to="{ name: 'dashboard-workflow-table', params: { id: t.id } }">{{ t.name }}</RouterLink>
                  <span v-if="t.archived" class="tp-chip tp-chip--warn wtp-chip">Archived</span>
                  <span v-if="t.description" class="wtp-desc">{{ t.description }}</span>
                </td>
                <td>
                  <div class="wtp-cols">
                    <code v-for="c in t.columns.slice(0, 4)" :key="c.key" translate="no">{{ c.key }}</code>
                    <span v-if="t.columns.length > 4" class="wtp-faint">+{{ t.columns.length - 4 }} more</span>
                    <span v-if="!t.columns.length" class="wtp-faint">none</span>
                  </div>
                </td>
                <td class="num">{{ t.row_count }}</td>
                <td class="num">{{ formatBytes(t.bytes) }}</td>
                <td class="wtp-faint wtp-when">{{ when(t.updated_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <TableCreateDialog v-model:open="createOpen" @created="onCreated" />

    <AppDialog v-model:open="renameOpen" title="Rename the table" size="sm">
      <form :id="`${uid}-rename`" class="wtp-form" @submit.prevent="saveRename">
        <label class="wtp-label" :for="`${uid}-rn`">Name</label>
        <input :id="`${uid}-rn`" v-model="renameName" class="wtp-in" type="text" maxlength="120" autocomplete="off">
        <label class="wtp-label" :for="`${uid}-rd`">Description</label>
        <input :id="`${uid}-rd`" v-model="renameDesc" class="wtp-in" type="text" maxlength="500" autocomplete="off">
        <p class="wtp-faint">A Data table step that names the table by its name needs the new name; a step that chose it from the list keeps working.</p>
      </form>
      <template #footer>
        <button type="button" class="tp-btn" @click="renameOpen = false">Cancel</button>
        <button type="submit" class="tp-btn tp-btn--primary" :form="`${uid}-rename`" :disabled="busy || !renameName.trim()">Save</button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import PageLoader from '@/components/common/PageLoader.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import TableUsageMeter from '@/components/workflow-tables/TableUsageMeter.vue'
import TableCreateDialog from '@/components/workflow-tables/TableCreateDialog.vue'
import TableColumnsPanel from '@/components/workflow-tables/TableColumnsPanel.vue'
import TableRowsGrid from '@/components/workflow-tables/TableRowsGrid.vue'
import { apiErrorText, formatBytes } from '@/components/workflow-tables/tableData'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import '@/components/workflow-tables/workflow-tables.css'

const route = useRoute()
const router = useRouter()
const uid = `wtp-${useId()}`
const tableId = computed(() => route.params.id || null)

const when = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString() }

// ── the list and the usage ──
const tables = ref([])
const workspace = ref(null)
const canCreate = ref(false)
const usage = ref(null)
const listLoading = ref(false)
const listError = ref('')
const showArchived = ref(false)

async function loadList() {
  listLoading.value = true
  listError.value = ''
  try {
    const { data } = await api.getWorkflowTables(showArchived.value ? { include_archived: 1 } : {})
    tables.value = Array.isArray(data?.tables) ? data.tables : []
    workspace.value = data?.workspace || null
    canCreate.value = !!data?.can_create
    if (data?.usage) usage.value = data.usage
  } catch (e) {
    listError.value = apiErrorText(e, 'The tables could not be loaded')
  } finally {
    listLoading.value = false
  }
}
async function loadUsage() {
  try {
    const { data } = await api.getWorkflowTableUsage()
    usage.value = data
  } catch { /* the meter keeps its last reading; the rows say any write problem themselves */ }
}

// ── one table ──
const table = ref(null)
const tableLoading = ref(false)
const tableError = ref('')
const busy = ref(false)
const grid = ref(null)

async function loadTable() {
  if (!tableId.value) return
  tableLoading.value = true
  tableError.value = ''
  try {
    const { data } = await api.getWorkflowTable(tableId.value)
    table.value = data
  } catch (e) {
    table.value = null
    tableError.value = e?.response?.status === 404 ? 'This workspace has no such table. It may have been deleted, or it belongs to another workspace.' : apiErrorText(e, 'The table could not be loaded')
  } finally {
    tableLoading.value = false
  }
}
setBreadcrumbLabel(() => (tableId.value ? table.value?.name : null))

watch(tableId, (id) => {
  if (id) { table.value = null; loadTable(); loadUsage() } else { loadList() }
}, { immediate: true })

function onTableChanged(next) { if (next) table.value = next; grid.value?.reload() }
async function afterRowsChanged() {
  // The row count, the size and the usage meter move with every write.
  try { const { data } = await api.getWorkflowTable(tableId.value); table.value = data } catch { /* the grid already said */ }
  loadUsage()
}
function onCreated(t) {
  notify.success(`Created the table ${t.name}`)
  router.push({ name: 'dashboard-workflow-table', params: { id: t.id } })
}

const renameOpen = ref(false)
const renameName = ref('')
const renameDesc = ref('')
function openRename() { renameName.value = table.value.name; renameDesc.value = table.value.description || ''; renameOpen.value = true }
async function saveRename() {
  busy.value = true
  try {
    const { data } = await api.updateWorkflowTable(table.value.id, { name: renameName.value.trim(), description: renameDesc.value.trim() })
    table.value = data
    renameOpen.value = false
    notify.success('Saved')
  } catch (e) {
    notify.error(apiErrorText(e, 'The table was not renamed'))
  } finally {
    busy.value = false
  }
}

async function toggleArchive() {
  const archiving = !table.value.archived
  if (archiving) {
    const ok = await confirm({
      title: `Archive ${table.value.name}?`,
      message: 'Its rows are kept, but workflows can no longer read or write it until you restore it.',
      confirmText: 'Archive',
    })
    if (!ok) return
  }
  busy.value = true
  try {
    const { data } = await api.archiveWorkflowTable(table.value.id, archiving)
    table.value = data
    notify.success(archiving ? 'Archived' : 'Restored')
  } catch (e) {
    notify.error(apiErrorText(e, archiving ? 'The table was not archived' : 'The table was not restored'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.wtp { padding: 24px 16px; color: var(--vm-ink); }
@media (min-width: 1024px) { .wtp { padding: 32px; } }
.wtp-wrap { display: grid; gap: 16px; max-width: 1400px; margin: 0 auto; min-width: 0; }
.wtp :deep(svg) { width: 15px; height: 15px; flex-shrink: 0; }
.wtp-back { display: inline-flex; align-items: center; gap: 4px; width: fit-content; font-size: 12px; font-weight: 600; color: var(--vm-link); text-decoration: none; }
.wtp-back:hover { text-decoration: underline; }
.wtp-back:focus-visible, .wtp-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
.wtp-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; }
.wtp-titles { display: grid; gap: 4px; min-width: 0; }
.wtp-h1 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2; color: var(--vm-ink); overflow-wrap: anywhere; }
.wtp-h1 :deep(svg) { width: 22px; height: 22px; padding: 8px; box-sizing: content-box; border-radius: 10px; background: var(--vm-primary-soft); color: var(--vm-link); }
.wtp-sub { margin: 0; font-size: 14px; color: var(--vm-ink-soft); }
.wtp-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.wtp-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.wtp-toggle { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); cursor: pointer; }
.wtp-toggle input { width: 16px; height: 16px; accent-color: var(--vm-primary); }
.wtp-paused { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--vm-red-soft); color: var(--vm-red-ink); font-size: 13px; }
.wtp-paused a { color: inherit; font-weight: 700; }
.wtp-state, .wtp-empty { display: grid; justify-items: center; gap: 8px; padding: 40px 16px; border: 1px dashed var(--vm-line-2); border-radius: 10px; background: var(--vm-surface); text-align: center; color: var(--vm-ink-soft); }
.wtp-state p, .wtp-empty p { margin: 0; max-width: 520px; font-size: 13px; }
.wtp-empty h2 { margin: 0; font-size: 16px; color: var(--vm-ink); }
.wtp-empty > :deep(svg), .wtp-state > :deep(svg) { width: 26px; height: 26px; color: var(--vm-ink-faint); }
.wtp-scroll { overflow-x: auto; border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.wtp-scroll:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
/* Keeps a readable width on a phone and scrolls inside .wtp-scroll, never squeezing a name onto two lines. */
.wtp-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 13px; }
.wtp-table td:first-child { min-width: 200px; }
.wtp-table th { padding: 10px 12px; border-bottom: 1px solid var(--vm-line-2); background: var(--vm-surface-soft); text-align: left; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); white-space: nowrap; }
.wtp-table td { padding: 10px 12px; border-bottom: 1px solid var(--vm-line); vertical-align: top; }
.wtp-table tr:last-child td { border-bottom: 0; }
.wtp-table tbody tr:hover { background: var(--vm-surface-soft); }
.wtp-table tr.is-archived { color: var(--vm-ink-soft); }
.num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wtp-link { font-weight: 700; color: var(--vm-link); text-decoration: none; overflow-wrap: break-word; }
.wtp-link:hover { text-decoration: underline; }
.wtp-chip { margin-left: 6px; }
.wtp-desc { display: block; margin-top: 2px; font-size: 12px; color: var(--vm-ink-faint); }
.wtp-cols { display: flex; flex-wrap: wrap; gap: 4px; }
.wtp-cols code { padding: 1px 6px; border-radius: 4px; background: var(--vm-surface-soft); font: 11px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft); }
.wtp-faint { font-size: 12px; color: var(--vm-ink-faint); }
.wtp-when { white-space: nowrap; }
.wtp-detail { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
@media (min-width: 1180px) { .wtp-detail { grid-template-columns: minmax(0, 1fr) 340px; } }
.wtp-aside { padding: 14px; border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface-soft); min-width: 0; }
.wtp-form { display: grid; gap: 6px; }
.wtp-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.wtp-in { width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.wtp-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .wtp-in, .wtp-toggle { min-height: 44px; } }
</style>
