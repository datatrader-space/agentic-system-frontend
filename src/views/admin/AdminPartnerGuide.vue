<template>
  <div class="pg admin-page">
    <header class="pg-head admin-page-header">
      <router-link to="/admin-dashboard/partner-keys" class="pg-back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Partner Agent API
      </router-link>
      <div class="pg-title-row">
        <div>
          <h1 class="admin-page-title">Partner API guide</h1>
          <p>Every endpoint a partner can call, and the integration guide to send them. Base URL
            <code>{{ fullBase }}</code></p>
        </div>
        <div class="pg-actions">
          <button class="pg-btn" @click="copy(fullBase, 'Base URL copied')">Copy base URL</button>
          <button class="pg-btn primary" :disabled="!md" @click="download">Download guide (.md)</button>
        </div>
      </div>
      <label class="pg-search">
        <span class="pg-sr">Search the guide</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input v-model="query" type="search" placeholder="Find an endpoint or a topic, e.g. connect, usage, return_url" />
      </label>
    </header>

    <div v-if="loading" class="pg-empty">Loading the guide…</div>
    <div v-else-if="error" class="pg-empty pg-error" role="alert">{{ error }}</div>

    <div v-else class="pg-body">
      <nav class="pg-toc" aria-label="Contents">
        <label class="pg-toc-mobile">
          <span class="pg-sr">Jump to</span>
          <select @change="jump($event.target.value)">
            <option value="">Jump to…</option>
            <option value="endpoints">Endpoints</option>
            <option v-for="h in visibleHeadings" :key="h.id" :value="h.id">{{ h.level === 3 ? '— ' : '' }}{{ h.text }}</option>
          </select>
        </label>
        <ul class="pg-toc-list">
          <li><a href="#endpoints" :class="{ active: activeId === 'endpoints' }" @click.prevent="jump('endpoints')">Endpoints</a></li>
          <li v-for="h in visibleHeadings" :key="h.id" :class="'lvl' + h.level">
            <a :href="'#' + h.id" :class="{ active: activeId === h.id }" @click.prevent="jump(h.id)">{{ h.text }}</a>
          </li>
        </ul>
      </nav>

      <main class="pg-main">
        <section id="endpoints" class="pg-card admin-surface" aria-labelledby="pg-endpoints-h">
          <h2 class="admin-section-title" id="pg-endpoints-h">Endpoints</h2>
          <p class="pg-muted">Send <code>Authorization: Bearer &lt;partner key&gt;</code> with each request. A partner only
            ever reaches its own agents; another partner's id answers 404.</p>
          <div v-if="!visibleGroups.length" class="pg-empty">No endpoint matches “{{ query }}”.</div>
          <div v-for="g in visibleGroups" :key="g.name" class="pg-group">
            <h3 class="admin-section-title">{{ g.name }}</h3>
            <ul class="pg-endpoints">
              <li v-for="e in g.rows" :key="e.method + e.path" class="pg-endpoint">
                <span class="pg-method" :class="e.method.toLowerCase()">{{ e.method }}</span>
                <code class="pg-path" v-html="breakable(e.path)"></code>
                <span class="pg-purpose" v-html="e.purposeHtml"></span>
                <button class="pg-btn sm" :aria-label="`Copy ${e.method} ${e.path}`"
                        @click="copy(`${e.method} ${absolute(e.path)}`)">Copy</button>
              </li>
            </ul>
          </div>
        </section>

        <article ref="article" class="pg-card pg-md admin-surface" v-html="guideHtml"></article>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { saveBlob } from '../../utils/saveBlob'

const loading = ref(true)
const error = ref('')
const md = ref('')
const baseUrl = ref('/api/partner/agents/')
const query = ref('')
const activeId = ref('endpoints')
const article = ref(null)
const route = useRoute()

const fullBase = computed(() => `${window.location.origin}${baseUrl.value}`)

function slug(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
}

// A path may wrap after a slash, never inside a word. Escaped first: the text comes from the guide.
function breakable(path) {
  const esc = path.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\//g, '/<wbr>')
}

function absolute(path) {
  return path.startsWith('/') ? `${window.location.origin}${path}` : path
}

// The endpoint reference is read from the guide's own "Endpoints" table, so the page and the guide can never
// disagree. Each row is `| METHOD | path | purpose |`.
const endpoints = computed(() => {
  const section = md.value.split(/^## /m).find((s) => /^\d+\.\s+Endpoints/.test(s)) || ''
  const rows = []
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 5) continue
    const method = cells[1].replace(/`/g, '')
    const path = cells[2].replace(/`/g, '')
    if (!/^(GET|POST|PUT|PATCH|DELETE|WS)$/.test(method)) continue
    rows.push({ method, path, purpose: cells[3].replace(/\*\*/g, ''), purposeHtml: marked.parseInline(cells[3]) })
  }
  return rows
})

function groupOf(path) {
  if (path.includes('/connections')) return 'Connections'
  if (path.includes('/usage')) return 'Usage and cost'
  if (path.includes('tools')) return 'Tools'
  if (path.startsWith('/ws/')) return 'Chat'
  return 'Agents'
}
const GROUP_ORDER = ['Agents', 'Connections', 'Tools', 'Usage and cost', 'Chat']

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const groups = new Map(GROUP_ORDER.map((name) => [name, []]))
  for (const e of endpoints.value) {
    if (q && !`${e.method} ${e.path} ${e.purpose}`.toLowerCase().includes(q)) continue
    groups.get(groupOf(e.path)).push(e)
  }
  return GROUP_ORDER.map((name) => ({ name, rows: groups.get(name) })).filter((g) => g.rows.length)
})

// Guide sections: h2 and h3, with ids the contents list links to.
const headings = computed(() => {
  const out = []
  for (const t of marked.lexer(md.value)) {
    if (t.type === 'heading' && (t.depth === 2 || t.depth === 3)) out.push({ level: t.depth, text: t.text.replace(/[`*]/g, ''), id: slug(t.text) })
  }
  return out
})
const visibleHeadings = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return headings.value
  const body = md.value.split(/^#{2,3} /m)
  return headings.value.filter((h) => {
    const chunk = body.find((s) => s.replace(/[`*]/g, '').startsWith(h.text)) || h.text
    return chunk.toLowerCase().includes(q)
  })
})

const guideHtml = computed(() => {
  const renderer = new marked.Renderer()
  renderer.heading = function ({ tokens, depth, text }) {
    return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>`
  }
  // The first heading is the guide's own title; the page already has one.
  const body = md.value.replace(/^# .*\n/, '')
  return marked.parse(body, { renderer })
})

function addCopyButtons() {
  const root = article.value
  if (!root) return
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.pg-code-copy')) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pg-code-copy'
    btn.textContent = 'Copy'
    btn.setAttribute('aria-label', 'Copy this example')
    btn.addEventListener('click', () => copy((pre.querySelector('code') || pre).textContent.replace(/Copy$/, '')))
    pre.appendChild(btn)
  })
}

function jump(id) {
  if (!id) return
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    activeId.value = id
  }
}

let observer = null
function watchSections() {
  observer?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver((entries) => {
    const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    if (seen.length) activeId.value = seen[0].target.id
  }, { rootMargin: '0px 0px -70% 0px' })
  for (const id of ['endpoints', ...headings.value.map((h) => h.id)]) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
}

function copy(text, message = 'Copied') {
  try { navigator.clipboard.writeText(text); notify.success(message) } catch { /* noop */ }
}

function download() {
  saveBlob(new Blob([md.value], { type: 'text/markdown;charset=utf-8' }), 'PARTNER_AGENT_API.md')
  notify.success('Guide downloaded — share it with the partner')
}

watch(guideHtml, async () => {
  await nextTick()
  addCopyButtons()
  watchSections()
  // A link to one section (#…) arrives before the guide has loaded: go there once it has.
  if (route.hash) jump(decodeURIComponent(route.hash.slice(1)))
})

onMounted(async () => {
  try {
    const { data } = await api.getPartnerDocs()
    md.value = data.content_md || ''
    if (data.base_url) baseUrl.value = data.base_url
  } catch (e) {
    error.value = 'The guide could not be loaded: ' + (e.response?.data?.detail || e.message)
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.pg { padding: 28px 36px 64px; max-width: 1240px; }
.pg-back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--admin-muted, #475569); text-decoration: none; }
.pg-back:hover { color: #4f46e5; }
.pg-back svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
.pg-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
.pg-head h1 { font-size: 24px; font-weight: 800; color: var(--admin-ink, #0f172a); }
.pg-head p { color: var(--admin-muted, #475569); margin-top: 6px; font-size: 14px; line-height: 1.5; }
.pg-head p code { font-family: ui-monospace, monospace; font-size: 13px; background: var(--admin-soft, #f1f5f9); padding: 2px 6px; border-radius: 6px; color: var(--admin-ink, #0f172a); word-break: break-all; }
.pg-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.pg-search { position: relative; display: block; margin-top: 18px; max-width: 560px; }
.pg-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; fill: none; stroke: var(--admin-muted, #64748b); stroke-width: 2; }
.pg-search input { width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px 10px 36px; font-size: 14px; color: var(--admin-ink, #0f172a); background: var(--admin-surface, #fff); }
.pg-search input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
.pg-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.pg-btn { border: 1px solid #cbd5e1; background: var(--admin-surface, #fff); color: var(--admin-ink, #334155); border-radius: 9px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: border-color .15s, background-color .15s; }
.pg-btn:hover { border-color: #94a3b8; }
.pg-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,.25); }
.pg-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.pg-btn.primary:hover { background: #4338ca; }
.pg-btn:disabled { opacity: .5; cursor: default; }
.pg-btn.sm { padding: 5px 10px; font-size: 12px; }

.pg-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; margin-top: 24px; align-items: start; }
.pg-toc { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
.pg-toc-mobile { display: none; }
.pg-toc-list { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--admin-line, #e2e8f0); }
.pg-toc-list a { display: block; padding: 5px 12px; font-size: 13px; color: var(--admin-muted, #475569); text-decoration: none; border-left: 2px solid transparent; margin-left: -1px; line-height: 1.4; }
.pg-toc-list li.lvl3 a { padding-left: 24px; font-size: 12px; }
.pg-toc-list a:hover { color: var(--admin-ink, #0f172a); }
.pg-toc-list a.active { color: #4f46e5; border-left-color: #4f46e5; font-weight: 600; }
.pg-toc-list a:focus-visible { outline: none; box-shadow: inset 0 0 0 2px rgba(79,70,229,.35); border-radius: 4px; }

.pg-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.pg-card { background: var(--admin-surface, #fff); border: 1px solid var(--admin-line, #e2e8f0); border-radius: 14px; padding: 22px 26px; scroll-margin-top: 16px; }
.pg-card h2 { font-size: 18px; font-weight: 700; color: var(--admin-ink, #0f172a); }
.pg-muted { font-size: 13px; color: var(--admin-muted, #475569); margin-top: 6px; line-height: 1.6; }
.pg-muted code { font-family: ui-monospace, monospace; font-size: 12px; background: var(--admin-soft, #f1f5f9); padding: 1px 5px; border-radius: 4px; }
.pg-group { margin-top: 18px; }
.pg-group h3 { font-size: 13px; font-weight: 700; color: var(--admin-ink, #334155); margin-bottom: 6px; }
.pg-endpoints { list-style: none; margin: 0; padding: 0; border: 1px solid var(--admin-line, #e2e8f0); border-radius: 10px; overflow: hidden; }
.pg-endpoint { display: grid; grid-template-columns: 64px minmax(0, 1.1fr) minmax(0, 1.4fr) auto; gap: 12px; align-items: center; padding: 10px 12px; border-top: 1px solid #f1f5f9; }
.pg-endpoint:first-child { border-top: none; }
.pg-endpoint:hover { background: var(--admin-soft, #f8fafc); }
.pg-method { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; text-align: center; padding: 3px 0; border-radius: 6px; }
.pg-method.get { background: #dbeafe; color: #1d4ed8; }
.pg-method.post { background: #dcfce7; color: #15803d; }
.pg-method.patch, .pg-method.put { background: #fef3c7; color: #b45309; }
.pg-method.delete { background: #fee2e2; color: #b91c1c; }
.pg-method.ws { background: #ede9fe; color: #6d28d9; }
.pg-path { font-family: ui-monospace, monospace; font-size: 12.5px; color: var(--admin-ink, #0f172a); overflow-wrap: anywhere; }
.pg-purpose { font-size: 13px; color: var(--admin-muted, #475569); line-height: 1.5; }
.pg-purpose :deep(code) { font-family: ui-monospace, monospace; font-size: 12px; background: var(--admin-soft, #f1f5f9); padding: 1px 4px; border-radius: 4px; }
.pg-empty { color: var(--admin-muted, #64748b); font-size: 13px; padding: 12px 4px; }
.pg-error { color: #b91c1c; }

.pg-md { font-size: 14px; color: var(--admin-ink, #334155); line-height: 1.7; }
.pg-md :deep(h2) { font-size: 19px; font-weight: 700; color: var(--admin-ink, #0f172a); margin: 32px 0 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; scroll-margin-top: 16px; }
.pg-md :deep(h2:first-child) { margin-top: 0; border-top: none; padding-top: 0; }
.pg-md :deep(h3) { font-size: 15px; font-weight: 700; color: var(--admin-ink, #1e293b); margin: 24px 0 8px; scroll-margin-top: 16px; }
.pg-md :deep(h4) { font-size: 14px; font-weight: 700; color: var(--admin-ink, #1e293b); margin: 18px 0 6px; }
.pg-md :deep(p), .pg-md :deep(ul), .pg-md :deep(ol) { margin: 8px 0; max-width: 78ch; }
.pg-md :deep(ul), .pg-md :deep(ol) { padding-left: 20px; }
.pg-md :deep(table) { display: block; overflow-x: auto; border-collapse: collapse; margin: 12px 0; font-size: 13px; max-width: 100%; }
.pg-md :deep(th), .pg-md :deep(td) { border: 1px solid var(--admin-line, #e2e8f0); padding: 6px 10px; text-align: left; vertical-align: top; }
.pg-md :deep(th) { background: var(--admin-soft, #f8fafc); color: var(--admin-ink, #334155); }
.pg-md :deep(code) { font-family: ui-monospace, monospace; font-size: 12.5px; background: var(--admin-soft, #f1f5f9); padding: 1px 5px; border-radius: 4px; color: var(--admin-ink, #0f172a); }
.pg-md :deep(pre) { position: relative; background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; overflow-x: auto; margin: 12px 0; }
.pg-md :deep(pre code) { background: none; color: inherit; padding: 0; font-size: 12.5px; }
.pg-md :deep(.pg-code-copy) { position: absolute; top: 8px; right: 8px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; border-radius: 7px; padding: 3px 9px; font-size: 11px; font-weight: 600; cursor: pointer; }
.pg-md :deep(.pg-code-copy:hover) { background: #334155; }
.pg-md :deep(.pg-code-copy:focus-visible) { outline: none; box-shadow: 0 0 0 2px #a5b4fc; }
.pg-md :deep(a) { color: #4f46e5; }
.pg-md :deep(hr) { border: none; border-top: 1px solid var(--admin-line, #e2e8f0); margin: 20px 0; }

@media (max-width: 1023px) {
  .pg { padding: 20px 16px 48px; }
  .pg-body { grid-template-columns: 1fr; gap: 16px; }
  .pg-toc { position: static; max-height: none; }
  .pg-toc-list { display: none; }
  .pg-toc-mobile { display: block; }
  .pg-toc-mobile select { width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 12px; font-size: 14px; background: var(--admin-surface, #fff); color: var(--admin-ink, #0f172a); }
  .pg-card { padding: 18px 16px; }
  .pg-endpoint { grid-template-columns: 56px minmax(0, 1fr) auto; }
  .pg-endpoint .pg-btn { grid-row: 1; grid-column: 3; }
  .pg-purpose { grid-column: 2 / 4; grid-row: 2; }
}
@media (prefers-reduced-motion: reduce) { .pg-btn { transition: none; } }
</style>
