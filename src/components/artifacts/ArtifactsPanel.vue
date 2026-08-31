<template>
  <section class="af-panel">
    <!-- Toolbar -->
    <div class="af-toolbar">
      <input v-model="store.query" class="af-search" type="search" placeholder="Filter artifacts…"
             aria-label="Filter artifacts by name" />
      <select v-model="store.originFilter" class="af-sel" aria-label="Filter by kind">
        <option value="">All kinds</option>
        <option v-for="(n, o) in store.countsByOrigin" :key="o" :value="o">{{ originLabel(o) }} ({{ n }})</option>
      </select>
      <label class="af-check" title="Show superseded versions as separate rows">
        <input type="checkbox" :checked="store.showAllVersions"
               @change="store.setShowAllVersions($event.target.checked)" />
        History
      </label>
      <button class="af-icon" title="Refresh" :disabled="store.loading" @click="store.load()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
      </button>
    </div>

    <!-- List -->
    <div class="af-list-wrap">
      <div v-if="store.loading && !store.items.length" class="af-note">Loading…</div>
      <div v-else-if="store.error" class="af-note">
        {{ store.error }}
        <button class="af-retry" @click="store.load()">Retry</button>
      </div>
      <div v-else-if="!store.filtered.length" class="af-note">
        <template v-if="store.query || store.originFilter">Nothing matches this filter.</template>
        <template v-else>
          No artifacts in this chat yet.<br />
          <span class="af-dim">Files you attach, images the agent generates, scripts it runs and the
          output they produce all appear here.</span>
        </template>
      </div>

      <ul v-else class="af-list" role="listbox" :aria-activedescendant="store.selectedId || undefined">
        <li v-for="a in store.filtered" :key="a.artifact_id">
          <button class="af-row" :class="{ on: a.artifact_id === store.selectedId }" role="option"
                  :id="a.artifact_id" :aria-selected="a.artifact_id === store.selectedId"
                  @click="store.select(a.artifact_id)">
            <span class="af-ext" :class="kindClass(a)">{{ ext(a) }}</span>
            <span class="af-info">
              <span class="af-name" :title="a.name || a.filename">{{ a.name || a.filename }}</span>
              <span class="af-meta">
                <span class="af-badge" :class="kindClass(a)">{{ kindLabel(a) }}</span>
                <span v-if="a.version > 1" class="af-ver" title="This file has earlier versions">v{{ a.version }}</span>
                <span>{{ formatSize(a.size) }}</span>
                <span v-if="a.created_at" class="af-dim">· {{ when(a.created_at) }}</span>
              </span>
            </span>
            <span v-if="a.expires_at" class="af-expiry" :title="`Expires ${when(a.expires_at)}`">⏳</span>
          </button>
        </li>
      </ul>

      <button v-if="store.hasMore" class="af-more" :disabled="store.loading" @click="store.loadMore()">
        {{ store.loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>

    <!-- Detail -->
    <div v-if="store.selectedId" class="af-detail">
      <div class="af-detail-head">
        <div class="af-detail-title">
          <input v-if="renaming" ref="renameInput" v-model="renameDraft" class="af-rename"
                 aria-label="Artifact name" @keyup.enter="commitRename" @keyup.esc="renaming = false"
                 @blur="commitRename" />
          <template v-else>
            <span class="af-name" :title="detailName">{{ detailName }}</span>
            <span v-if="detail && detail.provenance && detail.provenance.tool" class="af-dim">
              from {{ detail.provenance.tool }}
            </span>
          </template>
        </div>
        <button class="af-icon" title="Close preview" aria-label="Close preview" @click="store.select(null)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="af-preview">
        <div v-if="store.previewLoading" class="af-note">Loading preview…</div>
        <img v-else-if="previewKind === 'image'" :src="store.downloadUrl(store.selectedId)"
             :alt="detailName" class="af-img" />
        <!-- A canvas artifact is untrusted HTML the model wrote: previewed as SOURCE here, never rendered.
             Rendering it live is the Canvas tab's job, inside its existing sandboxed iframe. -->
        <pre v-else-if="previewText !== null" class="af-code"><code>{{ previewText }}</code></pre>
        <div v-else class="af-note">
          No inline preview for this file type.<br />
          <span class="af-dim">{{ detail && detail.media_type }}</span>
        </div>
        <p v-if="store.preview && store.preview.truncated" class="af-trunc">
          Preview truncated — download for the full file.
        </p>
      </div>

      <!-- Versions -->
      <div v-if="detail && detail.versions_count > 1" class="af-versions">
        <button class="af-link" @click="toggleVersions">
          {{ versionsOpen ? 'Hide' : 'Show' }} {{ detail.versions_count }} versions
        </button>
        <ul v-if="versionsOpen" class="af-vlist">
          <li v-for="v in store.versions" :key="v.artifact_id">
            <span class="af-vnum">v{{ v.version }}</span>
            <span class="af-dim">{{ when(v.created_at) }} · {{ formatSize(v.size) }}</span>
            <a class="af-link" :href="store.downloadUrl(v.artifact_id)" :download="v.filename || ''">Download</a>
          </li>
        </ul>
      </div>

      <!-- Actions -->
      <div class="af-actions">
        <a class="af-btn primary" :href="store.downloadUrl(store.selectedId)"
           :download="(detail && detail.filename) || ''">Download</a>
        <button class="af-btn" :disabled="store.busy || renaming" @click="startRename">Rename</button>
        <button class="af-btn" :disabled="store.busy" @click="togglePin">
          {{ isPinned ? 'Unpin' : 'Keep' }}
        </button>
        <button class="af-btn danger" :disabled="store.busy" @click="doDelete">Delete</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useArtifactsStore } from '../../stores/useArtifactsStore'
import { confirm as confirmDialog } from '../../composables/useConfirm'

const store = useArtifactsStore()
const versionsOpen = ref(false)
const renaming = ref(false)
const renameDraft = ref('')
const renameInput = ref(null)

const detail = computed(() => store.detail)
const detailName = computed(() => (detail.value && detail.value.name) || (store.selected && store.selected.name) || '')
const previewKind = computed(() => (store.preview && store.preview.preview_kind)
  || (detail.value && detail.value.preview_kind) || 'none')
const previewText = computed(() => (store.preview && store.preview.text) ?? null)
const isPinned = computed(() => !!(detail.value && detail.value.visibility === 'USER_LIBRARY'))

watch(() => store.selectedId, () => { versionsOpen.value = false; renaming.value = false })

function toggleVersions() {
  versionsOpen.value = !versionsOpen.value
  if (versionsOpen.value && !store.versions.length) store.loadVersions()
}

// Rename edits in place rather than through a dialog: it is a one-field change, and the platform's
// confirm composable has no prompt (native dialogs are banned here).
function startRename() {
  renameDraft.value = detailName.value
  renaming.value = true
  nextTick(() => renameInput.value && renameInput.value.select())
}
function commitRename() {
  if (!renaming.value) return                      // blur after Esc/Enter already closed it
  renaming.value = false
  const next = renameDraft.value.trim()
  if (next && next !== detailName.value) store.rename(store.selectedId, next)
}

function togglePin() { store.setPinned(store.selectedId, !isPinned.value) }

async function doDelete() {
  const ok = await confirmDialog({
    title: 'Delete artifact?',
    message: `${detailName.value} will be removed from this chat and your library. This cannot be undone.`,
    confirmText: 'Delete',
    danger: true,
  })
  if (ok) store.remove(store.selectedId)
}

// ── presentation ────────────────────────────────────────────────────────────────────────────────
const ORIGINS = {
  USER_UPLOAD: 'Uploaded',
  AGENT_GENERATED: 'Generated',
  SCRIPT_OUTPUT: 'Script output',
  TOOL_OUTPUT: 'Tool output',
  CONNECTOR_IMPORT: 'Imported',
  DERIVED: 'Derived',
}
const CODE_TYPES = /^text\/(x-python|x-shellscript|javascript|x-ruby)$/
const isScript = (a) => a.origin === 'AGENT_GENERATED' && CODE_TYPES.test(a.media_type || '')
const isCanvas = (a) => a.origin === 'AGENT_GENERATED' && (a.media_type || '') === 'text/html'
const originLabel = (o) => ORIGINS[o] || o

// The origin enum alone would call a script, a canvas page and an image all "Generated" — read the media
// type so each row says what it actually is.
function kindLabel(a) {
  if (isScript(a)) return 'Script'
  if (isCanvas(a)) return 'Design'
  if ((a.media_type || '').startsWith('image/')) return 'Image'
  return ORIGINS[a.origin] || a.origin || 'Artifact'
}
function kindClass(a) {
  if (isScript(a)) return 'k-script'
  if (isCanvas(a)) return 'k-design'
  if (a.origin === 'USER_UPLOAD') return 'k-upload'
  if (a.origin === 'SCRIPT_OUTPUT' || a.origin === 'TOOL_OUTPUT') return 'k-output'
  return 'k-gen'
}
function ext(a) {
  const n = a.filename || a.name || ''
  const e = n.includes('.') ? n.split('.').pop() : ''
  return (e || 'file').slice(0, 4).toUpperCase()
}
function formatSize(bytes) {
  const b = Number(bytes || 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
function when(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}
</script>

<style scoped>
.af-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface, #fff); }
.af-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); flex-wrap: wrap; }
.af-search { flex: 1; min-width: 120px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; padding: 6px 10px; font-size: 13px; background: transparent; color: inherit; }
.af-sel { border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; padding: 6px 8px; font-size: 12.5px; background: transparent; color: inherit; }
.af-check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--vm-ink-soft, #475569); cursor: pointer; white-space: nowrap; }
.af-icon { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; background: transparent; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.af-icon:disabled { opacity: .5; cursor: not-allowed; }
.af-icon svg { width: 15px; height: 15px; }

.af-list-wrap { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 6px; }
.af-note { padding: 32px 20px; text-align: center; font-size: 13px; color: var(--vm-ink-soft, #64748b); line-height: 1.55; }
.af-dim { color: var(--vm-ink-dim, #94a3b8); }
.af-retry { margin-left: 8px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 7px; background: transparent; padding: 3px 9px; font-size: 12px; cursor: pointer; color: inherit; }
.af-list { list-style: none; margin: 0; padding: 0; }
.af-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border: none; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; color: inherit; }
.af-row:hover { background: var(--vm-surface-2, #f1f5f9); }
.af-row.on { background: var(--vm-violet-soft, #eef2ff); }
.af-ext { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; font-size: 9.5px; font-weight: 700; letter-spacing: .3px; }
.af-info { min-width: 0; flex: 1; display: block; }
.af-name { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.af-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; font-size: 11px; color: var(--vm-ink-soft, #64748b); }
.af-badge { font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 10px; text-transform: uppercase; letter-spacing: .3px; }
.af-ver { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 6px; background: #e2e8f0; color: #475569; }
.af-expiry { font-size: 12px; }
.k-script { background: #dcfce7; color: #15803d; }
.k-design { background: #fae8ff; color: #a21caf; }
.k-upload { background: #dbeafe; color: #1d4ed8; }
.k-output { background: #fef3c7; color: #b45309; }
.k-gen { background: #ede9fe; color: #6d28d9; }
.af-more { display: block; width: calc(100% - 12px); margin: 8px 6px; padding: 7px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 9px; background: transparent; font-size: 12.5px; font-weight: 600; cursor: pointer; color: inherit; }

.af-detail { flex: 0 0 auto; max-height: 52%; display: flex; flex-direction: column; border-top: 1px solid var(--vm-line-2, #e5e7eb); }
.af-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; }
.af-detail-title { min-width: 0; display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
.af-rename { flex: 1; min-width: 0; border: 1px solid var(--vm-violet-d, #4f46e5); border-radius: 7px; padding: 3px 7px; font-size: 13px; font-weight: 600; background: transparent; color: inherit; }
.af-preview { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 12px 8px; }
.af-img { max-width: 100%; border-radius: 8px; display: block; }
.af-code { margin: 0; padding: 10px; border-radius: 8px; background: var(--vm-surface-2, #f8fafc); font-size: 11.5px; line-height: 1.5; white-space: pre; overflow-x: auto; }
.af-trunc { margin: 6px 0 0; font-size: 11.5px; color: var(--vm-ink-dim, #94a3b8); }
.af-versions { padding: 0 12px 8px; font-size: 12px; }
.af-vlist { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; }
.af-vlist li { display: flex; align-items: center; gap: 8px; font-size: 11.5px; }
.af-vnum { font-weight: 700; }
.af-link { border: none; background: transparent; padding: 0; font-size: 12px; font-weight: 600; color: var(--vm-violet-d, #4f46e5); cursor: pointer; text-decoration: none; }
.af-actions { display: flex; gap: 7px; padding: 9px 12px; border-top: 1px solid var(--vm-line-2, #e5e7eb); flex-wrap: wrap; }
.af-btn { border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 9px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; background: transparent; color: inherit; cursor: pointer; text-decoration: none; }
.af-btn:disabled { opacity: .5; cursor: not-allowed; }
.af-btn.primary { background: var(--vm-violet-d, #4f46e5); border-color: transparent; color: #fff; }
.af-btn.danger { color: #b91c1c; }

@media (prefers-color-scheme: dark) {
  .af-code { background: #262c38; }
  .af-ver { background: #334155; color: #cbd5e1; }
}
</style>
