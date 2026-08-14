<template>
  <div class="cg">
    <header class="cg-head">
      <div>
        <h1>Capability Graph</h1>
        <p>The platform's canonical capability vocabulary — one node per capability, aliases folding legacy
          names onto it, and typed edges making relationships queryable. Lifecycle is governed
          (draft → review → active → deprecated → retired); the <strong>backend enforces legality</strong> —
          illegal moves surface their exact reason here.</p>
      </div>
    </header>

    <!-- Governance strip: the graph's health vs the runtime's real tool surface -->
    <section class="gov card">
      <div v-if="!gov" class="gov-loading">Loading governance…</div>
      <template v-else>
        <span class="gov-chip" :class="gov.unresolved_tool_names.count ? 'warn' : 'ok'"
              :title="(gov.unresolved_tool_names.sample || []).join(', ')">
          <Icon icon="lucide:puzzle" /> {{ gov.unresolved_tool_names.count }} unresolved tool{{ gov.unresolved_tool_names.count === 1 ? '' : 's' }}
        </span>
        <span class="gov-chip" :class="gov.orphan_nodes.count ? 'warn' : 'ok'"
              :title="(gov.orphan_nodes.sample || []).map(o => o.slug).join(', ')">
          <Icon icon="lucide:unlink" /> {{ gov.orphan_nodes.count }} orphan node{{ gov.orphan_nodes.count === 1 ? '' : 's' }}
        </span>
        <span class="gov-sep"></span>
        <span v-for="(n, state) in gov.lifecycle_counts" :key="state" class="gov-count">
          <i class="lc-dot" :class="state"></i>{{ state }} {{ n }}
        </span>
        <span class="gov-spacer"></span>
        <button class="btn primary sm" :disabled="seeding" @click="seedFromTools">
          <Icon :icon="seeding ? 'lucide:loader-2' : 'lucide:sparkles'" :class="{ spin: seeding }" />
          Seed from tools
        </button>
      </template>
    </section>

    <div class="cols">
      <!-- Left: searchable node list -->
      <section class="card list-col">
        <div class="toolbar">
          <Icon icon="lucide:search" class="tb-ico" />
          <input v-model="q" class="search" placeholder="Search slug, name or tool…" />
        </div>
        <div class="tabs">
          <button v-for="t in tabs" :key="t" class="tab" :class="{ on: tab === t }" @click="tab = t">
            {{ t }} <em>{{ counts[t] || 0 }}</em>
          </button>
        </div>
        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="loadAll">Retry</button></div>
        <div v-else-if="!visibleNodes.length" class="state">No capabilities match.</div>
        <div v-else class="rows">
          <button v-for="n in visibleNodes" :key="n.id" class="row" :class="{ sel: n.id === selectedId }"
                  @click="select(n)">
            <span class="row-main">
              <strong>{{ n.slug }}</strong>
              <span class="sub">{{ n.name }}</span>
            </span>
            <span class="lc" :class="n.lifecycle">{{ n.lifecycle }}</span>
          </button>
        </div>
      </section>

      <!-- Right: selected node detail -->
      <section class="card detail-col">
        <div v-if="!selected" class="state">
          <Icon icon="lucide:mouse-pointer-click" class="state-ico" />
          Select a capability to curate its lifecycle, aliases and edges.
        </div>
        <template v-else>
          <div class="d-head">
            <div>
              <h2>{{ selected.name }}</h2>
              <code class="slug">{{ selected.slug }}</code>
            </div>
            <span class="lc big" :class="selected.lifecycle">{{ selected.lifecycle }}</span>
          </div>

          <p v-if="selected.description" class="d-desc">{{ selected.description }}</p>
          <div class="d-meta">
            <span v-if="selected.canonical_tool_name" class="meta-chip" title="Canonical runtime tool">
              <Icon icon="lucide:wrench" /> {{ selected.canonical_tool_name }}
            </span>
            <span v-else class="meta-chip abstract" title="No runtime tool — abstract capability">
              <Icon icon="lucide:shapes" /> abstract
            </span>
            <span v-if="selected.category" class="meta-chip"><Icon icon="lucide:folder" /> {{ selected.category }}</span>
            <span class="meta-chip muted"><Icon icon="lucide:clock" /> updated {{ shortDate(selected.updated_at) }}</span>
          </div>

          <!-- Lifecycle: the backend is the source of legality — every other state is offered, an
               illegal hop returns its exact reason and we surface it verbatim. -->
          <div class="d-block">
            <h3>Lifecycle</h3>
            <div class="tr-row">
              <button v-for="s in otherLifecycles" :key="s" class="btn ghost sm" :disabled="transitioning"
                      @click="transitionTo(s)">
                <Icon icon="lucide:arrow-right" /> {{ s }}
              </button>
            </div>
            <p class="hint">Moves POST <code>transition</code> — illegal transitions are rejected by the backend
              and the reason shown here.</p>
          </div>

          <!-- Aliases -->
          <div class="d-block">
            <h3>Aliases <em>{{ selected.aliases.length }}</em></h3>
            <div class="chips">
              <span v-for="a in selected.aliases" :key="a.id" class="chip">
                {{ a.alias }}
                <button class="chip-x" title="Remove alias" @click="removeAlias(a)"><Icon icon="lucide:x" /></button>
              </span>
              <span v-if="!selected.aliases.length" class="none">No aliases — legacy names resolve here once added.</span>
            </div>
            <div class="add-row">
              <input v-model="newAlias" placeholder="Add alias (legacy tool id, old slug…)"
                     @keyup.enter="addAlias" />
              <button class="btn primary sm" :disabled="!newAlias.trim()" @click="addAlias">
                <Icon icon="lucide:plus" /> Add
              </button>
            </div>
          </div>

          <!-- Outgoing edges -->
          <div class="d-block">
            <h3>Outgoing edges <em>{{ selected.edges_out.length }}</em></h3>
            <div class="edges">
              <div v-for="e in selected.edges_out" :key="e.id" class="edge">
                <span class="rel">{{ e.relation }}</span>
                <Icon icon="lucide:arrow-right" class="edge-arrow" />
                <button class="link" @click="jumpTo(e.dst)">{{ e.dst_slug }}</button>
                <button class="chip-x" title="Remove edge" @click="removeEdge(e)"><Icon icon="lucide:x" /></button>
              </div>
              <span v-if="!selected.edges_out.length" class="none">No outgoing edges.</span>
            </div>
            <div class="add-row">
              <select v-model="edgeRelation">
                <option v-for="r in RELATIONS" :key="r" :value="r">{{ r }}</option>
              </select>
              <div class="dst-pick">
                <input v-model="edgeQuery" placeholder="Search destination node…" @input="edgeDst = null" />
                <div v-if="edgeQuery && !edgeDst && dstMatches.length" class="dst-menu">
                  <button v-for="m in dstMatches" :key="m.id" @click="pickDst(m)">
                    <strong>{{ m.slug }}</strong> <span>{{ m.name }}</span>
                  </button>
                </div>
              </div>
              <button class="btn primary sm" :disabled="!edgeDst" @click="addEdge">
                <Icon icon="lucide:plus" /> Add edge
              </button>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
// Curation console for the canonical capability graph (Phase 1 follow-up). The BACKEND is the sole
// validator everywhere here: lifecycle legality, alias shape/dedupe and edge rules are enforced by
// /capability-nodes/ — this page only surfaces the 400 details it returns.
import { ref, computed, inject, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { confirm } from '@/composables/useConfirm'

const LIFECYCLES = ['draft', 'review', 'active', 'deprecated', 'retired']
const RELATIONS = ['requires', 'provides', 'part_of', 'alternative_to']

const notify = inject('notify', (m) => console.log(m))

const nodes = ref([])
const gov = ref(null)
const loading = ref(true)
const error = ref(false)
const seeding = ref(false)
const transitioning = ref(false)

const q = ref('')
const tab = ref('all')
const tabs = ['all', ...LIFECYCLES]
const selectedId = ref(null)

const newAlias = ref('')
const edgeRelation = ref('requires')
const edgeQuery = ref('')
const edgeDst = ref(null)

const selected = computed(() => nodes.value.find((n) => n.id === selectedId.value) || null)
const otherLifecycles = computed(() => LIFECYCLES.filter((s) => s !== selected.value?.lifecycle))

const counts = computed(() => {
  const c = { all: nodes.value.length }
  for (const n of nodes.value) c[n.lifecycle] = (c[n.lifecycle] || 0) + 1
  return c
})

const visibleNodes = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return nodes.value.filter((n) => {
    if (tab.value !== 'all' && n.lifecycle !== tab.value) return false
    if (!needle) return true
    return `${n.slug} ${n.name || ''} ${n.canonical_tool_name || ''}`.toLowerCase().includes(needle)
  })
})

const dstMatches = computed(() => {
  const needle = edgeQuery.value.trim().toLowerCase()
  if (!needle) return []
  return nodes.value
    .filter((n) => n.id !== selected.value?.id)
    .filter((n) => `${n.slug} ${n.name || ''}`.toLowerCase().includes(needle))
    .slice(0, 8)
})

function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }

function select(n) {
  selectedId.value = n.id
  newAlias.value = ''
  edgeQuery.value = ''
  edgeDst.value = null
}

function jumpTo(nodeId) {
  const n = nodes.value.find((x) => x.id === nodeId)
  if (n) select(n)
}

function pickDst(m) { edgeDst.value = m; edgeQuery.value = m.slug }

function replaceNode(updated) {
  const i = nodes.value.findIndex((n) => n.id === updated.id)
  if (i >= 0) nodes.value.splice(i, 1, updated)
  else nodes.value.push(updated)
}

async function loadNodes() {
  loading.value = true; error.value = false
  try {
    const all = []
    let page = 1
    for (;;) {
      const { data } = await api.get('/capability-nodes/', { params: { page_size: 100, page } })
      const rows = Array.isArray(data) ? data : (data.results || [])
      all.push(...rows)
      if (Array.isArray(data) || !data.next || page >= 50) break
      page += 1
    }
    nodes.value = all
  } catch (e) { error.value = true }
  loading.value = false
}

async function loadGovernance() {
  try { const { data } = await api.get('/capability-nodes/governance/'); gov.value = data }
  catch (e) { /* strip stays in its loading state; the list still works */ }
}

function loadAll() { loadNodes(); loadGovernance() }

async function transitionTo(state) {
  transitioning.value = true
  try {
    const { data } = await api.post(`/capability-nodes/${selected.value.id}/transition/`, { to_state: state })
    replaceNode(data)
    notify(`${data.slug} → ${data.lifecycle}`, 'success')
    loadGovernance()
  } catch (e) {
    notify(e?.response?.data?.detail || 'Transition failed', 'error')
  }
  transitioning.value = false
}

async function addAlias() {
  const alias = newAlias.value.trim()
  if (!alias) return
  try {
    const { data } = await api.post(`/capability-nodes/${selected.value.id}/aliases/`, { alias })
    replaceNode(data)
    newAlias.value = ''
    loadGovernance()   // alias coverage feeds "unresolved tools"
  } catch (e) {
    notify(e?.response?.data?.detail || 'Could not add the alias', 'error')
  }
}

async function removeAlias(a) {
  try {
    const { data } = await api.delete(`/capability-nodes/${selected.value.id}/aliases/${a.id}/`)
    replaceNode(data)
    loadGovernance()
  } catch (e) {
    notify(e?.response?.data?.detail || 'Could not remove the alias', 'error')
  }
}

async function addEdge() {
  if (!edgeDst.value) return
  try {
    const { data } = await api.post(`/capability-nodes/${selected.value.id}/edges/`,
                                    { dst_id: edgeDst.value.id, relation: edgeRelation.value })
    replaceNode(data)
    edgeDst.value = null; edgeQuery.value = ''
  } catch (e) {
    notify(e?.response?.data?.detail || 'Could not add the edge', 'error')
  }
}

async function removeEdge(edge) {
  try {
    const { data } = await api.delete(`/capability-nodes/${selected.value.id}/edges/${edge.id}/`)
    replaceNode(data)
  } catch (e) {
    notify(e?.response?.data?.detail || 'Could not remove the edge', 'error')
  }
}

async function seedFromTools() {
  const ok = await confirm({
    title: 'Seed from tools?',
    message: 'Creates a DRAFT capability node for every runtime tool the graph does not cover yet. Existing nodes are untouched — drafts still need review before they resolve.',
    confirmText: 'Seed drafts',
  })
  if (!ok) return
  seeding.value = true
  try {
    const { data } = await api.post('/capability-nodes/sync/', { apply: true })
    notify(data.created?.length ? `Seeded ${data.created.length} draft node(s)` : 'Nothing to seed — every tool is covered', 'success')
    await Promise.all([loadNodes(), loadGovernance()])
  } catch (e) {
    notify(e?.response?.data?.detail || 'Seeding failed', 'error')
  }
  seeding.value = false
}

onMounted(loadAll)
</script>

<style scoped>
.cg { padding: 28px 32px 60px; }
.cg-head { margin-bottom: 16px; }
.cg-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.cg-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 760px; line-height: 1.5; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }

/* Governance strip */
.gov { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 16px; margin-bottom: 16px; }
.gov-loading { color: #94a3b8; font-size: 12.5px; }
.gov-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 800; }
.gov-chip svg { width: 14px; height: 14px; }
.gov-chip.ok { background: #dcfce7; color: #16a34a; }
.gov-chip.warn { background: #fef3c7; color: #b45309; }
.gov-sep { width: 1px; height: 20px; background: #e5ebf3; }
.gov-count { display: inline-flex; align-items: center; gap: 5px; color: #64748b; font-size: 11.5px; font-weight: 700; text-transform: capitalize; }
.lc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.gov-spacer { flex: 1; }

/* Buttons (AdminBuiltinAgents tokens) */
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn.sm { height: 32px; padding: 0 11px; font-size: 12px; }
.btn:disabled { opacity: .6; cursor: default; }
.btn svg { width: 15px; height: 15px; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; font-size: inherit; padding: 0; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

/* Two columns */
.cols { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start; }

/* Left list */
.list-col { overflow: hidden; }
.toolbar { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #eef2f7; }
.tb-ico { width: 15px; height: 15px; color: #94a3b8; flex-shrink: 0; }
.search { flex: 1; border: 0; outline: none; font-size: 13px; color: #0f172a; background: transparent; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 12px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tab { border: 0; background: transparent; border-radius: 7px; padding: 4px 9px; font-size: 11px; font-weight: 800; color: #64748b; cursor: pointer; text-transform: capitalize; }
.tab em { font-style: normal; opacity: .65; margin-left: 2px; }
.tab.on { background: #4f46e5; color: #fff; }
.rows { max-height: 62vh; overflow-y: auto; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; border: 0; background: transparent; padding: 11px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.row:hover { background: #f8fafc; }
.row.sel { background: #eef2ff; }
.row-main { min-width: 0; }
.row-main strong { display: block; font-size: 12.5px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .sub { display: block; color: #94a3b8; font-size: 11px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Lifecycle chips — one palette for chips, dots and badges */
.lc { border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 850; text-transform: uppercase; letter-spacing: .03em; flex-shrink: 0; }
.lc.big { font-size: 11px; padding: 4px 10px; }
.lc.draft, .lc-dot.draft { background: #f1f5f9; color: #64748b; }
.lc.review, .lc-dot.review { background: #fef3c7; color: #b45309; }
.lc.active, .lc-dot.active { background: #dcfce7; color: #16a34a; }
.lc.deprecated, .lc-dot.deprecated { background: #ffedd5; color: #c2410c; }
.lc.retired, .lc-dot.retired { background: #fee2e2; color: #b91c1c; }
.lc-dot.draft { background: #94a3b8; } .lc-dot.review { background: #f59e0b; } .lc-dot.active { background: #22c55e; }
.lc-dot.deprecated { background: #f97316; } .lc-dot.retired { background: #ef4444; }

/* Right detail */
.detail-col { padding: 20px 22px; min-height: 320px; }
.state { padding: 44px 20px; text-align: center; color: #64748b; font-size: 13px; }
.state.err { color: #b45309; }
.state-ico { display: block; width: 22px; height: 22px; margin: 0 auto 8px; color: #94a3b8; }
.d-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.d-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
.slug { font-size: 11.5px; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 2px 7px; }
.d-desc { margin: 10px 0 0; color: #475569; font-size: 13px; line-height: 1.55; }
.d-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.meta-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e5ebf3; border-radius: 7px; padding: 4px 9px; font-size: 11.5px; font-weight: 700; color: #475569; background: #f8fafc; }
.meta-chip svg { width: 13px; height: 13px; }
.meta-chip.abstract { color: #7c3aed; background: #f5f3ff; border-color: #ede9fe; }
.meta-chip.muted { color: #94a3b8; font-weight: 600; }

.d-block { margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
.d-block h3 { margin: 0 0 10px; font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.d-block h3 em { font-style: normal; font-weight: 700; color: #94a3b8; margin-left: 4px; }
.tr-row { display: flex; flex-wrap: wrap; gap: 8px; }
.hint { margin: 9px 0 0; color: #94a3b8; font-size: 11.5px; }
.hint code { background: #f1f5f9; border-radius: 4px; padding: 1px 4px; }

.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { display: inline-flex; align-items: center; gap: 5px; background: #eef2ff; color: #4338ca; border-radius: 7px; padding: 4px 6px 4px 10px; font-size: 12px; font-weight: 700; }
.chip-x { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 5px; background: transparent; color: inherit; cursor: pointer; opacity: .6; }
.chip-x:hover { opacity: 1; background: rgba(15,23,42,.08); }
.chip-x svg { width: 11px; height: 11px; }
.none { color: #94a3b8; font-size: 12px; }

.add-row { display: flex; align-items: center; gap: 8px; margin-top: 11px; flex-wrap: wrap; }
.add-row input, .add-row select { height: 34px; border: 1px solid #d8e2f0; border-radius: 8px; padding: 0 10px; font-size: 12.5px; color: #0f172a; background: #fff; }
.add-row input:focus, .add-row select:focus { outline: none; border-color: #4f46e5; }
.add-row input { min-width: 220px; flex: 1; }

.edges { display: grid; gap: 6px; }
.edge { display: flex; align-items: center; gap: 8px; border: 1px solid #eef2f7; border-radius: 8px; padding: 6px 10px; font-size: 12.5px; }
.edge .rel { font-weight: 800; color: #0f172a; background: #f1f5f9; border-radius: 5px; padding: 2px 7px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }
.edge-arrow { width: 13px; height: 13px; color: #94a3b8; }
.edge .chip-x { margin-left: auto; color: #64748b; }

.dst-pick { position: relative; flex: 1; min-width: 220px; }
.dst-pick input { width: 100%; }
.dst-menu { position: absolute; top: 38px; left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid #e5ebf3; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.12); overflow: hidden; }
.dst-menu button { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left; border: 0; background: transparent; padding: 8px 12px; font-size: 12.5px; cursor: pointer; }
.dst-menu button:hover { background: #f8fafc; }
.dst-menu strong { color: #0f172a; }
.dst-menu span { color: #94a3b8; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 960px) { .cols { grid-template-columns: 1fr; } .rows { max-height: 40vh; } }
@media (max-width: 680px) { .cg { padding: 20px 16px; } }
</style>
