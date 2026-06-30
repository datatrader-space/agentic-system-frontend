<template>
  <div class="ha">
    <header class="ha-head">
      <div>
        <h1>Help Center Analytics</h1>
        <p>Search, assistant, feedback, and guided-tour performance — and where to improve.</p>
      </div>
      <div class="ha-filters">
        <select v-model="range" @change="reloadAll"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select>
        <select v-model="area" @change="reloadAll"><option value="">All areas</option><option v-for="a in AREAS" :key="a" :value="a">{{ a }}</option></select>
        <select v-model="ctype" @change="reloadAll"><option value="">All types</option><option value="doc">Doc</option><option value="guide">Guide</option><option value="tutorial">Tutorial</option><option value="integration">Integration</option><option value="faq">FAQ</option><option value="learning_path">Learning path</option></select>
      </div>
    </header>

    <!-- Metric cards -->
    <div class="metrics">
      <div v-for="m in metricCards" :key="m.label" class="metric">
        <span class="m-label">{{ m.label }}</span>
        <span class="m-value">{{ m.value }}</span>
        <span v-if="m.sub" :class="['m-sub', m.tone]">{{ m.sub }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <nav class="tabs">
      <button v-for="t in TABS" :key="t.key" :class="{ active: tab === t.key }" @click="setTab(t.key)">{{ t.label }}</button>
    </nav>

    <section class="card tab-card">
      <div v-if="loadingTab" class="state">Loading…</div>
      <div v-else-if="errorTab" class="state error">Couldn’t load. <button class="link" @click="loadTab">Retry</button></div>

      <!-- SEARCH -->
      <template v-else-if="tab === 'search'">
        <h3>Zero-result searches</h3>
        <table v-if="data.zero_result_queries?.length" class="tbl">
          <thead><tr><th>Query</th><th>Count</th><th>Users</th><th>Suggested area</th><th>Action</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in data.zero_result_queries" :key="i">
              <td class="q">{{ r.query }}</td><td>{{ r.count }}</td><td>{{ r.user_count }}</td>
              <td>{{ r.suggested_area || '—' }}</td><td><span class="sugg">{{ r.action }}</span></td>
              <td><button class="iconbtn" title="Copy query" @click="copy(r.query)"><Icon icon="lucide:copy" /></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No zero-result searches in this range. 🎉</p>

        <h3 class="mt">Top queries</h3>
        <table v-if="data.top_queries?.length" class="tbl">
          <thead><tr><th>Query</th><th>Count</th><th></th></tr></thead>
          <tbody><tr v-for="(r, i) in data.top_queries" :key="i"><td class="q">{{ r.query }}</td><td>{{ r.count }}</td><td><button class="iconbtn" @click="copy(r.query)"><Icon icon="lucide:copy" /></button></td></tr></tbody>
        </table>
        <p v-else class="empty">No searches yet.</p>

        <h3 class="mt">Results but no clicks</h3>
        <table v-if="data.low_click_through?.length" class="tbl">
          <thead><tr><th>Query</th><th>Count</th><th>Suggestion</th></tr></thead>
          <tbody><tr v-for="(r, i) in data.low_click_through" :key="i"><td class="q">{{ r.query }}</td><td>{{ r.count }}</td><td><span class="sugg">{{ r.action }}</span></td></tr></tbody>
        </table>
        <p v-else class="empty">Nothing flagged.</p>
      </template>

      <!-- ASSISTANT -->
      <template v-else-if="tab === 'assistant'">
        <h3>No-answer questions</h3>
        <table v-if="data.no_answer_questions?.length" class="tbl">
          <thead><tr><th>Question</th><th>Count</th><th>Surface</th><th>Suggested area</th><th>Action</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in data.no_answer_questions" :key="i">
              <td class="q">{{ r.question }}</td><td>{{ r.count }}</td><td>{{ r.surface || '—' }}</td>
              <td>{{ r.suggested_area || '—' }}</td><td><span class="sugg">{{ r.action }}</span></td>
              <td><button class="iconbtn" @click="copy(r.question)"><Icon icon="lucide:copy" /></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No unanswered questions. 🎉</p>

        <h3 class="mt">Top questions</h3>
        <table v-if="data.top_questions?.length" class="tbl">
          <thead><tr><th>Question</th><th>Count</th></tr></thead>
          <tbody><tr v-for="(r, i) in data.top_questions" :key="i"><td class="q">{{ r.question }}</td><td>{{ r.count }}</td></tr></tbody>
        </table>
        <p v-else class="empty">No assistant questions yet.</p>

        <h3 class="mt">Most-used sources</h3>
        <table v-if="data.top_sources?.length" class="tbl">
          <thead><tr><th>Source</th><th>Times cited</th></tr></thead>
          <tbody><tr v-for="(r, i) in data.top_sources" :key="i"><td class="q">{{ r.source }}</td><td>{{ r.count }}</td></tr></tbody>
        </table>
        <p v-else class="empty">No sources yet.</p>
      </template>

      <!-- FEEDBACK -->
      <template v-else-if="tab === 'feedback'">
        <h3>Least helpful content</h3>
        <table v-if="data.least_helpful?.length" class="tbl">
          <thead><tr><th>Content</th><th>Area</th><th>Helpful</th><th>Not helpful</th><th>Rate</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(c, i) in data.least_helpful" :key="i">
              <td class="q">{{ c.title }}</td><td>{{ c.product_area }}</td>
              <td>{{ c.helpful_count }}</td><td>{{ c.not_helpful_count }}</td><td>{{ pct(c.helpful_rate) }}</td>
              <td><button class="iconbtn" title="Open article" @click="open(c.url)"><Icon icon="lucide:external-link" /></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No feedback yet.</p>

        <h3 class="mt">Most helpful content</h3>
        <table v-if="data.most_helpful?.length" class="tbl">
          <thead><tr><th>Content</th><th>Area</th><th>Helpful</th><th>Rate</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(c, i) in data.most_helpful" :key="i">
              <td class="q">{{ c.title }}</td><td>{{ c.product_area }}</td><td>{{ c.helpful_count }}</td><td>{{ pct(c.helpful_rate) }}</td>
              <td><button class="iconbtn" @click="open(c.url)"><Icon icon="lucide:external-link" /></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No feedback yet.</p>
      </template>

      <!-- TOURS -->
      <template v-else-if="tab === 'tours'">
        <h3>Guided tour performance</h3>
        <table v-if="data.tours?.length" class="tbl">
          <thead><tr><th>Tour</th><th>Area</th><th>Starts</th><th>Completed</th><th>Skipped</th><th>Completion</th><th>Drop-off</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in data.tours" :key="i">
              <td class="q">{{ t.title }}</td><td>{{ t.product_area }}</td><td>{{ t.starts }}</td>
              <td>{{ t.completions }}</td><td>{{ t.skips }}</td><td>{{ pct(t.completion_rate) }}</td>
              <td>{{ t.dropoff_step != null ? `step ${t.dropoff_step}` : '—' }}</td>
              <td><button class="iconbtn" title="Open tour" @click="open(t.url)"><Icon icon="lucide:external-link" /></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No tour activity yet.</p>
      </template>

      <!-- CONTENT GAPS -->
      <template v-else-if="tab === 'gaps'">
        <h3>Content gaps <span class="muted">({{ data.count || 0 }})</span></h3>
        <table v-if="data.gaps?.length" class="tbl">
          <thead><tr><th>Type</th><th>Subject</th><th>Signal</th><th>Suggestion</th><th>Action</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(g, i) in data.gaps" :key="i">
              <td><span :class="['gap', g.type]">{{ gapLabel(g.type) }}</span></td>
              <td class="q">{{ g.subject }}</td><td>{{ g.count }}</td>
              <td class="sug-cell">{{ g.suggestion }}</td><td><span class="sugg">{{ g.action }}</span></td>
              <td>
                <button v-if="g.url" class="iconbtn" title="Open" @click="open(g.url)"><Icon icon="lucide:external-link" /></button>
                <button v-else class="iconbtn" title="Copy" @click="copy(g.subject)"><Icon icon="lucide:copy" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">No content gaps detected. 🎉</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const router = useRouter()
const notify = inject('notify', (m) => console.log(m))

const AREAS = ['Getting Started', 'Agents', 'Knowledge Base', 'Workflows', 'Integrations', 'Billing', 'API & Developers', 'Troubleshooting', 'Security', 'Account Settings']
const TABS = [
  { key: 'search', label: 'Search' }, { key: 'assistant', label: 'AI Assistant' },
  { key: 'feedback', label: 'Feedback' }, { key: 'tours', label: 'Guided Tours' },
  { key: 'gaps', label: 'Content Gaps' },
]
const TAB_SECTION = { search: 'searches', assistant: 'assistant', feedback: 'feedback', tours: 'tours', gaps: 'content-gaps' }

const range = ref('30d')
const area = ref('')
const ctype = ref('')
const tab = ref('search')
const overview = ref({})
const data = ref({})
const loadingTab = ref(true)
const errorTab = ref(false)

function params() { return { range: range.value, product_area: area.value, type: ctype.value } }
function pct(r) { return `${Math.round((r || 0) * 100)}%` }
function gapLabel(t) { return { zero_result: 'Zero result', assistant_no_answer: 'No answer', low_click_through: 'Low CTR', low_helpful: 'Low helpful', tour_skip: 'Tour skip' }[t] || t }
function copy(text) { try { navigator.clipboard.writeText(text); notify('Copied', 'success') } catch { /* ignore */ } }
function open(url) { if (url) router.push(url) }

const metricCards = computed(() => {
  const o = overview.value
  return [
    { label: 'Total searches', value: o.total_searches ?? 0 },
    { label: 'Zero-result rate', value: pct(o.zero_result_rate), sub: `${o.zero_result_searches ?? 0} searches`, tone: 'warn' },
    { label: 'Assistant no-answer rate', value: pct(o.assistant_no_answer_rate), sub: `${o.assistant_no_answer ?? 0} of ${o.assistant_questions ?? 0}`, tone: 'warn' },
    { label: 'Helpful rate', value: pct(o.helpful_rate), sub: `${o.helpful_votes ?? 0}👍 ${o.not_helpful_votes ?? 0}👎`, tone: 'good' },
    { label: 'Tour completion rate', value: pct(o.tour_completion_rate), sub: `${o.tours_completed ?? 0}/${o.tours_started ?? 0} completed`, tone: 'good' },
  ]
})

async function loadOverview() {
  try { const { data: d } = await api.adminHelpAnalytics('overview', params()); overview.value = d } catch (e) { /* keep */ }
}
async function loadTab() {
  loadingTab.value = true; errorTab.value = false
  try { const { data: d } = await api.adminHelpAnalytics(TAB_SECTION[tab.value], params()); data.value = d }
  catch (e) { errorTab.value = true }
  loadingTab.value = false
}
function setTab(k) { tab.value = k; loadTab() }
function reloadAll() { loadOverview(); loadTab() }

onMounted(() => { loadOverview(); loadTab() })
</script>

<style scoped>
.ha { padding: 28px 32px 60px; }
.ha-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.ha-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.ha-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; }
.ha-filters { display: flex; gap: 10px; flex-shrink: 0; }
.ha-filters select { height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 10px; font-size: 13px; background: #fff; }
.metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric { border: 1px solid #e5ebf3; border-radius: 13px; background: #fff; padding: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.m-label { display: block; color: #64748b; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.m-value { display: block; margin-top: 8px; font-size: 26px; font-weight: 850; }
.m-sub { display: block; margin-top: 4px; font-size: 11.5px; font-weight: 600; color: #94a3b8; }
.m-sub.warn { color: #d97706; } .m-sub.good { color: #059669; }
.tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.tabs button { height: 36px; border: 1px solid #dbe4f0; border-radius: 999px; background: #fff; padding: 0 16px; color: #334155; font-size: 13px; font-weight: 700; cursor: pointer; }
.tabs button.active { border-color: #4f46e5; background: #4f46e5; color: #fff; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); padding: 20px; }
.tab-card h3 { margin: 0 0 12px; font-size: 14px; font-weight: 800; }
.tab-card h3.mt { margin-top: 26px; }
.muted { color: #94a3b8; font-weight: 600; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 9px 10px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl .q { font-weight: 650; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sug-cell { color: #475569; max-width: 280px; }
.sugg { display: inline-block; border-radius: 6px; background: #eef2ff; color: #4f46e5; padding: 3px 8px; font-size: 11px; font-weight: 800; }
.gap { border-radius: 6px; padding: 3px 8px; font-size: 10.5px; font-weight: 850; }
.gap.zero_result { background: #fff7e6; color: #d97706; } .gap.assistant_no_answer { background: #fff1f3; color: #e11d48; }
.gap.low_click_through { background: #eef4ff; color: #2563eb; } .gap.low_helpful { background: #fef2f2; color: #dc2626; } .gap.tour_skip { background: #f5f3ff; color: #7c3aed; }
.iconbtn { display: grid; place-items: center; width: 30px; height: 30px; border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer; }
.iconbtn:hover { background: #eef2f7; color: #0f172a; } .iconbtn svg { width: 15px; height: 15px; }
.state { padding: 40px; text-align: center; color: #64748b; } .state.error { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.empty { color: #94a3b8; font-size: 13px; padding: 14px 0; }
@media (max-width: 1100px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) { .ha { padding: 20px 16px; } .ha-head { flex-direction: column; } .metrics { grid-template-columns: 1fr; } }
</style>
