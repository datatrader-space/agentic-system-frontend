<template>
  <div class="docs-page">
    <!-- Sidebar -->
    <aside class="docs-sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <span class="sidebar-logo">📚</span>
          <div>
            <h2 class="sidebar-title">AADML Docs</h2>
            <span class="sidebar-version">v1.0</span>
          </div>
        </div>
        <button class="sidebar-close" @click="sidebarOpen = false">✕</button>
      </div>

      <!-- Search -->
      <div class="sidebar-search">
        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input v-model="searchQuery" type="text" placeholder="Search docs..." class="search-input" />
      </div>

      <nav class="docs-nav">
        <div v-if="loading" class="nav-loading">
          <div class="skeleton" v-for="i in 4" :key="i"></div>
        </div>
        <template v-else>
          <div v-for="item in filteredTree" :key="item.slug" class="nav-section">
            <router-link 
              :to="`/docs/${item.slug}`" 
              class="nav-item" 
              :class="{ active: currentSlug === item.slug }"
              @click="sidebarOpen = false"
            >
              <span class="nav-icon">{{ categoryIcon(item.category) }}</span>
              <span>{{ item.title }}</span>
            </router-link>
            <div v-if="item.children && item.children.length" class="nav-children">
              <router-link
                v-for="child in item.children"
                :key="child.slug"
                :to="`/docs/${child.slug}`"
                class="nav-item child"
                :class="{ active: currentSlug === child.slug }"
                @click="sidebarOpen = false"
              >
                {{ child.title }}
              </router-link>
            </div>
          </div>
        </template>
      </nav>
    </aside>

    <!-- Mobile toggle -->
    <button class="mobile-sidebar-toggle" @click="sidebarOpen = true">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
      </svg>
      <span>Docs Menu</span>
    </button>

    <!-- Content -->
    <main class="docs-content">
      <!-- Loading -->
      <div v-if="pageLoading" class="content-loading">
        <div class="skeleton-block" v-for="i in 3" :key="i"></div>
      </div>

      <!-- Welcome / Landing -->
      <div v-else-if="!currentPage && !currentSlug" class="docs-welcome">
        <div class="welcome-hero">
          <div class="welcome-glow"></div>
          <h1 class="welcome-title">
            <span class="gradient-text">AADML Documentation</span>
          </h1>
          <p class="welcome-subtitle">
            Everything you need to build, deploy, and manage AI agents.
          </p>
        </div>

        <div class="quick-links">
          <router-link 
            v-for="card in quickStartCards" 
            :key="card.slug" 
            :to="`/docs/${card.slug}`" 
            class="quick-card"
          >
            <span class="quick-icon">{{ card.icon }}</span>
            <div>
              <h3>{{ card.title }}</h3>
              <p>{{ card.desc }}</p>
            </div>
            <svg class="quick-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </router-link>
        </div>

        <div class="welcome-footer">
          <p>Can't find what you need? Use the search or <router-link to="/contact">contact us</router-link>.</p>
        </div>
      </div>

      <!-- 404 for slug not found -->
      <div v-else-if="!currentPage && currentSlug" class="content-empty">
        <span class="empty-icon">📄</span>
        <h2>Page not found</h2>
        <p>The documentation page "<code>{{ currentSlug }}</code>" doesn't exist yet.</p>
        <router-link to="/docs" class="back-link">← Back to docs</router-link>
      </div>

      <!-- Article -->
      <article v-else class="article">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <router-link to="/docs">Docs</router-link>
          <span class="breadcrumb-sep">/</span>
          <span v-if="currentPage.category" class="breadcrumb-cat">{{ currentPage.category }}</span>
          <span v-if="currentPage.category" class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">{{ currentPage.title }}</span>
        </div>

        <div class="article-header">
          <span class="article-category" v-if="currentPage.category">
            {{ categoryIcon(currentPage.category) }} {{ currentPage.category }}
          </span>
          <h1>{{ currentPage.title }}</h1>
          <p class="article-excerpt" v-if="currentPage.excerpt">{{ currentPage.excerpt }}</p>
        </div>
        <div class="article-body" v-html="currentPage.content_html || ''"></div>
        <div class="article-footer">
          <div class="article-meta" v-if="currentPage.updated_at">
            Last updated: {{ formatDate(currentPage.updated_at) }}
          </div>
          <div class="article-nav">
            <router-link v-if="prevPage" :to="`/docs/${prevPage.slug}`" class="nav-prev">
              ← {{ prevPage.title }}
            </router-link>
            <router-link v-if="nextPage" :to="`/docs/${nextPage.slug}`" class="nav-next">
              {{ nextPage.title }} →
            </router-link>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

const route = useRoute()

const tree = ref([])
const currentPage = ref(null)
const loading = ref(true)
const pageLoading = ref(false)
const searchQuery = ref('')
const sidebarOpen = ref(false)

const currentSlug = computed(() => route.params.slug || '')

useMeta({
  title: computed(() => currentPage.value ? `${currentPage.value.title} — AADML Docs` : 'Documentation — AADML'),
  description: computed(() => currentPage.value?.excerpt || 'AADML platform documentation — agents, tools, signals, MCP, and more.'),
})

const quickStartCards = [
  { slug: 'getting-started', icon: '🚀', title: 'Getting Started', desc: 'Set up your first agent in 5 minutes' },
  { slug: 'tools', icon: '🛠️', title: 'Tools', desc: '140+ built-in tools across 15+ categories' },
  { slug: 'signals', icon: '⚡', title: 'Signals & Schedules', desc: 'Automate agents with cron, webhooks, and events' },
  { slug: 'mcp', icon: '🔌', title: 'MCP Integration', desc: 'Connect external Model Context Protocol servers' },
  { slug: 'knowledge', icon: '🧠', title: 'Knowledge & Dream', desc: 'Agent memory, knowledge cards, and dream cycles' },
  { slug: 'api-reference', icon: '📡', title: 'API Reference', desc: 'REST API endpoints and authentication' },
]

const categoryIcons = {
  'Basics': '🚀',
  'Core': '🛠️',
  'Automation': '⚡',
  'Extensibility': '🔌',
  'Intelligence': '🧠',
  'Developers': '📡',
  'Security': '🔒',
}

function categoryIcon(cat) {
  return categoryIcons[cat] || '📄'
}

const filteredTree = computed(() => {
  if (!searchQuery.value.trim()) return tree.value
  const q = searchQuery.value.toLowerCase()
  return tree.value.filter(item => 
    item.title.toLowerCase().includes(q) ||
    (item.children || []).some(c => c.title.toLowerCase().includes(q))
  )
})

// Prev/next navigation
const flatPages = computed(() => {
  const flat = []
  tree.value.forEach(item => {
    flat.push(item)
    if (item.children) flat.push(...item.children)
  })
  return flat
})

const currentIndex = computed(() => flatPages.value.findIndex(p => p.slug === currentSlug.value))
const prevPage = computed(() => currentIndex.value > 0 ? flatPages.value[currentIndex.value - 1] : null)
const nextPage = computed(() => currentIndex.value >= 0 && currentIndex.value < flatPages.value.length - 1 ? flatPages.value[currentIndex.value + 1] : null)

onMounted(async () => {
  await loadTree()
  if (currentSlug.value) {
    await loadPage(currentSlug.value)
  }
})

watch(() => route.params.slug, async (slug) => {
  if (slug) {
    await loadPage(slug)
    window.scrollTo(0, 0)
  } else {
    currentPage.value = null
  }
})

async function loadTree() {
  try {
    loading.value = true
    const { data } = await api.get('/content/docs-tree/')
    tree.value = data.tree || []
  } catch (e) {
    console.warn('Docs: could not load tree', e.message)
    tree.value = [
      { slug: 'getting-started', title: 'Getting Started', category: 'Basics', children: [] },
      { slug: 'tools', title: 'Tools', category: 'Core', children: [] },
      { slug: 'signals', title: 'Signals & Schedules', category: 'Automation', children: [] },
      { slug: 'mcp', title: 'MCP Integration', category: 'Extensibility', children: [] },
      { slug: 'knowledge', title: 'Knowledge & Dream', category: 'Intelligence', children: [] },
      { slug: 'api-reference', title: 'API Reference', category: 'Developers', children: [] },
    ]
  } finally {
    loading.value = false
  }
}

async function loadPage(slug) {
  try {
    pageLoading.value = true
    const { data } = await api.get(`/content/pages/${slug}/`)
    currentPage.value = data.page
  } catch (e) {
    currentPage.value = null
  } finally {
    pageLoading.value = false
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.docs-page {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 100vh;
  background: var(--bg-body);
  color: var(--text-primary);
}

/* ═══ Sidebar ═══ */
.docs-sidebar {
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar-logo { font-size: 1.4rem; }

.sidebar-title {
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.sidebar-version {
  font-size: 0.7rem;
  color: var(--text-muted);
  background: rgba(139,92,246,0.1);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.sidebar-close { display: none; background: none; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; }

/* Search */
.sidebar-search {
  padding: 0.75rem 1.25rem;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.75rem 0.6rem 2.25rem;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
}

.search-input::placeholder { color: var(--text-muted); }

/* Nav */
.docs-nav {
  padding: 0.75rem 0;
  flex: 1;
  overflow-y: auto;
}

.nav-loading { padding: 1rem 1.5rem; }
.skeleton {
  height: 18px;
  border-radius: 6px;
  background: rgba(139,92,246,0.08);
  margin-bottom: 0.75rem;
  animation: pulse 1.5s ease infinite;
}
.skeleton:nth-child(2) { width: 70%; }
.skeleton:nth-child(3) { width: 85%; }

.nav-section { margin-bottom: 0.125rem; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 1.25rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}

.nav-icon { font-size: 0.9rem; }

.nav-item:hover {
  color: var(--text-primary);
  background: rgba(139, 92, 246, 0.04);
}

.nav-item.active {
  color: #8b5cf6;
  border-left-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  font-weight: 600;
}

.nav-item.child {
  padding-left: 2.75rem;
  font-size: 0.825rem;
}

/* ═══ Mobile ═══ */
.mobile-sidebar-toggle {
  display: none;
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 90;
  background: rgba(139, 92, 246, 0.9);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  gap: 0.5rem;
  align-items: center;
  box-shadow: 0 4px 20px rgba(139,92,246,0.4);
  backdrop-filter: blur(8px);
}

/* ═══ Content ═══ */
.docs-content {
  padding: 2.5rem 4rem;
  max-width: 860px;
  min-height: 100vh;
}

@keyframes pulse {
  0%,100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.content-loading { padding: 2rem 0; }
.skeleton-block {
  height: 20px;
  border-radius: 8px;
  background: rgba(139,92,246,0.06);
  margin-bottom: 1rem;
  animation: pulse 1.5s ease infinite;
}
.skeleton-block:first-child { width: 45%; height: 32px; }
.skeleton-block:nth-child(2) { width: 80%; }
.skeleton-block:nth-child(3) { width: 65%; }

/* ═══ Welcome ═══ */
.docs-welcome { padding: 1rem 0; }

.welcome-hero {
  text-align: center;
  padding: 3rem 0 2.5rem;
  position: relative;
}

.welcome-glow {
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: 400px; height: 200px;
  background: radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%);
  pointer-events: none;
}

.welcome-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  position: relative;
}

.gradient-text {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
  position: relative;
}

.quick-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.25rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.quick-card:hover {
  border-color: rgba(139,92,246,0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.quick-icon { font-size: 1.6rem; flex-shrink: 0; }

.quick-card h3 {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.quick-card p {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

.quick-arrow {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  margin-left: auto;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.quick-card:hover .quick-arrow { transform: translateX(3px); color: #8b5cf6; }

.welcome-footer {
  text-align: center;
  margin-top: 3rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.welcome-footer a { color: #8b5cf6; text-decoration: none; }
.welcome-footer a:hover { text-decoration: underline; }

/* ═══ Empty / 404 ═══ */
.content-empty {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
.content-empty h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
.content-empty p { color: var(--text-muted); }
.content-empty code { background: rgba(139,92,246,0.1); padding: 0.2rem 0.5rem; border-radius: 4px; }
.back-link { display: inline-block; margin-top: 1.5rem; color: #8b5cf6; text-decoration: none; font-weight: 600; }

/* ═══ Breadcrumb ═══ */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.breadcrumb a { color: #8b5cf6; text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb-sep { opacity: 0.4; }
.breadcrumb-current { color: var(--text-primary); font-weight: 500; }

/* ═══ Article ═══ */
.article-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.article-category {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.article-header h1 {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 0.5rem;
}

.article-excerpt {
  color: var(--text-muted);
  font-size: 1.1rem;
  line-height: 1.5;
}

.article-body {
  line-height: 1.85;
  font-size: 1rem;
}

.article-body :deep(h1) { font-size: 1.8rem; margin: 2.5rem 0 1rem; font-weight: 700; }
.article-body :deep(h2) { font-size: 1.4rem; margin: 2rem 0 0.8rem; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
.article-body :deep(h3) { font-size: 1.15rem; margin: 1.5rem 0 0.6rem; font-weight: 600; }
.article-body :deep(p) { margin-bottom: 1rem; color: var(--text-secondary, var(--text-primary)); }
.article-body :deep(ul), .article-body :deep(ol) { padding-left: 1.5rem; margin-bottom: 1rem; }
.article-body :deep(li) { margin-bottom: 0.5rem; }
.article-body :deep(code) {
  background: rgba(139, 92, 246, 0.12);
  padding: 0.15rem 0.45rem;
  border-radius: 5px;
  font-size: 0.88em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.article-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  margin: 1.25rem 0;
  font-size: 0.88rem;
}
.article-body :deep(pre code) { background: none; padding: 0; }
.article-body :deep(table) { width: 100%; border-collapse: collapse; margin: 1.25rem 0; border-radius: 8px; overflow: hidden; }
.article-body :deep(th), .article-body :deep(td) { padding: 0.65rem 1rem; border: 1px solid var(--border); text-align: left; }
.article-body :deep(th) { background: rgba(139, 92, 246, 0.08); font-weight: 600; font-size: 0.9rem; }
.article-body :deep(blockquote) {
  border-left: 3px solid #8b5cf6;
  padding: 0.75rem 1.25rem;
  margin: 1rem 0;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary, var(--text-muted));
}
.article-body :deep(a) { color: #8b5cf6; text-decoration: none; }
.article-body :deep(a:hover) { text-decoration: underline; }
.article-body :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }

/* ═══ Article Footer ═══ */
.article-footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.article-meta {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-bottom: 1.5rem;
}

.article-nav {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.nav-prev, .nav-next {
  padding: 0.75rem 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.15s ease;
}

.nav-prev:hover, .nav-next:hover {
  border-color: rgba(139,92,246,0.3);
  transform: translateY(-1px);
}

.nav-next { margin-left: auto; }

/* ═══ Responsive ═══ */
@media (max-width: 900px) {
  .docs-page { grid-template-columns: 1fr; }
  .docs-sidebar {
    position: fixed;
    top: 0; left: 0;
    width: 300px; height: 100vh;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }
  .docs-sidebar.open { transform: translateX(0); box-shadow: 0 0 40px rgba(0,0,0,0.5); }
  .sidebar-close { display: block; }
  .mobile-sidebar-toggle { display: flex; }
  .docs-content { padding: 2rem 1.5rem; }
  .quick-links { grid-template-columns: 1fr; }
  .welcome-title { font-size: 1.8rem; }
}
</style>
