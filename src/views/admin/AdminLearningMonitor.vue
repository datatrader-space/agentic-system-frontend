<template>
  <div class="learning-page" data-testid="learning-monitor">
    <header class="page-header">
      <div class="page-heading">
        <div class="eyebrow"><Icon icon="lucide:brain-circuit" /> Continuous learning</div>
        <h1>Learning Monitor</h1>
        <p>
          Trace what agents learned, which run produced it, and whether the learning pipeline
          is healthy. Select an agent or conversation to apply the same scope across this view.
        </p>
      </div>

      <div class="header-actions" aria-label="Learning monitor controls">
        <div class="segmented" aria-label="Reporting window">
          <button
            v-for="d in [1, 7, 14, 30]"
            :key="d"
            type="button"
            :class="{ active: days === d }"
            :aria-pressed="days === d"
            @click="setDays(d)"
          >
            {{ d }}d
          </button>
        </div>
        <button type="button" class="button secondary" :disabled="loading" @click="refreshAll">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
          Refresh
        </button>
      </div>
    </header>

    <section class="scope-card" aria-labelledby="scope-title">
      <div class="scope-intro">
        <span class="section-icon"><Icon icon="lucide:list-filter" /></span>
        <div>
          <h2 id="scope-title">View scope</h2>
          <p>Filters apply to runs, memory, agents, failures, and attributed learning spend.</p>
        </div>
      </div>

      <div class="scope-controls">
        <label class="field" for="learning-agent">
          <span>Agent</span>
          <select id="learning-agent" v-model="agentId" @change="onAgentChange">
            <option :value="null">All learning agents</option>
            <option v-for="agent in scope.agents" :key="agent.id" :value="agent.id">
              {{ agent.name }} · {{ formatNumber(agent.runs) }} run{{ agent.runs === 1 ? '' : 's' }}
            </option>
          </select>
        </label>

        <label class="field conversation-field" for="learning-conversation">
          <span>Conversation</span>
          <select id="learning-conversation" v-model="conversationId" @change="load">
            <option :value="null">All conversations</option>
            <option v-for="conversation in visibleConversations" :key="conversation.id" :value="conversation.id">
              #{{ conversation.id }} · {{ conversation.title }} · {{ conversation.runs }} run{{ conversation.runs === 1 ? '' : 's' }}
            </option>
          </select>
        </label>

        <button
          v-if="hasScope"
          type="button"
          class="button tertiary clear-button"
          @click="clearScope"
        >
          <Icon icon="lucide:x" /> Clear scope
        </button>
      </div>

      <div class="scope-summary" :class="{ scoped: hasScope }">
        <Icon :icon="hasScope ? 'lucide:focus' : 'lucide:globe-2'" />
        <div>
          <span>{{ hasScope ? 'Focused view' : 'Platform view' }}</span>
          <strong>{{ scopeLabel || `All learning activity · last ${days} days` }}</strong>
        </div>
      </div>
    </section>

    <div v-if="loading && !snap" class="state-card" role="status">
      <span class="loader" aria-hidden="true"></span>
      <strong>Loading learning activity</strong>
      <span>Collecting runs, memories, instincts, and spend.</span>
    </div>

    <div v-else-if="error && !snap" class="state-card error-state" role="alert">
      <Icon icon="lucide:circle-alert" />
      <strong>Learning activity could not be loaded</strong>
      <span>Check the API connection, then try again.</span>
      <button type="button" class="button secondary" @click="refreshAll">Retry</button>
    </div>

    <template v-else-if="snap">
      <div v-if="error" class="inline-alert danger" role="alert">
        <Icon icon="lucide:circle-alert" />
        <div><strong>Refresh failed.</strong> The last successful snapshot is still shown.</div>
        <button type="button" class="text-button" @click="refreshAll">Try again</button>
      </div>

      <div v-if="pendingReview" class="inline-alert warning" role="alert">
        <Icon icon="lucide:triangle-alert" />
        <div>
          <strong>{{ pendingReview }} run{{ pendingReview === 1 ? '' : 's' }} waiting for review.</strong>
          No extractor model was available when {{ pendingReview === 1 ? 'this run finished' : 'these runs finished' }}.
          Configure the <em>summarize</em> model on AI Provider; the next sweep will retry them.
        </div>
      </div>

      <section aria-labelledby="health-title">
        <div class="section-heading compact-heading">
          <div>
            <h2 id="health-title">Pipeline health</h2>
            <p>{{ formatNumber(snap.runs.total) }} extractor run{{ snap.runs.total === 1 ? '' : 's' }} in this scope</p>
          </div>
          <span class="updated-at"><Icon icon="lucide:clock-3" /> Updated {{ shortTime(snap.generated_at) }}</span>
        </div>

        <div class="metric-grid">
          <button
            v-for="metric in metrics"
            :key="metric.key"
            type="button"
            class="metric-card"
            :class="[metric.tone, { selected: tab === metric.key }]"
            :aria-pressed="tab === metric.key"
            @click="tab = metric.key"
          >
            <span class="metric-top">
              <span class="metric-icon"><Icon :icon="metric.icon" /></span>
              <Icon icon="lucide:arrow-up-right" class="metric-open" />
            </span>
            <span class="metric-label">{{ metric.label }}</span>
            <strong class="metric-value">{{ metric.value }}</strong>
            <span class="metric-note">{{ metric.note }}</span>
          </button>
        </div>
      </section>

      <section class="panel schedule-panel" aria-labelledby="schedule-title">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon violet"><Icon icon="lucide:timer-reset" /></span>
            <div>
              <h2 id="schedule-title">Recovery sweep</h2>
              <p>Retries completed runs that did not enter the learning pipeline.</p>
            </div>
          </div>
          <span class="status-badge" :class="sched.enabled ? 'success' : 'neutral'">
            <span class="status-dot"></span>{{ sched.enabled ? 'Active' : 'Paused' }}
          </span>
        </div>

        <div v-if="!sched.available" class="empty-state compact">
          <Icon icon="lucide:calendar-x-2" />
          <span>The periodic task schedule is unavailable on this deployment.</span>
        </div>

        <template v-else>
          <div class="schedule-body">
            <label class="field interval-field" for="learning-interval">
              <span>Run every</span>
              <div class="input-suffix">
                <input id="learning-interval" v-model.number="intervalMinutes" type="number" min="1" step="1" />
                <span>minutes</span>
              </div>
            </label>

            <div class="preset-group" aria-label="Interval presets">
              <button
                v-for="preset in presets"
                :key="preset.m"
                type="button"
                :class="{ active: intervalMinutes === preset.m }"
                @click="intervalMinutes = preset.m"
              >
                {{ preset.label }}
              </button>
            </div>

            <label class="switch-control">
              <input v-model="enabled" type="checkbox" />
              <span class="switch" aria-hidden="true"></span>
              <span>{{ enabled ? 'Sweep enabled' : 'Sweep paused' }}</span>
            </label>

            <div class="schedule-actions">
              <button type="button" class="button primary" :disabled="saving || !dirty" @click="saveSchedule">
                <Icon icon="lucide:save" /> {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
              <button type="button" class="button secondary" :disabled="sweeping" @click="runNow">
                <Icon icon="lucide:play" /> {{ sweeping ? 'Queueing…' : 'Run now' }}
              </button>
            </div>
          </div>

          <div class="schedule-meta">
            <span><Icon icon="lucide:repeat-2" /> Every <strong>{{ prettyInterval(sched.interval_seconds) }}</strong></span>
            <span><Icon icon="lucide:activity" /> {{ formatNumber(sched.total_run_count || 0) }} sweeps</span>
            <span v-if="sched.last_run_at"><Icon icon="lucide:history" /> Last run {{ shortTime(sched.last_run_at) }}</span>
            <code>{{ sched.task || 'agent.tasks.sweep_run_learning' }}</code>
          </div>
        </template>
      </section>

      <section v-if="(snap.runs.by_agent || []).length" class="panel" aria-labelledby="agents-title">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon blue"><Icon icon="lucide:bot" /></span>
            <div>
              <h2 id="agents-title">Learning by agent</h2>
              <p>Compare review throughput and select a row to focus the entire page.</p>
            </div>
          </div>
          <span class="source-label">{{ snap.runs.source }}</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th class="numeric">Runs</th>
                <th class="numeric">Reviewed</th>
                <th class="numeric">Saved</th>
                <th class="numeric">Skipped</th>
                <th class="numeric">Pending</th>
                <th class="numeric">Errors</th>
                <th><span class="sr-only">Filter</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in snap.runs.by_agent"
                :key="row.agent.id ?? 'none'"
                class="selectable-row"
                :class="{ selected: sameId(agentId, row.agent.id) }"
                @click="pickAgent(row.agent.id)"
              >
                <td>
                  <div class="agent-cell">
                    <span class="agent-avatar"><Icon icon="lucide:bot" /></span>
                    <div><strong>{{ row.agent.name }}</strong><span>{{ reviewedRate(row) }}% reviewed</span></div>
                  </div>
                </td>
                <td class="numeric">{{ formatNumber(row.runs) }}</td>
                <td class="numeric positive">{{ formatNumber(row.reviewed) }}</td>
                <td class="numeric strong">{{ formatNumber(row.saved) }}</td>
                <td class="numeric muted">{{ formatNumber(row.skipped) }}</td>
                <td class="numeric" :class="{ caution: row.pending_review }">{{ formatNumber(row.pending_review) }}</td>
                <td class="numeric" :class="{ negative: row.errors }">{{ formatNumber(row.errors) }}</td>
                <td class="row-action"><Icon :icon="sameId(agentId, row.agent.id) ? 'lucide:check' : 'lucide:chevron-right'" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel detail-panel" aria-labelledby="detail-title">
        <div class="panel-header detail-header">
          <div class="panel-title-group">
            <span class="section-icon slate"><Icon :icon="activeMetric.icon" /></span>
            <div>
              <h2 id="detail-title">{{ tabTitle }}</h2>
              <p>{{ tabDescription }}</p>
            </div>
          </div>
          <span class="source-label">{{ tabSource }}</span>
        </div>

        <template v-if="tab === 'runs'">
          <div v-if="!snap.runs.recent.length" class="empty-state">
            <Icon icon="lucide:inbox" /><strong>No extractor runs</strong><span>No runs were recorded in this window.</span>
          </div>
          <div v-else class="table-wrap">
            <table class="data-table detail-table">
              <thead><tr><th>Agent</th><th>Conversation</th><th>Status</th><th class="numeric">Saved</th><th class="numeric">When</th></tr></thead>
              <tbody>
                <tr v-for="run in snap.runs.recent" :key="run.id">
                  <td><strong>{{ run.agent?.name || 'Unassigned' }}</strong></td>
                  <td>
                    <button type="button" class="conversation-link" @click="pickConversation(run.conversation?.id)">
                      #{{ run.conversation?.id ?? '—' }} · {{ run.conversation?.title || 'Untitled conversation' }}
                    </button>
                  </td>
                  <td>
                    <span :class="['status-badge', statusChip(run.status)]"><span class="status-dot"></span>{{ statusLabel(run.status) }}</span>
                    <span v-if="run.skip_reason" class="reason-text">{{ skipLabel(run.skip_reason) }}</span>
                  </td>
                  <td class="numeric strong">{{ formatNumber(run.actions) }}</td>
                  <td class="numeric muted nowrap">{{ shortTime(run.at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="tab === 'saved'">
          <div v-if="!(snap.memory.added || []).length" class="empty-state">
            <Icon icon="lucide:database-zap" /><strong>No memories written</strong><span>No memory facts were added in this window.</span>
          </div>
          <ul v-else class="activity-feed">
            <li v-for="fact in snap.memory.added" :key="fact.id">
              <span class="feed-marker success"><Icon icon="lucide:plus" /></span>
              <div class="feed-content">
                <div class="feed-meta">
                  <span class="status-badge neutral">{{ fact.topic.scope }}</span>
                  <strong>{{ fact.topic.title }}</strong>
                  <span class="status-badge" :class="fact.source === 'assistant_tool' ? 'info' : 'success'">
                    {{ fact.source === 'assistant_tool' ? 'Explicit' : 'Learned' }}
                  </span>
                  <span v-if="!fact.current" class="status-badge warning">Superseded</span>
                  <span class="feed-attribution">{{ attribution(fact) }} · {{ shortTime(fact.at) }}</span>
                </div>
                <p>{{ fact.statement }}</p>
              </div>
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'corrections'">
          <div v-if="!(snap.memory.corrections || []).length" class="empty-state">
            <Icon icon="lucide:file-diff" /><strong>No corrections</strong><span>A correction appears when a newer fact retires an older one.</span>
          </div>
          <ul v-else class="activity-feed">
            <li v-for="correction in snap.memory.corrections" :key="correction.id">
              <span class="feed-marker warning"><Icon icon="lucide:refresh-ccw" /></span>
              <div class="feed-content">
                <div class="feed-meta">
                  <span class="status-badge warning">Corrected</span>
                  <strong>{{ correction.topic.title }}</strong>
                  <span class="muted">{{ correction.topic.scope }}</span>
                  <span class="feed-attribution">{{ attribution(correction) }} · {{ shortTime(correction.retired_at) }}</span>
                </div>
                <div class="change-row old"><span>Before</span><p>{{ correction.was }}</p></div>
                <div class="change-row new"><span>After</span><p>{{ correction.now || 'Retired without a replacement' }}</p></div>
              </div>
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'pending'">
          <div v-if="!pendingRuns.length" class="empty-state">
            <Icon icon="lucide:circle-check-big" />
            <strong>{{ pendingReview ? 'No pending runs in the recent sample' : 'Nothing waiting for review' }}</strong>
            <span>{{ pendingReview ? `${pendingReview} older pending run(s) exist outside the latest 60 rows.` : 'Every run in this scope has reached a terminal learning state.' }}</span>
          </div>
          <div v-else class="table-wrap">
            <table class="data-table detail-table">
              <thead><tr><th>Agent</th><th>Conversation</th><th class="numeric">When</th></tr></thead>
              <tbody>
                <tr v-for="run in pendingRuns" :key="run.id">
                  <td><strong>{{ run.agent?.name || 'Unassigned' }}</strong></td>
                  <td>#{{ run.conversation?.id ?? '—' }} · {{ run.conversation?.title || 'Untitled conversation' }}</td>
                  <td class="numeric muted nowrap">{{ shortTime(run.at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="tab === 'instincts'">
          <div v-if="instinctsZero" class="empty-state">
            <Icon icon="lucide:sparkles" /><strong>No instincts captured</strong><span>Instincts appear after successful runs are processed by a working extractor.</span>
          </div>
          <ul v-else class="activity-feed">
            <li v-for="instinct in snap.instincts.recent" :key="instinct.id">
              <span class="feed-marker violet"><Icon icon="lucide:sparkles" /></span>
              <div class="feed-content">
                <div class="feed-meta">
                  <span class="status-badge info">{{ instinct.domain }}</span>
                  <strong>{{ Math.round((instinct.confidence || 0) * 100) }}% confidence</strong>
                  <span class="muted">{{ instinct.runs }} run{{ instinct.runs === 1 ? '' : 's' }} · {{ instinct.status }}</span>
                </div>
                <div class="change-row neutral"><span>When</span><p>{{ instinct.trigger }}</p></div>
                <div class="change-row new"><span>Do</span><p>{{ instinct.action }}</p></div>
              </div>
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'errors'">
          <div v-if="!errorCount" class="empty-state success-empty">
            <Icon icon="lucide:shield-check" /><strong>No extractor failures</strong><span>No learning failures were recorded in this window.</span>
          </div>
          <ul v-else class="activity-feed error-feed">
            <li v-for="failure in snap.runs.errors" :key="failure.id">
              <span class="feed-marker danger"><Icon icon="lucide:x" /></span>
              <div class="feed-content">
                <div class="feed-meta">
                  <span class="status-badge danger">Error</span>
                  <strong>{{ failure.agent?.name || 'Unassigned' }}</strong>
                  <span class="muted">Conversation #{{ failure.conversation?.id ?? '—' }} · {{ shortTime(failure.at) }}</span>
                </div>
                <pre class="error-message">{{ failure.error }}</pre>
              </div>
            </li>
          </ul>
          <div class="cost-summary">
            <div><span>Extractor calls</span><strong>{{ formatNumber(snap.cost.calls) }}</strong></div>
            <div><span>Prompt tokens</span><strong>{{ formatNumber(snap.cost.prompt_tokens) }}</strong></div>
            <div><span>Completion tokens</span><strong>{{ formatNumber(snap.cost.completion_tokens) }}</strong></div>
            <div><span>Learning spend</span><strong>{{ formatMoney(snap.cost.total_cost_usd) }}</strong></div>
          </div>
        </template>
      </section>

      <section v-if="(snap.memory.topics || []).length" class="panel" aria-labelledby="topics-title">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon green"><Icon icon="lucide:library-big" /></span>
            <div><h2 id="topics-title">Memory topics</h2><p>The active subjects and summaries injected into agent context.</p></div>
          </div>
          <span class="source-label">{{ snap.memory.source }}</span>
        </div>
        <div class="table-wrap">
          <table class="data-table detail-table topics-table">
            <thead><tr><th>Topic</th><th>Scope</th><th>Injected summary</th><th class="numeric">Facts</th><th class="numeric">Updated</th></tr></thead>
            <tbody>
              <tr v-for="topic in snap.memory.topics" :key="topic.id">
                <td><strong>{{ topic.title }}</strong></td>
                <td><span class="status-badge neutral">{{ topic.scope }}</span></td>
                <td class="summary-cell">{{ topic.summary || 'No summary generated yet.' }}</td>
                <td class="numeric strong">{{ formatNumber(topic.facts) }}</td>
                <td class="numeric muted nowrap">{{ shortTime(topic.updated_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="page-note"><Icon icon="lucide:info" /><span>{{ snap.note }}</span></footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const snap = ref(null)
const scope = ref({ agents: [], conversations: [] })
const loading = ref(true)
const error = ref(false)
const days = ref(7)
const tab = ref('runs')
const agentId = ref(null)
const conversationId = ref(null)

const sched = ref({})
const intervalMinutes = ref(10)
const enabled = ref(true)
const saving = ref(false)
const sweeping = ref(false)
const presets = [
  { m: 5, label: '5m' },
  { m: 10, label: '10m' },
  { m: 30, label: '30m' },
  { m: 60, label: '1h' },
  { m: 360, label: '6h' },
]

let loadRequest = 0
let scopeRequest = 0

const reviewed = computed(() => {
  const statuses = snap.value?.runs?.by_status || {}
  return (statuses.reviewed || 0) + (statuses.done || 0)
})
const pendingReview = computed(() => snap.value?.runs?.pending_review || 0)
const pendingRuns = computed(() => (snap.value?.runs?.recent || []).filter((run) => run.status === 'pending_review'))
const errorCount = computed(() => snap.value?.runs?.by_status?.error || 0)
const instinctsZero = computed(() => (snap.value?.instincts?.total || 0) === 0)
const hasScope = computed(() => agentId.value != null || conversationId.value != null)
const dirty = computed(() =>
  Math.round((sched.value.interval_seconds || 0) / 60) !== intervalMinutes.value
  || Boolean(sched.value.enabled) !== enabled.value)

const visibleConversations = computed(() => {
  const conversations = scope.value.conversations || []
  return agentId.value == null
    ? conversations
    : conversations.filter((conversation) => sameId(conversation.agent_id, agentId.value))
})

const scopeLabel = computed(() => {
  const labels = []
  if (agentId.value != null) {
    const agent = (scope.value.agents || []).find((item) => sameId(item.id, agentId.value))
    labels.push(agent?.name || `Agent ${agentId.value}`)
  }
  if (conversationId.value != null) {
    const conversation = (scope.value.conversations || []).find((item) => sameId(item.id, conversationId.value))
    labels.push(`#${conversationId.value}${conversation?.title ? ` · ${conversation.title}` : ''}`)
  }
  return labels.join(' / ')
})

const metrics = computed(() => [
  {
    key: 'runs', label: 'Runs reviewed', value: formatNumber(reviewed.value),
    note: `${formatNumber(snap.value?.runs?.total || 0)} total runs`, icon: 'lucide:scan-search', tone: 'blue',
  },
  {
    key: 'saved', label: 'Memories saved', value: formatNumber(snap.value?.runs?.actions_saved || 0),
    note: `${formatNumber(snap.value?.memory?.facts_added || 0)} ledger facts added`, icon: 'lucide:database-zap', tone: 'green',
  },
  {
    key: 'pending', label: 'Pending review', value: formatNumber(pendingReview.value),
    note: pendingReview.value ? 'Extractor model required' : 'Nothing waiting', icon: 'lucide:clock-alert', tone: pendingReview.value ? 'amber' : 'slate',
  },
  {
    key: 'corrections', label: 'Facts corrected', value: formatNumber(snap.value?.memory?.facts_invalidated || 0),
    note: 'Retired or replaced facts', icon: 'lucide:file-diff', tone: 'violet',
  },
  {
    key: 'instincts', label: 'Instincts', value: formatNumber(snap.value?.instincts?.total || 0),
    note: `${formatNumber(snap.value?.instincts?.multi_run_evidence || 0)} with multi-run evidence`, icon: 'lucide:sparkles', tone: 'purple',
  },
  {
    key: 'errors', label: 'Failures & spend', value: formatNumber(errorCount.value),
    note: `${formatMoney(snap.value?.cost?.total_cost_usd)} learning spend`, icon: 'lucide:circle-alert', tone: errorCount.value ? 'red' : 'slate',
  },
])

const TAB_META = {
  runs: ['Extractor runs', 'Every learning pass with its agent, conversation, status, and output.', 'agent.MemoryAutopilotRun'],
  saved: ['Saved memories', 'The exact facts added to the memory ledger in this scope.', 'MemoryFact · added'],
  corrections: ['Fact corrections', 'Before-and-after changes that keep the memory ledger current.', 'MemoryFact · invalidated'],
  pending: ['Pending review', 'Runs that could not be processed because no extractor model was available.', 'status = pending_review'],
  instincts: ['Learned instincts', 'Evidence-backed behavioral guidance discovered across successful runs.', 'agent.Instinct'],
  errors: ['Failures and learning spend', 'Extractor errors and the attributed token and cost footprint.', 'LLMRequestLog · request_source=system'],
}
const tabTitle = computed(() => (TAB_META[tab.value] || ['Activity'])[0])
const tabDescription = computed(() => (TAB_META[tab.value] || ['', ''])[1])
const tabSource = computed(() => (TAB_META[tab.value] || ['', '', ''])[2])
const activeMetric = computed(() => metrics.value.find((metric) => metric.key === tab.value) || metrics.value[0])

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  })
}

function shortTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function reviewedRate(row) {
  return row.runs ? Math.round((row.reviewed / row.runs) * 100) : 0
}

function attribution(item) {
  const parts = [item.agent?.name || 'Unassigned agent']
  if (item.conversation?.id) parts.push(`Conversation #${item.conversation.id}`)
  return parts.join(' · ')
}

function statusChip(status) {
  if (status === 'reviewed' || status === 'done') return 'success'
  if (status === 'error') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'neutral'
}

function statusLabel(status) {
  if (status === 'pending_review') return 'Pending review'
  if (status === 'done') return 'Reviewed'
  return status ? status.replaceAll('_', ' ') : 'Unknown'
}

function skipLabel(reason) {
  return ({
    prefilter: 'Nothing to learn', secret: 'Contained a secret', disabled: 'Learning disabled',
    duplicate: 'Already processed', no_model: 'No model available', empty: 'Empty run',
  })[reason] || reason
}

function prettyInterval(seconds) {
  if (!seconds) return '—'
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`
  const hours = seconds / 3600
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`
}

function setDays(value) {
  if (days.value === value) return
  days.value = value
  refreshAll()
}

function pickAgent(id) {
  if (id == null) return
  agentId.value = sameId(agentId.value, id) ? null : id
  conversationId.value = null
  load()
}

function pickConversation(id) {
  if (id == null) return
  const conversation = (scope.value.conversations || []).find((item) => sameId(item.id, id))
  conversationId.value = id
  if (conversation?.agent_id != null) agentId.value = conversation.agent_id
  load()
}

function onAgentChange() {
  conversationId.value = null
  load()
}

function clearScope() {
  agentId.value = null
  conversationId.value = null
  load()
}

function applySchedule(schedule) {
  sched.value = schedule || {}
  if (schedule?.interval_seconds) {
    intervalMinutes.value = Math.max(1, Math.round(schedule.interval_seconds / 60))
  }
  enabled.value = schedule?.enabled !== false
}

async function loadScope() {
  const request = ++scopeRequest
  try {
    const { data } = await api.get('/admin/observability/learning/scope/', {
      params: { days: days.value }, noCache: true,
    })
    if (request === scopeRequest) scope.value = data
  } catch {
    if (request === scopeRequest) scope.value = { agents: [], conversations: [] }
  }
}

async function load() {
  const request = ++loadRequest
  loading.value = true
  error.value = false
  try {
    const params = { days: days.value }
    if (agentId.value != null) params.agent_id = agentId.value
    if (conversationId.value != null) params.conversation_id = conversationId.value
    const { data } = await api.get('/admin/observability/learning/', { params, noCache: true })
    if (request !== loadRequest) return
    snap.value = data
    applySchedule(data.schedule)
  } catch {
    if (request === loadRequest) error.value = true
  } finally {
    if (request === loadRequest) loading.value = false
  }
}

function refreshAll() {
  loadScope()
  return load()
}

async function saveSchedule() {
  saving.value = true
  try {
    const { data } = await api.patch('/admin/observability/learning/schedule/', {
      interval_minutes: intervalMinutes.value,
      enabled: enabled.value,
    })
    applySchedule(data)
    notify.success(`Recovery sweep now runs every ${prettyInterval(data.interval_seconds)}.`)
  } catch (requestError) {
    notify.error(requestError?.response?.data?.error || 'Could not update the recovery sweep.')
  } finally {
    saving.value = false
  }
}

async function runNow() {
  sweeping.value = true
  try {
    const { data } = await api.post('/admin/observability/learning/sweep/', {})
    if (data.queued) {
      notify.success('Recovery sweep queued. Activity will refresh as it completes.')
      window.setTimeout(load, 4000)
    } else {
      notify.error(data.error || 'Could not queue the recovery sweep.')
    }
  } catch (requestError) {
    notify.error(requestError?.response?.data?.error || 'Could not queue the recovery sweep.')
  } finally {
    sweeping.value = false
  }
}

onMounted(refreshAll)
</script>

<style scoped>
.learning-page {
  --ink: #0f172a;
  --muted: #64748b;
  --subtle: #94a3b8;
  --line: #e2e8f0;
  --soft-line: #edf2f7;
  --surface: #ffffff;
  --primary: #4f46e5;
  width: min(100%, 1560px);
  margin: 0 auto;
  padding: 26px 30px 64px;
  color: var(--ink);
  isolation: isolate;
}

.page-header,
.panel-header,
.scope-card,
.schedule-body,
.schedule-meta,
.section-heading,
.scope-controls,
.scope-summary,
.panel-title-group,
.scope-intro,
.header-actions,
.inline-alert,
.agent-cell,
.feed-meta,
.page-note { display: flex; align-items: center; }

.page-header { justify-content: space-between; align-items: flex-start; gap: 28px; margin-bottom: 20px; }
.page-heading { max-width: 760px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; color: var(--primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.eyebrow svg { width: 15px; height: 15px; }
.page-heading h1 { margin: 6px 0 0; font-size: clamp(25px, 2.2vw, 32px); line-height: 1.15; letter-spacing: -.035em; font-weight: 800; }
.page-heading p { margin: 8px 0 0; color: var(--muted); font-size: 13.5px; line-height: 1.55; }
.header-actions { gap: 10px; flex: none; }

.segmented { display: inline-flex; padding: 3px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.segmented button { min-width: 42px; height: 32px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font-size: 12px; font-weight: 750; cursor: pointer; }
.segmented button:hover { color: var(--ink); background: #f8fafc; }
.segmented button.active { color: #fff; background: var(--primary); box-shadow: 0 2px 7px rgba(79, 70, 229, .25); }

.button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; padding: 0 14px; border: 1px solid transparent; border-radius: 9px; font: inherit; font-size: 12.5px; font-weight: 750; white-space: nowrap; cursor: pointer; transition: border-color .15s, background .15s, box-shadow .15s, transform .15s; }
.button svg { width: 15px; height: 15px; }
.button:hover:not(:disabled) { transform: translateY(-1px); }
.button:disabled { opacity: .55; cursor: not-allowed; }
.button.primary { color: #fff; background: var(--primary); box-shadow: 0 3px 9px rgba(79, 70, 229, .22); }
.button.primary:hover:not(:disabled) { background: #4338ca; }
.button.secondary { color: #334155; background: #fff; border-color: #d8e1ec; }
.button.secondary:hover:not(:disabled) { border-color: #b9c5d5; background: #f8fafc; }
.button.tertiary { color: var(--muted); background: #f8fafc; border-color: transparent; }
.spin { animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.scope-card { position: relative; align-items: flex-end; gap: 22px; padding: 16px 18px; margin-bottom: 22px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 7px 24px rgba(15, 23, 42, .035); }
.scope-intro { align-self: center; gap: 10px; min-width: 170px; }
.scope-intro h2,
.panel-title-group h2,
.section-heading h2 { margin: 0; font-size: 14px; font-weight: 800; letter-spacing: -.01em; }
.scope-intro p,
.panel-title-group p,
.section-heading p { margin: 3px 0 0; color: var(--muted); font-size: 11.5px; line-height: 1.4; }
.scope-controls { flex: 1; align-items: flex-end; gap: 12px; min-width: 0; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 180px; color: #475569; font-size: 10.5px; font-weight: 800; letter-spacing: .055em; text-transform: uppercase; }
.conversation-field { flex: 1; max-width: 430px; }
.field select,
.field input { width: 100%; height: 40px; border: 1px solid #d8e1ec; border-radius: 9px; outline: none; background: #fff; color: var(--ink); font: inherit; font-size: 12.5px; font-weight: 650; text-transform: none; letter-spacing: 0; }
.field select { padding: 0 34px 0 11px; cursor: pointer; }
.field input { padding: 0 11px; }
.field select:focus,
.field input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, .12); }
.clear-button { margin-bottom: 0; }
.scope-summary { align-self: center; gap: 9px; min-width: 230px; max-width: 300px; padding: 9px 11px; border-radius: 10px; color: var(--muted); background: #f8fafc; }
.scope-summary.scoped { color: #4338ca; background: #eef2ff; }
.scope-summary > svg { width: 17px; height: 17px; flex: none; }
.scope-summary div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.scope-summary span { font-size: 9.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.scope-summary strong { overflow: hidden; font-size: 11.5px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }

.section-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; color: #475569; background: #f1f5f9; flex: none; }
.section-icon svg { width: 17px; height: 17px; }
.section-icon.violet { color: #6d28d9; background: #f3e8ff; }
.section-icon.blue { color: #2563eb; background: #dbeafe; }
.section-icon.green { color: #15803d; background: #dcfce7; }
.section-icon.slate { color: #475569; background: #f1f5f9; }

.section-heading { justify-content: space-between; gap: 16px; margin: 0 0 12px; }
.compact-heading { align-items: flex-end; }
.updated-at { display: inline-flex; align-items: center; gap: 6px; color: var(--subtle); font-size: 10.5px; white-space: nowrap; }
.updated-at svg { width: 13px; height: 13px; }

.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(145px, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric-card { --metric: #64748b; --metric-soft: #f1f5f9; position: relative; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; min-height: 148px; padding: 14px 15px; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink); text-align: left; font: inherit; cursor: pointer; box-shadow: 0 4px 15px rgba(15, 23, 42, .035); transition: transform .16s, border-color .16s, box-shadow .16s; }
.metric-card::before { position: absolute; inset: 0 0 auto; height: 3px; background: var(--metric); content: ''; opacity: 0; }
.metric-card:hover { transform: translateY(-2px); border-color: #c7d2fe; box-shadow: 0 9px 24px rgba(15, 23, 42, .07); }
.metric-card.selected { border-color: var(--metric); box-shadow: 0 0 0 2px color-mix(in srgb, var(--metric) 14%, transparent), 0 8px 22px rgba(15, 23, 42, .06); }
.metric-card.selected::before { opacity: 1; }
.metric-card.blue { --metric: #2563eb; --metric-soft: #dbeafe; }
.metric-card.green { --metric: #16a34a; --metric-soft: #dcfce7; }
.metric-card.amber { --metric: #d97706; --metric-soft: #fef3c7; }
.metric-card.violet { --metric: #7c3aed; --metric-soft: #ede9fe; }
.metric-card.purple { --metric: #9333ea; --metric-soft: #f3e8ff; }
.metric-card.red { --metric: #dc2626; --metric-soft: #fee2e2; }
.metric-top { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.metric-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; color: var(--metric); background: var(--metric-soft); }
.metric-icon svg { width: 16px; height: 16px; }
.metric-open { width: 13px; height: 13px; color: #cbd5e1; }
.metric-label { margin-top: 13px; color: var(--muted); font-size: 10.5px; font-weight: 800; letter-spacing: .045em; text-transform: uppercase; }
.metric-value { margin-top: 2px; font-size: 27px; line-height: 1.1; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
.metric-note { margin-top: auto; padding-top: 7px; overflow: hidden; color: var(--subtle); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }

.panel { margin-bottom: 16px; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: #fff; box-shadow: 0 4px 16px rgba(15, 23, 42, .03); }
.panel-header { justify-content: space-between; gap: 16px; min-height: 66px; padding: 13px 16px; border-bottom: 1px solid var(--soft-line); background: linear-gradient(180deg, #fff 0%, #fbfdff 100%); }
.panel-title-group { gap: 11px; min-width: 0; }
.source-label { max-width: 36%; overflow: hidden; color: var(--subtle); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }

.schedule-body { gap: 18px; align-items: flex-end; padding: 18px 16px; }
.interval-field { width: 185px; flex: none; }
.input-suffix { position: relative; }
.input-suffix input { padding-right: 70px; font-variant-numeric: tabular-nums; }
.input-suffix span { position: absolute; top: 50%; right: 10px; color: var(--muted); font-size: 11px; font-weight: 700; text-transform: none; letter-spacing: 0; transform: translateY(-50%); pointer-events: none; }
.preset-group { display: inline-flex; gap: 5px; padding-bottom: 1px; }
.preset-group button { min-width: 40px; height: 38px; padding: 0 9px; border: 1px solid #d8e1ec; border-radius: 8px; background: #fff; color: var(--muted); font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; }
.preset-group button:hover { border-color: #a5b4fc; color: #4338ca; }
.preset-group button.active { border-color: #6366f1; color: #4338ca; background: #eef2ff; }
.switch-control { display: inline-flex; align-items: center; gap: 9px; min-height: 40px; color: #334155; font-size: 12px; font-weight: 750; cursor: pointer; }
.switch-control input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.switch { position: relative; width: 34px; height: 20px; border-radius: 999px; background: #cbd5e1; transition: background .16s; }
.switch::after { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .25); content: ''; transition: transform .16s; }
.switch-control input:checked + .switch { background: var(--primary); }
.switch-control input:checked + .switch::after { transform: translateX(14px); }
.switch-control input:focus-visible + .switch { outline: 3px solid rgba(99, 102, 241, .2); }
.schedule-actions { display: flex; gap: 8px; margin-left: auto; }
.schedule-meta { gap: 18px; flex-wrap: wrap; min-height: 43px; padding: 10px 16px; border-top: 1px solid var(--soft-line); color: var(--muted); background: #f8fafc; font-size: 10.5px; }
.schedule-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.schedule-meta svg { width: 13px; height: 13px; color: var(--subtle); }
.schedule-meta code { margin-left: auto; color: var(--subtle); font-size: 9.5px; }

.inline-alert { gap: 11px; padding: 12px 14px; margin-bottom: 16px; border: 1px solid; border-radius: 11px; font-size: 12px; line-height: 1.5; }
.inline-alert > svg { width: 18px; height: 18px; flex: none; }
.inline-alert div { flex: 1; }
.inline-alert.warning { border-color: #fde68a; color: #92400e; background: #fffbeb; }
.inline-alert.danger { border-color: #fecaca; color: #991b1b; background: #fef2f2; }
.text-button { padding: 0; border: 0; color: inherit; background: transparent; font: inherit; font-size: 11.5px; font-weight: 800; cursor: pointer; text-decoration: underline; }

.table-wrap { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: 10px 16px; border-bottom: 1px solid var(--soft-line); color: var(--muted); background: #f8fafc; font-size: 9.5px; font-weight: 800; letter-spacing: .055em; text-align: left; text-transform: uppercase; white-space: nowrap; }
.data-table td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 12px; vertical-align: middle; }
.data-table tbody tr:last-child td { border-bottom: 0; }
.data-table tbody tr:hover td { background: #fbfdff; }
.data-table .numeric { text-align: right; font-variant-numeric: tabular-nums; }
.data-table .strong { color: var(--ink); font-weight: 800; }
.data-table .positive { color: #15803d; font-weight: 750; }
.data-table .caution { color: #b45309; font-weight: 750; }
.data-table .negative { color: #dc2626; font-weight: 750; }
.muted { color: var(--subtle) !important; }
.nowrap { white-space: nowrap; }
.selectable-row { cursor: pointer; }
.selectable-row.selected td { background: #eef2ff !important; }
.agent-cell { gap: 9px; min-width: 180px; }
.agent-avatar { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; color: #4f46e5; background: #eef2ff; flex: none; }
.agent-avatar svg { width: 15px; height: 15px; }
.agent-cell div { display: flex; flex-direction: column; gap: 2px; }
.agent-cell strong { color: var(--ink); font-size: 12px; }
.agent-cell span { color: var(--subtle); font-size: 9.5px; }
.row-action { width: 34px; color: #cbd5e1 !important; text-align: center; }
.row-action svg { width: 14px; height: 14px; }

.detail-panel { min-height: 190px; }
.detail-table td { padding-top: 12px; padding-bottom: 12px; }
.conversation-link { max-width: 410px; overflow: hidden; padding: 0; border: 0; color: #4338ca; background: transparent; font: inherit; font-size: 12px; font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.conversation-link:hover { text-decoration: underline; }
.reason-text { margin-left: 7px; color: var(--subtle); font-size: 10.5px; }

.status-badge { display: inline-flex; align-items: center; gap: 5px; min-height: 22px; padding: 3px 8px; border-radius: 999px; color: #475569; background: #f1f5f9; font-size: 9px; font-weight: 850; letter-spacing: .035em; text-transform: uppercase; white-space: nowrap; }
.status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.status-badge.success { color: #15803d; background: #dcfce7; }
.status-badge.warning { color: #a16207; background: #fef3c7; }
.status-badge.danger { color: #dc2626; background: #fee2e2; }
.status-badge.info { color: #4338ca; background: #eef2ff; }
.status-badge.neutral { color: #64748b; background: #f1f5f9; }

.activity-feed { display: flex; flex-direction: column; gap: 0; margin: 0; padding: 6px 16px 12px; list-style: none; }
.activity-feed li { display: flex; gap: 12px; padding: 14px 2px; border-bottom: 1px solid var(--soft-line); }
.activity-feed li:last-child { border-bottom: 0; }
.feed-marker { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin-top: 1px; border-radius: 8px; flex: none; }
.feed-marker svg { width: 14px; height: 14px; }
.feed-marker.success { color: #15803d; background: #dcfce7; }
.feed-marker.warning { color: #a16207; background: #fef3c7; }
.feed-marker.violet { color: #7c3aed; background: #ede9fe; }
.feed-marker.danger { color: #dc2626; background: #fee2e2; }
.feed-content { flex: 1; min-width: 0; }
.feed-meta { gap: 7px; flex-wrap: wrap; min-height: 24px; color: var(--muted); font-size: 10.5px; }
.feed-meta strong { color: #334155; }
.feed-attribution { margin-left: auto; color: var(--subtle); }
.feed-content > p { margin: 5px 0 0; color: #1e293b; font-size: 12.5px; line-height: 1.55; }
.change-row { display: grid; grid-template-columns: 52px 1fr; gap: 8px; margin-top: 7px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; }
.change-row > span { padding-top: 1px; color: var(--subtle); font-size: 9px; font-weight: 850; letter-spacing: .04em; text-transform: uppercase; }
.change-row p { margin: 0; color: #334155; font-size: 12px; line-height: 1.5; }
.change-row.old p { color: #94a3b8; text-decoration: line-through; }
.change-row.new { background: #f0fdf4; }
.change-row.new > span { color: #15803d; }
.error-message { margin: 7px 0 0; padding: 10px 11px; overflow-x: auto; border: 1px solid #fee2e2; border-radius: 8px; color: #991b1b; background: #fff7f7; font: 10.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
.cost-summary { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--soft-line); background: #f8fafc; }
.cost-summary div { display: flex; flex-direction: column; gap: 3px; padding: 14px 16px; border-right: 1px solid var(--soft-line); }
.cost-summary div:last-child { border-right: 0; }
.cost-summary span { color: var(--muted); font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.cost-summary strong { font-size: 15px; font-variant-numeric: tabular-nums; }

.empty-state,
.state-card { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px; padding: 32px; color: var(--muted); text-align: center; }
.empty-state.compact { min-height: 96px; }
.empty-state > svg,
.state-card > svg { width: 26px; height: 26px; margin-bottom: 9px; color: #94a3b8; }
.empty-state strong,
.state-card strong { color: #334155; font-size: 13px; }
.empty-state span,
.state-card span { margin-top: 4px; font-size: 11.5px; }
.state-card { min-height: 300px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
.state-card .button { margin-top: 14px; }
.loader { width: 26px; height: 26px; margin-bottom: 12px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin .8s linear infinite; }
.error-state > svg { color: #dc2626; }
.summary-cell { max-width: 600px; color: var(--muted) !important; line-height: 1.45; }
.page-note { align-items: flex-start; gap: 8px; padding: 6px 3px 0; color: var(--subtle); font-size: 10.5px; line-height: 1.5; }
.page-note svg { width: 14px; height: 14px; margin-top: 1px; flex: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1280px) {
  .scope-card { flex-wrap: wrap; }
  .scope-intro { width: 100%; }
  .scope-summary { margin-left: auto; }
  .metric-grid { grid-template-columns: repeat(3, minmax(160px, 1fr)); }
  .schedule-body { flex-wrap: wrap; }
}

@media (max-width: 900px) {
  .learning-page { padding: 22px 20px 56px; }
  .page-header { flex-direction: column; }
  .header-actions { width: 100%; justify-content: space-between; }
  .scope-controls { width: 100%; flex-wrap: wrap; }
  .field,
  .conversation-field { flex: 1 1 240px; max-width: none; }
  .scope-summary { width: 100%; max-width: none; }
  .schedule-actions { width: 100%; margin-left: 0; }
  .schedule-meta code { width: 100%; margin-left: 0; }
  .metric-grid { grid-template-columns: repeat(2, minmax(150px, 1fr)); }
  .feed-attribution { width: 100%; margin-left: 0; }
}

@media (max-width: 560px) {
  .learning-page { padding: 18px 14px 48px; }
  .header-actions { align-items: stretch; flex-direction: column; }
  .segmented { display: grid; grid-template-columns: repeat(4, 1fr); }
  .scope-card { padding: 14px; }
  .scope-controls { flex-direction: column; align-items: stretch; }
  .field,
  .conversation-field { width: 100%; min-width: 0; flex-basis: auto; }
  .metric-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
  .metric-card { min-height: 140px; padding: 13px; }
  .metric-value { font-size: 24px; }
  .panel-header { align-items: flex-start; }
  .source-label { display: none; }
  .schedule-body { align-items: stretch; flex-direction: column; }
  .interval-field { width: 100%; }
  .preset-group { display: grid; grid-template-columns: repeat(5, 1fr); }
  .schedule-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .cost-summary { grid-template-columns: 1fr 1fr; }
  .cost-summary div:nth-child(2) { border-right: 0; }
  .cost-summary div:nth-child(-n + 2) { border-bottom: 1px solid var(--soft-line); }
  .change-row { grid-template-columns: 1fr; gap: 3px; }
}
</style>
