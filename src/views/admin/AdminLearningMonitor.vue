<!-- Learning Monitor — is each agent learning? (agentic-docs/LEARNING_MONITOR_REDESIGN_PLAN.md in the backend repo)

     Overview and Agents read outcomes: runs by how they ended, the agent's own mistakes apart from the
     environment's, warned mistakes repeated, and a trend per agent with the reasons that decided it
     (GET /admin/observability/learning/agents/). Memory, Practices and Pipeline read what the learner wrote
     and whether it ran (GET /admin/observability/learning/). The window and agent filters apply to all tabs;
     the conversation filter narrows Memory and Pipeline. -->
<template>
  <div class="learning-page" data-testid="learning-monitor">
    <header class="page-header">
      <div class="page-heading">
        <div class="eyebrow"><Icon icon="lucide:brain-circuit" /> Continuous learning</div>
        <h1>Learning Monitor</h1>
        <p>Whether agents get better from their runs: how often they succeed, whether they repeat the mistakes they were warned about, and what they learned.</p>
      </div>
      <span v-if="board" class="updated-at"><Icon icon="lucide:clock-3" /> Updated {{ shortTime(board.generated_at) }}</span>
    </header>

    <div class="filters" role="group" aria-label="Filters">
      <div class="segmented" role="group" aria-label="Reporting window">
        <button v-for="d in WINDOWS" :key="d" type="button" :class="{ active: days === d }" :aria-pressed="days === d" @click="setDays(d)">{{ d }}d</button>
      </div>
      <label class="field" for="learning-agent">
        <span>Agent</span>
        <select id="learning-agent" v-model="agentId" @change="onAgentChange">
          <option :value="null">All agents</option>
          <option v-for="agent in agentOptions" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
        </select>
      </label>
      <label v-if="tab === 'memory' || tab === 'pipeline'" class="field" for="learning-conversation">
        <span>Conversation</span>
        <select id="learning-conversation" v-model="conversationId" @change="loadSnapshot">
          <option :value="null">All conversations</option>
          <option v-for="c in visibleConversations" :key="c.id" :value="c.id">#{{ c.id }} · {{ c.title }}</option>
        </select>
      </label>
      <button type="button" class="button secondary" :disabled="loading" @click="refreshAll">
        <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
      </button>
    </div>

    <nav class="tabs" aria-label="Learning monitor sections">
      <button v-for="t in tabs" :key="t.key" type="button" class="tab" :class="{ active: tab === t.key }"
              :aria-current="tab === t.key ? 'page' : undefined" :data-tab="t.key" @click="tab = t.key">
        <Icon :icon="t.icon" />{{ t.label }}<span v-if="t.count != null" class="count">{{ t.count }}</span>
      </button>
    </nav>

    <div v-if="loading && !board && !snap" class="state-card" role="status">
      <span class="loader" aria-hidden="true"></span>
      <strong>Loading learning activity</strong>
      <span>Collecting runs, mistakes, memories and practices.</span>
    </div>

    <div v-else-if="error && !board && !snap" class="state-card error-state" role="alert">
      <Icon icon="lucide:circle-alert" />
      <strong>Learning activity could not be loaded</strong>
      <span>Check the API connection, then try again.</span>
      <button type="button" class="button secondary" @click="refreshAll">Retry</button>
    </div>

    <template v-else>
      <div v-if="error" class="inline-alert danger" role="alert">
        <Icon icon="lucide:circle-alert" />
        <div><strong>Refresh failed.</strong> The last loaded figures are still shown.</div>
        <button type="button" class="text-button" @click="refreshAll">Try again</button>
      </div>
      <div v-if="pendingReview" class="inline-alert warning" role="status">
        <Icon icon="lucide:triangle-alert" />
        <div>
          <strong>{{ pendingReview }} run{{ pendingReview === 1 ? '' : 's' }} not learned from yet.</strong>
          No summarize model was available when {{ pendingReview === 1 ? 'it' : 'they' }} finished. Set one on the AI Provider page; the recovery sweep retries them.
        </div>
      </div>

      <template v-if="tab === 'overview'">
        <LearningOverview v-if="overviewReport" :report="overviewReport" :agents="board?.agents || []"
                          :agent-scoped="agentId != null" @open-agent="openAgent" />
      </template>

      <template v-else-if="tab === 'agents'">
        <LearningAgentDetail v-if="agentId != null" :report="detail" :loading="detailLoading"
                             :name="agentName" @back="closeAgent" />
        <LearningAgents v-else-if="board" :report="board" @select="openAgent" />
      </template>

      <LearningMemory v-else-if="tab === 'memory' && snap" :snap="snap" />

      <LearningPractices v-else-if="tab === 'practices' && snap" :snap="snap" :review-queue="reviewQueue"
                         :reviewing="reviewing" @review="review" />

      <LearningPipeline v-else-if="tab === 'pipeline' && snap" :snap="snap" @pick-conversation="pickConversation"
                        @refresh="refreshAll" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import LearningOverview from '@/components/admin/learning/LearningOverview.vue'
import LearningAgents from '@/components/admin/learning/LearningAgents.vue'
import LearningAgentDetail from '@/components/admin/learning/LearningAgentDetail.vue'
import LearningMemory from '@/components/admin/learning/LearningMemory.vue'
import LearningPractices from '@/components/admin/learning/LearningPractices.vue'
import LearningPipeline from '@/components/admin/learning/LearningPipeline.vue'
import { sameId, shortTime } from '@/components/admin/learning/learningFormat'
import '@/components/admin/learning/learning.css'

const WINDOWS = [1, 7, 14, 30, 90]

const days = ref(7)
const tab = ref('overview')
const agentId = ref(null)
const conversationId = ref(null)

const board = ref(null)          // every agent's scorecard (Overview, Agents)
const detail = ref(null)         // the picked agent's report
const snap = ref(null)           // what the learner wrote (Memory, Practices, Pipeline)
const scope = ref({ agents: [], conversations: [] })
const reviewQueue = ref([])
const reviewing = ref(null)
const loading = ref(true)
const detailLoading = ref(false)
const error = ref(false)

let boardRequest = 0
let detailRequest = 0
let snapRequest = 0

const pendingReview = computed(() => snap.value?.runs?.pending_review || 0)
const overviewReport = computed(() => (agentId.value != null ? detail.value : board.value))

const agentOptions = computed(() => {
  const seen = new Map()
  for (const card of board.value?.agents || []) seen.set(String(card.agent.id), { id: card.agent.id, name: card.agent.name })
  for (const agent of scope.value.agents || []) if (!seen.has(String(agent.id))) seen.set(String(agent.id), { id: agent.id, name: agent.name })
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const agentName = computed(() => agentOptions.value.find((a) => sameId(a.id, agentId.value))?.name || '')
const visibleConversations = computed(() => (scope.value.conversations || [])
  .filter((c) => agentId.value == null || sameId(c.agent_id, agentId.value)))

const tabs = computed(() => [
  { key: 'overview', label: 'Overview', icon: 'lucide:layout-dashboard' },
  { key: 'agents', label: 'Agents', icon: 'lucide:bot', count: board.value?.agents?.length ?? null },
  { key: 'memory', label: 'Memory', icon: 'lucide:database-zap' },
  { key: 'practices', label: 'Practices', icon: 'lucide:sparkles', count: reviewQueue.value.length || null },
  { key: 'pipeline', label: 'Pipeline', icon: 'lucide:workflow' },
])

async function loadBoard () {
  const request = ++boardRequest
  const { data } = await api.get('/admin/observability/learning/agents/', { params: { days: days.value }, noCache: true })
  if (request === boardRequest) board.value = data
}

async function loadDetail () {
  const request = ++detailRequest
  if (agentId.value == null) { detail.value = null; return }
  detailLoading.value = true
  try {
    const { data } = await api.get('/admin/observability/learning/agents/', {
      params: { days: days.value, agent_id: agentId.value }, noCache: true,
    })
    if (request === detailRequest) detail.value = data
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

async function loadSnapshot () {
  const request = ++snapRequest
  const params = { days: days.value }
  if (agentId.value != null) params.agent_id = agentId.value
  if (conversationId.value != null) params.conversation_id = conversationId.value
  const { data } = await api.get('/admin/observability/learning/', { params, noCache: true })
  if (request !== snapRequest) return
  snap.value = data
  // Held here rather than read off `snap`, so a judged practice leaves the queue the moment its verdict lands.
  reviewQueue.value = data?.instincts?.review_queue || []
}

async function loadScope () {
  try {
    const { data } = await api.get('/admin/observability/learning/scope/', { params: { days: days.value }, noCache: true })
    scope.value = data || { agents: [], conversations: [] }
  } catch {
    scope.value = { agents: [], conversations: [] }
  }
}

async function refreshAll () {
  loading.value = true
  error.value = false
  const results = await Promise.allSettled([loadBoard(), loadDetail(), loadSnapshot(), loadScope()])
  error.value = results.slice(0, 3).some((r) => r.status === 'rejected')
  loading.value = false
}

function setDays (value) {
  if (days.value === value) return
  days.value = value
  refreshAll()
}

function openAgent (id) {
  agentId.value = id
  conversationId.value = null
  tab.value = 'agents'
  loadDetail().catch(() => { error.value = true })
  loadSnapshot().catch(() => { error.value = true })
}

function closeAgent () {
  agentId.value = null
  conversationId.value = null
  detail.value = null
  loadSnapshot().catch(() => { error.value = true })
}

function onAgentChange () {
  conversationId.value = null
  loadDetail().catch(() => { error.value = true })
  loadSnapshot().catch(() => { error.value = true })
}

function pickConversation (id) {
  if (id == null) return
  const conversation = (scope.value.conversations || []).find((c) => sameId(c.id, id))
  conversationId.value = id
  if (conversation?.agent_id != null) agentId.value = conversation.agent_id
  loadSnapshot().catch(() => { error.value = true })
}

async function review (instinct, verdict) {
  reviewing.value = instinct.id
  try {
    const { data } = await api.post('/admin/observability/learning/review/', { instinct_id: instinct.id, verdict })
    reviewQueue.value = reviewQueue.value.filter((row) => row.id !== instinct.id)
    notify.success(verdict === 'good'
      ? `Confirmed. Confidence is now ${Math.round((data.confidence || 0) * 100)}%.`
      : `Marked not useful. Confidence fell to ${Math.round((data.confidence || 0) * 100)}%.`)
  } catch (requestError) {
    notify.error(requestError?.response?.data?.detail || 'Could not record that verdict.')
  } finally {
    reviewing.value = null
  }
}

onMounted(refreshAll)
</script>
