<template>
  <main class="activity-page">
    <header class="activity-header">
      <div>
        <h1>Activity</h1>
        <p>Monitor runs, logs and agent executions.</p>
      </div>
      <button class="help-btn">
        <Icon icon="lucide:circle-help" />
        Help
      </button>
    </header>

    <nav class="activity-tabs" aria-label="Activity views">
      <button :class="{ active: activeTab === 'requests' }" @click="activeTab = 'requests'">Request Log</button>
      <button :class="{ active: activeTab === 'audit' }" @click="activeTab = 'audit'">Audit Trail</button>
      <button :class="{ active: activeTab === 'failures' }" @click="activeTab = 'failures'">Failures</button>
    </nav>

    <PageLoader v-if="loading && !hasLoaded" label="Loading activity..." min-height="360px" />

    <section v-else class="activity-shell">
      <div class="log-card">
        <div class="filters-row">
          <label class="filter-btn">
            <Icon icon="lucide:users" />
            <select v-model="agentFilter" @change="refreshAll">
              <option value="">All Agents</option>
              <option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>

          <label class="filter-btn">
            <span class="status-dot" />
            <select v-model="statusFilter" @change="loadRequests">
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Failed</option>
              <option value="timeout">Timeout</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>

          <label class="filter-btn date-filter">
            <Icon icon="lucide:calendar-days" />
            <select>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This month</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>

          <button class="export-btn">
            <Icon icon="lucide:download" />
            Export
          </button>
        </div>

        <div v-if="activeTab === 'requests'" class="table-frame">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>
                  <span class="sort-head">Started At <Icon icon="lucide:arrow-down" /></span>
                </th>
                <th>Duration</th>
                <th>Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in pagedRuns" :key="run.id">
                <td>
                  <div class="agent-cell">
                    <span :class="['agent-icon', run.tone]"><Icon :icon="run.icon" /></span>
                    <div>
                      <strong>{{ run.agent }}</strong>
                      <small>{{ run.slug }}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span :class="['run-status', run.statusTone]"><i />{{ run.status }}</span>
                </td>
                <td>{{ run.startedAt }}</td>
                <td>{{ run.duration }}</td>
                <td>{{ run.cost }}</td>
                <td>
                  <div class="actions-cell">
                    <button>View run</button>
                    <button aria-label="More actions"><Icon icon="lucide:more-horizontal" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeTab === 'audit'" class="audit-list">
          <article v-for="entry in auditRows" :key="entry.id" class="audit-row">
            <span :class="['agent-icon', entry.tone]"><Icon icon="lucide:file-clock" /></span>
            <div>
              <strong>{{ entry.title }}</strong>
              <small>{{ entry.copy }}</small>
            </div>
            <time>{{ entry.time }}</time>
          </article>
        </div>

        <div v-else class="audit-list">
          <article v-for="run in failureRows" :key="run.id" class="audit-row">
            <span class="agent-icon red"><Icon icon="lucide:triangle-alert" /></span>
            <div>
              <strong>{{ run.agent }} failed</strong>
              <small>{{ run.startedAt }} - {{ run.duration }} - {{ run.cost }}</small>
            </div>
            <button class="mini-action">Debug</button>
          </article>
        </div>

        <footer class="table-footer">
          <span>Showing {{ rangeStart }} to {{ rangeEnd }} of {{ totalRuns }} runs</span>
          <div class="pager">
            <button :disabled="currentPage === 1" @click="currentPage--"><Icon icon="lucide:chevron-left" /></button>
            <button
              v-for="page in visiblePages"
              :key="page"
              :class="{ active: page === currentPage }"
              @click="currentPage = page"
            >
              {{ page }}
            </button>
            <span v-if="totalPages > 6">...</span>
            <button v-if="totalPages > 5" @click="currentPage = totalPages">{{ totalPages }}</button>
            <button :disabled="currentPage === totalPages" @click="currentPage++"><Icon icon="lucide:chevron-right" /></button>
          </div>
          <label>
            Rows per page
            <select v-model.number="pageSize" @change="currentPage = 1">
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </label>
        </footer>
      </div>

      <aside class="inspect-card">
        <h2>How to inspect runs</h2>
        <p>Use the table to review recent agent runs and outcomes.</p>

        <div class="inspect-step">
          <span class="blue"><Icon icon="lucide:search" /></span>
          <div>
            <h3>View run details</h3>
            <p>Click View run to inspect inputs, outputs, logs, and token usage.</p>
          </div>
        </div>

        <div class="inspect-step">
          <span class="red"><Icon icon="lucide:triangle-alert" /></span>
          <div>
            <h3>Investigate failures</h3>
            <p>Use the Failures tab to quickly find and debug failed runs.</p>
          </div>
        </div>

        <div class="inspect-step">
          <span class="slate"><Icon icon="lucide:clipboard-list" /></span>
          <div>
            <h3>Audit history</h3>
            <p>Visit the Audit Trail tab to see who made changes and when.</p>
          </div>
        </div>

        <button class="docs-btn">
          Open docs
          <Icon icon="lucide:external-link" />
        </button>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import PageLoader from '../components/common/PageLoader.vue'

const loading = ref(false)
const hasLoaded = ref(false)
const activeTab = ref('requests')
const agents = ref([])
const requests = ref([])
const auditEntries = ref([])
const agentFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const reqCount = ref(0)

const fallbackRuns = [
  { id: 'r1', agent: 'Content Writer', slug: 'content-writer', status: 'Success', startedAt: 'May 20, 2025 10:32 AM', duration: '00:01:24', cost: '$0.021', icon: 'lucide:file-text', tone: 'cyan', statusTone: 'success' },
  { id: 'r2', agent: 'Research Assistant', slug: 'research-assistant', status: 'Success', startedAt: 'May 20, 2025 10:18 AM', duration: '00:02:11', cost: '$0.034', icon: 'lucide:search', tone: 'violet', statusTone: 'success' },
  { id: 'r3', agent: 'Data Analyst', slug: 'data-analyst', status: 'Failed', startedAt: 'May 20, 2025 09:50 AM', duration: '00:00:42', cost: '$0.005', icon: 'lucide:bar-chart-3', tone: 'red', statusTone: 'failed' },
  { id: 'r4', agent: 'Content Writer', slug: 'content-writer', status: 'Success', startedAt: 'May 19, 2025 08:46 PM', duration: '00:01:05', cost: '$0.018', icon: 'lucide:file-text', tone: 'cyan', statusTone: 'success' },
  { id: 'r5', agent: 'Research Assistant', slug: 'research-assistant', status: 'Success', startedAt: 'May 19, 2025 07:22 PM', duration: '00:01:48', cost: '$0.029', icon: 'lucide:search', tone: 'violet', statusTone: 'success' },
  { id: 'r6', agent: 'Code Interpreter', slug: 'code-interpreter', status: 'Success', startedAt: 'May 19, 2025 06:41 PM', duration: '00:03:17', cost: '$0.047', icon: 'lucide:code-2', tone: 'green', statusTone: 'success' },
  { id: 'r7', agent: 'File Reader', slug: 'file-reader', status: 'Success', startedAt: 'May 19, 2025 05:37 PM', duration: '00:00:18', cost: '$0.002', icon: 'lucide:file', tone: 'orange', statusTone: 'success' },
  { id: 'r8', agent: 'Slack Notifier', slug: 'slack-notifier', status: 'Success', startedAt: 'May 19, 2025 04:15 PM', duration: '00:00:09', cost: '$0.001', icon: 'logos:slack-icon', tone: 'white', statusTone: 'success' },
  { id: 'r9', agent: 'Data Analyst', slug: 'data-analyst', status: 'Success', startedAt: 'May 19, 2025 03:02 PM', duration: '00:01:33', cost: '$0.026', icon: 'lucide:bar-chart-3', tone: 'red', statusTone: 'success' },
  { id: 'r10', agent: 'Content Writer', slug: 'content-writer', status: 'Failed', startedAt: 'May 19, 2025 01:41 PM', duration: '00:00:37', cost: '$0.003', icon: 'lucide:file-text', tone: 'cyan', statusTone: 'failed' },
]

const totalRuns = computed(() => Math.max(reqCount.value || 0, allRuns.value.length || fallbackRuns.length))
const totalPages = computed(() => Math.max(1, Math.ceil(totalRuns.value / pageSize.value)))
const rangeStart = computed(() => totalRuns.value ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize.value, totalRuns.value))
const visiblePages = computed(() => Array.from({ length: Math.min(totalPages.value, 5) }, (_, index) => index + 1))

const allRuns = computed(() => {
  const source = requests.value.length ? requests.value : fallbackRuns
  return source.map((request, index) => normalizeRun(request, index))
})

const pagedRuns = computed(() => {
  if (requests.value.length) return allRuns.value.slice(0, pageSize.value)
  const start = (currentPage.value - 1) * pageSize.value
  return allRuns.value.slice(start, start + pageSize.value)
})

const failureRows = computed(() => allRuns.value.filter((run) => run.statusTone === 'failed').slice(0, 10))

const auditRows = computed(() => {
  if (!auditEntries.value.length) {
    return [
      { id: 'a1', title: 'Agent configuration updated', copy: 'Content Writer settings changed', time: 'May 20, 2025 09:12 AM', tone: 'cyan' },
      { id: 'a2', title: 'Workflow published', copy: 'Research Assistant workflow moved live', time: 'May 19, 2025 06:45 PM', tone: 'violet' },
      { id: 'a3', title: 'Credential rotated', copy: 'Slack connector token updated', time: 'May 19, 2025 04:02 PM', tone: 'green' },
    ]
  }
  return auditEntries.value.map((entry, index) => ({
    id: entry.id || `audit-${index}`,
    title: entry.action || entry.provider || 'Audit event',
    copy: entry.model || entry.conversation_id || 'Activity event recorded',
    time: formatDate(entry.created_at),
    tone: ['cyan', 'violet', 'green'][index % 3],
  }))
})

watch([agentFilter, statusFilter], () => {
  currentPage.value = 1
})

watch(currentPage, () => {
  if (requests.value.length) loadRequests()
})

function normalizeRun(request, index) {
  if (request.startedAt) return request
  const fallback = fallbackRuns[index % fallbackRuns.length]
  const status = request.status === 'error' || request.status === 'failed' ? 'Failed' : 'Success'
  const ms = Number(request.latency_ms || request.duration_ms || 0)
  return {
    id: request.id || `req-${index}`,
    agent: request.agent_name || request.agent || fallback.agent,
    slug: slugify(request.agent_slug || request.agent_name || request.agent || fallback.slug),
    status,
    startedAt: formatDate(request.created_at) || fallback.startedAt,
    duration: ms ? formatDuration(ms) : fallback.duration,
    cost: formatMoney(request.cost_estimate ?? request.cost_usd ?? request.cost ?? 0, 3),
    icon: fallback.icon,
    tone: fallback.tone,
    statusTone: status === 'Failed' ? 'failed' : 'success',
  }
}

function slugify(value) {
  return String(value || 'agent').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatMoney(value, digits = 3) {
  return `$${Number(value || 0).toFixed(digits)}`
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function loadAgents() {
  try {
    const response = await api.getAgents()
    agents.value = response.data.results || response.data || []
  } catch (error) {
    console.error('Agents error:', error)
  }
}

async function loadRequests() {
  try {
    const params = { page: currentPage.value, page_size: pageSize.value }
    if (agentFilter.value) params.agent_id = agentFilter.value
    if (statusFilter.value) params.status = statusFilter.value
    const response = await api.getLlmRequests(params)
    requests.value = response.data.results || []
    reqCount.value = response.data.count || requests.value.length
  } catch (error) {
    console.error('Requests error:', error)
  }
}

async function loadAudit() {
  try {
    const response = await api.getLlmAudit({ page: 1 })
    auditEntries.value = response.data.results || []
  } catch (error) {
    console.error('Audit error:', error)
  }
}

async function refreshAll() {
  loading.value = true
  await Promise.all([loadRequests(), loadAudit()])
  loading.value = false
}

async function loadDashboard() {
  loading.value = true
  try {
    await loadAgents()
    await Promise.all([loadRequests(), loadAudit()])
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
}

onMounted(loadDashboard)
</script>

<style scoped>
.activity-page {
  min-height: 100%;
  padding: 28px 32px 38px;
  background: #f8fbff;
  color: #10182f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

h1,
h2,
h3,
p {
  margin: 0;
}

button,
select {
  font: inherit;
}

.activity-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 31px;
}

.activity-header h1 {
  font-size: 27px;
  line-height: 1.12;
  font-weight: 850;
  letter-spacing: 0;
  color: #071225;
}

.activity-header p {
  margin-top: 8px;
  color: #52637d;
  font-size: 14px;
  font-weight: 500;
}

.help-btn,
.export-btn,
.filter-btn,
.docs-btn,
.actions-cell button,
.pager button,
.table-footer select,
.mini-action {
  border: 1px solid #dbe4f0;
  background: #fff;
  color: #17233c;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .035);
}

.help-btn {
  display: inline-flex;
  height: 37px;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 0 15px;
  font-size: 13px;
  font-weight: 800;
}

.help-btn svg {
  width: 16px;
  height: 16px;
  color: #52637d;
}

.activity-tabs {
  display: flex;
  gap: 33px;
  border-bottom: 1px solid #dfe7f2;
  margin-bottom: 0;
}

.activity-tabs button {
  height: 45px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #52637d;
  font-size: 14px;
  font-weight: 800;
}

.activity-tabs button.active {
  color: #245af4;
  border-bottom-color: #245af4;
}

.activity-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 278px;
  gap: 22px;
  border: 1px solid #dfe7f2;
  border-radius: 16px;
  background: #fff;
  padding: 20px 20px 18px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, .055);
}

.log-card {
  min-width: 0;
}

.filters-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}

.filter-btn,
.export-btn {
  display: inline-flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 800;
}

.filter-btn {
  min-width: 158px;
  position: relative;
  justify-content: flex-start;
}

.filter-btn svg,
.export-btn svg {
  width: 16px;
  height: 16px;
}

.filter-btn svg:first-child {
  color: #53657d;
}

.filter-btn select {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  appearance: none;
  background: transparent;
  color: #17233c;
  font-size: 13px;
  font-weight: 800;
}

.filter-btn svg:last-child {
  pointer-events: none;
}

.status-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #071225;
}

.date-filter {
  min-width: 166px;
}

.export-btn {
  margin-left: auto;
}

.table-frame {
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th {
  height: 48px;
  padding: 0 18px;
  background: #f8fafc;
  border-bottom: 1px solid #dfe7f2;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .06em;
  text-align: left;
  text-transform: uppercase;
}

th:nth-child(1) { width: 28%; }
th:nth-child(2) { width: 14%; }
th:nth-child(3) { width: 22%; }
th:nth-child(4) { width: 13%; }
th:nth-child(5) { width: 11%; }
th:nth-child(6) { width: 16%; }

td {
  height: 55px;
  padding: 0 18px;
  border-bottom: 1px solid #edf2f8;
  color: #23334f;
  font-size: 13px;
  font-weight: 650;
  vertical-align: middle;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.sort-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sort-head svg {
  width: 14px;
  height: 14px;
  color: #071225;
}

.agent-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.agent-cell strong,
.agent-cell small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-cell strong {
  color: #10182f;
  font-size: 13px;
  font-weight: 850;
}

.agent-cell small {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.agent-icon {
  display: grid;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 7px;
  color: #fff;
}

.agent-icon svg {
  width: 15px;
  height: 15px;
}

.agent-icon.cyan { background: #10aeb9; }
.agent-icon.violet { background: #8063ee; }
.agent-icon.red { background: #f34e44; }
.agent-icon.green { background: #13a978; }
.agent-icon.orange { background: #f97316; }
.agent-icon.white {
  border: 1px solid #dbe4f0;
  background: #fff;
}

.run-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 850;
}

.run-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.run-status.success {
  color: #04996f;
}

.run-status.success i {
  background: #10b981;
}

.run-status.failed {
  color: #dc2626;
}

.run-status.failed i {
  background: #ef4444;
}

.actions-cell {
  display: grid;
  grid-template-columns: 78px 36px;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.actions-cell button {
  display: inline-grid;
  place-items: center;
  height: 31px;
  border-radius: 8px;
  padding: 0 12px;
  line-height: 1;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.actions-cell button:first-child {
  width: 78px;
}

.actions-cell button:last-child {
  width: 36px;
  min-width: 36px;
  padding: 0;
}

.actions-cell button:last-child svg {
  width: 15px;
  height: 15px;
}

.audit-list {
  display: grid;
  gap: 10px;
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  padding: 12px;
}

.audit-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  border: 1px solid #e7edf5;
  border-radius: 10px;
  padding: 12px;
}

.audit-row strong,
.audit-row small {
  display: block;
}

.audit-row strong {
  color: #10182f;
  font-size: 13px;
  font-weight: 850;
}

.audit-row small,
.audit-row time {
  color: #64748b;
  font-size: 12px;
}

.mini-action {
  height: 30px;
  border-radius: 7px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 850;
}

.table-footer {
  display: grid;
  grid-template-columns: 1fr auto 175px;
  align-items: center;
  gap: 18px;
  padding: 18px 18px 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 650;
}

.pager {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pager button {
  min-width: 31px;
  height: 31px;
  border-radius: 8px;
  color: #23334f;
  font-size: 13px;
  font-weight: 800;
}

.pager button.active {
  border-color: #245af4;
  background: #245af4;
  color: #fff;
}

.pager button:disabled {
  opacity: .45;
}

.table-footer label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  white-space: nowrap;
}

.table-footer select {
  width: 84px;
  height: 33px;
  border-radius: 8px;
  padding: 0 12px;
  font-weight: 800;
}

.inspect-card {
  align-self: start;
  border: 1px solid #dfe7f2;
  border-radius: 14px;
  background: #fff;
  padding: 26px 20px 20px;
}

.inspect-card h2 {
  color: #10182f;
  font-size: 15px;
  font-weight: 850;
}

.inspect-card > p {
  margin-top: 9px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.inspect-step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 13px;
  margin-top: 28px;
}

.inspect-step > span {
  display: grid;
  width: 33px;
  height: 33px;
  place-items: center;
  border-radius: 50%;
}

.inspect-step svg {
  width: 17px;
  height: 17px;
}

.inspect-step .blue { background: #dbeafe; color: #2563eb; }
.inspect-step .red { background: #fee2e2; color: #ef4444; }
.inspect-step .slate { background: #eaf0ff; color: #2563eb; }

.inspect-step h3 {
  color: #10182f;
  font-size: 13px;
  font-weight: 850;
}

.inspect-step p {
  margin-top: 7px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.docs-btn {
  display: inline-flex;
  width: 100%;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 30px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 1280px) {
  .activity-shell {
    grid-template-columns: 1fr;
  }

  .inspect-card {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .inspect-card > h2,
  .inspect-card > p,
  .docs-btn {
    grid-column: 1 / -1;
  }

  .inspect-step {
    margin-top: 0;
  }
}

@media (max-width: 980px) {
  .activity-page {
    padding: 24px 18px 38px;
  }

  .filters-row {
    flex-wrap: wrap;
  }

  .export-btn {
    margin-left: 0;
  }

  .table-frame {
    overflow-x: auto;
  }

  table {
    min-width: 920px;
  }

  .table-footer {
    grid-template-columns: 1fr;
  }

  .table-footer label {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .activity-header {
    flex-direction: column;
  }

  .activity-tabs {
    gap: 18px;
    overflow-x: auto;
  }

  .filter-btn,
  .export-btn {
    width: 100%;
  }

  .inspect-card {
    grid-template-columns: 1fr;
  }
}
</style>
