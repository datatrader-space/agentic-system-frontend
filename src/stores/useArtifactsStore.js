// Pinia store — the chat's Artifacts side panel.
//
// One list of everything a conversation produced or received: uploads, generated media, the script the
// agent wrote, the files that script emitted, canvas revisions, promoted tool outputs. The backend is the
// single registry (ContentArtifact); this store is a thin, live-updating view of it.
//
// Live, not polled: the runtime emits an `artifact_created` frame from the one promotion chokepoint and
// useChatStore hands it here, so a file appears the moment it exists. A refetch only happens when the
// conversation changes or the user asks.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'

// Only the LATEST version of each lineage is listed; a rewritten script.py is one row at v3, and the
// history is fetched on demand. `versions=all` is a per-panel toggle, not the default.
// The WS descriptor and the REST serializer must agree on the id key. They did NOT once (REST answered
// only `uuid`), which produced `/api/artifacts/undefined/download/` and a "download.json" error file. The
// server now sends both; normalizing here as well means a future drift degrades to "still works" rather
// than to an undiagnosable broken button.
const normalize = (row) => (row && !row.artifact_id && row.uuid
  ? { ...row, artifact_id: row.uuid }
  : row)

export const fmtMs = (ms) => {
  const n = Number(ms || 0)
  if (!n) return '—'
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(n < 10000 ? 2 : 1)} s`
}

export const useArtifactsStore = defineStore('artifacts', {
  state: () => ({
    open: false,
    conversationId: null,
    items: [],
    loading: false,
    error: '',
    hasMore: false,
    offset: 0,
    limit: 50,
    countsByOrigin: {},
    showAllVersions: false,
    // 'oldest' reads the chat as a timeline (first thing produced at the top, same direction as the
    // conversation). Ordering is a SERVER concern: sorting one loaded page locally would order that page,
    // not the conversation.
    order: 'oldest',
    // filters
    query: '',
    originFilter: '',
    // selection + preview
    selectedId: null,
    detail: null,
    preview: null,
    previewLoading: false,
    previewFailed: false,
    versions: [],
    versionsLoading: false,
    busy: false,
    // Last re-run of the selected artifact: {success, exit_code, stdout, stderr, duration_ms,
    // executed_on, outputs}. Cleared on selection change so one script's output can never be read as
    // another's.
    rerunning: false,
    rerun: null,
    rerunError: '',
    // Unseen count for the header badge — cleared when the panel is opened.
    unseen: 0,
  }),

  getters: {
    selected: (s) => s.items.find((a) => a.artifact_id === s.selectedId) || null,
    // Client-side name filter over the loaded page: the list is small and this keeps typing instant.
    // The server-side `q` stays available for the day a conversation needs real paging.
    filtered: (s) => {
      const q = s.query.trim().toLowerCase()
      let out = s.items
      if (s.originFilter) out = out.filter((a) => a.origin === s.originFilter)
      if (q) out = out.filter((a) => (a.name || a.filename || '').toLowerCase().includes(q))
      return out
    },
    isEmpty: (s) => !s.loading && s.items.length === 0,
  },

  actions: {
    openPanel(conversationId) {
      this.open = true
      this.unseen = 0
      if (conversationId && String(conversationId) !== String(this.conversationId)) {
        this.bind(conversationId)
      } else if (!this.items.length && this.conversationId) {
        this.load()
      }
    },
    closePanel() { this.open = false },
    toggle(conversationId) { this.open ? this.closePanel() : this.openPanel(conversationId) },

    // Point the panel at a conversation. Resets everything — artifacts are conversation-scoped, and
    // carrying one chat's list into another is exactly the kind of leak that looks like a data bug.
    bind(conversationId) {
      const changed = String(conversationId || '') !== String(this.conversationId || '')
      this.conversationId = conversationId || null
      if (changed) {
        this.items = []
        this.offset = 0
        this.selectedId = null
        this.detail = null
        this.preview = null
        this.versions = []
        this.unseen = 0
        this.error = ''
      }
      if (this.conversationId) this.load()
    },

    async load({ append = false } = {}) {
      if (!this.conversationId) return
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.getConversationArtifacts(this.conversationId, {
          limit: this.limit,
          offset: append ? this.offset : 0,
          versions: this.showAllVersions ? 'all' : '',
          order: this.order,
        })
        const rows = ((data && data.results) || []).map(normalize)
        this.items = append ? [...this.items, ...rows] : rows
        this.hasMore = !!(data && data.has_more)
        this.offset = this.items.length
        this.countsByOrigin = (data && data.counts_by_origin) || {}
      } catch (e) {
        this.error = 'Could not load artifacts.'
        if (!append) this.items = []
      } finally {
        this.loading = false
      }
    },

    loadMore() { if (this.hasMore && !this.loading) this.load({ append: true }) },

    setShowAllVersions(v) {
      this.showAllVersions = !!v
      this.load()
    },

    setOrder(order) {
      if (this.order === order) return
      this.order = order === 'oldest' ? 'oldest' : 'newest'
      this.load()
    },

    // ── live ──────────────────────────────────────────────────────────────────────────────────────
    // An `artifact_created` frame from the running turn. Descriptors are small by design, so a row
    // appended here shows name/type/size immediately and fills in the rest when selected.
    onArtifactCreated(descriptor) {
      const d = normalize(descriptor)
      if (!d || !d.artifact_id) return
      const idx = this.items.findIndex((a) => a.artifact_id === d.artifact_id)
      const row = { ...d, _live: true }
      if (idx >= 0) {
        this.items.splice(idx, 1, { ...this.items[idx], ...row })
        return
      }
      // A new VERSION replaces the row it supersedes, so the live list obeys the same
      // one-row-per-lineage rule as the server listing instead of growing a duplicate name.
      if (!this.showAllVersions && d.version > 1) {
        const prev = this.items.findIndex(
          (a) => (a.filename || a.name) === (d.filename || d.name))
        if (prev >= 0) {
          this.items.splice(prev, 1, row)
          return
        }
      }
      // A newly produced artifact goes wherever "most recent" lives for the current order — appending it
      // to the top of a timeline would put the newest thing before things that happened earlier.
      if (this.order === 'oldest') this.items.push(row)
      else this.items.unshift(row)
      this.countsByOrigin = { ...this.countsByOrigin,
                              [d.origin]: (this.countsByOrigin[d.origin] || 0) + 1 }
      if (!this.open) this.unseen += 1
    },

    // ── selection ─────────────────────────────────────────────────────────────────────────────────
    async select(artifactId) {
      if (!artifactId) { this.selectedId = null; this.detail = null; this.preview = null; return }
      this.selectedId = artifactId
      this.detail = null
      this.preview = null
      this.versions = []
      this.rerun = null
      this.rerunError = ''
      this.previewFailed = false
      this.previewLoading = true
      try {
        const [detail, preview] = await Promise.all([
          api.getArtifact(artifactId, this.conversationId).catch(() => null),
          api.getArtifactPreview(artifactId, this.conversationId).catch(() => null),
        ])
        if (this.selectedId !== artifactId) return          // selection moved on while we waited
        this.detail = detail ? normalize(detail.data) : null
        this.preview = preview ? preview.data : null
        // Distinguish "the server said this type has no inline preview" from "the request failed".
        // Collapsing the two is what let a 404 read as a file-type limitation for an ordinary .py file.
        this.previewFailed = !preview || !detail
      } finally {
        if (this.selectedId === artifactId) this.previewLoading = false
      }
    },

    async loadVersions() {
      if (!this.selectedId) return
      this.versionsLoading = true
      try {
        const { data } = await api.getArtifactVersions(this.selectedId, this.conversationId)
        this.versions = ((data && data.results) || []).map(normalize)
      } catch (e) {
        this.versions = []
      } finally {
        this.versionsLoading = false
      }
    },

    // ── mutations (owner-only server-side; the UI just reflects the answer) ───────────────────────
    async rename(artifactId, name) {
      this.busy = true
      try {
        const { data } = await api.renameArtifact(artifactId, name)
        this._patch(artifactId, { name: data.name, display_name: data.display_name })
        if (this.detail && this.detail.artifact_id === artifactId) this.detail = data
        notify.success('Renamed')
      } catch (e) {
        notify.error('Could not rename this artifact')
      } finally { this.busy = false }
    },

    async setPinned(artifactId, pinned) {
      this.busy = true
      try {
        const { data } = await api.pinArtifact(artifactId, pinned)
        this._patch(artifactId, { visibility: data.visibility, expires_at: data.expires_at })
        if (this.detail && this.detail.artifact_id === artifactId) this.detail = { ...this.detail, ...data }
        notify.success(pinned ? 'Kept in your library' : 'Unpinned')
      } catch (e) {
        notify.error('Could not update this artifact')
      } finally { this.busy = false }
    },

    async remove(artifactId) {
      this.busy = true
      try {
        await api.deleteArtifact(artifactId)
        this.items = this.items.filter((a) => a.artifact_id !== artifactId)
        if (this.selectedId === artifactId) this.select(null)
        notify.success('Deleted')
      } catch (e) {
        notify.error('Could not delete this artifact')
      } finally { this.busy = false }
    },

    // ── re-run ────────────────────────────────────────────────────────────────────────────────────
    // Server-side replay of the stored source. Any files it produces come back as artifact descriptors
    // and are folded into the list, exactly as if a turn had produced them.
    async rerunScript(artifactId) {
      if (this.rerunning) return
      this.rerunning = true
      this.rerunError = ''
      this.rerun = null
      try {
        const { data } = await api.rerunArtifact(artifactId)
        if (this.selectedId !== artifactId) return      // selection moved while it ran
        this.rerun = data
        for (const o of (data && data.outputs) || []) this.onArtifactCreated(o)
        if (data && data.success) notify.success(`Ran on ${data.executed_on} in ${fmtMs(data.duration_ms)}`)
        else notify.error(`Script exited ${data && data.exit_code}`)
      } catch (e) {
        // The server's refusal text is the useful part ("needs a capability grant", "not a Python
        // script") — surfacing a generic failure instead is what makes a feature feel broken.
        this.rerunError = (e && e.response && e.response.data && e.response.data.detail)
          || 'Could not re-run this script.'
        notify.error(this.rerunError)
      } finally {
        this.rerunning = false
      }
    },

    _patch(artifactId, fields) {
      const idx = this.items.findIndex((a) => a.artifact_id === artifactId)
      if (idx >= 0) this.items.splice(idx, 1, { ...this.items[idx], ...fields })
    },

    downloadUrl(artifactId) {
      const base = `/api/artifacts/${artifactId}/download/`
      return this.conversationId
        ? `${base}?conversation_id=${encodeURIComponent(this.conversationId)}`
        : base
    },

    reset() {
      this.$reset()
    },
  },
})
