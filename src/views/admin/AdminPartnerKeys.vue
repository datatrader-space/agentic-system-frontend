<template>
  <div class="pk">
    <header class="pk-head">
      <div>
        <h1>Partner Agent API</h1>
        <p>Issue a bearer key to a partner so their app can create &amp; manage AI agents on-demand,
           inside that partner's own account and workspace. The key <strong>is</strong> the partner's
           identity — every agent it creates is owned by them.</p>
      </div>
      <button class="pk-btn" @click="openDocs">📖 Integration guide</button>
    </header>

    <!-- Issue a key -->
    <section class="pk-card">
      <div class="pk-card-h">
        <h2>Issue a key</h2>
        <span class="pk-sub">Pick the partner user, then generate. The full key is shown only once.</span>
      </div>

      <div class="pk-gen">
        <!-- Partner picker -->
        <div class="pk-picker">
          <input
            v-model="userQuery"
            class="pk-input"
            type="text"
            placeholder="Search partner by name or email…"
            @input="onSearch"
            @focus="showResults = true" />
          <div v-if="showResults && userResults.length" class="pk-results">
            <button
              v-for="u in userResults"
              :key="u.id"
              class="pk-result"
              @click="selectUser(u)">
              <span class="pk-result-name">{{ u.username }}</span>
              <span class="pk-result-mail">{{ u.email }}</span>
            </button>
          </div>
        </div>

        <input v-model="newName" class="pk-input pk-name" type="text" maxlength="120"
               placeholder="Label (e.g. “Acme integration”)" />

        <button class="pk-btn primary" :disabled="generating || !selectedUser" @click="generate">
          {{ generating ? 'Generating…' : 'Generate key' }}
        </button>
      </div>

      <div v-if="selectedUser" class="pk-selected">
        Partner: <strong>{{ selectedUser.username }}</strong>
        <span class="pk-result-mail">{{ selectedUser.email }}</span>
        <button class="pk-btn ghost sm" @click="clearUser">Change</button>
      </div>

      <!-- Freshly created key (shown once) -->
      <div v-if="freshKey" class="pk-fresh">
        <div class="pk-fresh-label">New key — copy it now, it won't be shown again. Share it with the partner securely.</div>
        <div class="pk-fresh-row">
          <code class="pk-key">{{ freshKey }}</code>
          <button class="pk-btn" @click="copy(freshKey)">Copy</button>
          <button class="pk-btn ghost" @click="freshKey = ''">Dismiss</button>
        </div>
      </div>
    </section>

    <!-- Existing keys -->
    <section class="pk-card">
      <div class="pk-card-h"><h2>Keys</h2></div>
      <div v-if="loading" class="pk-empty">Loading…</div>
      <div v-else-if="!keys.length" class="pk-empty">No keys yet. Issue one above.</div>
      <table v-else class="pk-table">
        <thead>
          <tr><th>Label</th><th>Partner</th><th>Key</th><th>Status</th><th>Requests</th><th>Last used</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="k in keys" :key="k.id" :class="{ revoked: k.revoked }">
            <td>{{ k.name || '—' }}</td>
            <td>
              <div class="pk-partner">{{ k.user_label || '—' }}</div>
            </td>
            <td><code class="pk-hint">{{ k.key_hint || '••••' }}</code></td>
            <td>
              <span class="pk-pill" :class="k.revoked ? 'rev' : 'act'">{{ k.revoked ? 'Revoked' : 'Active' }}</span>
            </td>
            <td>{{ k.request_count?.toLocaleString?.() ?? k.request_count }}</td>
            <td>{{ fmt(k.last_used_at) }}</td>
            <td>{{ fmt(k.created_at) }}</td>
            <td class="pk-actions">
              <button class="pk-btn sm" @click="rotate(k)">Rotate</button>
              <button v-if="!k.revoked" class="pk-btn sm" @click="toggle(k, true)">Revoke</button>
              <button v-else class="pk-btn sm" @click="toggle(k, false)">Reactivate</button>
              <button class="pk-btn danger sm" @click="remove(k)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Quick-start -->
    <section class="pk-card">
      <div class="pk-card-h">
        <h2>Quick start (for the partner)</h2>
        <button class="pk-btn" @click="download">⬇ Download guide (.md)</button>
      </div>
      <div class="pk-quick">
        <div><span class="pk-q-k">Base URL</span><code>{{ baseUrl }}</code></div>
        <div><span class="pk-q-k">Auth header</span><code>Authorization: Bearer &lt;key&gt;</code></div>
      </div>
      <ol class="pk-steps">
        <li><strong>Create</strong> — <code>POST {{ baseUrl }}</code> with <code>{"name":"…","prompt":"…","workspace_name":"…"}</code>.</li>
        <li><strong>List</strong> — <code>GET {{ baseUrl }}</code> → the partner's own agents.</li>
        <li><strong>Manage</strong> — <code>GET/PATCH/DELETE {{ baseUrl }}&lt;id&gt;/</code>, plus <code>/pause/</code> &amp; <code>/unpause/</code>.</li>
      </ol>
      <p class="pk-mini">Agents are owned by the partner's account. <code>workspace_name</code> places the agent
        in a named workspace (created if new); omit it to use the partner's default workspace.</p>
    </section>

    <!-- Docs drawer -->
    <div v-if="docsOpen" class="pk-drawer-mask" @click.self="docsOpen = false">
      <aside class="pk-drawer">
        <header class="pk-drawer-h">
          <h3>Partner Agent API — Integration Guide</h3>
          <div class="pk-drawer-actions">
            <button class="pk-btn" @click="download">⬇ Download</button>
            <button class="pk-btn ghost" @click="docsOpen = false">✕ Close</button>
          </div>
        </header>
        <div v-if="docsLoading" class="pk-empty">Loading documentation…</div>
        <div v-else class="pk-md" v-html="docsHtml"></div>
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
const baseUrl = ref('/api/partner/agents/')
const loading = ref(true)
const generating = ref(false)
const newName = ref('')
const freshKey = ref('')

// Partner picker
const userQuery = ref('')
const userResults = ref([])
const selectedUser = ref(null)
const showResults = ref(false)
let searchTimer = null

// Docs
const docsOpen = ref(false)
const docsLoading = ref(false)
const docsHtml = ref('')
let docsMd = ''

function fmt(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getPartnerKeys()
    keys.value = data.keys || []
    if (data.base_url) baseUrl.value = data.base_url
  } catch (e) {
    notify.error('Failed to load partner keys: ' + (e.response?.data?.detail || e.message))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  selectedUser.value = null
  clearTimeout(searchTimer)
  const q = userQuery.value.trim()
  if (!q) { userResults.value = []; return }
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await api.searchPartnerUsers(q)
      userResults.value = data.users || []
      showResults.value = true
    } catch { userResults.value = [] }
  }, 250)
}

function selectUser(u) {
  selectedUser.value = u
  userQuery.value = ''
  userResults.value = []
  showResults.value = false
}

function clearUser() {
  selectedUser.value = null
  userQuery.value = ''
}

async function generate() {
  if (!selectedUser.value) return
  generating.value = true
  try {
    const { data } = await api.createPartnerKey(selectedUser.value.id, newName.value.trim())
    freshKey.value = data.key
    newName.value = ''
    selectedUser.value = null
    notify.success('Key generated — copy it now')
    await load()
  } catch (e) {
    notify.error('Failed to generate: ' + (e.response?.data?.detail || e.response?.data?.error || e.message))
  } finally {
    generating.value = false
  }
}

async function toggle(k, revoked) {
  if (revoked) {
    const ok = await confirm({
      title: 'Revoke this key?',
      message: `“${k.name || k.key_hint}” will stop working immediately.`,
      confirmText: 'Revoke',
      danger: true,
    })
    if (!ok) return
  }
  try {
    await api.togglePartnerKey(k.id, revoked)
    notify.success(revoked ? 'Key revoked' : 'Key reactivated')
    await load()
  } catch (e) {
    notify.error('Failed: ' + (e.response?.data?.detail || e.message))
  }
}

async function rotate(k) {
  const ok = await confirm({
    title: 'Rotate this key?',
    message: `A new secret is issued and “${k.name || k.key_hint}” stops working immediately. Share the new value with the partner.`,
    confirmText: 'Rotate',
    danger: true,
  })
  if (!ok) return
  try {
    const { data } = await api.rotatePartnerKey(k.id)
    freshKey.value = data.key
    notify.success('Key rotated — copy the new value now')
    await load()
  } catch (e) {
    notify.error('Failed to rotate: ' + (e.response?.data?.detail || e.message))
  }
}

async function remove(k) {
  const ok = await confirm({
    title: 'Delete this key?',
    message: `“${k.name || k.key_hint}” will be permanently removed. This cannot be undone.`,
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deletePartnerKey(k.id)
    notify.success('Key deleted')
    await load()
  } catch (e) {
    notify.error('Failed to delete: ' + (e.response?.data?.detail || e.message))
  }
}

async function ensureDocs() {
  if (docsMd) return
  docsLoading.value = true
  try {
    const { data } = await api.getPartnerDocs()
    docsMd = data.content_md || ''
    docsHtml.value = marked.parse(docsMd)
  } catch (e) {
    docsHtml.value = '<p>Failed to load documentation.</p>'
    notify.error('Failed to load docs: ' + (e.response?.data?.detail || e.message))
  } finally {
    docsLoading.value = false
  }
}

async function openDocs() {
  docsOpen.value = true
  await ensureDocs()
}

async function download() {
  await ensureDocs()
  if (!docsMd) return
  const blob = new Blob([docsMd], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'PARTNER_AGENT_API.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  notify.success('Guide downloaded — share it with the partner')
}

function copy(text) {
  try { navigator.clipboard.writeText(text); notify.success('Copied') } catch { /* noop */ }
}

onMounted(load)
</script>

<style scoped>
.pk { padding: 32px 36px; max-width: 1100px; }
.pk-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.pk-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.pk-head p { color: #64748b; margin-top: 6px; font-size: 14px; max-width: 680px; line-height: 1.5; }

.pk-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-top: 20px; }
.pk-card-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.pk-card-h h2 { font-size: 15px; font-weight: 700; color: #0f172a; }
.pk-sub { font-size: 12px; color: #94a3b8; }

.pk-gen { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
.pk-picker { position: relative; flex: 1; min-width: 260px; }
.pk-input { width: 100%; border: 1px solid #cbd5e1; border-radius: 9px; padding: 9px 12px; font-size: 14px; color: #0f172a; }
.pk-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.pk-name { flex: 1; min-width: 200px; }
.pk-results { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.12); max-height: 260px; overflow-y: auto; }
.pk-result { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 9px 12px;
  border: none; background: none; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
.pk-result:hover { background: #f8fafc; }
.pk-result-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.pk-result-mail { font-size: 12px; color: #94a3b8; }
.pk-selected { margin-top: 12px; font-size: 13px; color: #334155; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.pk-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9px; padding: 8px 14px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap; }
.pk-btn:hover { border-color: #94a3b8; }
.pk-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.pk-btn.primary:hover { background: #4338ca; }
.pk-btn.primary:disabled { opacity: .5; cursor: default; }
.pk-btn.danger { color: #dc2626; border-color: #fecaca; }
.pk-btn.danger:hover { background: #fef2f2; }
.pk-btn.ghost { border-color: transparent; color: #64748b; }
.pk-btn.sm { padding: 5px 10px; font-size: 12px; }

.pk-fresh { margin-top: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 11px; padding: 14px; }
.pk-fresh-label { font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 8px; }
.pk-fresh-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.pk-key { flex: 1; min-width: 280px; background: #052e16; color: #86efac; padding: 9px 12px; border-radius: 8px;
  font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }

.pk-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pk-table th { text-align: left; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: .03em; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.pk-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.pk-table tr.revoked { opacity: .55; }
.pk-partner { font-size: 13px; color: #334155; }
.pk-hint { font-family: ui-monospace, monospace; color: #475569; }
.pk-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.pk-pill.act { background: #dcfce7; color: #15803d; }
.pk-pill.rev { background: #f1f5f9; color: #94a3b8; }
.pk-actions { text-align: right; white-space: nowrap; }
.pk-actions .pk-btn { margin-left: 6px; }
.pk-empty { color: #94a3b8; font-size: 13px; padding: 12px 4px; }

.pk-quick { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 14px; }
.pk-q-k { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.pk-quick code { font-family: ui-monospace, monospace; font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; }
.pk-steps { margin: 0 0 12px; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.9; }
.pk-steps code { font-family: ui-monospace, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 5px; color: #0f172a; }
.pk-mini { font-size: 12px; color: #64748b; line-height: 1.7; }
.pk-mini code { font-family: ui-monospace, monospace; background: #f8fafc; padding: 1px 5px; border-radius: 4px; }

.pk-drawer-mask { position: fixed; inset: 0; background: rgba(15,23,42,.4); z-index: 50; display: flex; justify-content: flex-end; }
.pk-drawer { width: min(760px, 92vw); height: 100%; background: #fff; box-shadow: -8px 0 32px rgba(0,0,0,.18); display: flex; flex-direction: column; }
.pk-drawer-h { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #e2e8f0; }
.pk-drawer-h h3 { font-size: 15px; font-weight: 700; color: #0f172a; }
.pk-drawer-actions { display: flex; gap: 8px; }
.pk-md { padding: 22px 26px; overflow-y: auto; font-size: 14px; color: #334155; line-height: 1.6; }
.pk-md :deep(h1) { font-size: 22px; font-weight: 800; margin: 8px 0 12px; color: #0f172a; }
.pk-md :deep(h2) { font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: #0f172a; }
.pk-md :deep(h3) { font-size: 14px; font-weight: 700; margin: 18px 0 8px; color: #1e293b; }
.pk-md :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.pk-md :deep(th), .pk-md :deep(td) { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
.pk-md :deep(code) { font-family: ui-monospace, monospace; font-size: 12.5px; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
.pk-md :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; overflow-x: auto; }
.pk-md :deep(pre code) { background: none; color: inherit; padding: 0; }
.pk-md :deep(a) { color: #4f46e5; }
</style>
