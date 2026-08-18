<template>
  <div class="iq">
    <header class="iq-head">
      <div>
        <h1>Issues</h1>
        <p>Problems reported by users and by agents — an agent that hits a broken or missing capability
          files one through MCP with the evidence attached, instead of telling the user it isn't possible.
          Only administrators see this queue.</p>
      </div>
      <div class="counts" v-if="counts">
        <span class="pill open">{{ counts.open }} open</span>
        <span class="pill crit" v-if="counts.critical_open">{{ counts.critical_open }} critical</span>
        <span class="pill muted">{{ counts.total }} total</span>
      </div>
    </header>

    <section class="card">
      <div class="toolbar">
        <select v-model="filters.status" @change="load">
          <option value="open_only">Open only</option>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="wont_fix">Won't fix</option>
          <option value="duplicate">Duplicate</option>
        </select>
        <select v-model="filters.severity" @change="load">
          <option value="">Any severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select v-model="filters.source" @change="load">
          <option value="">Any source</option>
          <option value="mcp">MCP client</option>
          <option value="agent">Agent</option>
          <option value="dashboard">Dashboard</option>
          <option value="system">System</option>
        </select>
        <input v-model="filters.search" class="search" placeholder="Search title or body…"
               @keyup.enter="load" />
        <button class="btn ghost" @click="load">Refresh</button>
      </div>

      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="!items.length" class="state">
        Nothing here. <span class="muted">An empty queue means no reports match this filter — not that
        nothing was ever reported.</span>
      </div>
      <table v-else class="tbl">
        <thead>
          <tr><th>Issue</th><th>Severity</th><th>Source</th><th>Reported by</th><th>When</th><th>Status</th><th class="r">Actions</th></tr>
        </thead>
        <tbody>
          <template v-for="row in items" :key="row.id">
            <tr :class="{ crit: row.severity === 'critical' && row.is_open }">
              <td>
                <button class="titlebtn" @click="expanded = expanded === row.id ? null : row.id">
                  {{ row.title }}
                </button>
                <div class="sub" v-if="row.context && row.context.tool">tool: {{ row.context.tool }}</div>
              </td>
              <td><span :class="['sev', row.severity]">{{ row.severity }}</span></td>
              <td class="muted">{{ row.source }}</td>
              <td class="muted">{{ row.reported_by_name || row.reporter_label || '—' }}</td>
              <td class="muted">{{ shortDate(row.created_at) }}</td>
              <td><span :class="['st', row.status]">{{ row.status.replace('_', ' ') }}</span></td>
              <td class="actions">
                <button v-if="row.is_open" class="btn tiny" @click="setStatus(row, 'investigating')"
                        :disabled="row.status === 'investigating'">Investigating</button>
                <button v-if="row.is_open" class="btn tiny primary" @click="resolve(row)">Resolve</button>
                <button v-else class="btn tiny ghost" @click="setStatus(row, 'open')">Reopen</button>
              </td>
            </tr>
            <tr v-if="expanded === row.id" class="detail">
              <td colspan="7">
                <p v-if="row.body" class="body">{{ row.body }}</p>
                <p v-else class="muted">No description was supplied.</p>
                <p v-if="row.resolution" class="resolution">
                  <strong>Resolution:</strong> {{ row.resolution }}
                  <span class="muted" v-if="row.resolved_by_name"> — {{ row.resolved_by_name }}</span>
                </p>
                <details v-if="row.context && Object.keys(row.context).length">
                  <summary>Evidence</summary>
                  <pre>{{ JSON.stringify(row.context, null, 2) }}</pre>
                </details>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
// Admin-only queue. The reporter files through `aadml_report_issue` (MCP) and has no view of their own —
// so everything here assumes a single audience and shows the raw evidence blob, which is another user's
// operational detail and must not leak into a user-facing surface.
import { ref, reactive, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const items = ref([])
const counts = ref(null)
const loading = ref(true)
const error = ref(false)
const expanded = ref(null)
const filters = reactive({ status: 'open_only', severity: '', source: '', search: '' })

const shortDate = (d) => d
  ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

async function load() {
  loading.value = true
  error.value = false
  try {
    const { data } = await api.get('/admin/issues/', { params: { ...filters, limit: 100 } })
    items.value = data.items || []
    counts.value = data.counts || null
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function setStatus(row, status, resolution = '') {
  try {
    const { data } = await api.patch(`/admin/issues/${row.id}/`, { status, resolution })
    Object.assign(row, data)
    // A row that leaves the current filter should disappear from it, or the list lies about what it shows.
    if (filters.status === 'open_only' && !data.is_open) {
      items.value = items.value.filter(i => i.id !== row.id)
    }
    if (counts.value) load()
  } catch {
    notify.error('Could not update the issue.')
  }
}

async function resolve(row) {
  const ok = await confirm({
    title: 'Resolve this issue',
    message: `Mark "${row.title}" resolved? The reporter is not notified — this closes it for the queue.`,
    confirmText: 'Resolve',
  })
  if (ok) setStatus(row, 'resolved')
}

onMounted(load)
</script>

<style scoped>
.iq { padding: 28px 32px 60px; }
.iq-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.iq-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.iq-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
.counts { display: flex; gap: 8px; flex-shrink: 0; }
.pill { border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 800; }
.pill.open { background: #eef4ff; color: #2563eb; } .pill.crit { background: #fee2e2; color: #dc2626; }
.pill.muted { background: #f1f5f9; color: #64748b; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.toolbar select, .search { border: 1px solid #e5ebf3; border-radius: 9px; padding: 7px 11px; font-size: 13px; background: #fff; }
.search { flex: 1; min-width: 200px; }
.btn { border-radius: 9px; padding: 7px 13px; font-size: 12.5px; font-weight: 700; border: 1px solid transparent; cursor: pointer; background: #4f46e5; color: #fff; }
.btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn.tiny { padding: 4px 9px; font-size: 11.5px; background: #fff; border-color: #d8e2f0; color: #334155; }
.btn.tiny.primary { background: #4f46e5; color: #fff; border-color: transparent; }
.btn:disabled { opacity: .45; cursor: default; }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 11px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl th.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
tr.crit td { background: #fff7f7; }
.titlebtn { border: 0; background: transparent; padding: 0; font: inherit; font-weight: 700; color: #0f172a; cursor: pointer; text-align: left; }
.titlebtn:hover { color: #4f46e5; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 3px; }
.muted { color: #94a3b8; }
.sev { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.sev.critical { background: #fee2e2; color: #b91c1c; } .sev.high { background: #ffedd5; color: #c2410c; }
.sev.medium { background: #fef3c7; color: #b45309; } .sev.low { background: #f1f5f9; color: #64748b; }
.st { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; background: #f1f5f9; color: #475569; }
.st.open { background: #eef4ff; color: #2563eb; } .st.resolved { background: #dcfce7; color: #16a34a; }
.st.investigating { background: #fef3c7; color: #b45309; }
.actions { text-align: right; white-space: nowrap; display: flex; gap: 6px; justify-content: flex-end; }
tr.detail td { background: #f8fafc; }
.body { white-space: pre-wrap; margin: 0 0 8px; color: #334155; font-size: 13px; line-height: 1.55; }
.resolution { margin: 0 0 8px; font-size: 12.5px; color: #334155; }
pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 9px; font-size: 11.5px; overflow-x: auto; max-height: 320px; }
summary { cursor: pointer; font-size: 12px; font-weight: 700; color: #475569; }
@media (max-width: 680px) { .iq { padding: 20px 16px; } }
</style>
