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
    // filters
    query: '',
    originFilter: '',
    // selection + preview
    selectedId: null,
    detail: null,
    preview: null,
    previewLoading: false,
    versions: [],
    versionsLoading: false,
    busy: false,
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
        })
        const rows = (data && data.results) || []
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

    // ── live ──────────────────────────────────────────────────────────────────────────────────────
    // An `artifact_created` frame from the running turn. Descriptors are small by design, so a row
    // appended here shows name/type/size immediately and fills in the rest when selected.
    onArtifactCreated(descriptor) {
      if (!descriptor || !descriptor.artifact_id) return
      const idx = this.items.findIndex((a) => a.artifact_id === descriptor.artifact_id)
      const row = { ...descriptor, _live: true }
      if (idx >= 0) {
        this.items.splice(idx, 1, { ...this.items[idx], ...row })
        return
      }
      // A new VERSION replaces the row it supersedes, so the live list obeys the same
      // one-row-per-lineage rule as the server listing instead of growing a duplicate name.
      if (!this.showAllVersions && descriptor.version > 1) {
        const prev = this.items.findIndex(
          (a) => (a.filename || a.name) === (descriptor.filename || descriptor.name))
        if (prev >= 0) {
          this.items.splice(prev, 1, row)
          return
        }
      }
      this.items.unshift(row)
      this.countsByOrigin = { ...this.countsByOrigin,
                              [descriptor.origin]: (this.countsByOrigin[descriptor.origin] || 0) + 1 }
      if (!this.open) this.unseen += 1
    },

    // ── selection ─────────────────────────────────────────────────────────────────────────────────
    async select(artifactId) {
      if (!artifactId) { this.selectedId = null; this.detail = null; this.preview = null; return }
      this.selectedId = artifactId
      this.detail = null
      this.preview = null
      this.versions = []
      this.previewLoading = true
      try {
        const [detail, preview] = await Promise.all([
          api.getArtifact(artifactId, this.conversationId).catch(() => null),
          api.getArtifactPreview(artifactId, this.conversationId).catch(() => null),
        ])
        if (this.selectedId !== artifactId) return          // selection moved on while we waited
        this.detail = detail ? detail.data : null
        this.preview = preview ? preview.data : null
      } finally {
        if (this.selectedId === artifactId) this.previewLoading = false
      }
    },

    async loadVersions() {
      if (!this.selectedId) return
      this.versionsLoading = true
      try {
        const { data } = await api.getArtifactVersions(this.selectedId, this.conversationId)
        this.versions = (data && data.results) || []
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
