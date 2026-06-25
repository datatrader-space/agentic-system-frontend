<template>
  <div class="cx">
    <header class="cx-head">
      <div>
        <h1>Crawler Export API</h1>
        <p>Issue bearer tokens that let a third party pull your crawled website data — one requested
           website at a time, only sources cleared for sharing.</p>
      </div>
      <button class="cx-toggle" :class="enabled ? 'on' : 'off'" :disabled="toggling" @click="toggle">
        <span class="cx-toggle-dot"></span>
        {{ toggling ? 'Saving…' : (enabled ? 'API enabled' : 'API disabled') }}
      </button>
    </header>

    <!-- Disabled hint -->
    <div v-if="!loading && !enabled" class="cx-note">
      The export API is currently <strong>disabled</strong> — all third-party requests get 403. Flip the
      switch above to start serving requests. Keys can still be generated below so they're ready first.
    </div>

    <!-- Generate -->
    <section class="cx-card">
      <div class="cx-card-h">
        <h2>Generate a token</h2>
        <span class="cx-sub">Each token is shown in full only once — copy it immediately.</span>
      </div>
      <div class="cx-gen">
        <input v-model="newName" class="cx-input" type="text" maxlength="120"
               placeholder="Label (e.g. “Partner X integration”)" @keyup.enter="generate" />
        <button class="cx-btn primary" :disabled="generating" @click="generate">
          {{ generating ? 'Generating…' : 'Generate token' }}
        </button>
      </div>

      <!-- Freshly created key (shown once) -->
      <div v-if="freshKey" class="cx-fresh">
        <div class="cx-fresh-label">New token — copy it now, it won't be shown again</div>
        <div class="cx-fresh-row">
          <code class="cx-key">{{ freshKey }}</code>
          <button class="cx-btn" @click="copy(freshKey)">Copy</button>
          <button class="cx-btn ghost" @click="freshKey = ''">Dismiss</button>
        </div>
      </div>
    </section>

    <!-- Existing keys -->
    <section class="cx-card">
      <div class="cx-card-h"><h2>Tokens</h2></div>
      <div v-if="loading" class="cx-empty">Loading…</div>
      <div v-else-if="!keys.length" class="cx-empty">No tokens yet. Generate one above.</div>
      <table v-else class="cx-table">
        <thead>
          <tr><th>Label</th><th>Token</th><th>Status</th><th>Requests</th><th>Last used</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="k in keys" :key="k.id" :class="{ revoked: k.revoked }">
            <td>{{ k.name || '—' }}</td>
            <td><code class="cx-hint">{{ k.key_hint || '••••' }}</code></td>
            <td>
              <span class="cx-pill" :class="k.revoked ? 'rev' : 'act'">{{ k.revoked ? 'Revoked' : 'Active' }}</span>
            </td>
            <td>{{ k.request_count?.toLocaleString?.() ?? k.request_count }}</td>
            <td>{{ fmt(k.last_used_at) }}</td>
            <td>{{ fmt(k.created_at) }}</td>
            <td class="cx-actions">
              <button v-if="!k.revoked" class="cx-btn danger sm" @click="revoke(k)">Revoke</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Integration / usage guide -->
    <section class="cx-card">
      <div class="cx-card-h">
        <h2>Integration &amp; usage guide</h2>
        <button class="cx-btn" @click="openDocs">📖 Open full documentation</button>
      </div>
      <div class="cx-quick">
        <div><span class="cx-q-k">Base URL</span><code>{{ baseUrl }}</code></div>
        <div><span class="cx-q-k">Auth header</span><code>Authorization: Bearer &lt;token&gt;</code></div>
      </div>
      <ol class="cx-steps">
        <li><strong>Search</strong> for a site — <code>GET {{ baseUrl }}/search?url=zameen.com</code> → confirms availability.</li>
        <li><strong>List pages</strong> — <code>GET {{ baseUrl }}/pages/?website=zameen.com&amp;limit=50</code> → cursor-paginated, filterable structured data.</li>
        <li><strong>Fetch a page</strong> — <code>GET {{ baseUrl }}/pages/&lt;id&gt;/</code> (JSON) or <code>/pages/&lt;id&gt;/html/</code> (raw HTML).</li>
      </ol>
      <p class="cx-mini">Filters: <code>availability</code>, <code>currency</code>, <code>min_price</code>, <code>max_price</code>,
        <code>language</code>, <code>status</code>, <code>has_snapshot</code>, <code>updated_after</code>, <code>q</code>, <code>fields</code>.
        Page forward by echoing back <code>next_cursor</code> as <code>?cursor=</code> until it is null.</p>
    </section>

    <!-- Docs drawer -->
    <div v-if="docsOpen" class="cx-drawer-mask" @click.self="docsOpen = false">
      <aside class="cx-drawer">
        <header class="cx-drawer-h">
          <h3>Crawl Export API — Integration Guide</h3>
          <button class="cx-btn ghost" @click="docsOpen = false">✕ Close</button>
        </header>
        <div v-if="docsLoading" class="cx-empty">Loading documentation…</div>
        <div v-else class="cx-md" v-html="docsHtml"></div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { confirm } from '../../composables/useConfirm'

const keys = ref([])
const enabled = ref(false)
const baseUrl = ref('/api/export/crawl')
const loading = ref(true)
const generating = ref(false)
const toggling = ref(false)
const newName = ref('')
const freshKey = ref('')

const docsOpen = ref(false)
const docsLoading = ref(false)
const docsHtml = ref('')

function fmt(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getCrawlerExportKeys()
    keys.value = data.keys || []
    enabled.value = !!data.enabled
    if (data.base_url) baseUrl.value = data.base_url
  } catch (e) {
    notify.error('Failed to load export keys: ' + (e.response?.data?.detail || e.message))
  } finally {
    loading.value = false
  }
}

async function toggle() {
  toggling.value = true
  try {
    const { data } = await api.toggleCrawlerExport(!enabled.value)
    enabled.value = !!data.enabled
    notify.success(enabled.value ? 'Export API enabled' : 'Export API disabled')
  } catch (e) {
    notify.error('Failed to update: ' + (e.response?.data?.detail || e.message))
  } finally {
    toggling.value = false
  }
}

async function generate() {
  generating.value = true
  try {
    const { data } = await api.createCrawlerExportKey(newName.value.trim())
    freshKey.value = data.key
    newName.value = ''
    notify.success('Token generated — copy it now')
    await load()
  } catch (e) {
    notify.error('Failed to generate: ' + (e.response?.data?.detail || e.message))
  } finally {
    generating.value = false
  }
}

async function revoke(k) {
  const ok = await confirm({
    title: 'Revoke this token?',
    message: `“${k.name || k.key_hint}” will stop working immediately. This cannot be undone.`,
    confirmText: 'Revoke',
    danger: true,
  })
  if (!ok) return
  try {
    await api.revokeCrawlerExportKey(k.id)
    notify.success('Token revoked')
    await load()
  } catch (e) {
    notify.error('Failed to revoke: ' + (e.response?.data?.detail || e.message))
  }
}

async function openDocs() {
  docsOpen.value = true
  if (docsHtml.value) return
  docsLoading.value = true
  try {
    const { data } = await api.getCrawlerExportDocs()
    docsHtml.value = marked.parse(data.content_md || '')
  } catch (e) {
    docsHtml.value = '<p>Failed to load documentation.</p>'
    notify.error('Failed to load docs: ' + (e.response?.data?.detail || e.message))
  } finally {
    docsLoading.value = false
  }
}

function copy(text) {
  try { navigator.clipboard.writeText(text); notify.success('Copied') } catch { /* noop */ }
}

onMounted(load)
</script>

<style scoped>
.cx { padding: 32px 36px; max-width: 1100px; }
.cx-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.cx-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.cx-head p { color: #64748b; margin-top: 6px; font-size: 14px; max-width: 680px; }
.cx-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;
  padding: 7px 14px; border-radius: 999px; white-space: nowrap; cursor: pointer; border: 1px solid transparent;
  transition: all .15s; }
.cx-toggle:disabled { opacity: .6; cursor: default; }
.cx-toggle.on { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
.cx-toggle.off { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
.cx-toggle-dot { width: 9px; height: 9px; border-radius: 999px; background: currentColor; }
.cx-toggle.on:hover { background: #bbf7d0; }
.cx-toggle.off:hover { background: #e2e8f0; }

.cx-note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 12px;
  padding: 14px 16px; font-size: 13px; margin-top: 20px; line-height: 1.5; }
.cx-note code { background: #fef3c7; padding: 1px 6px; border-radius: 5px; }

.cx-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-top: 20px; }
.cx-card-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.cx-card-h h2 { font-size: 15px; font-weight: 700; color: #0f172a; }
.cx-sub { font-size: 12px; color: #94a3b8; }

.cx-gen { display: flex; gap: 10px; flex-wrap: wrap; }
.cx-input { flex: 1; min-width: 240px; border: 1px solid #cbd5e1; border-radius: 9px; padding: 9px 12px;
  font-size: 14px; color: #0f172a; }
.cx-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }

.cx-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9px;
  padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
.cx-btn:hover { border-color: #94a3b8; }
.cx-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.cx-btn.primary:hover { background: #4338ca; }
.cx-btn.primary:disabled { opacity: .6; cursor: default; }
.cx-btn.danger { color: #dc2626; border-color: #fecaca; }
.cx-btn.danger:hover { background: #fef2f2; }
.cx-btn.ghost { border-color: transparent; color: #64748b; }
.cx-btn.sm { padding: 5px 10px; font-size: 12px; }

.cx-fresh { margin-top: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 11px; padding: 14px; }
.cx-fresh-label { font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 8px; }
.cx-fresh-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cx-key { flex: 1; min-width: 280px; background: #052e16; color: #86efac; padding: 9px 12px; border-radius: 8px;
  font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }

.cx-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cx-table th { text-align: left; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: .03em; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.cx-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.cx-table tr.revoked { opacity: .55; }
.cx-hint { font-family: ui-monospace, monospace; color: #475569; }
.cx-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.cx-pill.act { background: #dcfce7; color: #15803d; }
.cx-pill.rev { background: #f1f5f9; color: #94a3b8; }
.cx-actions { text-align: right; }
.cx-empty { color: #94a3b8; font-size: 13px; padding: 12px 4px; }

.cx-quick { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 14px; }
.cx-q-k { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.cx-quick code { font-family: ui-monospace, monospace; font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; }
.cx-steps { margin: 0 0 12px; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.9; }
.cx-steps code { font-family: ui-monospace, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 5px; color: #0f172a; }
.cx-mini { font-size: 12px; color: #64748b; line-height: 1.7; }
.cx-mini code { font-family: ui-monospace, monospace; background: #f8fafc; padding: 1px 5px; border-radius: 4px; }

.cx-drawer-mask { position: fixed; inset: 0; background: rgba(15,23,42,.4); z-index: 50; display: flex; justify-content: flex-end; }
.cx-drawer { width: min(760px, 92vw); height: 100%; background: #fff; box-shadow: -8px 0 32px rgba(0,0,0,.18);
  display: flex; flex-direction: column; }
.cx-drawer-h { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #e2e8f0; }
.cx-drawer-h h3 { font-size: 15px; font-weight: 700; color: #0f172a; }
.cx-md { padding: 22px 26px; overflow-y: auto; font-size: 14px; color: #334155; line-height: 1.6; }
.cx-md :deep(h1) { font-size: 22px; font-weight: 800; margin: 8px 0 12px; color: #0f172a; }
.cx-md :deep(h2) { font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: #0f172a; }
.cx-md :deep(h3) { font-size: 14px; font-weight: 700; margin: 18px 0 8px; color: #1e293b; }
.cx-md :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.cx-md :deep(th), .cx-md :deep(td) { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
.cx-md :deep(code) { font-family: ui-monospace, monospace; font-size: 12.5px; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
.cx-md :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; overflow-x: auto; }
.cx-md :deep(pre code) { background: none; color: inherit; padding: 0; }
.cx-md :deep(a) { color: #4f46e5; }
</style>
