<template>
  <PublicLayout>
    <div class="docs-shell">
      <!-- ── Left: grouped nav ── -->
      <aside class="docs-side" :class="{ open: sidebarOpen }">
        <div class="side-search">
          <Icon icon="lucide:search" class="h-4 w-4 text-ink-faint" />
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
          </template>
        </nav>
      </aside>

      <button class="mobile-toggle lg:hidden" @click="sidebarOpen = true">
        <Icon icon="lucide:menu" class="h-5 w-5" /> Docs
      </button>

      <!-- ── Center: article ── -->
      <main class="docs-main">
        <div v-if="pageLoading" class="space-y-4 py-6">
          <div class="vm-skel h-9 w-2/5"></div>
          <div class="vm-skel h-4 w-4/5"></div>
          <div class="vm-skel h-4 w-3/5"></div>
        </div>

        <!-- Welcome (no slug) -->
        <div v-else-if="!currentPage && !currentSlug" class="welcome">
          <h1 class="welcome-title">AADML Documentation</h1>
          <p class="welcome-lead">Everything you need to build, deploy, and manage AI agents — from your first agent to production automation.</p>
          <div class="quick-grid">
            <router-link v-for="card in quickStartCards" :key="card.slug" :to="`/docs/${card.slug}`" class="quick-card">
              <span class="quick-ico">{{ card.icon }}</span>
              <div><h3>{{ card.title }}</h3><p>{{ card.desc }}</p></div>
            </router-link>
          </div>
        </div>

        <!-- 404 -->
        <div v-else-if="!currentPage && currentSlug" class="missing">
          <Icon icon="lucide:file-question" class="mx-auto h-12 w-12 text-ink-faint" />
          <h2>Page not found</h2>
          <p>The page “<code>{{ currentSlug }}</code>” doesn’t exist yet.</p>
          <router-link to="/docs" class="text-violet font-semibold">← Back to docs</router-link>
        </div>

        <!-- Article -->
        <article v-else class="article">
          <nav class="crumb">
            <router-link to="/docs">Docs</router-link>
            <Icon icon="lucide:chevron-right" class="h-3.5 w-3.5" />
            <span>{{ currentPage.title }}</span>
          </nav>

          <h1 class="article-title">{{ currentPage.title }}</h1>
          <p v-if="currentPage.excerpt" class="article-lead">{{ currentPage.excerpt }}</p>

          <div ref="articleEl" class="article-body" v-html="currentPage.content_html || ''"></div>

          <!-- prev / next -->
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

      <!-- ── Right: on-this-page + help ── -->
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
            <div class="help-top"><Icon icon="lucide:help-circle" class="h-5 w-5 text-violet" /> Need help?</div>
            <p>Join our community for real-time support and product updates.</p>
            <a href="/contact" class="help-link">Contact us <Icon icon="lucide:arrow-right" class="h-4 w-4" /></a>
          </div>
        </div>
      </aside>
    </div>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

const route = useRoute()
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
.docs-shell {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr) 232px;
  max-width: 1320px;
  margin: 0 auto;
  align-items: start;
}

/* ── Left nav ── */
.docs-side {
  position: sticky;
  top: 64px;
  align-self: start;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--vm-border);
  background: var(--vm-surface-soft);
  padding: 20px 14px;
}
.side-search {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 11px; background: var(--vm-surface);
  border: 1px solid var(--vm-border); margin-bottom: 14px;
}
.side-search input { flex: 1; border: none; outline: none; background: transparent; font-size: .85rem; color: var(--vm-ink); }
.side-close { border: none; background: none; cursor: pointer; color: var(--vm-ink-faint); }
.side-nav { overflow-y: auto; flex: 1; }
.nav-group { margin-bottom: 18px; }
.nav-group-label {
  font-size: .68rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--vm-ink-faint); padding: 0 10px 8px;
}
.nav-item {
  display: block; position: relative;
  padding: 7px 10px; border-radius: 8px;
  font-size: .875rem; color: var(--vm-ink-soft); text-decoration: none;
}
.nav-item:hover { color: var(--vm-ink); background: rgba(15,23,42,.04); }
.nav-item.active { color: var(--vm-primary); font-weight: 600; }
.nav-item .dot { position: absolute; left: 0; color: var(--vm-primary); }

.mobile-toggle {
  display: none; align-items: center; gap: 8px;
  position: fixed; bottom: 18px; left: 18px; z-index: 40;
  padding: 11px 16px; border-radius: 12px; border: none;
  font-weight: 600; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); cursor: pointer;
}

/* ── Center article ── */
.docs-main { min-width: 0; padding: 40px 56px 80px; }

.crumb { display: flex; align-items: center; gap: 6px; font-size: .82rem; color: var(--vm-ink-faint); margin-bottom: 18px; }
.crumb a { color: var(--vm-ink-soft); text-decoration: none; }
.crumb a:hover { color: var(--vm-primary); }

.article-title { font-family: var(--vm-font-display); font-size: 2.6rem; font-weight: 800; letter-spacing: -.02em; color: var(--vm-ink); line-height: 1.1; }
.article-lead { margin-top: 18px; font-size: 1.05rem; line-height: 1.7; color: var(--vm-ink-soft); }

.welcome { padding: 12px 0; }
.welcome-title { font-family: var(--vm-font-display); font-size: 2.4rem; font-weight: 800; color: var(--vm-ink); }
.welcome-lead { margin-top: 12px; font-size: 1.05rem; color: var(--vm-ink-soft); max-width: 640px; }
.quick-grid { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.quick-card { display: flex; gap: 14px; align-items: center; border: 1px solid var(--vm-border); border-radius: 14px; background: var(--vm-surface); padding: 18px; text-decoration: none; transition: transform .2s var(--vm-ease), box-shadow .2s, border-color .2s; }
.quick-card:hover { transform: translateY(-2px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.3); }
.quick-ico { font-size: 1.6rem; }
.quick-card h3 { font-weight: 700; color: var(--vm-ink); }
.quick-card p { font-size: .82rem; color: var(--vm-ink-soft); }

.missing { text-align: center; padding: 64px 0; }
.missing h2 { margin-top: 14px; font-size: 1.3rem; font-weight: 700; color: var(--vm-ink); }
.missing p { margin-top: 6px; color: var(--vm-ink-soft); }
.missing code { background: var(--vm-primary-soft); color: var(--vm-primary-d); padding: 1px 6px; border-radius: 5px; }

/* pager */
.pager { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--vm-border); display: flex; justify-content: space-between; gap: 16px; }
.pager-link { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border: 1px solid var(--vm-border); border-radius: 12px; text-decoration: none; transition: border-color .15s, transform .15s; max-width: 48%; }
.pager-link.next { text-align: right; align-items: flex-end; margin-left: auto; }
.pager-link:hover { border-color: var(--vm-primary); transform: translateY(-1px); }
.pager-cap { font-size: .72rem; color: var(--vm-ink-faint); text-transform: uppercase; letter-spacing: .05em; }
.pager-title { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--vm-primary); }

/* ── Right TOC ── */
.docs-toc { position: sticky; top: 64px; align-self: start; padding: 40px 16px; }
.toc-sticky { display: flex; flex-direction: column; gap: 20px; }
.toc-label { font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vm-ink-faint); }
.toc-list { list-style: none; margin: 8px 0 0; padding: 0; border-left: 1px solid var(--vm-border); }
.toc-list li a { display: block; padding: 5px 12px; font-size: .82rem; color: var(--vm-ink-soft); text-decoration: none; border-left: 2px solid transparent; margin-left: -1px; }
.toc-list li.sub a { padding-left: 22px; }
.toc-list li a:hover { color: var(--vm-ink); }
.toc-list li.active a { color: var(--vm-primary); border-left-color: var(--vm-primary); font-weight: 600; }

.help-card { border: 1px solid var(--vm-border); border-radius: 14px; background: var(--vm-primary-soft); padding: 16px; }
.help-top { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: .9rem; color: var(--vm-ink); }
.help-card p { margin-top: 8px; font-size: .8rem; color: var(--vm-ink-soft); line-height: 1.5; }
.help-link { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; font-size: .82rem; font-weight: 600; color: var(--vm-primary); text-decoration: none; }

/* ── Rendered markdown ── */
.article-body { margin-top: 28px; line-height: 1.75; color: var(--vm-ink-soft); }
.article-body :deep(h2) { scroll-margin-top: 80px; font-size: 1.5rem; font-weight: 800; color: var(--vm-ink); margin: 2.4rem 0 1rem; }
.article-body :deep(h3) { scroll-margin-top: 80px; font-size: 1.15rem; font-weight: 700; color: var(--vm-ink); margin: 1.8rem 0 .6rem; }
.article-body :deep(p) { margin-bottom: 1rem; }
.article-body :deep(a) { color: var(--vm-primary); text-decoration: none; }
.article-body :deep(a:hover) { text-decoration: underline; }
.article-body :deep(ul), .article-body :deep(ol) { padding-left: 1.4rem; margin-bottom: 1rem; }
.article-body :deep(li) { margin-bottom: .4rem; }
.article-body :deep(code) { background: var(--vm-primary-soft); color: var(--vm-primary-d); padding: .12rem .42rem; border-radius: 5px; font-size: .88em; font-family: 'JetBrains Mono', monospace; }
.article-body :deep(table) { width: 100%; border-collapse: collapse; margin: 1.2rem 0; }
.article-body :deep(th), .article-body :deep(td) { padding: .6rem 1rem; border: 1px solid var(--vm-border); text-align: left; }
.article-body :deep(th) { background: var(--vm-surface-soft); font-weight: 600; }
.article-body :deep(blockquote) { border-left: 3px solid var(--vm-primary); padding: .6rem 1.2rem; margin: 1rem 0; background: var(--vm-primary-soft); border-radius: 0 8px 8px 0; }

/* enhanced code blocks (injected wrapper) */
.article-body :deep(.code-block) { margin: 1.3rem 0; border: 1px solid var(--vm-border); border-radius: 12px; overflow: hidden; background: #0d1117; }
.article-body :deep(.code-bar) { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.08); }
.article-body :deep(.code-lang) { font-size: .72rem; font-family: 'JetBrains Mono', monospace; color: #8b949e; text-transform: capitalize; }
.article-body :deep(.code-copy) { font-size: .72rem; font-weight: 600; color: #8b949e; background: none; border: none; cursor: pointer; }
.article-body :deep(.code-copy:hover) { color: #e6edf3; }
.article-body :deep(.code-block pre) { margin: 0; border: none; border-radius: 0; background: #0d1117; color: #e6edf3; padding: 16px 18px; overflow-x: auto; font-size: .86rem; }
.article-body :deep(.code-block pre code) { background: none; color: inherit; padding: 0; }

@media (max-width: 1100px) {
  .docs-shell { grid-template-columns: 240px minmax(0, 1fr); }
  .docs-toc { display: none; }
  .docs-main { padding: 36px 32px 72px; }
}
@media (max-width: 860px) {
  .docs-shell { grid-template-columns: 1fr; }
  .docs-side { position: fixed; top: 0; left: 0; z-index: 70; width: 280px; height: 100vh; transform: translateX(-100%); transition: transform .25s var(--vm-ease2); box-shadow: var(--vm-shadow-l); }
  .docs-side.open { transform: translateX(0); }
  .mobile-toggle { display: inline-flex; }
  .docs-main { padding: 28px 20px 72px; }
  .quick-grid { grid-template-columns: 1fr; }
  .article-title { font-size: 2rem; }
}
</style>
