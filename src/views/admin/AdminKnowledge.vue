<template>
  <div class="kb">
    <header class="kb-head">
      <h1>RAG Knowledge</h1>
      <p>Monitor retrieval quality, test searches, fix answers, and tune sources — across all agents.</p>
    </header>

    <nav class="kb-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['kb-tab', { active: tab === t.id }]" @click="tab = t.id">
        {{ t.label }}
      </button>
    </nav>

    <!-- ───────────── Monitoring ───────────── -->
    <section v-if="tab === 'monitoring'" class="kb-panel">
      <div class="kb-row">
        <div class="seg">
          <button v-for="d in [7, 30, 90]" :key="d" :class="{ active: days === d }" @click="setDays(d)">{{ d }}d</button>
        </div>
        <select v-model="monScope" class="sel" @change="loadMonitoring">
          <option value="">All agents</option>
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <button class="btn" :disabled="loadingMon" @click="loadMonitoring">↻ Refresh</button>
      </div>

      <div class="stats">
        <div class="stat"><div class="v">{{ ov.totals?.queries ?? '—' }}</div><div class="l">KB queries</div></div>
        <div class="stat"><div class="v">{{ pct(ov.rates?.unanswered) }}</div><div class="l">Unanswered</div></div>
        <div class="stat"><div class="v">{{ pct(ov.rates?.low_confidence) }}</div><div class="l">Low confidence</div></div>
        <div class="stat"><div class="v">{{ ov.totals?.conflicts ?? '—' }}</div><div class="l">Conflicts</div></div>
        <div class="stat"><div class="v">{{ pct(ov.rates?.stale) }}</div><div class="l">Stale top source</div></div>
        <div class="stat"><div class="v">{{ ov.totals?.avg_top_score ?? '—' }}</div><div class="l">Avg top score</div></div>
      </div>

      <div class="card">
        <h3>Query volume <span class="muted">({{ days }}d)</span></h3>
        <div v-if="ov.timeseries?.length" class="chart">
          <div v-for="(p, i) in ov.timeseries" :key="i" class="bar-wrap" :title="`${p.date}: ${p.queries} queries, ${p.unanswered} unanswered`">
            <div class="bar" :style="{ height: barH(p.queries) }"></div>
            <div class="bar miss" :style="{ height: barH(p.unanswered) }"></div>
          </div>
        </div>
        <p v-else class="muted">No KB queries logged yet in this window.</p>
      </div>

      <div class="card">
        <div class="kb-row">
          <h3>Retrieval quality (eval)</h3>
          <button class="btn primary" :disabled="evalRunning" @click="runEval">{{ evalRunning ? 'Running…' : 'Run eval' }}</button>
        </div>
        <p class="muted small">Self-retrieval recall on sampled chunks — proves the lift from hybrid search + reranking.</p>
        <table v-if="evalRes.modes" class="tbl">
          <thead><tr><th>mode</th><th>recall@{{ evalRes.k }}</th><th>recall@1</th><th>MRR</th></tr></thead>
          <tbody>
            <tr v-for="m in ['vector_only', 'hybrid', 'hybrid_rerank']" :key="m" :class="{ best: m === 'hybrid_rerank' }">
              <td>{{ m }}</td><td>{{ evalRes.modes[m].recall_k.toFixed(3) }}</td>
              <td>{{ evalRes.modes[m].recall_1.toFixed(3) }}</td><td>{{ evalRes.modes[m].mrr.toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="evalRes.modes" class="verdict" :class="evalRes.verdict === 'OK' ? 'ok' : 'bad'">
          hybrid_rerank vs vector_only: {{ evalRes.delta_vs_vector >= 0 ? '+' : '' }}{{ evalRes.delta_vs_vector }} → {{ evalRes.verdict }}
          <span class="muted">({{ evalRes.cases }} cases, agent {{ evalRes.agent_name }})</span>
        </p>
      </div>

      <div class="two">
        <div class="card">
          <h3>Top questions</h3>
          <table class="tbl"><tbody>
            <tr v-for="(q, i) in topQ" :key="i"><td class="q">{{ q.query }}</td><td class="n">{{ q.count }}</td></tr>
            <tr v-if="!topQ.length"><td class="muted">No data yet.</td></tr>
          </tbody></table>
        </div>
        <div class="card">
          <h3>Unanswered / low-confidence</h3>
          <table class="tbl"><tbody>
            <tr v-for="(q, i) in unansweredQ" :key="i"><td class="q">{{ q.query }}</td><td class="n">{{ q.count }}</td></tr>
            <tr v-if="!unansweredQ.length"><td class="muted">Nothing unanswered. 🎉</td></tr>
          </tbody></table>
        </div>
      </div>

      <div class="card" v-if="conflicts.length">
        <h3>⚠ Conflicting sources <span class="muted small">(queries where sources disagreed)</span></h3>
        <div v-for="(c, i) in conflicts" :key="i" class="conf-row">
          <div class="conf-q">{{ c.query }}</div>
          <div v-for="(d, j) in c.detail" :key="j" class="conf-detail">
            <b>{{ d.attribute }}:</b>
            <span v-for="(v, k) in d.values" :key="k" class="conf-val">{{ v.value }} <em>({{ v.source }})</em><span v-if="k < d.values.length - 1"> vs </span></span>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────────── Index Health ───────────── -->
    <section v-if="tab === 'health'" class="kb-panel">
      <div class="kb-row">
        <select v-model="healthScope" class="sel" @change="loadHealth">
          <option value="">All agents</option>
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <button class="btn" @click="loadHealth">↻ Refresh</button>
        <button class="btn danger" v-if="healthScope && health.stale_embedder?.stale" :disabled="reembedding" @click="reembed">
          {{ reembedding ? 'Re-embedding…' : `Re-embed ${health.stale_embedder.stale} stale chunk(s)` }}
        </button>
      </div>

      <div class="stats">
        <div class="stat"><div class="v">{{ health.web_sources?.total ?? '—' }}</div><div class="l">Web sources</div></div>
        <div class="stat"><div class="v">{{ health.files?.total ?? '—' }}</div><div class="l">Files</div></div>
        <div class="stat"><div class="v">{{ health.chunks?.total ?? '—' }}</div><div class="l">Chunks</div></div>
        <div class="stat"><div class="v">{{ health.chunks?.archived ?? '—' }}</div><div class="l">Archived</div></div>
        <div class="stat" :class="{ warn: health.stale_embedder?.stale }">
          <div class="v">{{ healthScope ? (health.stale_embedder?.stale ?? '—') : 'n/a' }}</div><div class="l">Stale embedder</div></div>
        <div class="stat" :class="{ warn: needsReviewCount }"><div class="v">{{ needsReviewCount }}</div><div class="l">Needs review</div></div>
      </div>

      <div class="card">
        <h3>Chunks by source type</h3>
        <div class="kv" v-for="(n, t) in (health.chunks?.by_type || {})" :key="t"><span>{{ t || 'unknown' }}</span><b>{{ n }}</b></div>
        <p v-if="!Object.keys(health.chunks?.by_type || {}).length" class="muted">No chunks.</p>
      </div>

      <div class="card">
        <h3>Sources — trust &amp; access <span class="muted small">(trust 0–2; restrict to specific users)</span></h3>
        <table class="tbl">
          <thead><tr><th>source</th><th>kind</th><th>chunks</th><th>embed</th><th>trust</th><th>review</th><th>restricted</th><th>allowed users (emails)</th></tr></thead>
          <tbody>
            <tr v-for="s in (health.sources_list || [])" :key="s.kind + s.id">
              <td class="q">{{ s.name }}</td><td>{{ s.kind }}</td><td class="n">{{ s.chunk_count }}</td>
              <td>
                <button v-if="s.kind === 'web' && !s.chunk_count" class="btn sm"
                        :disabled="embedding.has(s.id)" @click="embedSource(s)">
                  {{ embedding.has(s.id) ? 'Embedding…' : 'Embed' }}
                </button>
                <span v-else-if="s.kind === 'web'" class="muted small">✓ embedded</span>
                <span v-else class="muted small">—</span>
              </td>
              <td><input class="num" type="number" step="0.1" min="0" max="2" :value="s.trust_score"
                         @change="setTrust(s, $event.target.value)" /></td>
              <td><input type="checkbox" :checked="s.needs_review" @change="setReview(s, $event.target.checked)" /></td>
              <td><input type="checkbox" :checked="s.restricted" @change="setRestricted(s, $event.target.checked)" /></td>
              <td>
                <input v-if="s.restricted" class="inp grow" :value="(s.allowed || []).join(', ')"
                       placeholder="email1@x.com, email2@x.com (blank = owner+staff only)"
                       @change="setAllowed(s, $event.target.value)" />
                <span v-else class="muted small">everyone (default)</span>
              </td>
            </tr>
            <tr v-if="!(health.sources_list || []).length"><td class="muted" colspan="8">No sources for this scope.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ───────────── Search Test ───────────── -->
    <section v-if="tab === 'search'" class="kb-panel">
      <div class="kb-row">
        <select v-model="agentId" class="sel"><option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        <input v-model="stQuery" class="inp grow" placeholder="Type a question to inspect retrieval…" @keyup.enter="runSearch" />
        <button class="btn primary" :disabled="stRunning || !agentId || !stQuery" @click="runSearch">Search</button>
      </div>

      <div v-if="st" class="card">
        <div class="badges">
          <span class="badge" :class="'c-' + (st.confidence?.level || 'none')">confidence: {{ st.confidence?.level }} ({{ st.confidence?.score }})</span>
          <span class="badge">{{ st.count }} hits</span>
          <span v-if="st.conflicts?.length" class="badge warn">⚠ {{ st.conflicts.length }} conflict(s)</span>
        </div>
        <div v-for="(h, i) in st.hits" :key="h.chunk_id" class="hit">
          <div class="hit-head">
            <span class="hit-n">[{{ i + 1 }}]</span>
            <span class="hit-title">{{ h.title || 'source' }}</span>
            <span class="hit-meta">{{ h.source_type }}<span v-if="h.section"> · {{ h.section }}</span> · score {{ (h.score || 0).toFixed(2) }}</span>
            <button class="btn tiny danger" @click="archiveChunk(h.chunk_id)">Mark outdated</button>
          </div>
          <a v-if="h.url" :href="h.url" target="_blank" class="hit-url">{{ h.url }}</a>
          <p class="hit-snip">{{ h.snippet }}</p>
          <button class="btn tiny" @click="prefillCorrection(h.title)">Mark wrong → add correction</button>
        </div>
        <p v-if="!st.hits?.length" class="muted">No chunks retrieved for that query.</p>
      </div>
    </section>

    <!-- ───────────── Corrections ───────────── -->
    <section v-if="tab === 'corrections'" class="kb-panel">
      <div class="kb-row">
        <select v-model="agentId" class="sel"><option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        <button class="btn" @click="loadCorrections">↻ Refresh</button>
      </div>
      <div class="card">
        <h3>Add verified answer</h3>
        <input v-model="newCorr.question" class="inp full" placeholder="Question (e.g. what is your return policy)" />
        <textarea v-model="newCorr.correct_answer" class="inp full" rows="3" placeholder="Correct answer the agent should give"></textarea>
        <button class="btn primary" :disabled="!agentId || !newCorr.question" @click="addCorrection">Save correction</button>
      </div>
      <div class="card">
        <h3>Active corrections</h3>
        <div v-for="c in corrections" :key="c.id" class="corr">
          <div class="corr-q">Q: {{ c.question }}</div>
          <div class="corr-a">A: {{ c.correct_answer }}</div>
          <div class="corr-act">
            <span class="badge" :class="c.status === 'active' ? 'c-high' : ''">{{ c.status }}</span>
            <button class="btn tiny" @click="toggleCorr(c)">{{ c.status === 'active' ? 'Archive' : 'Activate' }}</button>
            <button class="btn tiny danger" @click="delCorr(c)">Delete</button>
          </div>
        </div>
        <p v-if="!corrections.length" class="muted">No corrections for this agent.</p>
      </div>
    </section>

    <!-- ───────────── Sources & Aliases ───────────── -->
    <section v-if="tab === 'sources'" class="kb-panel">
      <div class="kb-row">
        <select v-model="agentId" class="sel"><option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        <button class="btn" @click="loadAliases">↻ Refresh</button>
      </div>
      <div class="card">
        <h3>Synonyms / aliases</h3>
        <p class="muted small">Expands queries so synonyms match (e.g. <em>Castor Oil → Arandi Oil</em>).</p>
        <div class="kb-row">
          <input v-model="newAlias.term" class="inp" placeholder="term (castor oil)" />
          <input v-model="newAlias.aliasesStr" class="inp grow" placeholder="comma-separated synonyms (arandi oil, ricinus communis)" />
          <button class="btn primary" :disabled="!agentId || !newAlias.term" @click="addAlias">Add</button>
        </div>
        <div v-for="a in aliases" :key="a.id" class="alias">
          <strong>{{ a.term }}</strong> → {{ (a.aliases || []).join(', ') }}
          <button class="btn tiny danger" @click="delAlias(a)">×</button>
        </div>
        <p v-if="!aliases.length" class="muted">No custom aliases (built-in seed map still applies).</p>
      </div>
      <div class="card">
        <h3>Knowledge tables (Django admin)</h3>
        <div class="kb-grid">
          <a v-for="t in tables" :key="t.title" :href="t.url" target="_blank" rel="noopener" class="kb-card">
            <span class="kb-ico">{{ t.icon }}</span><div class="kb-title">{{ t.title }}</div>
            <div class="kb-desc">{{ t.desc }}</div>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'

const tabs = [
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'health', label: 'Index Health' },
  { id: 'search', label: 'Search Test' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'sources', label: 'Sources & Aliases' },
]
const tab = ref('monitoring')
const agents = ref([])
const agentId = ref(null)

// Monitoring
const days = ref(30)
const monScope = ref('')          // '' = all agents
const ov = ref({})
const topQ = ref([])
const unansweredQ = ref([])
const conflicts = ref([])
const loadingMon = ref(false)
const evalRes = ref({})
const evalRunning = ref(false)

// Index health
const healthScope = ref('')
const health = ref({})
const reembedding = ref(false)
const needsReviewCount = ref(0)
const embedding = ref(new Set())   // web-source ids currently being embedded on demand

const pct = (r) => (r == null ? '—' : (r * 100).toFixed(1) + '%')
const maxQ = ref(1)
const barH = (v) => Math.max(2, Math.round((v / (maxQ.value || 1)) * 100)) + '%'

function setDays (d) { days.value = d; loadMonitoring() }

function scoped (extra) { return monScope.value ? { ...extra, agent_id: monScope.value } : extra }

async function loadMonitoring () {
  loadingMon.value = true
  try {
    const [o, tq, uq, cf] = await Promise.all([
      api.kbOverview(scoped({ days: days.value })),
      api.kbTopQuestions(scoped({ days: days.value, limit: 15 })),
      api.kbUnanswered(scoped({ days: days.value, limit: 15 })),
      api.kbConflicts(scoped({ days: days.value, limit: 20 })),
    ])
    ov.value = o.data
    maxQ.value = Math.max(1, ...(o.data.timeseries || []).map(p => p.queries))
    topQ.value = tq.data.questions || []
    unansweredQ.value = uq.data.questions || []
    conflicts.value = cf.data.conflicts || []
  } catch (e) { notify.error('Failed to load monitoring') } finally { loadingMon.value = false }
}

async function runEval () {
  evalRunning.value = true
  try {
    const r = await api.kbEval(scoped({ n: 30, k: 5 }))
    if (r.data.ok) { evalRes.value = r.data; notify.success('Eval complete') }
    else notify.error(r.data.error || 'Eval failed')
  } catch (e) { notify.error('Eval failed') } finally { evalRunning.value = false }
}

// Index health
async function loadHealth () {
  try {
    const r = await api.kbIndexHealth(healthScope.value ? { agent_id: healthScope.value } : {})
    health.value = r.data
    needsReviewCount.value = (r.data.web_sources?.needs_review || 0) + (r.data.files?.needs_review || 0)
  } catch (e) { notify.error('Failed to load index health') }
}
// Generate embeddings on demand for a store-only web source (e.g. export-API-triggered crawls).
async function embedSource (s) {
  embedding.value.add(s.id); embedding.value = new Set(embedding.value)
  try {
    await api.embedWebSource(s.id)
    notify.success('Embedding started — chunks will appear once it finishes')
  } catch (e) {
    notify.error('Embed failed: ' + (e.response?.data?.error || e.message))
  } finally {
    embedding.value.delete(s.id); embedding.value = new Set(embedding.value)
  }
}
async function reembed () {
  reembedding.value = true
  try {
    const r = await api.kbReembed({ agent_id: healthScope.value })
    notify.success(`Re-embedded ${r.data.reembedded || 0}, failed ${r.data.failed || 0}`)
    loadHealth()
  } catch (e) { notify.error('Re-embed failed') } finally { reembedding.value = false }
}
async function setTrust (s, val) {
  try { await api.kbSetTrust({ kind: s.kind, id: s.id, trust_score: parseFloat(val) }); s.trust_score = parseFloat(val) }
  catch (e) { notify.error('Failed to set trust') }
}
async function setReview (s, checked) {
  try { await api.kbSetTrust({ kind: s.kind, id: s.id, trust_score: s.trust_score, needs_review: checked }); loadHealth() }
  catch (e) { notify.error('Failed') }
}
async function setRestricted (s, checked) {
  try { await api.kbSetAcl({ kind: s.kind, id: s.id, restricted: checked }); s.restricted = checked; notify.success(checked ? 'Source restricted' : 'Source open to everyone') }
  catch (e) { notify.error('Failed to set access') }
}
async function setAllowed (s, val) {
  try {
    const emails = val.split(',').map(e => e.trim()).filter(Boolean)
    const r = await api.kbSetAcl({ kind: s.kind, id: s.id, restricted: true, allowed_emails: emails })
    s.allowed = r.data.allowed; notify.success('Allowed users updated')
  } catch (e) { notify.error('Failed') }
}

// Search test
const stQuery = ref('')
const st = ref(null)
const stRunning = ref(false)
async function runSearch () {
  stRunning.value = true
  try {
    const r = await api.kbSearchTest({ agent_id: agentId.value, query: stQuery.value })
    st.value = r.data
  } catch (e) { notify.error('Search failed') } finally { stRunning.value = false }
}
async function archiveChunk (id) {
  try { await api.kbArchiveChunk(id, { status: 'archived' }); notify.success('Chunk marked outdated'); runSearch() }
  catch (e) { notify.error('Failed') }
}
function prefillCorrection (title) {
  newCorr.question = stQuery.value
  tab.value = 'corrections'
  loadCorrections()
}

// Corrections
const corrections = ref([])
const newCorr = reactive({ question: '', correct_answer: '' })
async function loadCorrections () {
  if (!agentId.value) return
  try { const r = await api.kbCorrections({ agent_id: agentId.value }); corrections.value = r.data.corrections || [] }
  catch (e) { notify.error('Failed to load corrections') }
}
async function addCorrection () {
  try {
    await api.kbCreateCorrection({ agent_id: agentId.value, question: newCorr.question, correct_answer: newCorr.correct_answer })
    newCorr.question = ''; newCorr.correct_answer = ''; notify.success('Correction saved'); loadCorrections()
  } catch (e) { notify.error('Failed to save') }
}
async function toggleCorr (c) {
  try { await api.kbUpdateCorrection(c.id, { status: c.status === 'active' ? 'archived' : 'active' }); loadCorrections() }
  catch (e) { notify.error('Failed') }
}
async function delCorr (c) {
  try { await api.kbDeleteCorrection(c.id); loadCorrections() } catch (e) { notify.error('Failed') }
}

// Aliases
const aliases = ref([])
const newAlias = reactive({ term: '', aliasesStr: '' })
async function loadAliases () {
  if (!agentId.value) return
  try { const r = await api.kbAliases({ agent_id: agentId.value }); aliases.value = r.data.aliases || [] }
  catch (e) { notify.error('Failed to load aliases') }
}
async function addAlias () {
  try {
    const aliasesArr = newAlias.aliasesStr.split(',').map(s => s.trim()).filter(Boolean)
    await api.kbCreateAlias({ agent_id: agentId.value, term: newAlias.term, aliases: aliasesArr })
    newAlias.term = ''; newAlias.aliasesStr = ''; notify.success('Alias added'); loadAliases()
  } catch (e) { notify.error('Failed') }
}
async function delAlias (a) {
  try { await api.kbDeleteAlias(a.id); loadAliases() } catch (e) { notify.error('Failed') }
}

const djangoBase = (() => {
  const { protocol, hostname, port } = window.location
  return port === '5173' ? `${protocol}//${hostname}:8000` : ''
})()
const tables = [
  { title: 'WebSource', icon: '🌐', url: `${djangoBase}/admin/agent/websource/`, desc: 'Crawled sites: status, counts, trust.' },
  { title: 'WebPage', icon: '📄', url: `${djangoBase}/admin/agent/webpage/`, desc: 'Per page text, language, http status.' },
  { title: 'DocumentChunk', icon: '🧩', url: `${djangoBase}/admin/agent/documentchunk/`, desc: 'RAG chunks + embeddings + metadata.' },
  { title: 'CrawlRun', icon: '🗂', url: `${djangoBase}/admin/agent/crawlrun/`, desc: 'Per-crawl provenance + backend.' },
]

// Lazy-load each tab's data the first time it's opened.
const loaded = reactive({ health: false, corrections: false, aliases: false })
watch(tab, (t) => {
  if (t === 'health' && !loaded.health) { loaded.health = true; loadHealth() }
  if (t === 'corrections' && !loaded.corrections) { loaded.corrections = true; loadCorrections() }
  if (t === 'sources' && !loaded.aliases) { loaded.aliases = true; loadAliases() }
})

onMounted(async () => {
  try { const r = await api.getAgents(); agents.value = r.data.results || r.data || []; if (agents.value.length) agentId.value = agents.value[0].id } catch (e) {}
  loadMonitoring()
})
</script>

<style scoped>
.kb { padding: 28px 32px; max-width: 1200px; }
.kb-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.kb-head p { color: #64748b; margin-top: 4px; font-size: 14px; }
.kb-tabs { display: flex; gap: 6px; margin: 20px 0; border-bottom: 1px solid #e2e8f0; }
.kb-tab { background: none; border: none; padding: 10px 16px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; }
.kb-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }
.kb-panel { display: flex; flex-direction: column; gap: 16px; }
.kb-row { display: flex; align-items: center; gap: 10px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
.stat .v { font-size: 1.6rem; font-weight: 800; color: #0f172a; }
.stat .l { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; }
.card h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.chart { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 8px; }
.bar-wrap { flex: 1; display: flex; gap: 1px; align-items: flex-end; height: 100%; }
.bar { flex: 1; background: linear-gradient(180deg, #6366f1, #4f46e5); border-radius: 2px 2px 0 0; min-height: 2px; }
.bar.miss { background: #f59e0b; flex: 0.5; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; color: #64748b; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.tbl td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
.tbl tr.best { background: #eef2ff; font-weight: 700; }
.tbl td.q { color: #334155; } .tbl td.n { text-align: right; font-weight: 700; color: #4f46e5; }
.verdict { margin-top: 8px; font-size: 13px; font-weight: 700; }
.verdict.ok { color: #059669; } .verdict.bad { color: #dc2626; }
.seg button, .btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; }
.seg { display: inline-flex; gap: 4px; } .seg button.active { background: rgba(79,70,229,.1); color: #4f46e5; border-color: #c7d2fe; }
.btn.primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.btn.tiny { padding: 3px 8px; font-size: 11px; } .btn.danger { color: #dc2626; border-color: #fecaca; }
.btn:disabled { opacity: .5; cursor: default; }
.sel, .inp { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.inp.grow, .grow { flex: 1; } .inp.full { width: 100%; margin-bottom: 8px; }
.badges { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; }
.badge.warn { background: rgba(245,158,11,.16); color: #b45309; }
.badge.c-high { background: rgba(16,185,129,.14); color: #059669; }
.badge.c-medium { background: rgba(245,158,11,.16); color: #b45309; }
.badge.c-low, .badge.c-none { background: rgba(239,68,68,.14); color: #dc2626; }
.hit { border-top: 1px solid #f1f5f9; padding: 10px 0; }
.hit-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hit-n { font-weight: 800; color: #4f46e5; } .hit-title { font-weight: 700; color: #0f172a; }
.hit-meta { font-size: 12px; color: #94a3b8; } .hit-url { font-size: 12px; color: #6366f1; display: block; margin: 2px 0; word-break: break-all; }
.hit-snip { font-size: 13px; color: #475569; margin: 4px 0; line-height: 1.5; }
.corr { border-top: 1px solid #f1f5f9; padding: 10px 0; }
.corr-q { font-weight: 600; color: #0f172a; font-size: 13px; } .corr-a { color: #475569; font-size: 13px; margin: 2px 0; }
.corr-act { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.alias { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; padding: 6px 0; border-top: 1px solid #f1f5f9; }
.kb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.kb-card { display: block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-decoration: none; }
.kb-card:hover { border-color: #4f46e5; } .kb-ico { font-size: 20px; }
.kb-title { font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 6px; } .kb-desc { color: #64748b; font-size: 12px; margin-top: 2px; }
.muted { color: #94a3b8; } .small { font-size: 12px; }
.stat.warn { border-color: #fecaca; background: #fef2f2; } .stat.warn .v { color: #dc2626; }
.kv { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; color: #475569; }
.num { width: 64px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; font-size: 12px; }
.conf-row { border-top: 1px solid #f1f5f9; padding: 8px 0; }
.conf-q { font-weight: 600; color: #0f172a; font-size: 13px; }
.conf-detail { font-size: 13px; color: #b45309; margin-top: 2px; }
.conf-val em { color: #94a3b8; font-style: normal; font-size: 12px; }
</style>
