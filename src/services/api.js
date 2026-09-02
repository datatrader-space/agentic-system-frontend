// src/services/api.js
/**
 * API Service - Centralized Axios configuration
 */

import axios from 'axios'

// Create axios instance
// Default timeout is SHORT (20s) so the 95% read path fails fast instead of hanging up to 2 minutes.
// Genuinely-long operations (discovery / enrichment / model sync / reindex / analyze / crawl) are bumped
// back up centrally in the request interceptor below, and a few callers pass an explicit higher timeout.
const DEFAULT_TIMEOUT = 60000
const LONG_TIMEOUT = 120000
const api = axios.create({
  baseURL: '/api',
  timeout: DEFAULT_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})
// URL fragments for long-running operations that need more than the 20s default. One place to maintain,
// covers current + future endpoints matching the pattern; an explicit per-call timeout still wins (Math.max).
const _LONG_OP = /(discover|enrich|reindex|reembed|\/sync|sync[_-]|\/analyze|\/crawl|generate[_-])/i
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}
// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add CSRF token for Django
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken
    }

    // Session-based auth (cookies are sent automatically with withCredentials: true)
    // No need to add Authorization header for session auth

    // Workspace context — picked up by WorkspaceContextMiddleware on the server
    const wsId = localStorage.getItem('activeWorkspaceId')
    if (wsId) {
      config.headers['X-Workspace-ID'] = wsId
    }

    // Long-running operations need more than the 20s default. Bump by URL pattern (an explicit higher
    // per-call timeout still wins via Math.max). Fast reads keep the 20s fail-fast default.
    if (_LONG_OP.test(config.url || '')) {
      config.timeout = Math.max(config.timeout || 0, LONG_TIMEOUT)
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle errors globally
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.status, error.response.data)
      // Session died (expired/revoked). This global handler is what lets the router guard be
      // OPTIMISTIC (navigate first, revalidate in background): any API call proves the session, so
      // when one comes back 401 we clear cached auth state and land on /login. Skip when already on
      // a public/login page, and skip the auth-check endpoint itself — the guard interprets that
      // response body directly ({authenticated:false} is a 200; a genuine 401 here still applies).
      if (error.response.status === 401) {
        const path = window.location.pathname
        const onPublicPage = path === '/login' || path === '/signup' || path === '/' ||
          path.startsWith('/share/') || path.startsWith('/a/') || path.startsWith('/embed/')
        if (!onPublicPage) {
          clearApiCache()
          try { localStorage.clear(); sessionStorage.clear() } catch { /* ignore */ }
          window.location.assign('/login')
        }
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.request)
    } else {
      // Something else happened
      console.error('Error:', error.message)
    }

    return Promise.reject(error)
  }
)

// ───────────────────────────────────────────────────────────────────────────
// GET request DEDUP + short-TTL CACHE
//
// Two cheap, broad wins for page-load speed:
//  1) Dedup: concurrent identical GETs share ONE in-flight promise, so two components mounting at
//     once (e.g. AgentBuilder + LLMSettings both calling /llm/providers/) make ONE network call.
//  2) Cache: slow-changing reference data is served from memory for a few seconds, so navigating
//     between tabs doesn't refetch providers/models/tools/etc. Any write (post/put/patch/delete)
//     clears the cache, so data is never stale after a mutation. Pass { noCache: true } to bypass.
// ───────────────────────────────────────────────────────────────────────────
const _inflight = new Map()
const _cache = new Map()

// url-path → cache TTL in ms (0 = dedup only, no caching). Matched by substring.
const _CACHE_TTL = [
  ['/auth/me', 60_000], ['/auth/check', 60_000],
  ['/llm/providers', 60_000], ['/llm/models', 60_000],
  ['/tools/definitions', 60_000], ['/services/', 60_000], ['/mcp/servers', 60_000],
  ['/connectors', 30_000], ['/credentials/builtin-scopes', 300_000],
  ['/v2/orgs', 60_000], ['/workspaces', 60_000],
  // The Platform Super Agent card — fetched on EVERY new-chat mount. Safe to cache briefly: the two
  // things a user can change about it from chat (model / run mode) are POSTs, and any POST clears the
  // cache, so the next read is fresh. Listed BEFORE nothing else matches '/agents/super-agent'
  // (_AGENTS_LIST is an exact-match regex on '/agents/', so there is no conflict).
  ['/agents/super-agent', 30_000],
]
// The agent LIST is slow-changing reference-ish data refetched on every navigation, so cache it briefly.
// EXACT match only — '/agents/' (list), NOT '/agents/{id}/...' live sub-resources (signals/credentials/
// etc.), which the substring list would wrongly cache. Safe because any agent write (POST/PUT/PATCH/
// DELETE to /agents/) clears the whole cache (it isn't in _NO_CACHE_INVALIDATE), so a created/edited agent
// shows up immediately.
const _AGENTS_LIST = /^\/agents\/?$/
function _ttlFor(url) {
  if (_AGENTS_LIST.test(url)) return 30_000
  for (const [frag, ttl] of _CACHE_TTL) if (url.includes(frag)) return ttl
  return 0
}
function _key(url, config) {
  return url + '::' + JSON.stringify((config && config.params) || {})
}

const _rawGet = api.get.bind(api)
api.get = (url, config = {}) => {
  const key = _key(url, config)
  const ttl = config.noCache ? 0 : _ttlFor(url)
  const now = Date.now()
  if (ttl) {
    const c = _cache.get(key)
    if (c && c.expiry > now) {
      // Return a fresh shallow copy so a caller mutating .data can't corrupt the cached copy.
      return Promise.resolve({ ...c.resp, data: _clone(c.resp.data), _cached: true })
    }
  }
  if (_inflight.has(key)) return _inflight.get(key)
  const p = _rawGet(url, config)
    .then((resp) => {
      _inflight.delete(key)
      if (ttl) _cache.set(key, { resp, expiry: Date.now() + ttl })
      return resp
    })
    .catch((err) => { _inflight.delete(key); throw err })
  _inflight.set(key, p)
  return p
}

function _clone(d) {
  try { return (typeof structuredClone === 'function') ? structuredClone(d) : JSON.parse(JSON.stringify(d)) }
  catch { return d }
}

// A mutation invalidates the GET cache (simple + always-correct for reference data). EXCEPTION:
// high-frequency chat/conversation writes (sending a message, etc.) never change any CACHED endpoint
// (auth/providers/models/tools/services/connectors/orgs/workspaces — see _CACHE_TTL), so clearing the
// cache after every chat message just forces needless refetches of all that reference data on the next
// navigation. Skip the clear for those write paths; everything else still clears.
const _NO_CACHE_INVALIDATE = /\/(chat|messages?|conversations|turn|long-answer|stream)\b/i
// Entries that survive ordinary mutations: AUTH state only changes via /auth/* writes (login/logout —
// those trigger a FULL clear below) or session expiry (the global 401 handler). Wiping it on every
// unrelated save forced the router guard into a blocking /auth/check round trip on the very next
// navigation — the "click does nothing for seconds" hang. Everything else still clears on write.
const _KEEP_ON_WRITE = ['/auth/check', '/auth/me']
function _invalidateForWrite(writeUrl) {
  // An auth mutation (login/logout/password/2FA) invalidates auth state itself — full clear.
  if (/\/auth\//i.test(writeUrl || '')) { _cache.clear(); return }
  for (const key of _cache.keys()) {
    const url = key.split('::')[0]
    if (!_KEEP_ON_WRITE.some((frag) => url.includes(frag))) _cache.delete(key)
  }
}
for (const m of ['post', 'put', 'patch', 'delete']) {
  const raw = api[m].bind(api)
  api[m] = (url, ...rest) => {
    if (!_NO_CACHE_INVALIDATE.test(url || '')) _invalidateForWrite(url)
    return raw(url, ...rest)
  }
}

// Exposed so auth flows (login/logout) can hard-reset cached user/reference data.
export function clearApiCache() { _cache.clear(); _inflight.clear() }

// API methods
export default {
  // Generic methods
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  patch: (url, data, config) => api.patch(url, data, config),
  delete: (url, config) => api.delete(url, config),

  // Admin — Crawler Export API (third-party crawl-data export keys + integration docs)
  getCrawlerExportKeys: () => api.get('/admin/crawler-export/keys/'),
  toggleCrawlerExport: (enabled) => api.post('/admin/crawler-export/toggle/', { enabled }),
  createCrawlerExportKey: (name) => api.post('/admin/crawler-export/keys/', { name }),
  revokeCrawlerExportKey: (id) => api.post(`/admin/crawler-export/keys/${id}/revoke/`),
  getCrawlerExportDocs: () => api.get('/admin/crawler-export/docs/'),
  embedWebSource: (id) => api.post(`/admin/web-sources/${id}/embed/`),

  // Partner Agent API — admin key management + integration guide (staff-only)
  getPartnerKeys: () => api.get('/admin/partner-keys/'),
  createPartnerKey: (userId, name) => api.post('/admin/partner-keys/', { user_id: userId, name }),
  revokePartnerKey: (id) => api.post(`/admin/partner-keys/${id}/revoke/`),
  togglePartnerKey: (id, revoked) => api.post(`/admin/partner-keys/${id}/toggle/`, { revoked }),
  rotatePartnerKey: (id) => api.post(`/admin/partner-keys/${id}/rotate/`),
  deletePartnerKey: (id) => api.delete(`/admin/partner-keys/${id}/`),
  getPartnerDocs: () => api.get('/admin/partner-keys/docs/'),
  searchPartnerUsers: (search) => api.get('/admin/users/', { params: { search, limit: 20 } }),

  // ARTC — Agent-Run Training Corpus: feedback labels / consent / governed pull of own runs
  submitTrainingFeedback: (payload) => api.post('/run-trace/feedback/', payload),
  getTrainingConsent: () => api.get('/run-trace/consent/'),
  setTrainingConsent: (payload) => api.post('/run-trace/consent/', payload),
  pullTrainingCorpus: (format = 'sft') => api.get('/run-trace/corpus/', { params: { fmt: format } }),

  // Systems
  getSystems: () => api.get('/systems/'),
  getSystem: (id) => api.get(`/systems/${id}/`),
  createSystem: (data) => api.post('/systems/', data),
  updateSystem: (id, data) => api.put(`/systems/${id}/`, data),
  deleteSystem: (id) => api.delete(`/systems/${id}/`),

  // Repositories
  getRepositories: (systemId) => api.get(`/systems/${systemId}/repositories/`),
  getRepository: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/`),
  createRepository: (systemId, data) => api.post(`/systems/${systemId}/repositories/`, data),
  deleteRepository: (systemId, repoId) => api.delete(`/systems/${systemId}/repositories/${repoId}/`),
  analyzeRepository: (systemId, repoId, force = false) =>
    api.post(`/systems/${systemId}/repositories/${repoId}/analyze/`, { force }),
  getQuestions: (systemId, repoId) =>
    api.get(`/systems/${systemId}/repositories/${repoId}/questions/`),
  submitAnswers: (systemId, repoId, answers) =>
    api.post(`/systems/${systemId}/repositories/${repoId}/submit_answers/`, { answers }),

  // Repository Documentation
  getRepositoryRequirements: (systemId, repoId) =>
    api.get(`/systems/${systemId}/repositories/${repoId}/requirements/`),

  // Unified Connectors (P0 — read-only aggregation over Services + MCP)
  // scope: 'global' | 'agent:<id>'
  getConnectors: (scope = 'global') => api.get('/connectors/', { params: { scope } }),
  // One-shot load for the Connectors page: agents + connectors + workspaces.
  getConnectorsBundle: (scope = 'global') => api.get('/connectors/bundle/', { params: { scope } }),
  // Per-connector tools grouped read-only/write + per-tool permissions (P3)
  getConnectorTools: (kind, id, scope = 'global') =>
    api.get(`/connectors/${kind}/${id}/tools/`, { params: { scope } }),
  updateConnectorPermissions: (kind, id, scope, permissions) =>
    api.patch(`/connectors/${kind}/${id}/permissions/`, { permissions }, { params: { scope } }),

  // Built-in connector services (GitHub, Slack, ...). Service-generic, keyed by service.
  // OAuth reuses startConnection(provider_slug).
  getConnectorServices: () => api.get('/connectors/services'),
  getConnectorCatalog: () => api.get('/connectors/catalog/'),
  getServiceStatus: (key) => api.get(`/connectors/svc/${key}/status`),
  connectServicePat: (key, token) => api.post(`/connectors/svc/${key}/connect-pat`, { token }),
  disconnectService: (key) => api.post(`/connectors/svc/${key}/disconnect`),
  enableService: (key) => api.post(`/connectors/svc/${key}/enable`),
  disableService: (key) => api.post(`/connectors/svc/${key}/disable`),

  // Workspaces (Execution sandboxes section inside Connectors)
  getWorkspaces: () => api.get('/workspaces/'),

  // Service Management
  getServices: (params) => api.get('/services/', { params }),
  getService: (id) => api.get(`/services/${id}/`),
  createService: (data) => api.post('/services/create/', data),
  updateService: (id, data) => api.post(`/services/${id}/update/`, data),
  deleteService: (id) => api.post(`/services/${id}/delete/`),
  createServiceActions: (id, data) => api.post(`/services/${id}/actions/create/`, data),
  discoverServiceActions: (data) => api.post('/services/discover/', data),
  enrichSchemas: (data, config) => {
    return api.post('/services/enrich-schemas/', data, config)
  },
  // Background enrichment. The synchronous endpoint above caps at 20 actions per call; these run the
  // whole set in Celery so nothing is dropped for want of a request timeout.
  startEnrichmentJob: (data) => api.post('/services/enrich-schemas/start/', data),
  // Cache-busted: without a unique URL the browser served one cached snapshot for ~60s, so a poll
  // every 1.5s reached the server 3 times in two minutes and the progress bar sat frozen at 0.
  // The endpoint also sends no-store; this is the belt to that pair of braces.
  getEnrichmentJobStatus: (jobId) => api.get(`/services/enrich-schemas/status/${jobId}/`, {
    params: { _: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
  }),
  repairServiceSchemas: (serviceId) => api.post(`/services/${serviceId}/repair-schemas/`),

  // Service authentication (attach or rotate a credential without re-registering)
  getServiceAuth: (serviceId) => api.get(`/services/${serviceId}/auth/`),
  updateServiceAuth: (serviceId, data) => api.post(`/services/${serviceId}/auth/`, data),
  startServiceOAuth: (serviceId) => api.post(`/oauth/start/${serviceId}/`),
  getServiceOAuthStatus: (serviceId) => api.get(`/oauth/status/${serviceId}/`),
  disconnectServiceOAuth: (serviceId) => api.post(`/oauth/disconnect/${serviceId}/`),

  // Service Sharing
  shareService: (serviceId, data) => api.post(`/services/${serviceId}/share/`, data),
  listShares: (serviceId) => api.get(`/services/${serviceId}/shares/`),
  revokeShare: (serviceId, shareId) => api.post(`/services/${serviceId}/shares/${shareId}/revoke/`),
  getSharedWithMe: () => api.get('/services/shared-with-me/'),

  // Service Draft Management
  saveDraft: (data) => {
    return api.post('/services/save-draft/', data)
  },

  loadDraft: (serviceId) => {
    return api.get(`/services/draft/${serviceId}/`)
  },

  listDrafts: () => {
    return api.get('/services/drafts/')
  },

  completeService: (serviceId) => {
    return api.post(`/services/${serviceId}/complete/`)
  },

  activateService: (serviceId) => {
    return api.post(`/services/${serviceId}/activate/`)
  },
  validateActions: (data) => api.post('/services/validate-actions/', data),

  // OAuth Connection
  getOAuthStatus: (serviceId) => api.get(`/oauth/status/${serviceId}/`),
  startOAuth: (serviceId) => api.get(`/oauth/start/${serviceId}/`),
  disconnectOAuth: (serviceId) => api.delete(`/oauth/disconnect/${serviceId}/`),

  // ── AADML AS an MCP server (INBOUND: ChatGPT/Claude drive AADML) ──────────────────────────────────
  // Not to be confused with the `getMCPServers` family directly below, which is the OUTBOUND direction:
  // third-party MCP servers that AADML itself consumes. Same three letters, opposite arrows — the
  // Integrations page labels them "AADML as an MCP server" vs "Connected MCP servers" for that reason.
  // These three are session-authenticated on purpose: an MCP bearer token must never be able to manage
  // the grants that authorize it (see mcp_gateway/views.py).
  getAadmlMcpInfo: () => api.get('/mcp/info/'),
  getAadmlMcpConnections: () => api.get('/mcp/connections/'),
  revokeAadmlMcpConnection: (grantId) => api.post(`/mcp/connections/${grantId}/revoke/`),

  // MCP Server Management
  getMCPServers: (params) => api.get('/mcp/servers/', { params }),
  getMCPServer: (id) => api.get(`/mcp/servers/${id}/`),
  createMCPServer: (data) => api.post('/mcp/servers/create/', data),
  // MCP OAuth 2.1 connect (Phase 1)
  mcpOauthInitiate: (data) => api.post('/mcp/oauth/initiate/', data),
  mcpOauthStatus: (connectionId) => api.get(`/mcp/oauth/status/${connectionId}/`),
  mcpOauthRetrySync: (connectionId) => api.post(`/mcp/oauth/retry-sync/${connectionId}/`),
  mcpOauthDisconnect: (connectionId) => api.post(`/mcp/oauth/disconnect/${connectionId}/`),
  updateMCPServer: (id, data) => api.post(`/mcp/servers/${id}/update/`, data),
  deleteMCPServer: (id) => api.post(`/mcp/servers/${id}/delete/`),
  refreshMCPTools: (id) => api.post(`/mcp/servers/${id}/refresh-tools/`),
  resetMCPCircuitBreaker: (id) => api.post(`/mcp/servers/${id}/reset-circuit-breaker/`),
  testMCPConnection: (id) => api.post(`/mcp/servers/${id}/test/`),
  executeMCPTool: (serverId, toolName, args) => api.post(`/mcp/servers/${serverId}/execute/`, { tool_name: toolName, arguments: args }),
  getMCPSessions: () => api.get('/mcp/sessions/'),

  // MCP Credentials
  getMCPCredentials: (serverId, agentProfileId) => api.get(`/mcp/servers/${serverId}/credentials/`, { params: { agent_profile_id: agentProfileId } }),
  setMCPCredentials: (serverId, data) => api.post(`/mcp/servers/${serverId}/credentials/set/`, data),
  deleteMCPCredential: (serverId, credentialId) => api.post(`/mcp/servers/${serverId}/credentials/${credentialId}/delete/`),



  // Repository Files — lazy, one directory level per call (opts.path), or a capped name search
  // (opts.search). No args = top-level entries.
  getRepositoryFiles: (systemId, repoId, opts = {}) => {
    const params = {}
    if (opts.path) params.path = opts.path
    if (opts.search) params.search = opts.search
    return api.get(`/systems/${systemId}/repositories/${repoId}/files/`, { params })
  },
  getFileContent: (systemId, repoId, filePath) =>
    api.get(`/systems/${systemId}/repositories/${repoId}/files/content/`, {
      params: { path: filePath }
    }),
  saveFileContent: (systemId, repoId, path, content) =>
    api.post(`/systems/${systemId}/repositories/${repoId}/files/write/`, { path, content }),
  // Source Control (VS Code–style SCM over the repo clone)
  getSourceControlStatus: (systemId, repoId) =>
    api.get(`/systems/${systemId}/repositories/${repoId}/source-control/status/`),
  getSourceControlDiff: (systemId, repoId, path) =>
    api.get(`/systems/${systemId}/repositories/${repoId}/source-control/diff/`, { params: { path } }),
  // LLM models (for the IDE model switcher)
  getLLMModels: () => api.get('/llm/models/'),

  // Knowledge
  getKnowledge: (systemId) => api.get(`/systems/${systemId}/knowledge/`),

  // Tasks
  getTasks: (systemId) => api.get(`/systems/${systemId}/tasks/`),
  getTask: (systemId, taskId) => api.get(`/systems/${systemId}/tasks/${taskId}/`),
  createTask: (systemId, data) => api.post(`/systems/${systemId}/tasks/`, data),
  approveTask: (systemId, taskId, notes = '') =>
    api.post(`/systems/${systemId}/tasks/${taskId}/approve/`, { notes }),
  rejectTask: (systemId, taskId, notes = '') =>
    api.post(`/systems/${systemId}/tasks/${taskId}/reject/`, { notes }),

  // LLM
  checkLLMHealth: () => api.get('/llm/health/'),
  getLlmStats: (params) => api.get('/llm/stats/', { params }),
  getLlmUsage: (params) => api.get('/llm/usage/', { params }),
  getSandboxUsage: (params) => api.get('/sandbox/usage/', { params }),
  terminateSandboxLease: (leaseId) => api.post(`/sandbox/leases/${leaseId}/terminate/`),
  getLlmRequests: (params) => api.get('/llm/requests/', { params }),
  getLlmAudit: (params) => api.get('/llm/audit/', { params }),
  // Per-conversation cost breakdown (Usage → Cost Breakdown tab): totals + by-source + by-model + calls.
  getLlmCostByConversation: (params) => api.get('/llm/conversation-breakdown/', { params }),
  // One-shot loads: Activity page (agents+stats+usage+requests+audit) and
  // Settings → LLM tab (providers+models+stats+operation-models).
  getLlmDashboard: (params) => api.get('/llm/dashboard/', { params }),
  getLlmConfigureBundle: () => api.get('/llm/configure-bundle/'),
  // Admin — DB-backed model pricing (staff only; backend enforces IsAdminUser)
  getModelPricing: (params) => api.get('/admin/model-pricing/', { params }),
  setModelPricing: (id, data) => api.post(`/admin/model-pricing/${id}/`, data),
  syncOpenRouterPricing: () => api.post('/admin/model-pricing/sync-openrouter/', {}),

  // Admin — RAG Knowledge console (P9/P8/P10; staff only, backend enforces IsAdminUser)
  kbSettings: () => api.get('/admin/knowledge/settings/', { noCache: true }),
  kbUpdateSettings: (data) => api.put('/admin/knowledge/settings/', data),
  kbOverview: (params) => api.get('/admin/knowledge/overview/', { params, noCache: true }),
  kbTopQuestions: (params) => api.get('/admin/knowledge/top-questions/', { params, noCache: true }),
  kbUnanswered: (params) => api.get('/admin/knowledge/unanswered/', { params, noCache: true }),
  kbConflicts: (params) => api.get('/admin/knowledge/conflicts/', { params, noCache: true }),
  kbEval: (params) => api.get('/admin/knowledge/eval/', { params, noCache: true, timeout: 120000 }),
  kbSearchTest: (data) => api.post('/admin/knowledge/search-test/', data),
  kbCorrections: (params) => api.get('/admin/knowledge/corrections/', { params, noCache: true }),
  kbCreateCorrection: (data) => api.post('/admin/knowledge/corrections/', data),
  kbUpdateCorrection: (id, data) => api.patch(`/admin/knowledge/corrections/${id}/`, data),
  kbDeleteCorrection: (id) => api.delete(`/admin/knowledge/corrections/${id}/`),
  kbArchiveChunk: (id, data) => api.post(`/admin/knowledge/chunks/${id}/archive/`, data || {}),
  kbNeedsReview: () => api.get('/admin/knowledge/needs-review/', { noCache: true }),
  kbIndexHealth: (params) => api.get('/admin/knowledge/index-health/', { params, noCache: true }),
  kbReembed: (data) => api.post('/admin/knowledge/reembed/', data, { timeout: 300000 }),
  kbSetTrust: (data) => api.post('/admin/knowledge/trust/', data),
  kbSetAcl: (data) => api.post('/admin/knowledge/acl/', data),
  kbAliases: (params) => api.get('/admin/knowledge/aliases/', { params, noCache: true }),
  kbCreateAlias: (data) => api.post('/admin/knowledge/aliases/', data),
  kbDeleteAlias: (id) => api.delete(`/admin/knowledge/aliases/${id}/`),

  getLlmProviders: (params) => api.get('/llm/providers/', { params }),
  createLlmProvider: (data) => api.post('/llm/providers/', data),
  updateLlmProvider: (id, data) => api.put(`/llm/providers/${id}/`, data),
  deleteLlmProvider: (id) => api.delete(`/llm/providers/${id}/`),
  testLlmProvider: (id, model) => api.post(`/llm/providers/${id}/test/`, model ? { model } : {}),
  // Generic re-sync for ANY provider type (openai/anthropic/gemini/xai/openrouter/ollama).
  // Models also auto-sync on provider creation server-side; this is the manual refresh.
  syncModels: (id) => api.post(`/llm/providers/${id}/sync_models/`),
  syncOllamaModels: (id) => api.post(`/llm/providers/${id}/sync_ollama_models/`),
  syncOpenRouterModels: (id) => api.post(`/llm/providers/${id}/sync_openrouter_models/`),
  syncOpenAIModels: (id) => api.post(`/llm/providers/${id}/sync_openai_models/`),
  getLlmModels: (params = {}) => api.get('/llm/models/', { params }),
  // Per-user model selection for internal LLM ops (ask_llm / summarize / artifact_summarize)
  getOperationModels: () => api.get('/llm/operation-models/'),
  updateOperationModels: (data) => api.put('/llm/operation-models/', data),
  reindexEmbeddings: () => api.post('/llm/reindex-embeddings/'),
  getEmbeddingStatus: () => api.get('/llm/reindex-embeddings/'),
  createLlmModel: (data) => api.post('/llm/models/', data),
  updateLlmModel: (id, data) => api.put(`/llm/models/${id}/`, data),
  deleteLlmModel: (id) => api.delete(`/llm/models/${id}/`),

  // Agents
  getAgents: () => api.get('/agents/'),
  getAgent: (id) => api.get(`/agents/${id}/`),
  // Update agent fields (used by the chat Modes picker to persist the canonical agent_run_mode).
  updateAgent: (id, data) => api.patch(`/agents/${id}/`, data),

  // Authentication
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  checkAuth: () => api.get('/auth/check'),
  // First-run onboarding state (feature tour). Best-effort persistence so the tour
  // follows the user across devices. Body: { onboarding_completed?, onboarding_step? }.
  updateOnboarding: (data) => api.patch('/auth/me/onboarding', data),
  // In-app notifications (bell)
  getNotifications: (params) => api.get('/notifications/', { params, noCache: true }),
  getNotifUnreadCount: () => api.get('/notifications/unread-count/', { noCache: true }),
  markAllNotifsRead: () => api.post('/notifications/read-all/', {}),
  markNotifRead: (id) => api.patch(`/notifications/${id}/read/`, {}),
  getNotifPreferences: () => api.get('/notifications/preferences/', { noCache: true }),
  updateNotifPreferences: (data) => api.put('/notifications/preferences/', data),
  // Help Center: derived per-step onboarding checklist status (provider/agent/
  // connector/run/workflow/budget/guardrails) + aggregate progress.
  getOnboardingStatus: () => api.get('/onboarding/status/'),

  // Documentation/articles content (ContentPage) — docs, blog, changelog. Public.
  getContentPages: (params) => api.get('/content/pages/', { params }),
  getContentPage: (slug) => api.get(`/content/pages/${slug}/`),
  getDocsTree: () => api.get('/content/docs-tree/'),
  getChangelog: () => api.get('/content/pages/', { params: { type: 'changelog' } }),

  // Tutorials (helpcenter app) — dedicated domain models + per-user progress.
  getTutorials: (params) => api.get('/tutorials/', { params }),
  getTutorial: (slug) => api.get(`/tutorials/${slug}/`),
  updateTutorialProgress: (slug, data) => api.post(`/tutorials/${slug}/progress/`, data),
  sendTutorialFeedback: (slug, data) => api.post(`/tutorials/${slug}/feedback/`, data),

  // Guided Tours (helpcenter app) — backend-driven catalog + steps + per-user state.
  getGuidedTours: () => api.get('/guided-tours/'),
  updateTourProgress: (key, data) => api.post(`/guided-tours/${key}/progress/`, data),

  // Support tickets (helpcenter app).
  getSupportCategories: () => api.get('/support/categories/'),
  getSupportTickets: (params) => api.get('/support/tickets/', { params }),
  createSupportTicket: (data) => api.post('/support/tickets/', data),
  getSupportTicket: (ref) => api.get(`/support/tickets/${ref}/`),
  replySupportTicket: (ref, data) => api.post(`/support/tickets/${ref}/reply/`, data),
  updateSupportTicket: (ref, data) => api.patch(`/support/tickets/${ref}/update/`, data),

  // Smart Help Center (Help Knowledge System).
  helpSuggest: (q) => api.get('/help/suggest', { params: { q }, noCache: true }),
  helpSearch: (q) => api.get('/help/search', { params: { q }, noCache: true }),
  getPopularSearches: () => api.get('/help/popular-searches'),
  getHelpHome: () => api.get('/help/home'),
  getHelpTopics: () => api.get('/help/topics'),
  getHelpList: (params) => api.get('/help/list', { params }),
  getHelpContent: (slug) => api.get(`/help/content/${slug}`),
  getHelpLearningPaths: () => api.get('/help/learning-paths'),
  getHelpLearningPath: (slug) => api.get(`/help/learning-paths/${slug}`),
  logHelpSearch: (data) => api.post('/help/search-log', data),
  sendHelpFeedback: (data) => api.post('/help/feedback', data),
  askHelpAssistant: (data) => api.post('/help/assistant', data, { timeout: 60000 }),
  chatHelpAssistant: (data) => api.post('/help/assistant/chat', data, { timeout: 60000 }),
  getBuiltinHelpAssistant: () => api.get('/agents/builtin/help-assistant/', { noCache: true }),
  // AI Assistant slot — the agent that powers the widget (falls back to the built-in help-assistant).
  getAssistantConfig: () => api.get('/assistant/config', { noCache: true }),
  // Shared KB sources (e.g. Help Center) an agent can attach to.
  listKnowledgeSources: () => api.get('/knowledge-sources/', { noCache: true }),

  // Guided tours (backend-driven walkthroughs).
  getHelpGuidedTours: (params) => api.get('/help/guided-tours', { params, noCache: true }),
  getHelpGuidedTour: (slug) => api.get(`/help/guided-tours/${slug}`, { noCache: true }),
  getHelpToursForRoute: (route) => api.get('/help/guided-tours/for-route', { params: { route }, noCache: true }),
  startHelpTour: (slug, data) => api.post(`/help/guided-tours/${slug}/start`, data || {}),
  progressHelpTour: (slug, data) => api.post(`/help/guided-tours/${slug}/progress`, data || {}),
  completeHelpTour: (slug) => api.post(`/help/guided-tours/${slug}/complete`, {}),
  skipHelpTour: (slug) => api.post(`/help/guided-tours/${slug}/skip`, {}),

  // Admin Help Center analytics (staff only).
  adminHelpAnalytics: (section, params) => api.get(`/admin/help-analytics/${section}`, { params, noCache: true }),

  // Admin — built-in (system) agents console (platform-admin only). READ + destroy/publish/clone only:
  // authoring/editing happens in the normal agent builder (make_builtin on /agents/) — one write path.
  adminListBuiltinAgents: (params) => api.get('/admin/builtin-agents/', { noCache: true, params }),
  adminDeleteBuiltinAgent: (id) => api.delete(`/admin/builtin-agents/${id}/`),
  adminToggleBuiltinAgent: (id, enabled) => api.post(`/admin/builtin-agents/${id}/publish/`, { enabled }),
  adminCloneBuiltinAgent: (id) => api.post(`/admin/builtin-agents/${id}/clone/`, {}),
  cloneBuiltinAgent: (slug) => api.post(`/agents/builtin/${slug}/clone/`, {}),
  listBuiltinAgents: () => api.get('/agents/builtin/', { noCache: true }),

  // The ONE shared Platform Super Agent (system-owned built-in; per-caller team/inventory/model).
  // FULL payload — the Super Agent page + the admin console (capability inventory, tool catalog,
  // delegation team, model options). Heavy by design; server-side cached per user.
  getSuperAgent: () => api.get('/agents/super-agent/', { noCache: true }),
  // SLIM card — what CHAT needs to open a conversation (identity + run mode + image model). Skips the
  // capability inventory / tool catalog / model-options blocks entirely (~26 queries → a handful).
  // The chat model picker fetches /agents/<id>/model-options/ separately when the user opens it.
  getSuperAgentCard: () => api.get('/agents/super-agent/', { params: { slim: 1 } }),
  // Shared-agent model picker: the caller's provider cards + models, and their sticky pick.
  getAgentModelOptions: (id) => api.get(`/agents/${id}/model-options/`, { noCache: true }),
  selectAgentModel: (id, modelId) => api.post(`/agents/${id}/select-model/`, { model_id: modelId }),
  // Per-user run mode for SHARED agents. A plain updateAgent() would write the ONE shared row and
  // change the mode for every user on the platform — this writes the caller's override only.
  selectAgentRunMode: (id, runMode) => api.post(`/agents/${id}/select-run-mode/`, { agent_run_mode: runMode }),
  // AI Assistant slot — which agent powers the widget (one at a time).
  adminGetAssistantConfig: () => api.get('/admin/assistant/config', { noCache: true }),
  adminSetAssistantAgent: (agentId) => api.put('/admin/assistant/config', { agent_id: agentId }),

  // API reference (curated, grouped) — public Help Center read.
  getApiReference: () => api.get('/api-reference/'),

  // Admin Dashboard — curated API-reference registry management (platform-admin only).
  adminListApiEndpoints: (params) => api.get('/admin/helpcenter/api-endpoints/', { params, noCache: true }),
  adminGetApiEndpoint: (id) => api.get(`/admin/helpcenter/api-endpoints/${id}/`, { noCache: true }),
  adminCreateApiEndpoint: (data) => api.post('/admin/helpcenter/api-endpoints/', data),
  adminUpdateApiEndpoint: (id, data) => api.patch(`/admin/helpcenter/api-endpoints/${id}/`, data),
  adminDeleteApiEndpoint: (id) => api.delete(`/admin/helpcenter/api-endpoints/${id}/`),
  adminPreviewApiEndpoint: (id) => api.post(`/admin/helpcenter/api-endpoints/${id}/preview/`, {}),
  adminPreviewApiEndpointData: (data) => api.post('/admin/helpcenter/api-endpoints/preview/', data),
  adminSeedApiEndpoints: () => api.post('/admin/helpcenter/api-endpoints/seed/', {}),
  adminGenerateApiDraft: (id) => api.post(`/admin/helpcenter/api-endpoints/${id}/generate-ai-draft/`, {}),

  // Admin — Help Center content management (CMS).
  adminListHelpContent: (params) => api.get('/admin/helpcenter/content/', { params, noCache: true }),
  adminGetHelpContent: (id) => api.get(`/admin/helpcenter/content/${id}/`, { noCache: true }),
  adminCreateHelpContent: (data) => api.post('/admin/helpcenter/content/', data),
  adminUpdateHelpContent: (id, data) => api.patch(`/admin/helpcenter/content/${id}/`, data),
  adminDeleteHelpContent: (id) => api.delete(`/admin/helpcenter/content/${id}/`),
  adminPublishHelpContent: (id, published) => api.post(`/admin/helpcenter/content/${id}/publish/`, { published }),
  adminHelpContentMeta: () => api.get('/admin/helpcenter/content/meta/', { noCache: true }),
  adminGenerateHelpEmbeddings: () => api.post('/admin/helpcenter/content/generate-embeddings/', {}),
  // Upload a document (PDF/DOCX/…) → MarkItDown converts it → a DRAFT HelpContent is created to edit.
  adminImportHelpDocument: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/admin/helpcenter/content/import-document/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  adminHelpEmbeddingsStatus: () => api.get('/admin/helpcenter/content/generate-embeddings/status/', { noCache: true }),

  // Admin — Help article relations (related / prerequisite / next_step …).
  adminListRelations: (sourceId) => api.get('/admin/helpcenter/relations/', { params: { source: sourceId }, noCache: true }),
  adminCreateRelation: (data) => api.post('/admin/helpcenter/relations/', data),
  adminDeleteRelation: (id) => api.delete(`/admin/helpcenter/relations/${id}/`),
  adminRelationTypes: () => api.get('/admin/helpcenter/relations/relation-types/', { noCache: true }),

  // Admin — Guided Tours (CRUD + ordered steps).
  adminListGuidedTours: (params) => api.get('/admin/helpcenter/guided-tours/', { params, noCache: true }),
  adminGetGuidedTour: (id) => api.get(`/admin/helpcenter/guided-tours/${id}/`, { noCache: true }),
  adminCreateGuidedTour: (data) => api.post('/admin/helpcenter/guided-tours/', data),
  adminUpdateGuidedTour: (id, data) => api.patch(`/admin/helpcenter/guided-tours/${id}/`, data),
  adminDeleteGuidedTour: (id) => api.delete(`/admin/helpcenter/guided-tours/${id}/`),
  adminPublishGuidedTour: (id, published) => api.post(`/admin/helpcenter/guided-tours/${id}/publish/`, { published }),
  adminGuidedTourMeta: () => api.get('/admin/helpcenter/guided-tours/meta/', { noCache: true }),

  // Auth hardening (Track B): verification, password reset/change, 2FA
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  changePassword: (current_password, new_password) => api.post('/auth/change-password', { current_password, new_password }),
  twofaStatus: () => api.get('/auth/2fa/status'),
  twofaSetup: () => api.post('/auth/2fa/setup'),
  twofaConfirm: (code) => api.post('/auth/2fa/confirm', { code }),
  twofaDisable: (password) => api.post('/auth/2fa/disable', { password }),
  twofaVerify: (ephemeral_token, code) => api.post('/auth/2fa/verify', { ephemeral_token, code }),

  // Billing (Track C — Stripe). Plans is public; the rest are org-scoped + auth.
  billingPlans: () => api.get('/billing/plans/'),
  billingSubscription: () => api.get('/billing/subscription/', { noCache: true }),
  billingCheckout: (tier, interval) => api.post('/billing/checkout/', { tier, interval }),
  billingPortal: () => api.post('/billing/portal/'),

  // Web analytics — admin reports (Track D)
  analyticsOverview: (days = 30) => api.get('/analytics/admin/overview/', { params: { days } }),
  analyticsPages: (days = 30) => api.get('/analytics/admin/pages/', { params: { days } }),
  analyticsSources: (days = 30) => api.get('/analytics/admin/sources/', { params: { days } }),
  analyticsTech: (days = 30) => api.get('/analytics/admin/tech/', { params: { days } }),
  analyticsVisitors: (days = 30, limit = 50, offset = 0) =>
    api.get('/analytics/admin/visitors/', { params: { days, limit, offset } }),
  analyticsVisitor: (vid) => api.get(`/analytics/admin/visitors/${vid}/`),
  analyticsFunnels: (days = 30) => api.get('/analytics/admin/funnels/', { params: { days } }),

  // GitHub OAuth
  githubConfig: () => api.get('/auth/github/config'),
  githubLogin: () => api.get('/auth/github/login'),
  githubTestToken: (token = null) => {
    const url = token ? `/auth/github/test?token=${token}` : '/auth/github/test'
    return api.get(url)
  },
  githubListRepos: () => api.get('/auth/github/repos'),
  githubGetRepoInfo: (githubUrl) => api.post('/auth/github/repo-info', { github_url: githubUrl }),

  // CRS outputs
  runCrs: (systemId, repoId) => api.post(`/systems/${systemId}/repositories/${repoId}/crs/run/`),
  enrichCrs: (systemId, repoId, opts = {}) => api.post(`/systems/${systemId}/repositories/${repoId}/crs/enrich/`, opts),
  getCrsSummary: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/crs/summary/`),
  getCrsBlueprints: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/crs/blueprints/`),
  getCrsArtifacts: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/crs/artifacts/`),
  getCrsRelationships: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/crs/relationships/`),

  // Coding workspace ("Let's Code", P1) — flag-gated on the backend (CODING_WORKSPACE_ENABLED)
  startCodingTask: (systemId, repoId, prompt, modelId = null, agentId = null) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/start/`, { prompt, model_id: modelId, agent_id: agentId }),
  listCodingTasks: (systemId, repoId) => api.get(`/systems/${systemId}/repositories/${repoId}/coding/tasks/`),
  getCodingTask: (systemId, repoId, taskId) => api.get(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/`),
  cancelCodingTask: (systemId, repoId, taskId) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/cancel/`),
  discardCodingTask: (systemId, repoId, taskId) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/discard/`),
  revertCodingFile: (systemId, repoId, taskId, path) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/revert-file/`, { path }),
  revertCodingHunk: (systemId, repoId, taskId, path, hunk) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/revert-hunk/`, { path, hunk }),
  exportCodingTask: (systemId, repoId, taskId) => api.post(`/systems/${systemId}/repositories/${repoId}/coding/tasks/${taskId}/export/`),

  // Let's Code IDE — projects (clone GitHub repo → CRS pipeline; hides systems/repos)
  unifiedConfig: (systemId = null) => api.get('/lets-code/unified-config/', systemId ? { params: { system: systemId } } : {}),   // { enabled, export_enabled, agent_id }
  listProjects: () => api.get('/lets-code/projects/', { noCache: true }),
  createProject: (data) => api.post('/lets-code/projects/', data),   // { github_url, name?, branch? }
  getProject: (repoId) => api.get(`/lets-code/projects/${repoId}/`, { noCache: true }),
  deleteProject: (repoId) => api.delete(`/lets-code/projects/${repoId}/`),
  retryProject: (repoId) => api.post(`/lets-code/projects/${repoId}/retry/`),
  getProjectBranches: (repoId) => api.get(`/lets-code/projects/${repoId}/branches/`, { noCache: true }),
  switchProjectBranch: (repoId, branch) => api.post(`/lets-code/projects/${repoId}/switch-branch/`, { branch }),

  // Combined CRS payloads
  getCRSPayloads: async (systemId, repoId) => {
    const [blueprints, artifacts, relationships] = await Promise.all([
      api.get(`/systems/${systemId}/repositories/${repoId}/crs/blueprints/`),
      api.get(`/systems/${systemId}/repositories/${repoId}/crs/artifacts/`),
      api.get(`/systems/${systemId}/repositories/${repoId}/crs/relationships/`)
    ])
    return {
      data: {
        blueprints: blueprints.data,
        artifacts: artifacts.data.artifacts || [],
        relationships: relationships.data.relationships || []
      }
    }
  },

  // Context Files
  getConversations: (params) => api.get('/conversations/', { params }),
  getConversation: (id) => api.get(`/conversations/${id}/`),
  // Older pages of one thread. The conversation endpoint returns only the most recent window, so a
  // long chat opens fast; this walks backwards from the oldest message the client holds.
  // `before` is an EXCLUSIVE message id (cursor, not an offset — safe while messages are appended).
  getConversationMessages: (id, params) => api.get(`/conversations/${id}/messages/`, { params }),
  createConversation: (data) => api.post('/conversations/', data),

  // ── Conversation sharing (ChatGPT-style links) ──────────────────────────────────────────
  // Owner surface. Creating a link FREEZES a snapshot — messages sent afterwards stay private
  // until the owner explicitly refreshes the link.
  getConversationShares: (conversationId) => api.get(`/conversations/${conversationId}/share/`),
  createConversationShare: (conversationId, data = {}) =>
    api.post(`/conversations/${conversationId}/share/`, data),
  getMyShares: () => api.get('/shares/'),
  updateShare: (token, data) => api.patch(`/shares/${token}/`, data),
  revokeShare: (token) => api.delete(`/shares/${token}/`),
  // Public surface — `share/` (singular) is anonymous-readable; it must NEVER be confused with
  // the owner-only `shares/` (plural) routes above.
  getSharedConversation: (token) => api.get(`/share/${token}/`),
  forkSharedConversation: (token, data = {}) => api.post(`/share/${token}/fork/`, data),

  // Durable thumbs up/down on ONE assistant message. Pass value:null to clear.
  setMessageFeedback: (messageId, payload) => api.post(`/messages/${messageId}/feedback/`, payload),

  uploadContextFile: (conversationPk, file, agentId = null) => {
    const formData = new FormData()
    formData.append('file', file)
    if (agentId) {
      formData.append('agent_profile_id', agentId)
    }

    // If agentId is provided, we can use a direct endpoint or the same one if generic
    // But since current URL is /conversations/:id/files/, we need a generic one or assume conversationPk is null
    // Let's use the generic viewset if no conversationPk, but our URLs are nested.
    // Actually, I didn't add a generic router for files.
    // I should probably add a generic path or assume conversationPk might be 'agent' placeholder?
    // BETTER: Use a new generic endpoint in api.js?
    // Wait, the backend logic I added to ContextFileViewSet creates a generic endpoint if I register it.
    // Let's assume I need to register strict /context_files/ endpoint in urls.py for this to work clean.
    // For now, let's keep the nested URL for conversation, and use a different strategy or Assume user adds generic route.

    // Changing strategy: I will assume I added `router.register(r'context_files', ...)` or similiar.
    // But I didn't. I only modified the ViewSet code.
    // I need to register the generic route in urls.py first.
    // Let's modify api.js assuming the route exists as /agents/:id/files/ or /context_files/

    // Let's assume /context_files/ for generic access
    let url = `/conversations/${conversationPk}/files/`
    if (agentId && !conversationPk) {
      // Generic endpoint required.
      // Pass.
    }
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  // RE-WRITING properly below
  uploadAgentFile: (agentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('agent_profile', agentId);
    // We need a generic endpoint. I will add 'context_files' to router in next step.
    return api.post('/context_files/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  // Emulator Inspector: real per-turn debug logs (exact prompt the model received + response).
  getAgentDebugLogs: (agentId, params) => api.get(`/agents/${agentId}/debug-logs/`, { params }),

  // ── Publish lifecycle ──
  publishAgent: (id) => api.post(`/agents/${id}/publish/`),
  unpublishAgent: (id) => api.post(`/agents/${id}/unpublish/`),
  pauseAgent: (id, reason) => api.post(`/agents/${id}/pause/`, { reason }),
  unpauseAgent: (id) => api.post(`/agents/${id}/unpause/`, {}),
  // ── Admin: SYSTEM-wide Guardrails & Approvals floor (GlobalAgentPolicy). GET any authed user; PATCH staff-only. ──
  getGlobalAgentPolicy: () => api.get('/global-agent-policy/'),
  updateGlobalAgentPolicy: (data) => api.patch('/global-agent-policy/', data),
  // ── Org-tier Guardrails & Approvals (OrgAgentPolicy). GET any member; PATCH org owner/admin. ──
  getOrgAgentPolicy: (params = {}) => api.get('/org-agent-policy/', { params }),
  updateOrgAgentPolicy: (data) => api.patch('/org-agent-policy/', data),
  // ── Agent builder + monitoring (Screens 18 / 10) ──
  getAgentGuardrails: (id) => api.get(`/agents/${id}/guardrails/`),
  // P6: effective LLM turn-policy preview + selectable context profiles (read-only)
  getAgentEffectivePolicy: (id, params = {}) => api.get(`/agents/${id}/effective-policy/`, { params }),
  getAgentActionUsage: (id, params = {}) => api.get(`/agents/${id}/action-usage/`, { params }),
  // ── Web Intelligence (WEB_SEARCH broker) ──
  // The model list is capability-VERIFIED only (never "every model from this provider"); saving goes
  // through its own validated endpoint, not the generic agent PATCH, so an unsupported search model
  // is rejected server-side (400 WEB_SEARCH_MODEL_UNSUPPORTED) instead of failing at runtime.
  getWebSearchModels: () => api.get('/models/web-search/'),
  probeWebSearchModel: (provider, model_id) => api.post('/models/web-search/probe/', { provider, model_id }),
  getAgentWebIntelligence: (id) => api.get(`/agents/${id}/web-intelligence/`),
  updateAgentWebIntelligence: (id, data) => api.patch(`/agents/${id}/web-intelligence/`, data),
  getAgentMonitoring: (id) => api.get(`/agents/${id}/monitoring/`),
  rollbackAgent: (id) => api.post(`/agents/${id}/rollback/`),
  // ── Tools Library (Screen 24) ──
  getTools: (params) => api.get('/tools/', { params }),
  getToolCatalog: (params) => api.get('/tools/catalog/', { params }),
  getToolDetail: (name) => api.get(`/tools/${name}/`),
  updateTool: (name, data) => api.post(`/tools/${name}/update/`, data),
  getToolAgents: (name) => api.get(`/tools/${name}/agents/`),
  createYamlTool: (data) => api.post('/tools/create/yaml/', data),
  registerRemoteTool: (data) => api.post('/tools/register/remote/', data),
  deleteTool: (name) => api.post(`/tools/${name}/delete/`),
  // ── Templates ──
  listAgentTemplates: () => api.get('/agents/templates/'),
  saveAgentAsTemplate: (id, data) => api.post(`/agents/${id}/save-as-template/`, data),
  createAgentFromTemplate: (data) => api.post('/agents/from-template/', data),
  // ── Public share / webchat deploy ──
  getAgentShare: (id) => api.get(`/agents/${id}/share/`),
  enableAgentShare: (id) => api.post(`/agents/${id}/share/enable/`),
  disableAgentShare: (id) => api.post(`/agents/${id}/share/disable/`),
  regenerateAgentShare: (id) => api.post(`/agents/${id}/share/regenerate/`),
  updateAgentShareSettings: (id, data) => api.patch(`/agents/${id}/share/`, data),
  // Public (no auth): the webchat widget / public chat page reads this by share token.
  getPublicAgentConfig: (token) => api.get(`/public/agents/${token}/config.json`),
  // Confirm + (re)build the RAG index for an uploaded knowledge document.
  // Queues a Celery embed job; live progress streams over the knowledge-index WS.
  indexAgentFile: (fileId) => api.post(`/context_files/${fileId}/index/`),
  // Poll fallback for index status (WS push is primary).
  getAgentFileStatus: (fileId) => api.get(`/context_files/${fileId}/status/`),
  // ── Standalone user-scoped Knowledge & RAG (KnowledgeSource-backed, assignable to any agent) ──
  listKnowledge: (scope) => api.get('/knowledge/', { params: scope ? { scope } : {} }),
  getKnowledge: (id) => api.get(`/knowledge/${id}/`),
  deleteKnowledge: (id) => api.delete(`/knowledge/${id}/`),
  uploadKnowledgeFile: (file, name) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    return api.post('/knowledge/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  // Website resource: reuses the SAME crawl pipeline as the agent editor, anchored to a KnowledgeSource.
  crawlKnowledgeWebsite: (data) => api.post('/web_sources/discover/', { ...data, standalone: true }),
  exportKnowledge: (id) => api.get(`/knowledge/${id}/export/`, { responseType: 'blob' }),
  // List the current user's assignable KnowledgeSources for the agent editor picker.
  listUserKnowledgeSources: () => api.get('/knowledge/'),

  // ── Website knowledge sources (crawl → index → RAG). Live progress on the knowledge-index WS. ──
  discoverWebSource: (data) => api.post('/web_sources/discover/', data),
  getWebSource: (id) => api.get(`/web_sources/${id}/`),
  listWebSources: (agentId) => api.get('/web_sources/', { params: { agent_id: agentId } }),
  addWebSource: (id, data) => api.post(`/web_sources/${id}/add/`, data),
  reindexWebSource: (id) => api.post(`/web_sources/${id}/reindex/`),
  cancelWebSource: (id) => api.post(`/web_sources/${id}/cancel/`),
  deleteWebSource: (id) => api.delete(`/web_sources/${id}/`),
  getWebSourcePages: (id, params = {}) => api.get(`/web_sources/${id}/pages/`, { params }),
  addWebSourcePages: (id, urls) => api.post(`/web_sources/${id}/add_pages/`, { urls }),
  setWebSourceRecrawl: (id, recrawl_schedule) => api.post(`/web_sources/${id}/set_schedule/`, { recrawl_schedule }),
  // Approved URL / YouTube document ingestion (SSRF-gated → DocumentSource → MarkItDown). YouTube URLs
  // enter here too (captions-first). payload: { url, scope?, agent_id?, conversation_id? }.
  addDocumentUrl: (payload) => api.post('/document_sources/url/', payload),
  getDocumentSource: (id) => api.get(`/document_sources/${id}/`),
  listDocumentSources: (params = {}) => api.get('/document_sources/', { params }),
  // ── Attached (shared) knowledge bases: reuse a file/website from the owner's OTHER agents ──
  getAgentKnowledgeLibrary: (agentId) => api.get(`/agents/${agentId}/knowledge-library/`),
  getAgentKnowledgeAttachments: (agentId) => api.get(`/agents/${agentId}/knowledge-attachments/`),
  attachAgentKnowledge: (agentId, payload) => api.post(`/agents/${agentId}/knowledge-attachments/`, payload),
  detachAgentKnowledge: (agentId, payload) => api.post(`/agents/${agentId}/knowledge-attachments/detach/`, payload),
  refreshAgentKnowledge: (agentId, payload = {}) => api.post(`/agents/${agentId}/knowledge-attachments/refresh/`, payload),
  uploadConversationFile: (conversationPk, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/conversations/${conversationPk}/files/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getContextFiles: (conversationPk) => api.get(`/conversations/${conversationPk}/files/`),
  // Media gallery: generated + uploaded images/video for this conversation (scope='conversation') or
  // every conversation of this agent (scope='agent'). Optional source/type filters. Returns { media: [] }.
  getConversationMedia: (conversationPk, params = {}) =>
    api.get(`/conversations/${conversationPk}/media/`, { params }),
  deleteContextFile: (conversationPk, fileId) => api.delete(`/conversations/${conversationPk}/files/${fileId}/`),
  deleteGenericFile: (fileId) => api.delete(`/context_files/${fileId}/`),

  // Agent Workflows — saved prompt templates / "macros" scoped to one agent profile.
  // Backend: agent/view_handlers/workflow_views.py (POST requires profile_id + name).
  getWorkflows: (profileId) => api.get('/workflows/', { params: profileId ? { profile_id: profileId } : {} }),
  createWorkflow: (payload) => api.post('/workflows/', payload),
  updateWorkflow: (id, payload) => api.put(`/workflows/${id}/`, payload),
  deleteWorkflow: (id) => api.delete(`/workflows/${id}/`),
  runWorkflow: (id) => api.post(`/workflows/${id}/run/`),

  // Workflow Builder — node-canvas graphs (NEW, separate system: /api/workflow-graphs/).
  getWorkflowGraphs: () => api.get('/workflow-graphs/'),

  // Schedules (used by the Budgets page to scope a budget to a schedule).
  getSchedules: () => api.get('/schedules/'),
  // Standalone Schedules page (/dashboard/schedules).
  // List is cross-agent (AgentSchedule rows come back as `as_<id>` with agent_name).
  // Create is agent-scoped (an AgentSchedule always belongs to one agent).
  listSchedules: (params = {}) => api.get('/schedules/', { params }),
  createAgentSchedule: (agentId, payload) => api.post(`/agents/${agentId}/schedules/`, payload),
  updateSchedule: (id, payload) => api.put(`/schedules/${id}/`, payload),
  deleteSchedule: (id) => api.delete(`/schedules/${id}/`),
  runSchedule: (id) => api.post(`/schedules/${id}/run/`),
  getScheduleRuns: (id) => api.get(`/schedules/${id}/runs/`),
  getScheduleRunDetail: (id, runId) => api.get(`/schedules/${id}/runs/${runId}/`),
  getWorkflowGraph: (id) => api.get(`/workflow-graphs/${id}/`),
  // One-shot load for the canvas: the graph + all graphs (subflow picker) + agents.
  getWorkflowGraphBundle: (id) => api.get(`/workflow-graphs/${id}/bundle/`),
  createWorkflowGraph: (payload) => api.post('/workflow-graphs/', payload),
  saveWorkflowGraph: (id, payload) => api.put(`/workflow-graphs/${id}/`, payload),
  deleteWorkflowGraph: (id) => api.delete(`/workflow-graphs/${id}/`),
  validateWorkflowGraph: (id, graph) => api.post(`/workflow-graphs/${id}/validate/`, { graph }),
  runWorkflowGraph: (id, payload = {}) => api.post(`/workflow-graphs/${id}/run/`, payload),
  getWorkflowGraphRuns: (id) => api.get(`/workflow-graphs/${id}/runs/`),
  getWorkflowGraphRun: (runId) => api.get(`/workflow-graph-runs/${runId}/`),
  cancelWorkflowGraphRun: (runId) => api.post(`/workflow-graph-runs/${runId}/cancel/`),
  rerunWorkflowGraphRun: (runId, fromNode = null) =>
    api.post(`/workflow-graph-runs/${runId}/rerun/`, fromNode ? { from_node: fromNode } : {}),
  approveWorkflowGraphRun: (runId, nodeId, decision) =>
    api.post(`/workflow-graph-runs/${runId}/approve/`, { node_id: nodeId, decision }),
  // C: metrics, version history, export/import, starter templates
  getWorkflowGraphMetrics: (id) => api.get(`/workflow-graphs/${id}/metrics/`),
  exportWorkflowGraph: (id) => api.get(`/workflow-graphs/${id}/export/`),
  importWorkflowGraph: (payload) => api.post('/workflow-graphs/import/', payload),
  getWorkflowGraphVersions: (id) => api.get(`/workflow-graphs/${id}/versions/`),
  restoreWorkflowGraphVersion: (id, versionId) =>
    api.post(`/workflow-graphs/${id}/versions/${versionId}/restore/`),
  getWorkflowGraphTemplates: () => api.get('/workflow-graph-templates/'),
  getWorkflowMcpCatalog: () => api.get('/workflow-graphs/mcp-catalog/'),
  createWorkflowGraphFromTemplate: (key, name) =>
    api.post('/workflow-graph-templates/create/', name ? { key, name } : { key }),

  // ── Workflow operations (ADM-278 / P7) ───────────────────────────────────
  // Cross-workflow, unlike getWorkflowGraphRuns(id) which serves the builder for ONE workflow. An
  // operator asking "what needs me" cannot ask it of a single workflow.
  getWorkflowOpsRuns: (params = {}) => api.get('/workflow-runs/', { params }),
  getWorkflowRunTimeline: (runId) => api.get(`/workflow-graph-runs/${runId}/timeline/`),
  // `reuse_input` is REQUIRED for replay and has no default: reusing the original trigger payload and
  // starting fresh are materially different operations, and silence must not pick one.
  controlWorkflowRun: (runId, action, payload = {}) =>
    api.post(`/workflow-graph-runs/${runId}/control/`, { action, ...payload }),

  // Agent Chat
  startAgentChat: (agentProfileId, repositoryId = null) => {
    const payload = {};
    if (repositoryId) payload.repository_id = repositoryId;
    return api.post(`/agents/${agentProfileId}/chat/`, payload);
  },

  // New Agent Knowledge
  analyzeContextFile: (fileId) => api.post(`/context_files/${fileId}/analyze/`),

  // Session Reconnection
  getSessionEvents: (sessionId) => api.get(`/sessions/${sessionId}/events/`),

  // Services
  discoverActions: (data) => {
    const formData = new FormData()
    if (data.specFile) {
      formData.append('spec_file', data.specFile)
    }
    if (data.specUrl) {
      formData.append('api_spec_url', data.specUrl)
    }
    formData.append('base_url', data.baseUrl)
    formData.append('discovery_method', data.discoveryMethod || 'openapi')

    return api.post('/services/discover/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  enrichActions: (serviceId, actions) => {
    return api.post(`/services/${serviceId}/enrich/`, { actions })
  },

  registerService: (data) => {
    return api.post('/services/register/', data)
  },

  // ── Agent Workspace ──
  getAgentWorkspace: (agentId) => api.get(`/agents/${agentId}/workspace/`),
  readWorkspaceFile: (agentId, path) => api.post(`/agents/${agentId}/workspace/read/`, { path }),
  deleteWorkspaceFile: (agentId, path) => api.post(`/agents/${agentId}/workspace/delete/`, { path }),
  bulkDeleteWorkspaceFiles: (agentId, paths) => api.post(`/agents/${agentId}/workspace/bulk-delete/`, { paths }),
  downloadWorkspaceFile: (agentId, path) => api.post(`/agents/${agentId}/workspace/download/`, { path }, { responseType: 'blob' }),
  previewAgentPrompt: (agentId) => api.get(`/agents/${agentId}/preview-prompt/`),

  // ── Content artifacts (files this chat produced or received; the chat header's Artifacts panel) ──
  // Server-side scope is always the caller's OWN + explicitly-granted artifacts; conversationId only
  // NARROWS that to one chat. Downloads go through /api/artifacts/<uuid>/download/ (session cookie).
  searchArtifacts: (opts = {}) => {
    const params = new URLSearchParams()
    if (opts.conversationId) params.set('conversation_id', String(opts.conversationId))
    if (opts.q) params.set('q', opts.q)
    if (opts.mediaType) params.set('media_type', opts.mediaType)
    if (opts.origin) params.set('origin', opts.origin)
    params.set('limit', String(opts.limit || 100))
    if (opts.offset) params.set('offset', String(opts.offset))
    return api.get(`/artifacts/search/?${params.toString()}`)
  },

  // Artifacts panel. Conversation scope is a server-side NARROWING of the caller's own + granted
  // artifacts; conversation_id on the read calls also lets a chat-bound artifact resolve through its
  // binding. Nothing here ever receives a storage path.
  getConversationArtifacts: (conversationId, opts = {}) => {
    const params = new URLSearchParams()
    params.set('limit', String(opts.limit || 50))
    if (opts.offset) params.set('offset', String(opts.offset))
    if (opts.versions) params.set('versions', opts.versions)
    if (opts.order) params.set('order', opts.order)
    if (opts.q) params.set('q', opts.q)
    if (opts.origin) params.set('origin', opts.origin)
    return api.get(`/conversations/${conversationId}/artifacts/?${params.toString()}`)
  },
  getArtifact: (uuid, conversationId) =>
    api.get(`/artifacts/${uuid}/${conversationId ? `?conversation_id=${conversationId}` : ''}`),
  getArtifactPreview: (uuid, conversationId) =>
    api.get(`/artifacts/${uuid}/preview/${conversationId ? `?conversation_id=${conversationId}` : ''}`),
  getArtifactVersions: (uuid, conversationId) =>
    api.get(`/artifacts/${uuid}/versions/${conversationId ? `?conversation_id=${conversationId}` : ''}`),
  renameArtifact: (uuid, name) => api.post(`/artifacts/${uuid}/rename/`, { name }),
  pinArtifact: (uuid, pinned = true) => api.post(`/artifacts/${uuid}/pin/`, { pinned }),
  deleteArtifact: (uuid) => api.delete(`/artifacts/${uuid}/delete/`),
  // Replays a script artifact server-side (no LLM). Long by nature — it actually runs the script — so it
  // gets the sandbox timeout plus headroom rather than the 60s default.
  rerunArtifact: (uuid) => api.post(`/artifacts/${uuid}/rerun/`, {}, { timeout: 620000 }),

  // ── Workspace Status (Live Polling) ──
  getWorkspaceStatusList: () => api.get('/workspace-status/'),
  getWorkspaceStatusDetail: (workspaceId) => api.get(`/workspace-status/${workspaceId}/`),
  pingWorkspace: (workspaceId) => api.post(`/workspace-status/${workspaceId}/ping/`),
  executeWorkspaceCommand: (workspaceId, command, timeout = 30) =>
    api.post(`/workspace-status/${workspaceId}/execute/`, { command, timeout }),

  // ── Agent Workspace Routing ──
  getAgentWorkspaceRouting: (agentId, opts = {}) => {
    const params = new URLSearchParams()
    if (opts.files) params.set('files', 'true')
    if (opts.path) params.set('path', opts.path)
    const qs = params.toString()
    return api.get(`/agents/${agentId}/workspace-routing/${qs ? '?' + qs : ''}`)
  },

  // ── User Connections (OAuth Providers) ──
  getConnectionProviders: () => api.get('/connections/providers/'),
  getConnectionPresets: () => api.get('/connections/presets/'),
  getConnections: () => api.get('/connections/'),
  startConnection: (providerSlug, opts = {}) => {
    const params = new URLSearchParams()
    if (opts.scopes) params.set('scopes', opts.scopes)
    if (opts.owner) params.set('owner', opts.owner)
    const qs = params.toString()
    return api.get(`/connections/${providerSlug}/start/${qs ? '?' + qs : ''}`)
  },
  disconnectConnection: (providerSlug, opts = {}) => {
    const params = new URLSearchParams()
    if (opts.owner) params.set('owner', opts.owner)
    const qs = params.toString()
    return api.delete(`/connections/${providerSlug}/disconnect/${qs ? '?' + qs : ''}`)
  },
  configureProvider: (providerSlug, data) => api.post(`/connections/providers/${providerSlug}/configure/`, data),
  getProviderConfig: (providerSlug) => api.get(`/connections/providers/${providerSlug}/configure/`),
  createProvider: (data) => api.post('/connections/providers/create/', data),
  updateProvider: (providerSlug, data) => api.patch(`/connections/providers/${providerSlug}/`, data),
  deleteProvider: (providerSlug) => api.delete(`/connections/providers/${providerSlug}/delete/`),

  // Signal System
  getSignals: (agentId, params) => api.get(`/agents/${agentId}/signals/`, { params }),
  getSignalStats: (agentId) => api.get(`/agents/${agentId}/signals/stats/`),
  getSignalFlows: (agentId) => api.get(`/agents/${agentId}/signals/flows/`),
  getDeadLetters: (agentId) => api.get(`/agents/${agentId}/signals/dead/`),
  sendTestSignal: (agentId, data) => api.post(`/agents/${agentId}/signals/test/`, data),
  rotateSignalApiKey: (agentId) => api.post(`/agents/${agentId}/signals/api-key/`),
  cancelSignal: (agentId, signalId) => api.post(`/agents/${agentId}/signals/${signalId}/cancel/`),
  retrySignal: (agentId, signalId) => api.post(`/agents/${agentId}/signals/${signalId}/retry/`),
  // Mint a short-lived, browser-safe WebSocket chat token (auth: owner session or signal_api_key).
  mintChatToken: (agentId) => api.post(`/agents/${agentId}/chat-token/`),

  // Agent Knowledge / Dreaming Cycle
  getAgentKnowledge: (agentId) => api.get(`/agents/${agentId}/knowledge/`),
  // Unified memory (new system: AgentMemory via memory_router + Memory Autopilot)
  getAgentMemory: (agentId, params) => api.get(`/agents/${agentId}/memory/`, { params }),
  getAgentMemoryActivity: (agentId) => api.get(`/agents/${agentId}/memory/activity/`),
  forgetMemory: (memoryId) => api.post('/memory/forget/', { memory_id: memoryId }),
  // Account-level Memory & Context settings (Settings → Memory) — DB control plane, no env flags.
  getMemorySettings: () => api.get('/me/memory-settings/'),
  updateMemorySettings: (data) => api.patch('/me/memory-settings/', data),

  // Account-level execution target (Settings → Sandboxes). Account-level, not per-agent: the thing being
  // chosen is a MACHINE — this user's own connected workspace — so every agent they run follows it.
  // The GET also carries LIVE connection state (`workspace_connected`, `workspace_name`), because
  // choosing the local machine while nothing is connected is savable and must be visibly flagged.
  getSandboxSettings: () => api.get('/me/sandbox-settings/'),
  updateSandboxSettings: (data) => api.patch('/me/sandbox-settings/', data),
  // Manual "Regenerate summary" — full from-rows rebuild of the user's memory digests.
  regenerateMemoryDigests: () => api.post('/me/memory/regenerate-digests/'),
  // Generated memory summaries (digests) shown next to the rows.
  getGlobalMemoryDigest: () => api.get('/me/memory/digest/'),
  getAgentMemoryDigest: (agentId) => api.get(`/agents/${agentId}/memory/summary/`),
  // Global (scope='user') memory CRUD — Settings → Memory → Global Memories.
  listGlobalMemories: (params) => api.get('/me/memories/', { params }),
  createGlobalMemory: (data) => api.post('/me/memories/', data),
  updateGlobalMemory: (id, data) => api.patch(`/me/memories/${id}/`, data),
  deleteGlobalMemory: (id) => api.delete(`/me/memories/${id}/`),
  updateKnowledgeConfig: (agentId, data) => api.patch(`/agents/${agentId}/knowledge/config/`, data),
  updateKnowledgeCard: (agentId, cardId, data) => api.patch(`/agents/${agentId}/knowledge/cards/${cardId}/`, data),
  createKnowledgeCard: (agentId, data) => api.post(`/agents/${agentId}/knowledge/cards/`, data),
  deleteKnowledgeCard: (agentId, cardId) => api.delete(`/agents/${agentId}/knowledge/cards/${cardId}/delete/`),
  bulkDeleteKnowledgeCards: (agentId, cardIds) => api.post(`/agents/${agentId}/knowledge/cards/bulk-delete/`, { card_ids: cardIds }),
  // RETIRED: dreaming is no longer active (knowledge lives in AgentMemory). Kept for reference; the
  // backend endpoint now returns a {retired:true} notice and does not run a dream cycle. No active callers.
  triggerDream: (agentId) => api.post(`/agents/${agentId}/knowledge/dream/`),

  // Agent Flows
  getAgentFlows: (agentId, sort = 'time') => api.get(`/agents/${agentId}/flows/`, { params: { sort } }),
  updateFlow: (agentId, flowId, data) => api.patch(`/agents/${agentId}/flows/${flowId}/`, data),
  deleteFlow: (agentId, flowId) => api.delete(`/agents/${agentId}/flows/${flowId}/delete/`),
  bulkDeleteFlows: (agentId, flowIds) => api.post(`/agents/${agentId}/flows/bulk-delete/`, { flow_ids: flowIds }),
  processFlows: (agentId, data = {}) => api.post(`/agents/${agentId}/flows/process/`, data),
  updateFlowConfig: (agentId, data) => api.patch(`/agents/${agentId}/flows/config/`, data),

  // ── Budgets (Budgets page — /dashboard/budgets) ──────────────────────────
  // All calls accept an optional orgId so a multi-org user can target a specific organization. The backend
  // membership-validates it (an org the user can't access is rejected, never silently swapped).
  getOrganizations: () => api.get('/v2/orgs/'),
  getBudgetsSummary: (period, orgId) => api.get('/budgets/summary/', { params: { ...(period ? { period } : {}), ...(orgId ? { organization_id: orgId } : {}) } }),
  getBudgets: (orgId) => api.get('/budgets/', { params: orgId ? { organization_id: orgId } : {} }),
  getBudgetTargets: (orgId, scope) => api.get('/budgets/targets/', { params: { organization_id: orgId, scope_type: scope } }),
  createBudget: (data) => api.post('/budgets/', data),
  updateBudget: (id, data) => api.patch(`/budgets/${id}/`, data),
  deleteBudget: (id, orgId) => api.delete(`/budgets/${id}/`, { params: orgId ? { organization_id: orgId } : {} }),
  getBudgetStatus: (id, period, orgId) => api.get(`/budgets/${id}/status/`, { params: { ...(period ? { period } : {}), ...(orgId ? { organization_id: orgId } : {}) } }),
  getBudgetApprovals: () => api.get('/budgets/approvals/'),
  decideBudgetApproval: (eventId, decision) => api.post(`/budgets/approvals/${eventId}/decide/`, { decision }),
  getBudgetEvents: (orgId) => api.get('/budgets/events/', { params: orgId ? { organization_id: orgId } : {} }),
  getBudgetRules: (orgId) => api.get('/budget-rules/', { params: orgId ? { organization_id: orgId } : {} }),
  createBudgetRule: (data) => api.post('/budget-rules/', data),
  updateBudgetRule: (id, data) => api.patch(`/budget-rules/${id}/`, data),
  deleteBudgetRule: (id, orgId) => api.delete(`/budget-rules/${id}/`, { params: orgId ? { organization_id: orgId } : {} }),
}