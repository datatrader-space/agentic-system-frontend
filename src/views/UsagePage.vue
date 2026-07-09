<template>
  <main class="cost-page">
    <header class="cost-header">
      <div>
        <h1>AI Cost Dashboard</h1>
        <p>Monitor usage, costs, and audit LLM requests</p>
      </div>
      <div class="head-actions">
        <label>
          <select v-model="agentFilter" @change="reload">
            <option value="">All Agents</option>
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
          </select>
          <Icon icon="lucide:chevron-down" />
        </label>
        <label>
          <select v-model.number="days" @change="reload">
            <option :value="7">Last 7 days</option>
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
          </select>
          <Icon icon="lucide:chevron-down" />
        </label>
        <button type="button" class="refresh-btn" @click="reload">
          <Icon icon="lucide:refresh-cw" />
          Refresh
        </button>
      </div>
    </header>

    <PageLoader v-if="loading && !hasLoaded" label="Loading usage dashboard..." min-height="420px" />

    <template v-else>
      <section class="metric-grid" aria-label="Usage summary">
        <article v-for="card in metricCards" :key="card.label" class="metric-card">
          <div>
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small :class="card.good ? 'good' : ''">
              <Icon :icon="card.good ? 'lucide:arrow-up' : 'lucide:circle'" />
              {{ card.copy }}
            </small>
          </div>
          <i :class="card.tone"><Icon :icon="card.icon" /></i>
        </article>
      </section>

      <section class="analytics-grid">
        <article class="panel chart-panel">
          <div class="panel-head">
            <h2>Cost Over Time</h2>
            <label class="mini-select">
              <select v-model="chartMode">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <Icon icon="lucide:chevron-down" />
            </label>
          </div>
          <div class="legend"><span /> Total Cost (USD)</div>
          <div class="line-chart">
            <svg viewBox="0 0 640 250" role="img" aria-label="Cost over time chart">
              <defs>
                <linearGradient id="usageFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stop-color="#2f63f6" stop-opacity=".18" />
                  <stop offset="1" stop-color="#2f63f6" stop-opacity="0" />
                </linearGradient>
              </defs>
              <g class="grid-lines">
                <line v-for="tick in 5" :key="tick" x1="42" x2="620" :y1="tick * 42" :y2="tick * 42" />
              </g>
              <path :d="areaPath" fill="url(#usageFill)" />
              <path :d="linePath" fill="none" stroke="#3156e9" stroke-width="3" />
              <circle v-for="point in chartPoints" :key="point.label" :cx="point.x" :cy="point.y" r="5" />
            </svg>
          </div>
          <div class="chart-labels">
            <span v-for="point in chartPoints" :key="point.label">{{ point.label }}</span>
          </div>
        </article>

        <article class="panel donut-panel">
          <div class="panel-head">
            <h2>Top Models by Cost</h2>
            <label class="mini-select">
              <select>
                <option>By Cost</option>
                <option>By Requests</option>
              </select>
              <Icon icon="lucide:chevron-down" />
            </label>
          </div>
          <div class="donut-wrap">
            <div class="donut" :style="{ background: donutGradient }"></div>
            <ul>
              <li v-for="model in modelRows" :key="model.name">
                <span :style="{ background: model.color }"></span>
                <strong>{{ model.name }}</strong>
                <em>{{ formatMoney(model.cost) }} ({{ model.share }}%)</em>
              </li>
            </ul>
          </div>
          <button class="link-btn">View all models <Icon icon="lucide:arrow-right" /></button>
        </article>

        <article class="panel agent-panel">
          <div class="panel-head">
            <h2>Cost by Agent</h2>
            <label class="mini-select">
              <select>
                <option>By Cost</option>
                <option>By Requests</option>
              </select>
              <Icon icon="lucide:chevron-down" />
            </label>
          </div>
          <div class="agent-bars">
            <div v-for="row in agentCostRows" :key="row.name" class="agent-bar">
              <span>{{ row.name }}</span>
              <div><i :style="{ width: row.width + '%' }"></i></div>
              <strong>{{ formatMoney(row.cost) }}</strong>
            </div>
          </div>
          <button class="link-btn">View all agents <Icon icon="lucide:arrow-right" /></button>
        </article>
      </section>

      <section class="request-panel">
        <nav class="log-tabs" aria-label="Usage logs">
          <button :class="{ active: logTab === 'requests' }" @click="logTab = 'requests'">Request Log</button>
          <button :class="{ active: logTab === 'audit' }" @click="logTab = 'audit'">Audit Trail</button>
        </nav>

        <div class="log-filters">
          <label>
            <select v-model="providerFilter">
              <option value="">All Providers</option>
              <option>OpenAI</option>
              <option>Anthropic</option>
              <option>OpenRouter</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>
          <label>
            <select v-model="modelFilter">
              <option value="">All Models</option>
              <option>GPT-4o</option>
              <option>GPT-4 Turbo</option>
              <option>Claude 3.5 Sonnet</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>
          <label>
            <select v-model="statusFilter">
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>
          <div class="search-box">
            <Icon icon="lucide:search" />
            <input v-model="search" placeholder="Search requests..." />
          </div>
          <button class="icon-btn" aria-label="Table settings"><Icon icon="lucide:settings-2" /></button>
        </div>

        <div class="usage-table">
          <table v-if="logTab === 'requests'">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Request Type</th>
                <th>Input</th>
                <th>Output</th>
                <th>Cached</th>
                <th>Reasoning</th>
                <th>Latency</th>
                <th>Cost (USD)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedRequests" :key="row.id">
                <td>{{ row.time }}</td>
                <td>
                  <span class="agent-dot">{{ row.agentInitial }}</span>
                  {{ row.agent }}
                </td>
                <td>{{ row.provider }}</td>
                <td>{{ row.model }}</td>
                <td>{{ row.type }}</td>
                <td>{{ row.input }}</td>
                <td>{{ row.output }}</td>
                <td>{{ row.cached }}</td>
                <td>{{ row.reasoning }}</td>
                <td>{{ row.latency }}</td>
                <td>{{ row.cost }}</td>
                <td><span :class="['status-pill', row.statusTone]"><i />{{ row.status }}</span></td>
                <td><button class="more-btn"><Icon icon="lucide:more-horizontal" /></button></td>
              </tr>
            </tbody>
          </table>

          <div v-else class="audit-list">
            <article v-for="entry in auditRows" :key="entry.id">
              <span><Icon icon="lucide:file-clock" /></span>
              <div>
                <strong>{{ entry.title }}</strong>
                <small>{{ entry.copy }}</small>
              </div>
              <time>{{ entry.time }}</time>
            </article>
          </div>
        </div>

        <footer class="table-footer">
          <span>Showing {{ rangeStart }} to {{ rangeEnd }} of {{ totalRequests }} requests</span>
          <div class="pager">
            <button :disabled="page === 1" @click="page--"><Icon icon="lucide:chevron-left" /></button>
            <button v-for="item in visiblePages" :key="item" :class="{ active: item === page }" @click="page = item">{{ item }}</button>
            <span v-if="pageCount > 6">...</span>
            <button v-if="pageCount > 5" @click="page = pageCount">{{ pageCount }}</button>
            <button :disabled="page === pageCount" @click="page++"><Icon icon="lucide:chevron-right" /></button>
          </div>
          <label class="rows-select">
            <select v-model.number="pageSize" @change="page = 1">
              <option :value="10">10 / page</option>
              <option :value="25">25 / page</option>
              <option :value="50">50 / page</option>
            </select>
            <Icon icon="lucide:chevron-down" />
          </label>
        </footer>
      </section>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import PageLoader from '../components/common/PageLoader.vue'

const loading = ref(false)
const hasLoaded = ref(false)
const days = ref(7)
const agentFilter = ref('')
const providerFilter = ref('')
const modelFilter = ref('')
const statusFilter = ref('')
const search = ref('')
const logTab = ref('requests')
const chartMode = ref('daily')
const page = ref(1)
const pageSize = ref(10)

const agents = ref([])
const stats = ref({})
const usageRows = ref([])
const usageData = ref({})   // full llm_usage payload: cost_by_model / _agent / _provider / _user / totals
const requestRows = ref([])
const auditEntries = ref([])
const serverTotal = ref(0)

// No fabricated fallbacks — an empty account must read as real zeros, not fake demo data.
const fallbackUsage = []
const fallbackRequests = []
const fallbackStats = {}
const fallbackAudit = []

const normalizedUsage = computed(() => usageRows.value.length ? usageRows.value : fallbackUsage)
const normalizedStats = computed(() => ({ ...(stats.value || {}) }))

// Prefer the real llm_usage payload (cost_by_* + totals) for headline metrics; fall back to llm_stats.
const totalCost = computed(() => pickNumber(usageData.value.total_cost, normalizedStats.value.total_cost, normalizedStats.value.cost) || 0)
const totalRequestsMetric = computed(() => pickNumber(normalizedStats.value.total_requests, normalizedStats.value.requests) || sum(usageData.value.cost_by_provider || [], 'requests') || 0)
const avgLatency = computed(() => pickNumber(normalizedStats.value.avg_latency_seconds, normalizedStats.value.avg_latency, normalizedStats.value.avg_latency_ms / 1000) || 0)
const topModel = computed(() => (usageData.value.cost_by_model || [])[0]?.model_name || '—')
const topModelShare = computed(() => {
  const rows = usageData.value.cost_by_model || []
  const total = rows.reduce((s, r) => s + Number(r.cost || 0), 0) || 1
  return rows.length ? Math.round((Number(rows[0].cost || 0) / total) * 100) : 0
})
const knowledgeCost = computed(() => pickNumber(usageData.value.kb_cost, normalizedStats.value.kb_cost) || 0)
const embeddingCost = computed(() => pickNumber(usageData.value.embedding_cost, normalizedStats.value.embedding_cost) || 0)
const completionCost = computed(() => pickNumber(usageData.value.chat_cost, normalizedStats.value.chat_cost) || Math.max(0, totalCost.value - knowledgeCost.value - embeddingCost.value))

const _pct = (part) => (totalCost.value > 0 ? Math.round((part / totalCost.value) * 100) : 0)
const metricCards = computed(() => [
  { label: 'Total Requests', value: formatNumber(totalRequestsMetric.value), copy: 'across selected window', good: true, icon: 'lucide:zap', tone: 'blue' },
  { label: 'Total Cost', value: formatMoney(totalCost.value), copy: 'across selected window', good: true, icon: 'lucide:circle-dollar-sign', tone: 'green' },
  { label: 'Avg Latency', value: `${avgLatency.value.toFixed(2)}s`, copy: 'mean response time', good: true, icon: 'lucide:clock-3', tone: 'violet' },
  { label: 'Top Model', value: topModel.value, copy: `${topModelShare.value}% of total cost`, icon: 'lucide:sun', tone: 'amber' },
  { label: 'Knowledge Base Cost', value: formatMoney(knowledgeCost.value), copy: `${_pct(knowledgeCost.value)}% of total cost`, icon: 'lucide:book-open', tone: 'indigo' },
  { label: 'Embedding Cost', value: formatMoney(embeddingCost.value), copy: `${_pct(embeddingCost.value)}% of total cost`, icon: 'lucide:panel-top', tone: 'cyan' },
  { label: 'Chat / Completion Cost', value: formatMoney(completionCost.value), copy: `${_pct(completionCost.value)}% of total cost`, icon: 'lucide:message-circle', tone: 'teal' },
])

const chartPoints = computed(() => {
  const rows = normalizedUsage.value.slice(-7)
  const max = Math.max(...rows.map((row) => Number(row.cost || row.cost_usd || 0)), 1)
  return rows.map((row, index) => {
    const cost = Number(row.cost || row.cost_usd || 0)
    return {
      label: row.label || row.date || `Day ${index + 1}`,
      x: 58 + index * (548 / Math.max(rows.length - 1, 1)),
      y: 218 - (cost / max) * 162,
    }
  })
})

const linePath = computed(() => chartPoints.value.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '))
const areaPath = computed(() => `${linePath.value} L ${chartPoints.value.at(-1)?.x || 58} 218 L ${chartPoints.value[0]?.x || 58} 218 Z`)

const MODEL_COLORS = ['#3156e9', '#16b981', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#94a3b8']

// Top Models by Cost — REAL data from llm_usage.cost_by_model (was hardcoded 60/21/13/6 percentages).
const modelRows = computed(() => {
  const rows = usageData.value.cost_by_model || []
  const total = rows.reduce((s, r) => s + Number(r.cost || 0), 0) || 1
  return rows.slice(0, 6).map((r, i) => ({
    name: r.model_name || r.provider_type || 'unknown',
    cost: Number(r.cost || 0),
    share: Math.round((Number(r.cost || 0) / total) * 100),
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  }))
})

const donutGradient = computed(() => {
  if (!modelRows.value.length) return 'conic-gradient(#e2e8f0 0% 100%)'  // neutral ring when no data
  let start = 0
  const stops = modelRows.value.map((row) => {
    const end = start + row.share
    const segment = `${row.color} ${start}% ${end}%`
    start = end
    return segment
  })
  return `conic-gradient(${stops.join(', ')})`
})

// Cost by Agent — REAL data from llm_usage.cost_by_agent (was hardcoded 40/25/16/11/7 percentages).
const agentCostRows = computed(() => {
  const rows = (usageData.value.cost_by_agent || []).map((r) => ({
    name: r.agent_name || 'No agent', cost: Number(r.cost || 0),
  }))
  const max = Math.max(...rows.map((row) => row.cost), 1)
  return rows.slice(0, 8).map((row) => ({ ...row, width: Math.round((row.cost / max) * 100) }))
})

// Cost by Provider + Cost by User — real breakdowns (rendered if the template has panels for them).
const providerCostRows = computed(() => {
  const rows = (usageData.value.cost_by_provider || []).map((r) => ({
    name: r.provider_type || 'unknown', cost: Number(r.cost || 0),
    requests: r.requests || 0,
  }))
  const max = Math.max(...rows.map((row) => row.cost), 1)
  return rows.map((row) => ({ ...row, width: Math.round((row.cost / max) * 100) }))
})

const userCostRows = computed(() => {
  const rows = (usageData.value.cost_by_user || []).map((r) => ({
    name: r.user_email || 'Unknown', cost: Number(r.cost || 0), requests: r.requests || 0,
  }))
  const max = Math.max(...rows.map((row) => row.cost), 1)
  return rows.slice(0, 8).map((row) => ({ ...row, width: Math.round((row.cost / max) * 100) }))
})

const costDrivers = computed(() => {
  const out = []
  if (totalCost.value > 0) {
    out.push(`Chat/Completion usage ${_pct(completionCost.value)}% of total cost`)
    if (modelRows.value.length) out.push(`Top model: ${topModel.value} ${topModelShare.value}% of total cost`)
    const topAgent = agentCostRows.value[0]
    if (topAgent) out.push(`Highest agent: ${topAgent.name} ${_pct(topAgent.cost)}% of total cost`)
  }
  return out.length ? out : ['No usage recorded in the selected window']
})

const reductionTips = ['Use GPT-4 Turbo for routine tasks', 'Limit context and system prompts', 'Leverage caching and reuse results', 'Monitor low-value or test traffic']

const tableRequests = computed(() => {
  const source = requestRows.value.length ? requestRows.value : fallbackRequests
  return source.map(normalizeRequest).filter((row) => {
    const q = search.value.trim().toLowerCase()
    const matchesSearch = !q || [row.agent, row.provider, row.model, row.type].some((v) => String(v).toLowerCase().includes(q))
    const matchesProvider = !providerFilter.value || row.provider === providerFilter.value
    const matchesModel = !modelFilter.value || row.model === modelFilter.value
    const matchesStatus = !statusFilter.value || row.statusTone === statusFilter.value || row.status.toLowerCase() === statusFilter.value
    return matchesSearch && matchesProvider && matchesModel && matchesStatus
  })
})

const totalRequests = computed(() => Math.max(serverTotal.value || 0, tableRequests.value.length))
const pageCount = computed(() => Math.max(1, Math.ceil(totalRequests.value / pageSize.value)))
const rangeStart = computed(() => totalRequests.value ? ((page.value - 1) * pageSize.value) + 1 : 0)
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, totalRequests.value))
const visiblePages = computed(() => Array.from({ length: Math.min(pageCount.value, 5) }, (_, index) => index + 1))
const pagedRequests = computed(() => {
  if (requestRows.value.length) return tableRequests.value.slice(0, pageSize.value)
  const start = (page.value - 1) * pageSize.value
  return tableRequests.value.slice(start, start + pageSize.value)
})

const auditRows = computed(() => {
  const source = auditEntries.value.length ? auditEntries.value : fallbackAudit
  return source.map((entry, index) => ({
    id: entry.id || `audit-${index}`,
    title: entry.action || entry.title || 'Usage event recorded',
    copy: entry.description || entry.copy || entry.actor || 'LLM usage audit event',
    time: formatTime(entry.created_at || entry.time),
  }))
})

function pickNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return 0
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || row[`${key}_usd`] || 0), 0)
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value || 0)))
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function formatTime(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function normalizeRequest(row, index) {
  // Honest defaults — never fabricate an agent/provider/model name for a real row.
  const agentName = row.agent_name || row.agent || row.agent_profile_name || 'No agent'
  const status = row.status || (row.success === false ? 'Error' : 'Success')
  const statusTone = String(status).toLowerCase().includes('error') || String(status).toLowerCase().includes('fail') ? 'error' : 'success'
  return {
    id: row.id || `request-${index}`,
    time: formatTime(row.created_at || row.timestamp || row.time),
    agent: agentName,
    agentInitial: agentName.charAt(0).toUpperCase(),
    provider: row.provider || row.provider_name || 'unknown',
    model: row.model || row.model_name || 'unknown',
    type: row.request_type || row.operation || row.type || 'completion',
    input: formatNumber(row.input_tokens || row.prompt_tokens || row.input || 0),
    output: formatNumber(row.output_tokens || row.completion_tokens || row.output || 0),
    cached: formatNumber(row.cached_tokens || 0),
    reasoning: formatNumber(row.reasoning_tokens || 0),
    latency: row.latency || row.duration || (row.latency_ms != null ? `${(row.latency_ms / 1000).toFixed(2)}s` : '—'),
    cost: (row.cost || row.cost_usd) ? formatMoney(row.cost || row.cost_usd) : '$0.0000',
    status: statusTone === 'success' ? 'Success' : 'Error',
    statusTone,
  }
}

function unwrapList(data, ...keys) {
  if (Array.isArray(data)) return data
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  if (Array.isArray(data?.results)) return data.results
  return []
}

async function reload() {
  loading.value = true
  const params = { days: days.value, agent_id: agentFilter.value || undefined, page: page.value, page_size: pageSize.value }
  try {
    const [agentRes, statsRes, usageRes, requestsRes, auditRes] = await Promise.allSettled([
      api.getAgents ? api.getAgents() : api.get('/agents/'),
      api.getLlmStats(params),
      api.getLlmUsage(params),
      api.getLlmRequests(params),
      api.getLlmAudit({ page: 1, page_size: 5 }),
    ])
    if (agentRes.status === 'fulfilled') agents.value = unwrapList(agentRes.value.data, 'agents')
    if (statsRes.status === 'fulfilled') stats.value = statsRes.value.data || {}
    if (usageRes.status === 'fulfilled') {
      usageData.value = usageRes.value.data || {}
      // Optional time-series (if the backend ever returns one); the breakdown panels read usageData directly.
      usageRows.value = unwrapList(usageRes.value.data, 'usage', 'series')
    }
    if (requestsRes.status === 'fulfilled') {
      requestRows.value = unwrapList(requestsRes.value.data, 'requests')
      serverTotal.value = requestsRes.value.data?.count || requestRows.value.length
    }
    if (auditRes.status === 'fulfilled') auditEntries.value = unwrapList(auditRes.value.data, 'audit', 'entries')
  } finally {
    hasLoaded.value = true
    loading.value = false
  }
}

watch([page, pageSize], () => {
  if (hasLoaded.value) reload()
})

onMounted(reload)
</script>

<style scoped>
.cost-page {
  min-height: 100%;
  color: #061733;
}

.cost-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.cost-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.18;
  font-weight: 850;
  letter-spacing: 0;
}

.cost-header p {
  margin: 6px 0 0;
  color: #516383;
  font-size: 14px;
  font-weight: 550;
}

.head-actions,
.log-filters,
.table-footer,
.panel-head,
.donut-wrap,
.agent-bar,
.cost-header label,
.log-filters label,
.mini-select,
.rows-select {
  display: flex;
  align-items: center;
}

.head-actions {
  gap: 12px;
}

.cost-header label,
.log-filters label,
.mini-select,
.rows-select {
  position: relative;
  height: 42px;
  border: 1px solid #d8e3f2;
  border-radius: 10px;
  background: #fff;
}

.cost-header select,
.log-filters select,
.mini-select select,
.rows-select select {
  height: 100%;
  min-width: 150px;
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0 38px 0 14px;
  color: #13223a;
  font-size: 13px;
  font-weight: 750;
  outline: none;
}

.cost-header label svg,
.log-filters label svg,
.mini-select svg,
.rows-select svg {
  position: absolute;
  right: 12px;
  width: 15px;
  height: 15px;
  color: #516383;
  pointer-events: none;
}

.refresh-btn {
  height: 42px;
  border: 0;
  border-radius: 10px;
  background: #07132a;
  color: #fff;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(7, 19, 42, .16);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.metric-card,
.panel,
.request-panel {
  border: 1px solid #dbe5f2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, .045);
}

.metric-card {
  min-height: 132px;
  padding: 22px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  overflow: hidden;
}

.metric-card:nth-child(n + 5) {
  min-height: 116px;
}

.metric-card span,
.panel-head h2,
.cost-help h3,
.usage-table th {
  text-transform: uppercase;
}

.metric-card span {
  color: #60718f;
  font-size: 12px;
  font-weight: 850;
}

.metric-card strong {
  display: block;
  margin-top: 18px;
  color: #061733;
  font-size: clamp(22px, 1.7vw, 27px);
  line-height: 1;
  font-weight: 850;
  overflow-wrap: anywhere;
}

.metric-card small {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  color: #61708d;
  font-size: 12px;
  font-weight: 700;
}

.metric-card small.good {
  color: #08a46b;
}

.metric-card i {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-style: normal;
  flex: 0 0 auto;
}

.metric-card i.blue { color: #3156e9; background: #e9f0ff; }
.metric-card i.green { color: #059669; background: #dcf8ed; }
.metric-card i.violet { color: #7c3aed; background: #f1e7ff; }
.metric-card i.amber { color: #f97316; background: #fff2dd; }
.metric-card i.indigo { color: #7257ff; background: #eeeaff; }
.metric-card i.cyan { color: #0891b2; background: #ddf7ff; }
.metric-card i.teal { color: #0f9f87; background: #ddf8f1; }

.analytics-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.35fr) minmax(300px, 1fr) minmax(300px, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.chart-panel {
  min-height: 436px;
}

.panel {
  padding: 20px;
  min-width: 0;
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-head h2,
.cost-help h2 {
  margin: 0;
  color: #13223a;
  font-size: 15px;
  line-height: 1.25;
  font-weight: 850;
  text-transform: none;
}

.mini-select {
  height: 34px;
  border-radius: 8px;
}

.mini-select select {
  min-width: 92px;
  font-size: 12px;
}

.legend {
  color: #273a5a;
  font-size: 12px;
  font-weight: 750;
}

.legend span {
  display: inline-block;
  width: 18px;
  height: 3px;
  margin-right: 7px;
  border-radius: 999px;
  background: #3156e9;
  vertical-align: middle;
}

.line-chart {
  height: 216px;
  margin-top: 6px;
}

.line-chart svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.grid-lines line {
  stroke: #d9e2ee;
  stroke-dasharray: 4 6;
}

.line-chart circle {
  fill: #fff;
  stroke: #3156e9;
  stroke-width: 3;
}

.chart-labels {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  color: #60718f;
  font-size: 11px;
  font-weight: 700;
}

.donut-wrap {
  display: grid;
  grid-template-columns: minmax(122px, 142px) minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.donut {
  width: 142px;
  height: 142px;
  border-radius: 50%;
  position: relative;
  flex: 0 0 auto;
}

.donut::after {
  content: "";
  position: absolute;
  inset: 28px;
  border-radius: 50%;
  background: #fff;
}

.donut-wrap ul,
.driver-list,
.reduce-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.donut-wrap li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin-bottom: 12px;
  color: #263852;
  font-size: 12px;
  font-weight: 750;
}

.donut-wrap li span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.donut-wrap li em {
  grid-column: 2;
  color: #60718f;
  font-style: normal;
  font-weight: 750;
  line-height: 1.25;
}

.donut-wrap li strong {
  min-width: 0;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.agent-bars {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.agent-bar {
  display: grid;
  grid-template-columns: minmax(112px, 1.15fr) minmax(70px, .9fr) 62px;
  gap: 10px;
  align-items: center;
  color: #344865;
  font-size: 12px;
  font-weight: 750;
}

.agent-bar span {
  min-width: 0;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.agent-bar div {
  height: 7px;
  border-radius: 999px;
  background: #edf1f6;
  overflow: hidden;
}

.agent-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #3156e9;
}

.agent-bar strong {
  text-align: right;
  color: #13223a;
}

.link-btn {
  margin-top: 22px;
  border: 0;
  background: transparent;
  color: #2359f4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.cost-help {
  padding-top: 22px;
}

.cost-help h2 {
  padding-left: 14px;
  border-left: 4px solid #3156e9;
}

.cost-help p {
  color: #60718f;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 600;
}

.cost-help h3 {
  margin: 18px 0 10px;
  color: #13223a;
  font-size: 12px;
  font-weight: 850;
  text-transform: none;
}

.driver-list {
  display: grid;
  gap: 12px;
  color: #516383;
  font-size: 12px;
  line-height: 1.35;
}

.driver-list li::before {
  content: "";
  width: 4px;
  height: 4px;
  margin: 0 8px 2px 0;
  display: inline-block;
  border-radius: 50%;
  background: #3156e9;
}

.reduce-list {
  display: grid;
  gap: 10px;
  color: #516383;
  font-size: 12px;
  font-weight: 650;
}

.reduce-list li {
  display: flex;
  gap: 8px;
  align-items: center;
}

.reduce-list svg {
  color: #10b981;
}

.request-panel {
  padding: 0 14px 16px;
}

.log-tabs {
  height: 48px;
  display: flex;
  align-items: flex-end;
  gap: 24px;
  border-bottom: 1px solid #dbe5f2;
}

.log-tabs button {
  height: 48px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #516383;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.log-tabs button.active {
  color: #2359f4;
  border-bottom-color: #2359f4;
}

.log-filters {
  gap: 12px;
  padding: 20px 0;
}

.log-filters label {
  height: 36px;
}

.log-filters select {
  min-width: 116px;
  font-size: 12px;
}

.search-box {
  margin-left: auto;
  width: 240px;
  height: 36px;
  border: 1px solid #d8e3f2;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: #7b8aa5;
}

.search-box input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  color: #13223a;
  font-size: 12px;
  font-weight: 650;
}

.icon-btn,
.more-btn {
  border: 1px solid #d8e3f2;
  border-radius: 8px;
  background: #fff;
  color: #13223a;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn {
  width: 36px;
  height: 36px;
}

.usage-table {
  border: 1px solid #dbe5f2;
  border-radius: 10px;
  overflow: hidden;
}

.usage-table table {
  width: 100%;
  border-collapse: collapse;
}

.usage-table th,
.usage-table td {
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid #e5ebf3;
  color: #31425f;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.usage-table th {
  height: 44px;
  background: #f8fafc;
  color: #60718f;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0;
}

.usage-table tr:last-child td {
  border-bottom: 0;
}

.agent-dot {
  width: 18px;
  height: 18px;
  margin-right: 7px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  color: #3156e9;
  background: #eaf1ff;
  font-size: 10px;
  font-weight: 850;
}

.status-pill {
  min-width: 76px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 850;
}

.status-pill i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-pill.success {
  color: #059669;
  background: #ddf8eb;
}

.status-pill.success i {
  background: #10b981;
}

.status-pill.error {
  color: #e23b3b;
  background: #fee2e2;
}

.status-pill.error i {
  background: #ef4444;
}

.more-btn {
  width: 30px;
  height: 30px;
}

.audit-list {
  display: grid;
}

.audit-list article {
  min-height: 64px;
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid #e5ebf3;
}

.audit-list span {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #3156e9;
  background: #eef3ff;
}

.audit-list strong {
  display: block;
  color: #13223a;
  font-size: 13px;
  font-weight: 850;
}

.audit-list small,
.audit-list time {
  color: #60718f;
  font-size: 12px;
  font-weight: 650;
}

.table-footer {
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  color: #516383;
  font-size: 12px;
  font-weight: 750;
}

.pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager button {
  min-width: 32px;
  height: 32px;
  border: 1px solid #d8e3f2;
  border-radius: 8px;
  background: #fff;
  color: #31425f;
  font-weight: 800;
  cursor: pointer;
}

.pager button.active {
  color: #3156e9;
  border-color: #b8c9ff;
  background: #eef3ff;
}

.pager button:disabled {
  opacity: .45;
  cursor: default;
}

.rows-select {
  height: 34px;
}

.rows-select select {
  min-width: 92px;
}

@media (max-width: 1400px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .analytics-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .chart-panel {
    grid-column: 1 / -1;
  }

  .cost-help {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .cost-header,
  .head-actions,
  .log-filters,
  .table-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-grid,
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .cost-help {
    grid-column: auto;
  }

  .search-box {
    width: 100%;
    margin-left: 0;
  }

  .usage-table {
    overflow-x: auto;
  }
}
</style>
