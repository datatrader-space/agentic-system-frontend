<template>
  <main class="docs-page">
    <section class="docs-main">
      <header class="docs-hero">
        <div>
          <h1>Documentation</h1>
          <p>Everything you need to build, integrate, and scale with Aadml.</p>
        </div>
        <button class="changelog-btn">
          <Icon icon="lucide:clipboard-list" />
          View changelog
        </button>
      </header>

      <div class="docs-search">
        <Icon icon="lucide:search" />
        <input v-model="query" type="search" placeholder="Search docs, guides, API, and more..." />
        <kbd>Ctrl K</kbd>
      </div>

      <nav class="doc-tabs" aria-label="Documentation categories">
        <button v-for="tab in tabs" :key="tab" :class="{ active: tab === activeTab }" @click="activeTab = tab">
          {{ tab }}
        </button>
      </nav>

      <section id="categories" class="category-grid">
        <article v-for="category in categories" :key="category.title" class="category-card" @click="activeTab = category.title">
          <span :class="['category-icon', category.tone]"><Icon :icon="category.icon" /></span>
          <div>
            <h2>{{ category.title }}</h2>
            <span>{{ categoryCount(category) }}</span>
            <p>{{ category.copy }}</p>
          </div>
        </article>
      </section>

      <section id="quickstart" class="hero-grid">
        <article class="quickstart-card">
          <div class="quickstart-copy">
            <span>Quickstart</span>
            <h2>Build your first agent in 5 minutes</h2>
            <p>Follow this step-by-step guide to create, test, and run your first agent using Aadml.</p>
            <button @click="goTo('/dashboard/help-center/get-started')">
              Start quickstart
              <Icon icon="lucide:arrow-right" />
            </button>
          </div>
          <div class="quickstart-visual" aria-hidden="true">
            <div class="window-dots"><i /><i /><i /></div>
            <div class="code-line a" />
            <div class="code-line b" />
            <div class="code-line c" />
            <div class="code-line d" />
            <span class="play"><Icon icon="lucide:play" /></span>
          </div>
        </article>

        <article id="api-reference" class="api-card">
          <h2>API reference</h2>
          <p>Integrate with Aadml using our REST API.</p>
          <div class="api-list">
            <button v-for="endpoint in endpoints" :key="endpoint.title">
              <span class="doc-file"><Icon icon="lucide:file-text" /></span>
              <span>
                <strong>{{ endpoint.title }}</strong>
                <small>{{ endpoint.copy }}</small>
              </span>
              <em :class="endpoint.method.toLowerCase()">{{ endpoint.method }}</em>
            </button>
          </div>
          <button class="link-btn" @click="goTo('/dashboard/help-center/api-reference')">
            View full API reference
            <Icon icon="lucide:arrow-right" />
          </button>
        </article>
      </section>

      <section class="bottom-grid">
        <article id="sdks-cli" class="panel sdk-panel">
          <h2>SDKs & CLI</h2>
          <p>Build faster with our official SDKs and CLI.</p>
          <div class="sdk-list">
            <button v-for="sdk in sdks" :key="sdk.title">
              <span :class="['sdk-icon', sdk.tone]"><Icon :icon="sdk.icon" /></span>
              <span>
                <strong>{{ sdk.title }}</strong>
                <small>{{ sdk.copy }}</small>
              </span>
              <em>v2.1.0</em>
            </button>
          </div>
          <button class="link-btn">
            View all SDKs & CLI
            <Icon icon="lucide:arrow-right" />
          </button>
        </article>

        <article id="code-examples" class="panel code-panel">
          <div class="section-row">
            <div>
              <h2>Code examples</h2>
              <p>Copy, paste, and start building.</p>
            </div>
            <button class="copy-btn"><Icon icon="lucide:copy" /> Copy</button>
          </div>
          <div class="code-tabs">
            <button class="active">JavaScript</button>
            <button>Python</button>
            <button>cURL</button>
          </div>
          <pre><code>{{ codeExample }}</code></pre>
        </article>

        <article id="popular-articles" class="panel article-panel">
          <h2>Popular articles</h2>
          <div class="article-list">
            <button v-for="article in articles" :key="article.title" @click="openDoc(article)">
              <span class="doc-file"><Icon icon="lucide:file-text" /></span>
              <span>
                <strong>{{ article.title }}</strong>
                <small>{{ article.copy }}</small>
              </span>
            </button>
          </div>
          <button class="link-btn" @click="goTo('/docs')">
            Browse all articles
            <Icon icon="lucide:arrow-right" />
          </button>
        </article>
      </section>

      <p class="docs-footnote">
        Can't find what you need? <button>Search docs</button> or <button>contact support</button>.
      </p>
    </section>

    <aside class="docs-rail">
      <section class="rail-card on-page">
        <h2>On this page</h2>
        <a href="#categories" class="active">Documentation categories</a>
        <a href="#quickstart">Quickstart</a>
        <a href="#api-reference">API reference</a>
        <a href="#sdks-cli">SDKs & CLI</a>
        <a href="#code-examples">Code examples</a>
        <a href="#popular-articles">Popular articles</a>
      </section>

      <section class="rail-card">
        <h2>Recommended docs</h2>
        <button v-for="doc in recommendedDocs" :key="doc.title" class="rail-doc" @click="openDoc(doc)">
          <span class="doc-file"><Icon icon="lucide:file-text" /></span>
          <span>
            <strong>{{ doc.title }}</strong>
            <small>{{ doc.copy }}</small>
          </span>
        </button>
      </section>

      <section class="rail-card help-card">
        <h2>Need help?</h2>
        <p>We're here to help you build successfully.</p>
        <button v-for="item in helpLinks" :key="item.title" class="help-row" @click="goTo(item.route)">
          <span :class="item.tone"><Icon :icon="item.icon" /></span>
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.copy }}</small>
          </span>
          <Icon icon="lucide:chevron-right" />
        </button>
        <RouterLink to="/dashboard/help-center" class="help-center-link">
          Visit Help Center
          <Icon icon="lucide:chevron-right" />
        </RouterLink>
      </section>
    </aside>

    <button class="chat-fab" aria-label="Open support chat" @click="goTo('/dashboard/chat/new')">
      <Icon icon="lucide:message-circle" />
    </button>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const router = useRouter()
const route = useRoute()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeTab = ref('Getting Started')

const tabs = ['Getting Started', 'Agents', 'Workflows', 'Connectors', 'Tools', 'API', 'Security']

// Live docs from ContentPage (page_type='doc'); empty until loaded → static fallback.
const docs = ref([])

function categoryCount(category) {
  const n = docs.value.filter(d => (d.category || '').toLowerCase() === category.title.toLowerCase()).length
  return n ? `${n} guide${n === 1 ? '' : 's'}` : category.count
}

const allArticles = computed(() => docs.value.length
  ? docs.value.map(d => ({ title: d.title, copy: d.excerpt || '', slug: d.slug, category: d.category || '' }))
  : staticArticles)

const articles = computed(() => {
  let list = allArticles.value
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter(a => `${a.title} ${a.copy}`.toLowerCase().includes(q))
  if (docs.value.length && activeTab.value) {
    const tabMatches = list.some(a => a.category.toLowerCase() === activeTab.value.toLowerCase())
    if (tabMatches) list = list.filter(a => a.category.toLowerCase() === activeTab.value.toLowerCase())
  }
  return list.slice(0, 5)
})

const recommendedDocs = computed(() => docs.value.length
  ? docs.value.slice(0, 5).map(d => ({ title: d.title, copy: d.excerpt || '', slug: d.slug }))
  : staticRecommendedDocs)

function openDoc(item) { if (item && item.slug) router.push(`/docs/${item.slug}`) }
function goTo(route) { if (route) router.push(route) }

onMounted(async () => {
  try {
    const { data } = await api.getContentPages({ type: 'doc' })
    docs.value = data?.pages || []
  } catch (e) { /* keep static fallback content */ }
  try {
    const { data } = await api.getApiReference()
    apiRef.value = data
  } catch (e) { /* keep static API endpoints */ }
})

const categories = [
  { title: 'Getting Started', count: '5 guides', copy: 'Quickstart, concepts, and key things to get you up and running.', icon: 'lucide:rocket', tone: 'blue' },
  { title: 'Agents', count: '12 guides', copy: 'Create, configure, and deploy agents that act on your behalf.', icon: 'lucide:bot', tone: 'violet' },
  { title: 'Workflows', count: '8 guides', copy: 'Automate processes and orchestrate actions with powerful workflows.', icon: 'lucide:workflow', tone: 'teal' },
  { title: 'Connectors', count: '24 guides', copy: 'Integrate with your favorite apps, services, and data sources.', icon: 'lucide:link-2', tone: 'blue' },
  { title: 'Tools', count: '9 guides', copy: 'Extend Aadml with tools, capabilities, and custom actions.', icon: 'lucide:wrench', tone: 'blue' },
  { title: 'Security', count: '7 guides', copy: 'Learn about permissions, scopes, and best security practices.', icon: 'lucide:shield', tone: 'orange' },
]

const staticEndpoints = [
  { title: 'Authentication', copy: 'Learn how to authenticate requests', method: 'GET' },
  { title: 'Create an agent', copy: 'POST /v2/agents', method: 'POST' },
  { title: 'Run an agent', copy: 'POST /v2/agents/{id}/runs', method: 'POST' },
  { title: 'List runs', copy: 'GET /v2/runs', method: 'GET' },
]
// Schema-driven API reference (helpcenter /api-reference/). Falls back to static.
const apiRef = ref(null)
const endpoints = computed(() => {
  const groups = apiRef.value?.groups || []
  const flat = []
  for (const g of groups) {
    for (const e of (g.endpoints || [])) {
      flat.push({ title: e.summary || `${e.method} ${e.path}`, copy: e.path, method: e.method })
      if (flat.length >= 6) break
    }
    if (flat.length >= 6) break
  }
  return flat.length ? flat : staticEndpoints
})

const sdks = [
  { title: 'JavaScript SDK', copy: 'Install and build with Node.js', icon: 'logos:javascript', tone: 'yellow' },
  { title: 'Python SDK', copy: 'Install and build with Python', icon: 'logos:python', tone: 'white' },
  { title: 'Aadml CLI', copy: 'Command-line tools for Aadml', icon: 'lucide:terminal-square', tone: 'dark' },
]

const staticArticles = [
  { title: 'How Aadml works', copy: 'A high-level overview of the platform' },
  { title: 'Create your first agent', copy: 'Step-by-step guide to building an agent' },
  { title: 'Workflows 101', copy: 'Automate tasks with workflows' },
  { title: 'Connect your data', copy: 'Integrate and sync your data sources' },
  { title: 'Best practices', copy: 'Tips for building reliable agents' },
]

const staticRecommendedDocs = [
  { title: 'Core concepts', copy: 'Understand the basics of Aadml' },
  { title: 'Authentication guide', copy: 'Securely authenticate your requests' },
  { title: 'Rate limits', copy: 'Understand limits and best practices' },
  { title: 'Webhooks overview', copy: 'Real-time events and notifications' },
  { title: 'Error handling', copy: 'Handle errors like a pro' },
]

const helpLinks = [
  { title: 'Join our Discord', copy: 'Chat with the community', icon: 'lucide:message-circle', tone: 'blue', route: '/dashboard/help-center' },
  { title: 'Contact support', copy: 'Get help from our team', icon: 'lucide:life-buoy', tone: 'blue', route: '/dashboard/help-center/support' },
  { title: 'Feature requests', copy: 'Suggest and vote on features', icon: 'lucide:gem', tone: 'rose', route: '/dashboard/help-center/support?new=1' },
  { title: 'Status page', copy: 'View system status and uptime', icon: 'lucide:activity', tone: 'green', route: '/dashboard/help-center' },
]

const codeExample = `import { Aadml } from '@Aadml/sdk';

const client = new Aadml({
  apiKey: 'agntc_live_xxxxxxxxxxxxxxxxxxxxxxxx',
});

const run = await client.runs.create({
  agentId: 'agent_12345',
  input: { message: 'Summarize this document' },
});

console.log(run.status);`
</script>

<style scoped>
.docs-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 22px;
  min-height: 100%;
  padding: 28px 28px 54px;
  background: #f8fbff;
  color: #0f172a;
}

.docs-main {
  width: 100%;
  max-width: 1210px;
  justify-self: center;
}

.docs-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}

.docs-hero h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: 0;
}

.docs-hero p,
.api-card > p,
.panel > p,
.help-card > p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
}

.changelog-btn {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 9px;
  border: 1px solid #dbe4f0;
  border-radius: 9px;
  background: #fff;
  padding: 0 16px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 850;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.changelog-btn svg {
  width: 16px;
  height: 16px;
  color: #667085;
}

.docs-search {
  display: flex;
  align-items: center;
  gap: 13px;
  height: 54px;
  border: 1px solid #d8e2f0;
  border-radius: 10px;
  background: #fff;
  padding: 0 14px 0 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}

.docs-search svg {
  width: 18px;
  height: 18px;
  color: #94a3b8;
}

.docs-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.docs-search input::placeholder {
  color: #8b9bb1;
}

.docs-search kbd {
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
  padding: 3px 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}

.doc-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 13px;
  margin: 20px 0 24px;
}

.doc-tabs button {
  height: 36px;
  border: 1px solid #dbe4f0;
  border-radius: 9px;
  background: #fff;
  padding: 0 18px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 850;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}

.doc-tabs button.active {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.category-card,
.api-card,
.panel,
.rail-card {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 7px 20px rgba(15, 23, 42, .035);
}

.category-card {
  min-height: 150px;
  padding: 18px;
}

.category-icon,
.sdk-icon,
.doc-file,
.help-row > span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 10px;
}

.category-icon svg,
.sdk-icon svg {
  width: 22px;
  height: 22px;
}

.category-card h2,
.api-card h2,
.panel h2,
.rail-card h2 {
  margin: 13px 0 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 850;
}

.category-card span:not(.category-icon) {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.category-card p {
  margin: 13px 0 0;
  color: #475569;
  font-size: 12.5px;
  line-height: 1.55;
}

.blue { background: #eef4ff; color: #2563eb; }
.violet { background: #f2efff; color: #4f46e5; }
.teal { background: #e7fbf6; color: #0faaa5; }
.orange { background: #fff3e6; color: #f97316; }
.rose { background: #fff1f3; color: #f43f5e; }
.green { background: #e9fbf1; color: #10b981; }
.yellow { background: #fff8d8; color: #ca8a04; }
.white { background: #f8fafc; color: #2563eb; border: 1px solid #e5ebf3; }
.dark { background: #111827; color: #fff; }

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, .75fr);
  gap: 18px;
  margin-top: 18px;
}

.quickstart-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: center;
  min-height: 264px;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(135deg, #1f6df0 0%, #265ff1 50%, #3152e7 100%);
  color: #fff;
  padding: 28px;
  box-shadow: 0 14px 32px rgba(37, 99, 235, .18);
}

.quickstart-copy > span {
  color: rgba(255, 255, 255, .9);
  font-size: 14px;
  font-weight: 850;
}

.quickstart-card h2 {
  max-width: 440px;
  margin: 18px 0 0;
  font-size: 21px;
  line-height: 1.25;
  font-weight: 850;
  letter-spacing: 0;
}

.quickstart-card p {
  max-width: 500px;
  margin: 20px 0 26px;
  color: rgba(255, 255, 255, .92);
  font-size: 13px;
  line-height: 1.55;
}

.quickstart-card button,
.link-btn,
.help-center-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12.5px;
  font-weight: 850;
}

.quickstart-card button {
  height: 40px;
  border-radius: 8px;
  background: #fff;
  padding: 0 18px;
  color: #1e3a8a;
}

.quickstart-card svg,
.link-btn svg,
.help-center-link svg {
  width: 14px;
  height: 14px;
}

.quickstart-visual {
  position: relative;
  height: 190px;
  border: 1px solid rgba(255, 255, 255, .22);
  border-radius: 12px;
  background: rgba(255, 255, 255, .08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}

.window-dots {
  display: flex;
  gap: 7px;
  padding: 16px;
}

.window-dots i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .35);
}

.code-line {
  position: absolute;
  left: 32px;
  height: 5px;
  border-radius: 999px;
}

.code-line.a { top: 70px; width: 110px; background: #22d3ee; opacity: .55; }
.code-line.b { top: 88px; width: 190px; background: #a78bfa; opacity: .7; }
.code-line.c { top: 108px; width: 150px; background: #10b981; opacity: .62; }
.code-line.d { top: 130px; width: 220px; background: #60a5fa; opacity: .7; }

.play {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  width: 56px;
  height: 56px;
  transform: translate(-50%, -38%);
  place-items: center;
  border-radius: 999px;
  background: #fff;
  color: #2563eb;
  box-shadow: 0 18px 36px rgba(15, 23, 42, .25);
}

.play svg {
  width: 22px;
  height: 22px;
}

.api-card {
  padding: 20px;
}

.api-card h2,
.panel h2,
.rail-card h2 {
  margin-top: 0;
}

.api-list,
.sdk-list,
.article-list {
  margin-top: 18px;
}

.api-list button,
.sdk-list button,
.article-list button,
.rail-doc,
.help-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border: 0;
  border-top: 1px solid #edf2f7;
  background: transparent;
  padding: 10px 0;
  color: inherit;
  text-align: left;
}

.api-list button:first-child,
.article-list button:first-child,
.rail-doc:first-of-type {
  border-top: 0;
}

.doc-file {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  background: #f1f5f9;
  color: #94a3b8;
  border-radius: 7px;
}

.doc-file svg {
  width: 13px;
  height: 13px;
}

.api-list span:nth-child(2),
.article-list span:nth-child(2),
.rail-doc span:nth-child(2),
.help-row span:nth-child(2),
.sdk-list span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

strong,
small {
  display: block;
}

strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

small {
  margin-top: 3px;
  color: #64748b;
  font-size: 11.5px;
}

.api-list em,
.sdk-list em {
  border-radius: 7px;
  padding: 4px 9px;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 850;
}

.api-list em.get {
  background: #dcfce7;
  color: #16a34a;
}

.api-list em.post {
  background: #eaf1ff;
  color: #2563eb;
}

.sdk-list em {
  border: 1px solid #dbe4f0;
  background: #f8fafc;
  color: #64748b;
}

.bottom-grid {
  display: grid;
  grid-template-columns: minmax(260px, .8fr) minmax(0, 1.35fr) minmax(280px, .9fr);
  gap: 18px;
  margin-top: 18px;
}

.panel {
  padding: 20px;
}

.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.copy-btn {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 7px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 12px;
  color: #334155;
  font-size: 12px;
  font-weight: 850;
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

.sdk-list button {
  border-top: 0;
  padding: 10px 0;
}

.sdk-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 8px;
}

.sdk-icon svg {
  width: 22px;
  height: 22px;
}

.code-tabs {
  display: flex;
  gap: 4px;
  margin-top: 16px;
}

.code-tabs button {
  height: 29px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  padding: 0 12px;
  color: #475569;
  font-size: 12px;
  font-weight: 850;
}

.code-tabs button.active {
  background: #eef4ff;
  color: #2563eb;
}

pre {
  height: 176px;
  overflow: hidden;
  margin: 8px 0 0;
  border: 1px solid #e5ebf3;
  border-radius: 9px;
  background: #f8fafc;
  padding: 14px 16px;
  color: #be185d;
  font-size: 11.5px;
  line-height: 1.72;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  white-space: pre-wrap;
}

.docs-footnote {
  margin: 20px 0 0;
  text-align: center;
  color: #64748b;
  font-size: 12.5px;
}

.docs-footnote button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-weight: 850;
}

.docs-rail {
  display: grid;
  align-content: start;
  gap: 16px;
}

.rail-card {
  padding: 18px;
}

.on-page {
  position: sticky;
  top: 24px;
}

.on-page a {
  display: block;
  margin-top: 13px;
  padding-left: 12px;
  border-left: 2px solid transparent;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
}

.on-page a.active {
  border-color: #2563eb;
  color: #2563eb;
}

.rail-doc {
  padding: 10px 0;
}

.help-row {
  border-top: 0;
  padding: 10px 0;
}

.help-row > span:first-child {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 999px;
}

.help-row > span:first-child svg {
  width: 17px;
  height: 17px;
}

.help-row > svg {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.help-center-link {
  justify-content: space-between;
  width: 100%;
  height: 38px;
  margin-top: 12px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  padding: 0 13px;
  text-decoration: none;
}

.chat-fab {
  position: fixed;
  right: 30px;
  bottom: 28px;
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  box-shadow: 0 18px 35px rgba(37, 99, 235, .28);
}

.chat-fab svg {
  width: 25px;
  height: 25px;
}

@media (max-width: 1440px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1260px) {
  .docs-page {
    grid-template-columns: 1fr;
  }
  .docs-main {
    max-width: none;
  }
  .docs-rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .on-page {
    position: static;
  }
}

@media (max-width: 960px) {
  .hero-grid,
  .bottom-grid,
  .docs-rail {
    grid-template-columns: 1fr;
  }
  .quickstart-card {
    grid-template-columns: 1fr;
  }
  .quickstart-visual {
    margin-top: 22px;
  }
}

@media (max-width: 720px) {
  .docs-page {
    padding: 22px 16px 72px;
  }
  .docs-hero {
    flex-direction: column;
  }
  .category-grid {
    grid-template-columns: 1fr;
  }
  .docs-search kbd {
    display: none;
  }
}
</style>

