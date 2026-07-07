<template>
  <PublicLayout>
    <!-- ══ Marketing docs landing (no slug) ═════════════════════════════ -->
    <div v-if="!currentSlug" ref="pageRoot" class="page-main">
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">Documentation</div>
            <h1>Everything you need to <em>build and run</em> agents.</h1>
            <p>From your first mission to a governed institutional deployment. Read the concepts, follow a guide, or jump straight into the API and SDKs.</p>
            <div class="hero-actions">
              <a class="btn" href="#quickstart">Quickstart <span>→</span></a>
              <a class="btn secondary" href="#api">API &amp; SDKs</a>
            </div>
            <div class="subnav">
              <a href="#quickstart">Quickstart</a><a href="#browse">Browse by area</a>
              <a href="#guides">Guides</a><a href="#api">API &amp; SDKs</a>
            </div>
          </div>
          <div class="diagram-card reveal">
            <div class="platform-stack">
              <div v-for="s in docStack" :key="s.name" class="stack-row"><b>{{ s.name }}</b><span>{{ s.desc }}</span></div>
            </div>
            <div class="stack-caption">One reference · from first call to sovereign deployment</div>
          </div>
        </div>
      </section>

      <!-- Quickstart -->
      <section class="content-section" id="quickstart">
        <div class="shell">
          <div class="doc-shell">
            <aside class="doc-side reveal">
              <div v-if="loading" class="space-y-3 p-1">
                <div v-for="i in 6" :key="i" class="vm-skel h-4" :style="{ width: (55 + i * 6) + '%' }"></div>
              </div>
              <template v-else-if="groups.length">
                <template v-for="group in groups" :key="group.category">
                  <h4>{{ group.category }}</h4>
                  <router-link v-for="item in group.items" :key="item.slug" :to="`/docs/${item.slug}`">{{ item.title }}</router-link>
                </template>
              </template>
              <template v-else>
                <h4>Get started</h4>
                <a href="#quickstart" class="on">Quickstart</a>
                <a href="#browse">Browse by area</a>
                <a href="#guides">Guides</a>
                <h4>Build</h4>
                <router-link to="/features">Features</router-link>
                <a href="#api">API &amp; SDKs</a>
              </template>
            </aside>
            <div>
              <div class="section-head-wide reveal" style="margin-bottom:30px">
                <div><div class="section-kicker">Start here</div><h2>Run your first mission.</h2></div>
                <p>Install the SDK, create an agent with a scoped tool set, and execute a mission inside a persistent workspace—with governance applied at execution time.</p>
              </div>
              <div class="quickstart">
                <div class="qs-steps reveal">
                  <div v-for="q in qsSteps" :key="q.num" class="qs-step"><div class="num">{{ q.num }}</div><h3>{{ q.title }}</h3><p>{{ q.body }}</p></div>
                </div>
                <div class="code-block reveal">
                  <div class="bar">terminal · python</div>
                  <pre><span class="c"># install</span>
pip install aadml

<span class="c"># authenticate</span>
export AADML_API_KEY=<span class="s">"sk-..."</span>

<span class="k">from</span> aadml <span class="k">import</span> Client

client = <span class="f">Client</span>()

agent = client.agents.<span class="f">create</span>(
    name=<span class="s">"benefits-caseworker"</span>,
    model=<span class="s">"reasoning-pro"</span>,
    tools=[<span class="s">"browser"</span>, <span class="s">"postgres"</span>, <span class="s">"documents"</span>],
    budget_usd=<span class="s">5.00</span>,
    approval=<span class="s">"ask"</span>,   <span class="c"># human gate on writes</span>
)

run = client.missions.<span class="f">run</span>(
    agent=agent.id,
    goal=<span class="s">"Review case 21874 and prepare a decision"</span>,
    workspace=<span class="s">"case-21874"</span>,
)

<span class="k">for</span> event <span class="k">in</span> run.<span class="f">stream</span>():
    <span class="f">print</span>(event.type, event.summary)</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Browse by area -->
      <section class="content-section soft" id="browse">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Browse by area</div><h2>Find the right part of the platform.</h2></div>
            <p>Each area covers the concepts, the configuration, and the operational controls—so you can take a capability from a first call to a governed deployment.</p>
          </div>
          <div class="deployment-grid" style="margin-bottom:14px">
            <article v-for="a in browseTop" :key="a.title" class="deploy-card reveal" :style="{ '--tone': a.tone }"><div class="mark">{{ a.mark }}</div><h3>{{ a.title }}</h3><p>{{ a.body }}</p></article>
          </div>
          <div class="deployment-grid">
            <article v-for="a in browseBottom" :key="a.title" class="deploy-card reveal" :style="{ '--tone': a.tone }"><div class="mark">{{ a.mark }}</div><h3>{{ a.title }}</h3><p>{{ a.body }}</p></article>
          </div>
        </div>
      </section>

      <!-- Guides -->
      <section class="content-section" id="guides">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Guides</div><h2>Task-focused walkthroughs.</h2></div>
            <p>Step-by-step recipes for the operations teams build most often, each with copyable configuration and a runnable example.</p>
          </div>
          <div class="guide-table reveal">
            <div v-for="(g, i) in guides" :key="g.title" class="guide-row"><i>{{ i + 1 }}</i><div><b>{{ g.title }}</b><span>{{ g.body }}</span></div><em>{{ g.time }}</em></div>
          </div>
        </div>
      </section>

      <!-- API & SDKs -->
      <section class="content-section soft" id="api">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">API &amp; SDKs</div><h2>Call the platform from anywhere.</h2></div>
            <p>Typed SDKs for Python and TypeScript, a complete REST API, a CLI for operations, and signed webhooks for inbound events.</p>
          </div>
          <div class="runtime-grid">
            <div class="code-block reveal">
              <div class="bar">request · rest</div>
              <pre><span class="k">POST</span> /v1/missions
<span class="f">Authorization</span>: Bearer sk-...
<span class="f">Content-Type</span>: application/json

{
  <span class="s">"agent"</span>: <span class="s">"benefits-caseworker"</span>,
  <span class="s">"goal"</span>: <span class="s">"Review case 21874"</span>,
  <span class="s">"workspace"</span>: <span class="s">"case-21874"</span>,
  <span class="s">"budget_usd"</span>: 5.0,
  <span class="s">"approval"</span>: <span class="s">"ask"</span>
}

<span class="c">→ 201 { "mission_id": "msn_8f2", "state": "running" }</span></pre>
            </div>
            <div class="runtime-side">
              <article class="info-card reveal"><div class="icon">{ }</div><h3>SDKs</h3><p>First-class, typed clients with streaming, retries, and pagination built in.</p><ul><li>Python · <span style="font-family:var(--mono)">pip install aadml</span></li><li>TypeScript · <span style="font-family:var(--mono)">npm i @aadml/sdk</span></li><li>CLI · <span style="font-family:var(--mono)">aadml missions run</span></li></ul></article>
              <article class="info-card reveal"><div class="icon">↯</div><h3>Webhooks</h3><p>Receive signed, verifiable events for mission state, approvals, and signals.</p><ul><li>HMAC signatures and replay protection</li><li>Per-endpoint budgets and read-only modes</li><li>Dead-letter recovery and retries</li></ul></article>
            </div>
          </div>
        </div>
      </section>

      <section class="cta" id="contact">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>Start with one mission. Keep the same model as you scale.</h2></div>
            <div class="cta-copy">
              <p>Read the quickstart, wire your first connector, and put a human gate on the action that matters. Then grow it into an institutional deployment.</p>
              <div class="cta-actions">
                <a class="btn light" href="#quickstart">Open the quickstart <span>→</span></a>
                <router-link class="btn secondary" style="border-color:rgba(255,255,255,.55);color:white" to="/contact">Talk to North Rays</router-link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ══ CMS reader (with slug) ═══════════════════════════════════════ -->
    <div v-else class="shell"><div class="docs-shell">
      <!-- Left: grouped nav -->
      <aside class="docs-side" :class="{ open: sidebarOpen }">
        <div class="side-search">
          <Icon icon="lucide:search" class="h-4 w-4" />
          <input v-model="searchQuery" type="text" placeholder="Search documentation…" />
          <button class="side-close lg:hidden" @click="sidebarOpen = false" aria-label="Close"><Icon icon="lucide:x" class="h-5 w-5" /></button>
        </div>
        <nav class="side-nav vm-scroll">
          <div v-if="loading" class="space-y-3 p-2">
            <div v-for="i in 6" :key="i" class="vm-skel h-4" :style="{ width: (55 + i * 6) + '%' }"></div>
          </div>
          <template v-else>
            <div v-for="group in filteredGroups" :key="group.category" class="nav-group">
              <div class="nav-group-label">{{ group.category }}</div>
              <router-link
                v-for="item in group.items"
                :key="item.slug"
                :to="`/docs/${item.slug}`"
                class="nav-item"
                :class="{ active: currentSlug === item.slug }"
                @click="sidebarOpen = false"
              >
                <span v-if="currentSlug === item.slug" class="dot">•</span>{{ item.title }}
              </router-link>
            </div>
            <router-link to="/docs" class="nav-item back">← All docs</router-link>
          </template>
        </nav>
      </aside>

      <button class="mobile-toggle lg:hidden" @click="sidebarOpen = true">
        <Icon icon="lucide:menu" class="h-5 w-5" /> Docs
      </button>

      <!-- Center: article -->
      <main class="docs-main">
        <div v-if="pageLoading" class="space-y-4 py-6">
          <div class="vm-skel h-9 w-2/5"></div>
          <div class="vm-skel h-4 w-4/5"></div>
          <div class="vm-skel h-4 w-3/5"></div>
        </div>

        <div v-else-if="!currentPage" class="missing">
          <Icon icon="lucide:file-question" class="mx-auto h-12 w-12" />
          <h2>Page not found</h2>
          <p>The page “<code>{{ currentSlug }}</code>” doesn’t exist yet.</p>
          <router-link to="/docs" class="back-link">← Back to docs</router-link>
        </div>

        <article v-else class="article">
          <nav class="crumb">
            <router-link to="/docs">Docs</router-link>
            <Icon icon="lucide:chevron-right" class="h-3.5 w-3.5" />
            <span>{{ currentPage.title }}</span>
          </nav>
          <h1 class="article-title">{{ currentPage.title }}</h1>
          <p v-if="currentPage.excerpt" class="article-lead">{{ currentPage.excerpt }}</p>
          <div ref="articleEl" class="article-body" v-html="currentPage.content_html || ''"></div>
          <div class="pager">
            <router-link v-if="prevPage" :to="`/docs/${prevPage.slug}`" class="pager-link prev">
              <span class="pager-cap">Previous</span>
              <span class="pager-title"><Icon icon="lucide:arrow-left" class="h-4 w-4" /> {{ prevPage.title }}</span>
            </router-link>
            <span v-else></span>
            <router-link v-if="nextPage" :to="`/docs/${nextPage.slug}`" class="pager-link next">
              <span class="pager-cap">Next</span>
              <span class="pager-title">{{ nextPage.title }} <Icon icon="lucide:arrow-right" class="h-4 w-4" /></span>
            </router-link>
          </div>
        </article>
      </main>

      <!-- Right: on-this-page + help -->
      <aside v-if="currentPage" class="docs-toc">
        <div class="toc-sticky">
          <template v-if="toc.length">
            <div class="toc-label">On this page</div>
            <ul class="toc-list">
              <li v-for="h in toc" :key="h.id" :class="{ sub: h.level === 3, active: activeId === h.id }">
                <a :href="`#${h.id}`" @click.prevent="scrollTo(h.id)">{{ h.text }}</a>
              </li>
            </ul>
          </template>
          <div class="help-card">
            <div class="help-top"><Icon icon="lucide:help-circle" class="h-5 w-5" /> Need help?</div>
            <p>Join our community for real-time support and product updates.</p>
            <router-link to="/contact" class="help-link">Contact us <Icon icon="lucide:arrow-right" class="h-4 w-4" /></router-link>
          </div>
        </div>
      </aside>
    </div></div>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'
import { useReveal } from '../composables/useReveal'

const route = useRoute()
const pageRoot = ref(null)
useReveal(pageRoot)

// ── Marketing landing content (from docs.html) ──
const docStack = [
  { name: 'Quickstart', desc: 'Install, authenticate, and run your first mission in minutes' },
  { name: 'Concepts', desc: 'Missions · Agents · Workspaces · Signals · Governance' },
  { name: 'Surfaces', desc: 'Browser · Android · Daytona · Remote Runner' },
  { name: 'Workflows', desc: 'Triggers · Logic · Approvals · Sub-workflows · Replay' },
  { name: 'Connectors', desc: 'MCP servers · REST · Databases · Credentials' },
  { name: 'API & SDKs', desc: 'Python · TypeScript · REST · CLI · Webhooks' },
]
const qsSteps = [
  { num: '01 · INSTALL', title: 'Add the SDK', body: 'Install for Python or TypeScript and set your API key as an environment variable.' },
  { num: '02 · DEFINE', title: 'Create an agent', body: 'Give it a role, a model, an allowed tool set, a budget, and an approval policy.' },
  { num: '03 · EXECUTE', title: 'Run a mission', body: 'Start a mission in a workspace. Inspect every tool call, file, and decision as it runs.' },
  { num: '04 · GOVERN', title: 'Gate the consequential step', body: 'Require human approval before any external write, deploy, or payment.' },
]
const browseTop = [
  { tone: 'var(--blue-2)', mark: '☞', title: 'Getting started', body: 'Install the SDK, authenticate, and run your first mission with a scoped agent.' },
  { tone: 'var(--green-2)', mark: '◎', title: 'Core concepts', body: 'Missions, agents, workspaces, signals, and governance—the mental model.' },
  { tone: 'var(--violet-2)', mark: '↗', title: 'Execution surfaces', body: 'Browser automation, Android tools, Daytona workspaces, and the Remote Runner.' },
  { tone: 'var(--amber-2)', mark: '⬡', title: 'Workflow Builder', body: 'Triggers, logic, agents, approvals, waits, sub-workflows, and replay.' },
]
const browseBottom = [
  { tone: 'var(--green-2)', mark: '▤', title: 'Knowledge & memory', body: 'Documents, cited RAG, databases, vector stores, and structured memory.' },
  { tone: 'var(--blue-2)', mark: '⛓', title: 'Connectors & MCP', body: 'Register MCP servers, REST APIs, and databases with vaulted credentials.' },
  { tone: 'var(--red-2)', mark: '⚖', title: 'Governance', body: 'RBAC, approval gates, budgets, audit logs, retention, and tenant isolation.' },
  { tone: 'var(--violet-2)', mark: '⌂', title: 'Deployment', body: 'Managed cloud, dedicated, VPC, on-premise, and sovereign runners.' },
]
const guides = [
  { title: 'Run a long-running mission with checkpoints', body: 'Pause, resume, recover, and replay durable state across hours or days.', time: '10 min' },
  { title: 'Gate a tool behind human approval', body: 'Require explicit authorization before a write, deploy, payment, or send.', time: '6 min' },
  { title: 'Connect an MCP server', body: 'Register a server, scope its tools, and store credentials in the vault.', time: '8 min' },
  { title: 'Automate an authenticated browser portal', body: 'Open a session, navigate, extract evidence, and submit under policy.', time: '12 min' },
  { title: 'Operate an Android device farm', body: 'Assign a device, run a mobile workflow, and preserve recordings.', time: '14 min' },
  { title: 'Wake a workflow from a Redis signal', body: 'Normalize an event into a signal that routes and escalates work.', time: '9 min' },
]
const tree = ref([])
const currentPage = ref(null)
const loading = ref(true)
const pageLoading = ref(false)
const searchQuery = ref('')
const sidebarOpen = ref(false)
const articleEl = ref(null)
const toc = ref([])
const activeId = ref('')
let spy = null

const currentSlug = computed(() => route.params.slug || '')

setBreadcrumbLabel(() => currentPage.value?.title)

useMeta({
  title: computed(() => currentPage.value ? `${currentPage.value.title} — AADML Docs` : 'Documentation — AADML'),
  description: computed(() => currentPage.value?.excerpt || 'AADML platform documentation — agents, tools, signals, MCP, knowledge, and more.'),
})

const quickStartCards = [
  { slug: 'getting-started', icon: '🚀', title: 'Getting Started', desc: 'Set up your first agent in 5 minutes' },
  { slug: 'tools', icon: '🛠️', title: 'Tools', desc: '1,800+ tools across builtin, MCP, and services' },
  { slug: 'signals', icon: '⚡', title: 'Signals & Schedules', desc: 'Automate agents with cron, webhooks, events' },
  { slug: 'mcp', icon: '🔌', title: 'MCP Integration', desc: 'Connect external Model Context Protocol servers' },
  { slug: 'knowledge', icon: '🧠', title: 'Knowledge & Dream', desc: 'Agent memory, knowledge cards, dream cycles' },
  { slug: 'api-reference', icon: '📡', title: 'API Reference', desc: 'REST API endpoints and authentication' },
]

// Flatten the CMS tree (top-level + children) then group by category for the sidebar.
const flatPages = computed(() => {
  const flat = []
  tree.value.forEach(item => { flat.push(item); if (item.children) flat.push(...item.children) })
  return flat
})
const groups = computed(() => {
  const order = []
  const byCat = {}
  for (const p of flatPages.value) {
    const cat = p.category || 'Documentation'
    if (!byCat[cat]) { byCat[cat] = []; order.push(cat) }
    byCat[cat].push(p)
  }
  return order.map(cat => ({ category: cat, items: byCat[cat] }))
})
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map(g => ({ category: g.category, items: g.items.filter(i => i.title.toLowerCase().includes(q)) }))
    .filter(g => g.items.length)
})

const currentIndex = computed(() => flatPages.value.findIndex(p => p.slug === currentSlug.value))
const prevPage = computed(() => currentIndex.value > 0 ? flatPages.value[currentIndex.value - 1] : null)
const nextPage = computed(() => currentIndex.value >= 0 && currentIndex.value < flatPages.value.length - 1 ? flatPages.value[currentIndex.value + 1] : null)

onMounted(async () => {
  await loadTree()
  if (currentSlug.value) await loadPage(currentSlug.value)
})
onUnmounted(() => spy?.disconnect())

watch(() => route.params.slug, async (slug) => {
  if (slug) { await loadPage(slug); window.scrollTo(0, 0) }
  else { currentPage.value = null; toc.value = [] }
})

async function loadTree() {
  try {
    loading.value = true
    const { data } = await api.get('/content/docs-tree/')
    tree.value = data.tree || []
  } catch (e) {
    // Purely backend-driven: no fake nav on error — show the empty/welcome state.
    console.debug('Docs: tree load failed', e.message)
    tree.value = []
  } finally { loading.value = false }
}

async function loadPage(slug) {
  try {
    pageLoading.value = true
    const { data } = await api.get(`/content/pages/${slug}/`)
    currentPage.value = data.page
    await nextTick()
    enhanceArticle()
  } catch (e) {
    currentPage.value = null
    toc.value = []
  } finally { pageLoading.value = false }
}

function slugify(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section'
}

/** After rendering CMS HTML: build the right-rail TOC + add filename headers & copy buttons to code blocks. */
function enhanceArticle() {
  const el = articleEl.value
  if (!el) return

  // TOC from h2/h3
  const headings = el.querySelectorAll('h2, h3')
  const items = []
  const seen = {}
  headings.forEach(h => {
    let id = h.id || slugify(h.textContent)
    if (seen[id]) { id = `${id}-${seen[id]++}` } else { seen[id] = 1 }
    h.id = id
    items.push({ id, text: h.textContent.trim(), level: h.tagName === 'H3' ? 3 : 2 })
  })
  toc.value = items

  // Code blocks → header bar (language label) + copy button
  el.querySelectorAll('pre').forEach(pre => {
    if (pre.dataset.enhanced) return
    pre.dataset.enhanced = '1'
    const code = pre.querySelector('code')
    const cls = code?.className || ''
    const lang = (cls.match(/language-([\w-]+)/)?.[1] || 'code').replace(/^bash$/, 'Terminal')
    const wrap = document.createElement('div')
    wrap.className = 'code-block'
    const bar = document.createElement('div')
    bar.className = 'code-bar'
    const label = document.createElement('span')
    label.className = 'code-lang'
    label.textContent = lang
    const btn = document.createElement('button')
    btn.className = 'code-copy'
    btn.type = 'button'
    btn.textContent = 'Copy'
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(code?.innerText || pre.innerText || '')
      btn.textContent = 'Copied'
      setTimeout(() => { btn.textContent = 'Copy' }, 1500)
    })
    bar.appendChild(label); bar.appendChild(btn)
    pre.parentNode.insertBefore(wrap, pre)
    wrap.appendChild(bar); wrap.appendChild(pre)
  })

  // Scrollspy for the active TOC entry
  spy?.disconnect()
  if (headings.length) {
    spy = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) activeId.value = visible[0].target.id
    }, { rootMargin: '-80px 0px -70% 0px' })
    headings.forEach(h => spy.observe(h))
  }
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); activeId.value = id }
}
</script>


<style scoped>
/* CMS reader — AADML paper theme. Landing sections are styled by the scoped
   aadml-public sheets; only the 3-column reader needs local styles here. */
.docs-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 224px;
  gap: 8px;
  align-items: start;
  padding: 24px 0 80px;
}

/* Left nav */
.docs-side {
  position: sticky;
  top: 88px;
  align-self: start;
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 253, 248, 0.9);
  box-shadow: var(--shadow-sm);
  padding: 16px 14px;
}
.side-search {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 11px; background: var(--paper-2);
  border: 1px solid var(--line); margin-bottom: 12px; color: var(--muted);
}
.side-search input { flex: 1; border: none; outline: none; background: transparent; font-size: .85rem; color: var(--ink); }
.side-close { border: none; background: none; cursor: pointer; color: var(--muted); }
.side-nav { overflow-y: auto; flex: 1; }
.nav-group { margin-bottom: 16px; }
.nav-group-label {
  font: 800 10px var(--mono); letter-spacing: .12em; text-transform: uppercase;
  color: var(--muted); padding: 0 10px 8px;
}
.nav-item {
  display: block; position: relative;
  padding: 7px 10px; border-radius: 9px;
  font-size: .84rem; font-weight: 650; color: #4f5c55; text-decoration: none;
}
.nav-item:hover { color: var(--ink); background: rgba(20, 34, 29, 0.05); }
.nav-item.active { color: #fff; background: var(--ink); }
.nav-item.active .dot { color: #fff; }
.nav-item.back { margin-top: 10px; color: var(--blue); font-weight: 700; }
.nav-item .dot { position: absolute; left: 2px; }

.mobile-toggle {
  display: none; align-items: center; gap: 8px;
  position: fixed; bottom: 18px; left: 18px; z-index: 40;
  padding: 11px 16px; border-radius: 999px; border: none;
  font-weight: 800; color: #fff; background: var(--ink); box-shadow: var(--shadow-sm); cursor: pointer;
}

/* Center article */
.docs-main { min-width: 0; padding: 16px 40px 40px; }
.crumb { display: flex; align-items: center; gap: 6px; font-size: .8rem; color: var(--muted); margin-bottom: 18px; }
.crumb a { color: var(--muted); text-decoration: none; }
.crumb a:hover { color: var(--blue); }
.article-title { font-family: var(--serif); font-weight: 500; font-size: clamp(34px, 4vw, 52px); letter-spacing: -.03em; color: var(--ink); line-height: 1.02; margin: 0; }
.article-lead { margin-top: 16px; font-size: 1.05rem; line-height: 1.7; color: var(--muted); }

.missing { text-align: center; padding: 64px 0; color: var(--muted); }
.missing h2 { margin-top: 14px; font-size: 1.3rem; font-weight: 800; color: var(--ink); }
.missing code { background: var(--blue-2); color: var(--blue); padding: 1px 6px; border-radius: 5px; }
.back-link { display: inline-block; margin-top: 12px; color: var(--blue); font-weight: 700; text-decoration: none; }

/* pager */
.pager { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; }
.pager-link { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border: 1px solid var(--line); border-radius: 14px; text-decoration: none; transition: border-color .15s, transform .15s; max-width: 48%; background: var(--paper-2); }
.pager-link.next { text-align: right; align-items: flex-end; margin-left: auto; }
.pager-link:hover { border-color: var(--ink); transform: translateY(-1px); }
.pager-cap { font: 800 10px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.pager-title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--blue); }

/* Right TOC */
.docs-toc { position: sticky; top: 88px; align-self: start; padding: 20px 8px; }
.toc-sticky { display: flex; flex-direction: column; gap: 20px; }
.toc-label { font: 800 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.toc-list { list-style: none; margin: 8px 0 0; padding: 0; border-left: 1px solid var(--line); }
.toc-list li a { display: block; padding: 5px 12px; font-size: .82rem; color: var(--muted); text-decoration: none; border-left: 2px solid transparent; margin-left: -1px; }
.toc-list li.sub a { padding-left: 22px; }
.toc-list li a:hover { color: var(--ink); }
.toc-list li.active a { color: var(--blue); border-left-color: var(--blue); font-weight: 700; }

.help-card { border: 1px solid var(--line); border-radius: 16px; background: var(--blue-2); padding: 16px; }
.help-top { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: .9rem; color: var(--ink); }
.help-card p { margin-top: 8px; font-size: .8rem; color: #465b79; line-height: 1.5; }
.help-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; font-size: .82rem; font-weight: 700; color: var(--blue); text-decoration: none; }

/* Rendered markdown */
.article-body { margin-top: 28px; line-height: 1.75; color: #3a4a43; }
.article-body :deep(h2) { scroll-margin-top: 96px; font-family: var(--serif); font-size: 1.6rem; font-weight: 500; letter-spacing: -.02em; color: var(--ink); margin: 2.4rem 0 1rem; }
.article-body :deep(h3) { scroll-margin-top: 96px; font-size: 1.15rem; font-weight: 800; color: var(--ink); margin: 1.8rem 0 .6rem; }
.article-body :deep(p) { margin-bottom: 1rem; }
.article-body :deep(a) { color: var(--blue); text-decoration: none; }
.article-body :deep(a:hover) { text-decoration: underline; }
.article-body :deep(ul), .article-body :deep(ol) { padding-left: 1.4rem; margin-bottom: 1rem; }
.article-body :deep(li) { margin-bottom: .4rem; }
.article-body :deep(code) { background: var(--blue-2); color: var(--blue); padding: .12rem .42rem; border-radius: 5px; font-size: .88em; font-family: var(--mono); }
.article-body :deep(table) { width: 100%; border-collapse: collapse; margin: 1.2rem 0; }
.article-body :deep(th), .article-body :deep(td) { padding: .6rem 1rem; border: 1px solid var(--line); text-align: left; }
.article-body :deep(th) { background: #fbfaf6; font-weight: 700; }
.article-body :deep(blockquote) { border-left: 3px solid var(--blue); padding: .6rem 1.2rem; margin: 1rem 0; background: var(--blue-2); border-radius: 0 8px 8px 0; }

/* enhanced code blocks (injected wrapper) */
.article-body :deep(.code-block) { margin: 1.3rem 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #0d1117; }
.article-body :deep(.code-bar) { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.08); }
.article-body :deep(.code-lang) { font-size: .72rem; font-family: var(--mono); color: #8b949e; text-transform: capitalize; }
.article-body :deep(.code-copy) { font-size: .72rem; font-weight: 600; color: #8b949e; background: none; border: none; cursor: pointer; }
.article-body :deep(.code-copy:hover) { color: #e6edf3; }
.article-body :deep(.code-block pre) { margin: 0; border: none; border-radius: 0; background: #0d1117; color: #e6edf3; padding: 16px 18px; overflow-x: auto; font-size: .86rem; }
.article-body :deep(.code-block pre code) { background: none; color: inherit; padding: 0; }

@media (max-width: 1100px) {
  .docs-shell { grid-template-columns: 230px minmax(0, 1fr); }
  .docs-toc { display: none; }
  .docs-main { padding: 16px 24px 72px; }
}
@media (max-width: 860px) {
  .docs-shell { grid-template-columns: 1fr; }
  .docs-side { position: fixed; top: 0; left: 0; z-index: 70; width: 280px; height: 100vh; max-height: 100vh; border-radius: 0; transform: translateX(-100%); transition: transform .25s ease; }
  .docs-side.open { transform: translateX(0); }
  .mobile-toggle { display: inline-flex; }
  .docs-main { padding: 12px 4px 72px; }
  .article-title { font-size: 2rem; }
}
</style>
