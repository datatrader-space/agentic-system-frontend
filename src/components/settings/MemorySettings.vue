<template>
  <div class="panel">
    <!-- Hierarchy explainer -->
    <div class="card explain">
      <div class="explain-icon"><Brain :size="18" :stroke-width="2" /></div>
      <div>
        <h3 class="card-title">Memory &amp; Context</h3>
        <p class="card-sub" style="margin:0">
          Account settings control the default memory behavior. Each agent can also have its own memory
          settings — an agent only remembers when both this account switch and the agent's own switch are on.
        </p>
      </div>
    </div>

    <!-- Loading / error -->
    <div v-if="loading" class="card muted">Loading memory settings…</div>
    <div v-else-if="loadError" class="card error-card">
      <span>Couldn't load your memory settings.</span>
      <button class="btn-ghost" @click="loadSettings">Retry</button>
    </div>

    <template v-else>
      <!-- Master + account toggles -->
      <div class="card">
        <h3 class="card-title">Account memory</h3>
        <p class="card-sub">Turn memory on or off for your whole account.</p>

        <div class="row">
          <div>
            <div class="row-label">Memory master switch</div>
            <div class="row-hint">When off, no agent reads or writes any memory, regardless of its own settings.</div>
          </div>
          <button type="button" role="switch" :aria-checked="String(!!s.memory_enabled)"
                  class="sw" :class="s.memory_enabled ? 'on' : 'off'"
                  @click="set('memory_enabled', !s.memory_enabled)"><span class="knob" /></button>
        </div>

        <div class="nested" :class="{ off: !s.memory_enabled }">
          <div v-for="t in accountToggles" :key="t.key" class="row" :class="{ 'is-disabled': !s.memory_enabled }">
            <div>
              <div class="row-label">{{ t.label }}</div>
              <div class="row-hint">{{ t.hint }}</div>
            </div>
            <button type="button" role="switch" :aria-checked="String(!!s[t.key])"
                    class="sw" :class="[s[t.key] ? 'on' : 'off', !s.memory_enabled ? 'sw-disabled' : '']"
                    :disabled="!s.memory_enabled"
                    @click="set(t.key, !s[t.key])"><span class="knob" /></button>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="card">
        <h3 class="card-title">Conversation history</h3>
        <p class="card-sub">How much recent conversation agents see by default.</p>

        <div class="row">
          <div>
            <div class="row-label">Use conversation history</div>
            <div class="row-hint">Off = each turn starts fresh with no prior messages.</div>
          </div>
          <button type="button" role="switch" :aria-checked="String(!!s.history_enabled)"
                  class="sw" :class="s.history_enabled ? 'on' : 'off'"
                  @click="set('history_enabled', !s.history_enabled)"><span class="knob" /></button>
        </div>
        <div class="row" :class="{ 'is-disabled': !s.history_enabled }">
          <div>
            <div class="row-label">Default history behavior</div>
            <div class="row-hint">Auto = token-bounded recent window · Manual = last N messages.</div>
          </div>
          <div class="seg">
            <button class="seg-btn" :class="{ active: s.history_mode === 'auto' }" :disabled="!s.history_enabled" @click="set('history_mode', 'auto')">Auto</button>
            <button class="seg-btn" :class="{ active: s.history_mode === 'manual' }" :disabled="!s.history_enabled" @click="set('history_mode', 'manual')">Manual</button>
          </div>
        </div>
        <div v-if="s.history_mode === 'manual'" class="row" :class="{ 'is-disabled': !s.history_enabled }">
          <div>
            <div class="row-label">Messages to keep</div>
            <div class="row-hint">The last N messages included each turn.</div>
          </div>
          <input class="num" type="number" min="0" :value="s.max_history_messages ?? 0" :disabled="!s.history_enabled"
                 @change="set('max_history_messages', Math.max(0, parseInt($event.target.value || 0)))" />
        </div>
      </div>

      <!-- Limits -->
      <div class="card">
        <h3 class="card-title">Global memory limits</h3>
        <p class="card-sub">Storage isn't injection — older memories stay saved and searchable; only the most recent are kept in context.</p>
        <div class="row">
          <div>
            <div class="row-label">Active memory cap</div>
            <div class="row-hint">How many of your most recent global memories the agent keeps in context (the rest stay stored &amp; searchable).</div>
          </div>
          <input class="num" type="number" min="1" :value="s.global_memory_active_cap ?? 100"
                 @change="set('global_memory_active_cap', Math.max(1, parseInt($event.target.value || 100)))" />
        </div>
      </div>

      <!-- Advanced — memory summary (digest) -->
      <div class="card">
        <h3 class="card-title">Advanced — memory summary</h3>
        <p class="card-sub">Agents read a compact summary of your memories, not every row. This controls how it's built.</p>
        <div class="row">
          <div>
            <div class="row-label">Summary mode</div>
            <div class="row-hint">Exact = verbatim bullets (no AI, fully traceable). Compressed = an AI folds global &amp; agent memories into a shorter summary.</div>
          </div>
          <div class="seg">
            <button class="seg-btn" :class="{ active: (s.digest_mode || 'deterministic') === 'deterministic' }" @click="setDigestMode('deterministic')">Exact</button>
            <button class="seg-btn" :class="{ active: s.digest_mode === 'llm_compressed' }" @click="setDigestMode('llm_compressed')">Compressed</button>
          </div>
        </div>
        <div class="row">
          <div>
            <div class="row-label">Regenerate summaries</div>
            <div class="row-hint">Rebuild every memory summary from your current memory rows. Safe — your memories aren't changed.</div>
          </div>
          <button class="btn-ghost" :disabled="regenBusy" @click="regenerate">{{ regenBusy ? 'Rebuilding…' : 'Regenerate' }}</button>
        </div>
      </div>

      <!-- Global memory summary (the generated digest that agents actually read) -->
      <div class="card">
        <div class="gm-head">
          <div>
            <h3 class="card-title">Global memory summary</h3>
            <p class="card-sub" style="margin:0">The compact summary your agents read each turn (built from your memories below).</p>
          </div>
          <span v-if="digest" class="dg-badge">{{ digest.mode === 'compressed' ? 'AI-compressed' : 'Exact' }} · {{ digest.source_count }} memories</span>
        </div>
        <div v-if="digestLoading" class="dg-generating">
          <span class="dg-spin" />
          {{ s.digest_mode === 'llm_compressed' ? 'Memory summary is being generated…' : 'Loading summary…' }}
        </div>
        <pre v-else-if="digest && digest.content" class="dg-pre">{{ digest.content }}</pre>
        <div v-else class="muted">No summary yet — add a global memory below.</div>
      </div>

      <!-- Global Memories CRUD -->
      <div class="card">
        <div class="gm-head">
          <div>
            <h3 class="card-title">Global memories</h3>
            <p class="card-sub" style="margin:0">Facts and preferences agents can use across all your chats.</p>
          </div>
          <button class="btn-primary" @click="startAdd"><Plus :size="15" :stroke-width="2" /> Add memory</button>
        </div>

        <!-- Add / edit form -->
        <div v-if="editing" class="gm-form">
          <textarea v-model="draft.content" rows="2" placeholder="e.g. I prefer concise, implementation-ready answers." class="gm-textarea" />
          <div class="gm-form-actions">
            <label class="gm-field">Type
              <select v-model="draft.kind" class="gm-select">
                <option v-for="k in KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
              </select>
            </label>
            <label class="gm-pin"><input type="checkbox" v-model="draft.pinned" /> Pin</label>
            <span class="spacer" />
            <button class="btn-ghost" @click="cancelEdit">Cancel</button>
            <button class="btn-primary" :disabled="!draft.content.trim() || busy" @click="saveDraft">{{ draft.id ? 'Save' : 'Add' }}</button>
          </div>
        </div>

        <!-- Search -->
        <div v-if="memories.length || query" class="gm-search">
          <Search :size="15" :stroke-width="2" class="gm-search-icon" />
          <input v-model="query" placeholder="Search memories…" @input="debouncedLoad" />
        </div>

        <!-- List states -->
        <div v-if="listLoading" class="muted gm-empty">Loading…</div>
        <div v-else-if="!memories.length" class="gm-empty">
          <Brain :size="22" :stroke-width="1.6" class="text-[#cbd5e1]" />
          <p>{{ query ? 'No memories match your search.' : 'No global memories yet. Add one to get started.' }}</p>
        </div>

        <ul v-else class="gm-list">
          <li v-for="m in pagedMemories" :key="m.id" class="gm-item" :class="{ archived: m.status === 'archived' }">
            <button class="gm-pin-btn" :class="{ active: m.pinned }" :title="m.pinned ? 'Unpin' : 'Pin'" @click="togglePin(m)">
              <Pin :size="14" :stroke-width="2" />
            </button>
            <div class="gm-body">
              <p class="gm-content">{{ m.content }}</p>
              <div class="gm-meta">
                <span class="gm-tag">{{ kindLabel(m.kind) }}</span>
                <span v-if="m.status === 'archived'" class="gm-tag warn">archived</span>
                <span class="gm-dot">·</span>
                <span>{{ m.created_by === 'user' ? 'You' : m.created_by }}</span>
                <span class="gm-dot">·</span>
                <span>{{ fmtDate(m.updated_at || m.created_at) }}</span>
              </div>
            </div>
            <div class="gm-actions">
              <button class="gm-act" title="Edit" @click="startEdit(m)"><Pencil :size="14" :stroke-width="2" /></button>
              <button class="gm-act" :title="m.status === 'archived' ? 'Restore' : 'Archive'" @click="toggleArchive(m)">
                <ArchiveRestore v-if="m.status === 'archived'" :size="14" :stroke-width="2" />
                <Archive v-else :size="14" :stroke-width="2" />
              </button>
              <button class="gm-act danger" title="Delete" @click="remove(m)"><Trash2 :size="14" :stroke-width="2" /></button>
            </div>
          </li>
        </ul>

        <!-- Pagination — 10 per page -->
        <div v-if="memories.length > PAGE_SIZE" class="gm-pager">
          <button class="gm-page-btn" :disabled="page <= 1" @click="page--">Previous</button>
          <span class="gm-page-info">Page {{ page }} of {{ totalPages }} · {{ memories.length }} total</span>
          <button class="gm-page-btn" :disabled="page >= totalPages" @click="page++">Next</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Archive, ArchiveRestore, Brain, Pencil, Pin, Plus, Search, Trash2 } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { confirm } from '../../composables/useConfirm'

// Account sub-toggles (rendered inline so scoped styles apply — a functional component's DOM wouldn't get
// this SFC's data-v scope attribute, leaving the switches unstyled/invisible).
const accountToggles = [
  { key: 'global_memory_enabled', label: 'Global user memory', hint: 'Let agents use your account-wide memories.' },
  { key: 'agent_memory_enabled', label: 'Agent memory', hint: 'Let agents keep their own durable memories.' },
  { key: 'project_memory_enabled', label: 'Project memory', hint: 'Let agents use memory scoped to a project / repo.' },
  { key: 'end_of_run_learning_enabled', label: 'End-of-run learning', hint: 'Let agents save what they learned after a run completes.' },
]

// ── Account settings ────────────────────────────────────────────────────────────
const loading = ref(true)
const loadError = ref(false)
const s = reactive({})

// Global memory summary (the generated digest agents read).
const digest = ref(null)
const digestLoading = ref(false)
async function loadDigest() {
  digestLoading.value = true
  try { digest.value = (await api.getGlobalMemoryDigest()).data }
  catch (e) { digest.value = null }
  finally { digestLoading.value = false }
}

async function loadSettings() {
  loading.value = true
  loadError.value = false
  try {
    const { data } = await api.getMemorySettings()
    Object.assign(s, data)
  } catch (e) {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// Digest mode (Advanced). Turning on compression defaults the compressed scopes to global + agent.
async function setDigestMode(mode) {
  if ((s.digest_mode || 'deterministic') === mode) return
  const patch = { digest_mode: mode }
  if (mode === 'llm_compressed' && !(s.compressed_digest_scopes && s.compressed_digest_scopes.length)) {
    patch.compressed_digest_scopes = ['user', 'agent']
  }
  for (const [k, v] of Object.entries(patch)) await set(k, v)
  // Switching mode regenerates the summary — loadDigest() shows the "being generated…" state while it builds.
  await loadDigest()
}

const regenBusy = ref(false)
async function regenerate() {
  regenBusy.value = true
  try {
    const { data } = await api.regenerateMemoryDigests()
    notify.success(`Rebuilt ${data.regenerated} memory ${data.regenerated === 1 ? 'summary' : 'summaries'}`)
    await loadDigest()
  } catch (e) {
    notify.error('Could not regenerate summaries')
  } finally {
    regenBusy.value = false
  }
}

async function set(key, value) {
  const prev = s[key]
  s[key] = value                                   // optimistic
  try {
    const { data } = await api.updateMemorySettings({ [key]: value })
    Object.assign(s, data)
  } catch (e) {
    s[key] = prev                                  // rollback
    notify.error('Could not update setting')
  }
}

// ── Global memories ─────────────────────────────────────────────────────────────
const memories = ref([])
const listLoading = ref(false)
const query = ref('')
const editing = ref(false)
const busy = ref(false)
// "General" maps to the backend 'context' kind; Fact/Preference map 1:1.
const KINDS = [
  { value: 'general', label: 'General' },
  { value: 'preference', label: 'Preference' },
  { value: 'fact', label: 'Fact' },
]
const draft = reactive({ id: null, content: '', pinned: false, kind: 'general' })
const toBackendKind = (k) => (k === 'general' ? 'context' : k)
const toFormKind = (k) => (k === 'context' || !KINDS.some(o => o.value === k) ? 'general' : k)
const kindLabel = (k) => (k === 'context' ? 'general' : (k || 'general'))

// Pagination — show 10 rows per page.
const PAGE_SIZE = 10
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(memories.value.length / PAGE_SIZE)))
const pagedMemories = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return memories.value.slice(start, start + PAGE_SIZE)
})

async function loadMemories() {
  listLoading.value = true
  try {
    const { data } = await api.listGlobalMemories(query.value ? { q: query.value } : {})
    memories.value = data.memories || []
    if (page.value > totalPages.value) page.value = totalPages.value   // keep page in range
  } catch (e) {
    notify.error('Could not load memories')
  } finally {
    listLoading.value = false
  }
}

let _t
function debouncedLoad() {
  clearTimeout(_t)
  _t = setTimeout(() => { page.value = 1; loadMemories() }, 250)
}

function startAdd() {
  draft.id = null; draft.content = ''; draft.pinned = false; draft.kind = 'general'
  editing.value = true
}
function startEdit(m) {
  draft.id = m.id; draft.content = m.content; draft.pinned = !!m.pinned; draft.kind = toFormKind(m.kind)
  editing.value = true
}
function cancelEdit() { editing.value = false }

async function saveDraft() {
  const content = draft.content.trim()
  if (!content) return
  busy.value = true
  try {
    const kind = toBackendKind(draft.kind)
    if (draft.id) {
      await api.updateGlobalMemory(draft.id, { content, pinned: draft.pinned, kind })
    } else {
      await api.createGlobalMemory({ content, pinned: draft.pinned, kind })
    }
    editing.value = false
    notify.success(draft.id ? 'Memory updated' : 'Memory added')
    await loadMemories(); loadDigest()
  } catch (e) {
    const msg = e?.response?.data?.error || 'Could not save memory'
    notify.error(msg)
  } finally {
    busy.value = false
  }
}

async function togglePin(m) {
  try {
    await api.updateGlobalMemory(m.id, { pinned: !m.pinned })
    await loadMemories(); loadDigest()
  } catch (e) { notify.error('Could not update pin') }
}

async function toggleArchive(m) {
  const next = m.status === 'archived' ? 'active' : 'archived'
  try {
    await api.updateGlobalMemory(m.id, { status: next })
    await loadMemories(); loadDigest()
  } catch (e) { notify.error('Could not update memory') }
}

async function remove(m) {
  const ok = await confirm({
    title: 'Delete memory?', message: 'This permanently forgets this memory.',
    confirmText: 'Delete', danger: true,
  })
  if (!ok) return
  try {
    await api.deleteGlobalMemory(m.id)
    notify.success('Memory deleted')
    await loadMemories(); loadDigest()
  } catch (e) { notify.error('Could not delete memory') }
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

onMounted(async () => {
  await loadSettings()
  await loadMemories()
})
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--vm-surface, #fff); border: 1px solid var(--vm-line, #e7eaf0); border-radius: 14px; padding: 20px; }
.card-title { font-size: 1rem; font-weight: 600; color: var(--vm-ink, #0f172a); margin: 0 0 2px; }
.card-sub { font-size: 0.8125rem; color: var(--vm-ink-faint, #94a3b8); margin: 0 0 14px; }
.muted { color: var(--vm-ink-faint, #94a3b8); font-size: 0.875rem; }
.error-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #b42318; }

.explain { display: flex; gap: 14px; align-items: flex-start; }
.explain-icon { display: grid; place-items: center; height: 38px; width: 38px; flex-shrink: 0; border-radius: 10px; background: #eef2ff; color: #4f46e5; }

.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 0; border-top: 1px solid var(--vm-line, #f1f5f9); }
.row:first-of-type { border-top: none; }
.row.is-disabled { opacity: .5; }
.row-label { font-size: 0.875rem; font-weight: 500; color: var(--vm-ink-soft, #334155); }
.row-hint { font-size: 0.75rem; color: var(--vm-ink-faint, #94a3b8); margin-top: 2px; }
.nested { margin-top: 4px; padding-left: 14px; border-left: 2px solid #eef2ff; }
.nested.off { opacity: .55; }

.sw { position: relative; height: 22px; width: 38px; flex-shrink: 0; border: none; border-radius: 999px; cursor: pointer; transition: background .15s; padding: 0; }
.sw.on { background: var(--vm-primary, #2563eb); }
.sw.off { background: #cbd5e1; }
.sw .knob { position: absolute; top: 2px; left: 2px; height: 18px; width: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.2); transition: transform .15s; }
.sw.on .knob { transform: translateX(16px); }
.sw-disabled { opacity: .45; cursor: not-allowed; }

.seg { display: inline-flex; padding: 3px; background: var(--vm-surface-soft, #f1f5f9); border-radius: 9px; }
.seg-btn { padding: 6px 14px; font-size: 0.8125rem; font-weight: 500; color: var(--vm-ink-faint, #64748b); background: transparent; border: none; border-radius: 7px; cursor: pointer; }
.seg-btn.active { background: #fff; color: var(--vm-primary, #2563eb); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.seg-btn:disabled { cursor: not-allowed; }
.num { width: 92px; padding: 8px 10px; font-size: 0.875rem; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; text-align: right; }

.gm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.dg-badge { flex-shrink: 0; padding: 3px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 0.72rem; font-weight: 700; }
.dg-pre { margin: 0; padding: 12px 14px; background: #f8fafc; border: 1px solid #eef0f4; border-radius: 11px; font-family: inherit; font-size: 0.84rem; line-height: 1.5; color: #334155; white-space: pre-wrap; word-break: break-word; }
.dg-generating { display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 600; color: #4f46e5; }
.dg-spin { width: 13px; height: 13px; border: 2px solid #c7d2fe; border-top-color: #4f46e5; border-radius: 50%; animation: dg-rot 0.7s linear infinite; }
@keyframes dg-rot { to { transform: rotate(360deg); } }
.btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; font-size: 0.8125rem; font-weight: 600; color: #fff; background: var(--vm-primary, #2563eb); border: none; border-radius: 9px; cursor: pointer; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-ghost { padding: 8px 13px; font-size: 0.8125rem; font-weight: 600; color: #475569; background: #fff; border: 1px solid #e2e8f0; border-radius: 9px; cursor: pointer; }

.gm-form { background: #f8fafc; border: 1px solid #e7eaf0; border-radius: 12px; padding: 12px; margin-bottom: 14px; }
.gm-textarea { width: 100%; resize: vertical; border: 1px solid #d0d5dd; border-radius: 9px; padding: 9px 11px; font-size: 0.875rem; color: #0f172a; outline: none; }
.gm-textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #eaf0ff; }
.gm-form-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.gm-form-actions .spacer { flex: 1; }
.gm-pin { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: #475569; }
.gm-field { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: #475569; }
.gm-select { padding: 5px 8px; font-size: 0.8125rem; color: #0f172a; background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; cursor: pointer; }
.gm-pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 14px; }
.gm-page-btn { padding: 6px 14px; font-size: 0.8125rem; font-weight: 600; color: #344054; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; }
.gm-page-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; }
.gm-page-btn:disabled { opacity: .45; cursor: not-allowed; }
.gm-page-info { font-size: 0.78rem; color: #94a3b8; }

.gm-search { position: relative; margin-bottom: 12px; }
.gm-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.gm-search input { width: 100%; padding: 9px 11px 9px 34px; font-size: 0.875rem; border: 1px solid #e2e8f0; border-radius: 9px; outline: none; }
.gm-search input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #eaf0ff; }

.gm-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 0; color: #94a3b8; font-size: 0.875rem; text-align: center; }
.gm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.gm-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #eef0f4; border-radius: 11px; background: #fff; }
.gm-item.archived { opacity: .6; }
.gm-pin-btn { flex-shrink: 0; display: grid; place-items: center; height: 26px; width: 26px; border-radius: 7px; border: 1px solid #e2e8f0; background: #fff; color: #cbd5e1; cursor: pointer; }
.gm-pin-btn.active { color: #2563eb; border-color: #bfd3ff; background: #eef4ff; }
.gm-body { flex: 1; min-width: 0; }
.gm-content { font-size: 0.875rem; color: #1e293b; line-height: 1.45; margin: 0 0 5px; white-space: pre-wrap; }
.gm-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 0.72rem; color: #94a3b8; }
.gm-tag { padding: 1px 7px; border-radius: 999px; background: #f1f5f9; color: #64748b; font-weight: 600; }
.gm-tag.warn { background: #fff4e5; color: #b54708; }
.gm-dot { color: #cbd5e1; }
.gm-actions { display: flex; gap: 4px; flex-shrink: 0; }
.gm-act { display: grid; place-items: center; height: 28px; width: 28px; border-radius: 7px; border: 1px solid #e8ebf0; background: #fff; color: #667085; cursor: pointer; }
.gm-act:hover { border-color: #cdd5e0; color: #0f172a; }
.gm-act.danger:hover { border-color: #fda29b; color: #d92d20; }
</style>
