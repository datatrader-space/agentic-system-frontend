// Pinia store — Canvas + Live Preview side panel.
//
// PROVIDER-AWARE (Phase 3B). Two canvas providers share this one store + panel:
//
//   • 'static'      — the agent calls GENERATE_STATIC_PAGE; the backend stores HTML and streams a
//                     preview_ready / preview_updated event. This store fetches the (scope-checked)
//                     HTML from the REST artifact endpoint and holds it for CanvasShell to render in a
//                     sandboxed <iframe srcdoc>. No cross-origin URL is ever loaded. (Phase 0 — shipped.)
//
//   • 'web_builder' — the agent edits a real Web Builder (Kurumera) storefront through its MCP tools.
//                     There is NO local HTML: instead the backend mints a short-lived, signed,
//                     cross-origin preview URL. On preview_ready / preview_updated we call
//                     loadPreviewUrl() (GET /api/v1/canvas/{id}/preview → { url, expires_at }) and render
//                     it via <iframe :src>. The signed URL is never persisted; only references travel in
//                     the events (Contract 4). We keep the last-good URL visible while a refresh is in
//                     flight so the preview never flashes blank.
//
// See agentic-docs/CANVAS_LIVE_PREVIEW_PLAN.md §12b and agentic-docs/PHASE3B_CONTRACTS.md (Contract 4).
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const VIEWPORTS = {
  desktop: { label: 'Desktop', width: null }, // null = fill available
  tablet: { label: 'Tablet', width: 834 },
  mobile: { label: 'Mobile', width: 390 },
}

// Per-provider capability map (Contract 4). CanvasShell reads this to decide which controls/tabs render,
// so the panel chrome is data-driven rather than a tangle of provider `if`s in the template.
const CAPABILITIES = {
  static: {
    tabs: ['Preview', 'HTML', 'CSS', 'Assets'],
    codeTabs: true,        // HTML / CSS / Assets inspector tabs
    viewport: true,        // desktop / tablet / mobile
    zoom: true,
    download: true,        // download index.html
    openInTab: true,
    revisions: true,
    select: true,          // click-to-select an element
    routeSelector: false,  // multi-page / route switcher
    publish: false,        // publish (go-live) control
    storeInfo: false,      // store / page header chip
    crossOrigin: false,    // signed cross-origin iframe (vs srcdoc)
  },
  web_builder: {
    tabs: ['Preview'],
    codeTabs: false,       // no local HTML/CSS/Assets — the storefront is server-rendered
    viewport: true,
    zoom: true,
    download: false,
    openInTab: true,       // opens the signed preview URL
    revisions: true,
    select: true,          // stable-id selection via cross-origin postMessage
    routeSelector: true,
    publish: true,
    storeInfo: true,
    crossOrigin: true,
  },
}

function providerFrom(msgOrCanvas) {
  const c = msgOrCanvas || {}
  if (c.provider === 'static' || c.provider === 'web_builder') return c.provider
  if (c.canvas_type === 'web_builder') return 'web_builder'
  return null
}

export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    // Canvas mode: when on, the agent is told to render designs into the live preview and the
    // backend auto-exposes the design tools for the turn (sent as `canvas_mode` on the message).
    mode: (typeof localStorage !== 'undefined' && localStorage.getItem('cv.mode') === '1'),
    open: false,
    canvasId: null,
    conversationId: null,
    canvasType: 'static',
    // 'static' | 'web_builder' — the source of truth for provider-aware rendering. Kept alongside the
    // legacy canvasType for back-compat (canvasType is what the WS events historically carried).
    provider: 'static',
    status: 'idle', // idle | preparing | live | updating | error
    title: '',
    revision: 0, // the revision currently shown in the iframe
    activeRevision: 0, // the latest revision on the server
    viewport: 'desktop',
    designWidth: '1440px', // agent's declared target width (informational)
    html: '', // current preview HTML (iframe srcdoc) — STATIC provider only
    revisions: [], // [{ revision, summary, size_bytes, created_at }]
    loading: false,
    error: '',
    // bumped every time we want the iframe to hard-refresh
    frameKey: 0,
    // Phase 5 click-to-select: when selectMode is on, clicking an element in the preview captures it.
    selectMode: false,
    selectedElement: null, // static: { tag, label, html }; web_builder: { provider, element_id, tag, label }

    // ── web_builder provider state (Phase 3B) ────────────────────────────────────────────────────
    previewUrl: '',        // signed, short-lived, cross-origin URL for <iframe :src> (kept as last-good)
    previewExpiresAt: null,
    previewLoading: false,
    previewError: '',      // non-blocking: shown as a Retry affordance while last-good stays visible
    trustedOrigin: '',     // origin we accept postMessage selections from (from the preview host / URL)
    route: '/',            // active storefront route/path
    pageId: null,          // active BuilderDocument id
    pages: [],             // [{ id, route, name, handle }] — for the route selector
    builderVersions: [],   // web_builder: Kurumera BuilderVersion history [{ id, label, created_at }]
  }),

  getters: {
    viewportPresets: () => VIEWPORTS,
    hasCanvas: (s) => !!s.canvasId,
    isWebBuilder: (s) => s.provider === 'web_builder',
    capabilities: (s) => CAPABILITIES[s.provider] || CAPABILITIES.static,
    frameSrcKey: (s) => `${s.canvasId || 'none'}:${s.revision}:${s.frameKey}`,
    // Re-key the web_builder iframe whenever the signed URL or revision changes so a mutation swaps in
    // a fresh render instead of the browser reusing the (now-stale) previous document.
    previewSrcKey: (s) => `${s.previewUrl}:${s.revision}:${s.frameKey}`,
  },

  actions: {
    // ── WebSocket event intake (called from useChatStore._onEvent) ───────────────────────────
    // Returns true if it handled the event.
    handleEvent(msg) {
      const t = msg?.type
      switch (t) {
        case 'canvas_session_started':
          this.canvasId = msg.canvas_id
          this.canvasType = msg.canvas_type || 'static'
          this.provider = providerFrom(msg) || this.provider || 'static'
          this.title = msg.title || this.title
          if (Array.isArray(msg.pages)) this.pages = msg.pages
          if (msg.route != null) this.route = msg.route
          if (msg.page_id != null) this.pageId = msg.page_id
          if (msg.trusted_origin) this.trustedOrigin = msg.trusted_origin
          this.status = 'preparing'
          return true
        case 'canvas_status_changed':
          if (msg.canvas_id && msg.canvas_id !== this.canvasId) return true
          this.status = msg.status || this.status
          return true
        case 'preview_preparing':
          this.status = 'preparing'
          return true
        case 'preview_ready':
        case 'preview_updated': {
          this.canvasId = msg.canvas_id
          this.canvasType = msg.canvas_type || this.canvasType || 'static'
          this.provider = providerFrom(msg) || this.provider || 'static'
          if (msg.title) this.title = msg.title
          if (msg.viewport) this.designWidth = msg.viewport
          if (Array.isArray(msg.pages)) this.pages = msg.pages
          if (msg.route != null) this.route = msg.route
          if (msg.page_id != null) this.pageId = msg.page_id
          if (msg.trusted_origin) this.trustedOrigin = msg.trusted_origin
          this.activeRevision = msg.revision || this.activeRevision
          // First preview opens the panel automatically; subsequent updates refresh in place.
          if (msg.type === 'preview_ready' || msg.first) this.open = true
          if (this.provider === 'web_builder') {
            // Keep the last-good signed URL visible; loadPreviewUrl swaps it only on success.
            if (msg.type === 'preview_updated' && this.previewUrl) this.status = 'updating'
            else this.status = 'live'
            this.loadPreviewUrl(msg.route != null ? msg.route : this.route)
          } else {
            this.status = 'live'
            // Load the freshly-produced revision into the frame (srcdoc).
            this.loadArtifact(msg.revision)
          }
          this.refreshMeta()
          return true
        }
        case 'canvas_pages':
          if (Array.isArray(msg.pages)) this.pages = msg.pages
          return true
        case 'preview_failed':
          this.status = this.previewUrl || this.html ? 'live' : 'error'
          this.error = msg.message || 'The latest design change failed.'
          this.previewError = this.provider === 'web_builder' ? this.error : this.previewError
          notify.error(this.error)
          // keep whatever revision / last-good preview is currently shown
          return true
        case 'canvas_revision_created':
        case 'canvas_revision_restored':
          this.refreshMeta()
          // On restore for web_builder the backend re-mints a preview — refresh the signed URL too.
          if (t === 'canvas_revision_restored' && this.provider === 'web_builder') this.loadPreviewUrl()
          return true
        default:
          return false
      }
    },

    // ── REST ────────────────────────────────────────────────────────────────────────────────
    // On entering a conversation, adopt any existing canvas so it survives reloads.
    async adoptConversation(conversationId) {
      if (!conversationId) return
      this.conversationId = conversationId
      try {
        const { data } = await api.get(`/conversations/${conversationId}/canvas/`)
        const c = data?.canvas
        if (!c) { this._resetCanvas(); return }
        this.canvasId = c.canvas_id
        this.canvasType = c.canvas_type
        this.provider = providerFrom(c) || 'static'
        this.status = c.status
        this.title = c.title || ''
        this.activeRevision = c.active_revision
        this.designWidth = c.viewport || '1440px'
        this.revisions = c.revisions || []
        if (Array.isArray(c.pages)) this.pages = c.pages
        if (c.route != null) this.route = c.route
        if (c.page_id != null) this.pageId = c.page_id
        if (c.trusted_origin) this.trustedOrigin = c.trusted_origin
        if (this.provider === 'web_builder') {
          await this.loadPreviewUrl(this.route)
        } else if (c.active_revision) {
          await this.loadArtifact(c.active_revision)
        }
      } catch (e) {
        // No canvas / not authorized — silently leave the panel closed.
        this._resetCanvas()
      }
    },

    async loadArtifact(revision) {
      if (!this.canvasId) return
      this.loading = true
      this.error = ''
      try {
        const rev = revision || this.activeRevision
        const { data } = await api.get(`/canvas/${this.canvasId}/artifact/`, {
          params: rev ? { revision: rev } : {},
        })
        this.html = data.content || ''
        this.revision = data.revision
        this.activeRevision = data.active_revision ?? this.activeRevision
        if (data.viewport) this.designWidth = data.viewport
        if (data.title) this.title = data.title
        // A new revision means the previous selection anchor may no longer exist — clear it.
        this.selectedElement = null
        this.selectMode = false
        this.frameKey += 1
      } catch (e) {
        this.error = 'Could not load the preview.'
        this.status = 'error'
      } finally {
        this.loading = false
      }
    },

    // web_builder: fetch a fresh signed, short-lived preview URL for the current (or a given) route.
    // The URL is NEVER persisted server-side and is kept here only as the last-good src. On failure we
    // keep the previous URL on screen and surface a non-blocking Retry (previewError) instead of blanking.
    async loadPreviewUrl(route) {
      if (!this.canvasId) return
      this.previewLoading = true
      this.previewError = ''
      try {
        const targetRoute = route != null ? route : this.route
        // Path matches the shipped canvas REST convention (`/api/canvas/{id}/...`, trailing slash) —
        // the api client baseURL is `/api`, and the backend route is `canvas/<uuid>/preview/`.
        const { data } = await api.get(`/canvas/${this.canvasId}/preview/`, {
          params: targetRoute != null ? { route: targetRoute } : {},
        })
        const url = data.url || data.preview_url || ''
        if (!url) throw new Error('no preview url')
        // Defense-in-depth: pin the origin we'll accept selection postMessages from. The backend already
        // rejects any URL whose origin ≠ the trusted preview host (Contract 4); we mirror it locally.
        this.trustedOrigin = data.trusted_origin || this._originOf(url)
        this.previewUrl = url
        this.previewExpiresAt = data.expires_at || null
        if (data.route != null) this.route = data.route
        if (data.page_id != null) this.pageId = data.page_id
        if (providerFrom(data)) this.provider = providerFrom(data)
        // A fresh render means the previous selection anchor may be stale — clear it.
        this.selectedElement = null
        this.selectMode = false
        this.status = 'live'
        this.frameKey += 1
        this.loadBuilderVersions()   // refresh the version history (a mutation likely added one)
      } catch (e) {
        // Keep the last-good preview visible; show a Retry affordance. Only hard-error if we have nothing.
        this.previewError = 'Could not refresh the store preview.'
        this.status = this.previewUrl ? 'live' : 'error'
      } finally {
        this.previewLoading = false
      }
    },

    async refreshMeta() {
      if (!this.conversationId) return
      try {
        const { data } = await api.get(`/conversations/${this.conversationId}/canvas/`)
        const c = data?.canvas
        if (c) {
          this.revisions = c.revisions || []
          this.activeRevision = c.active_revision
          this.title = c.title || this.title
          if (Array.isArray(c.pages)) this.pages = c.pages
        }
      } catch (e) { /* best-effort */ }
    },

    async restoreRevision(revision) {
      if (!this.canvasId || !revision) return
      try {
        await api.post(`/canvas/${this.canvasId}/revisions/${revision}/restore/`)
        if (this.provider === 'web_builder') await this.loadPreviewUrl()
        else await this.loadArtifact(revision)
        await this.refreshMeta()
        notify.success(`Restored revision ${revision}`)
      } catch (e) {
        notify.error('Could not restore that revision.')
      }
    },

    // web_builder route switch (A12): point the preview at another page/route → new signed URL.
    async switchRoute(route) {
      if (this.provider !== 'web_builder' || route == null || route === this.route) return
      this.route = route
      this.status = 'updating'
      await this.loadPreviewUrl(route)
    },

    // web_builder publish (A10/A15): go-live. Publishing has NO dedicated REST endpoint — it must go
    // through the agent's approval-gated `publish_builder_page` MCP tool. So the Publish button asks the
    // agent to publish (via a chat message); the approval card then appears. Dynamic import avoids a
    // static circular dependency with useChatStore (which imports this store).
    async publish() {
      if (this.provider !== 'web_builder' || !this.canvasId) return
      try {
        const mod = await import('./useChatStore')
        mod.useChatStore().sendMessage('Publish this page to make it live on the storefront.')
        notify.info('Asked the agent to publish — you’ll be prompted to approve before it goes live.')
      } catch (e) {
        notify.error('Could not start publishing.')
      }
    },

    // web_builder revision history (A16): list Kurumera BuilderVersions for the current page. Fetched
    // through the connector's MCP tool server-side; empty/failed lists just leave the dropdown empty.
    async loadBuilderVersions() {
      if (this.provider !== 'web_builder' || !this.canvasId) return
      try {
        const { data } = await api.get(`/canvas/${this.canvasId}/builder-versions/`)
        this.builderVersions = Array.isArray(data?.versions) ? data.versions : []
      } catch (e) {
        // Non-fatal: the connector may not expose the list tool yet — keep whatever we have.
        this.builderVersions = this.builderVersions || []
      }
    },

    // web_builder restore (A16): restore an append-only BuilderVersion by its id, then re-mint the
    // preview. Restore creates a NEW version on Kurumera — history is never destroyed.
    async restoreBuilderVersion(versionId) {
      if (this.provider !== 'web_builder' || !this.canvasId || !versionId) return
      this.status = 'updating'
      try {
        await api.post(`/canvas/${this.canvasId}/builder-versions/${encodeURIComponent(versionId)}/restore/`)
        await this.loadPreviewUrl(this.route)
        this.loadBuilderVersions()
        notify.success('Restored — a new revision was created from it.')
      } catch (e) {
        this.status = this.previewUrl ? 'live' : 'error'
        notify.error('Could not restore that version.')
      }
    },

    // ── UI ────────────────────────────────────────────────────────────────────────────────────
    setMode(on) {
      this.mode = !!on
      try { localStorage.setItem('cv.mode', this.mode ? '1' : '0') } catch (_e) { /* ignore */ }
      if (this.mode && this.canvasId) this.open = true
      else if (!this.mode) this.open = false
    },
    setViewport(v) { if (VIEWPORTS[v]) this.viewport = v },
    refreshFrame() { this.frameKey += 1 },
    // Provider-aware manual refresh: re-mint the signed URL for web_builder, hard-reload the srcdoc frame
    // for static.
    refreshPreview() {
      if (this.provider === 'web_builder') this.loadPreviewUrl()
      else this.refreshFrame()
    },
    // Phase 5 click-to-select.
    setSelectMode(on) { this.selectMode = !!on },
    setSelectedElement(el) { this.selectedElement = el || null; this.selectMode = false },
    clearSelection() { this.selectedElement = null },
    show() { if (this.canvasId) this.open = true },
    close() { this.open = false },
    toggle() { this.open = !this.open && !!this.canvasId ? true : !this.open },

    _originOf(url) {
      try { return new URL(url, window.location.origin).origin } catch (e) { return '' }
    },

    _resetCanvas() {
      this.canvasId = null
      this.provider = 'static'
      this.status = 'idle'
      this.title = ''
      this.revision = 0
      this.activeRevision = 0
      this.html = ''
      this.revisions = []
      this.error = ''
      this.previewUrl = ''
      this.previewExpiresAt = null
      this.previewError = ''
      this.trustedOrigin = ''
      this.route = '/'
      this.pageId = null
      this.pages = []
    },
  },
})
