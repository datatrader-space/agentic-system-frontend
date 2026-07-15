// Pinia store — real chat thread + session history (Phase 2 backend wiring).
//
// Flow: pick an Agent Profile → first message starts a conversation
// (POST /agents/<id>/chat/) → live tokens stream over the chat WebSocket
// (ChatConnection). History loads via GET /conversations/.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { ChatConnection } from '../services/chatService'
import { useCanvasStore } from './useCanvasStore'
import { usePlanStore } from './usePlanStore'
import { createActivity, start as startActivity, ingest as ingestActivity, finish as finishActivity, interrupt as interruptActivity } from '../composables/activityStream'
import { useAgentTimeline, isRichEvent } from '../composables/useAgentTimeline'

// One shared live timeline for the currently-streaming assistant message (only one streams at a time).
// Reset per turn, snapshotted onto the message on completion — the SAME reducer the Emulator uses, so
// New Chat shows the identical friendly, param-free activity (Searching → Generating) instead of raw tool I/O.
const _tl = useAgentTimeline()

let _seq = 0
const nid = () => `m${++_seq}`

// §4b: streaming-content events stamped with the server's per-turn (turn_id, message_id). Used by the
// stale/interrupted-stream guard in _onEvent to ignore events from a superseded turn.
const STREAM_ID_TYPES = new Set([
  'assistant_message_chunk', 'assistant_message_complete', 'tool_result', 'tool_call',
])

function pickArray(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.results)) return d.results
  return []
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isStreaming: false,
    conversationId: null,
    repoId: 0,

    // Human-in-the-loop approval queue (tools the backend gated for approval + the max-steps
    // pause-and-ask). Rendered by HITLModal.
    hitlRequests: [],
    // True while ≥1 approval card is pending. Keeps the turn "active" (not "Done") so the card + Stop
    // stay visible even if the task/CRS path emitted a premature completion for the step-0 text.
    awaitingApproval: false,
    // True while a multi-step TASK/CRS run is in progress. Such a run streams an assistant_message_complete
    // after EVERY ReAct step, so the turn must NOT end on those — only on the run's terminal
    // agent_session_complete / agent_event session_complete.
    _taskRunActive: false,

    // Legacy native plan-mode WS approval signal (vestigial). The unified plan UI now handles
    // approval via the run-coordinator API (UnifiedPlanCard); this field feeds the low-level WS
    // resume mechanic only and is removed when that loop is internalized into the coordinator.
    pendingPlan: null,

    // Staged attachments (images/files) to send with the next message. Each:
    // { file: File, name, isImage, url }. Uploaded to the conversation on send; the backend
    // auto-attaches recent images to the vision model.
    pendingAttachments: [],

    // Agent selection
    agents: [],
    selectedAgentId: null,
    agentsLoaded: false,
    agentsLoading: false,

    // Sidebar history (current agent)
    sessions: [],
    sessionsLoading: false,

    // Global chat history across ALL agents (sidebar list + search modal)
    allSessions: [],
    allSessionsLoading: false,
    _allSessionsAt: 0,   // last successful fetch (ms) — drives the TTL cache below

    loadingHistory: false,
    error: '',

    _conn: null,
    _assistantId: null,
  }),
  getters: {
    isEmpty: (s) => s.messages.length === 0,
    // Inline plan artifact: true when the loaded history carries durable plan anchors. Drives the
    // active-plan chip near the composer (the plan card itself always renders inline at its anchor).
    hasDurablePlanAnchors: (s) =>
      s.messages.some((m) => Array.isArray(m.planArtifacts) && m.planArtifacts.length > 0),
    // True once we know the user has zero agents — drives the "create an agent first"
    // empty state and the disabled composer on the welcome screen.
    needsAgent: (s) => s.agentsLoaded && s.agents.length === 0,
    currentAgent: (s) =>
      s.agents.find((a) => String(a.id) === String(s.selectedAgentId)) || null,
    // Running session totals (this chat). Prefer a turn's EXACT completed usage; while a turn is
    // still streaming, fall back to its live activity-token counter so the footer ticks up mid-run
    // and finalises exactly. Turns with neither contribute 0; auto-resets when messages clear.
    sessionTokens: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.total_tokens) || (m.activity && m.activity.tokens && m.activity.tokens.total) || 0), 0),
    sessionCost: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.cost_usd) || (m.activity && m.activity.tokens && m.activity.tokens.cost) || 0), 0),

    // ── Rich-streaming live timeline (the currently-streaming message) ──
    // Mirrors the Emulator so New Chat renders the SAME friendly, param-free activity (Searching →
    // Generating) via AgentActivityTimeline instead of the raw ActivityStream/ActivityStep tool I/O.
    richActive: () => _tl.hasActivity(),
    liveStatus: () => _tl.currentStatus.value,
    liveSteps: () => _tl.steps.value,
    liveSources: () => _tl.sources.value,
    liveSummary: () => _tl.summary.value,
    liveComplete: () => _tl.isComplete.value,
    liveHasFailures: () => _tl.hasFailures.value,
  },
  actions: {
    // ---- Agents + history ----
    async loadAgents(force = false) {
      // agentsLoading is set synchronously, so concurrent mount-time calls from
      // LeftSidebar / ChatWelcome / ChatWorkspace collapse into a single request.
      // force=true (after creating / editing / deleting an agent) bypasses the "already loaded"
      // short-circuit so the change shows immediately without a full page refresh — still deduped
      // against any in-flight load.
      if (this.agentsLoading) return
      if (this.agentsLoaded && !force) return
      this.agentsLoading = true
      try {
        const res = await api.getAgents()
        this.agents = pickArray(res.data)
        if (!this.selectedAgentId && this.agents.length) {
          this.selectedAgentId = String(this.agents[0].id)
        }
        this.agentsLoaded = true
        await this.loadSessions()
      } catch {
        this.error = 'Failed to load agents'
      } finally {
        this.agentsLoading = false
      }
    },

    // Refresh the agent list after a create/edit/delete so pickers (New Chat / sidebar) update without a
    // page refresh. Thin wrapper over loadAgents(force=true) for explicit, greppable call sites.
    async refreshAgents() {
      return this.loadAgents(true)
    },

    setAgent(id) {
      this.selectedAgentId = String(id)
      this.loadSessions()
      this.prewarmAgent()   // warm the newly-selected agent during the idle window before the 1st message
    },

    async loadSessions() {
      if (!this.selectedAgentId || this.sessionsLoading) return
      this.sessionsLoading = true
      try {
        const res = await api.getConversations({
          agent_profile_id: this.selectedAgentId,
          ordering: '-updated_at',
          limit: 30,
        })
        this.sessions = pickArray(res.data)
      } catch {
        /* non-fatal */
      } finally {
        this.sessionsLoading = false
      }
    },

    // Global recent chats across every agent — powers the sidebar list + search modal.
    // Cached for 60s: re-opening the search modal or re-mounting the sidebar reuses the
    // list instead of refetching. Pass force=true after a mutation (e.g. a new chat).
    async loadAllSessions(force = false) {
      if (this.allSessionsLoading) return
      if (!force && this.allSessions.length && (Date.now() - this._allSessionsAt) < 60000) return
      this.allSessionsLoading = true
      try {
        const res = await api.getConversations({ ordering: '-updated_at', limit: 200 })
        this.allSessions = pickArray(res.data)
        this._allSessionsAt = Date.now()
      } catch {
        /* non-fatal */
      } finally {
        this.allSessionsLoading = false
      }
    },

    // ---- Conversation lifecycle ----
    reset() {
      // "New chat" stays on the SAME repo endpoint — keep the socket, just clear state and detach the
      // conversation (the first message creates a new one and conversation_created sets the id).
      this._clearTurnState()
      this.messages = []
      this.conversationId = null
      this.error = ''
      this.pendingPlan = null
      this._clearAttachments()
      this._conn?.setConversation(null)
    },

    _clearAttachments() {
      for (const a of this.pendingAttachments) {
        if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } }
      }
      this.pendingAttachments = []
    },

    async openConversation(id) {
      if (!id) {
        this.reset()
        return
      }
      // Already pointed at this conversation with a live socket or loaded history → no-op. This also
      // covers the case where ensureConversation() just created the id (to ingest a link before the
      // first message) and the URL replace re-entered here — we must NOT re-clear staged attachments.
      if (String(this.conversationId) === String(id) && (this.messages.length || this._conn)) return
      this._clearTurnState()   // switch conversation: clear UI state but KEEP the shared socket
      this.conversationId = String(id)
      this.messages = []
      this.pendingPlan = null
      this._clearAttachments()
      this.loadingHistory = true
      this.error = ''
      try {
        const res = await api.getConversation(id)
        const data = res.data || {}
        this.messages = pickArray(data.messages).map((m) => ({
          id: nid(),
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          status: 'done',
          error: '',
          toolCalls: [],
          // Long-answer stub: the stored content is a bounded stub; the full answer
          // is rehydrated on demand from the long-answer endpoint (see ChatMessage.vue).
          isLongResponse: !!(m.model_info && m.model_info.is_long_response),
          longAnswerRef: (m.model_info && m.model_info.long_answer_ref) || '',
          // Restore per-turn metadata persisted in model_info so a refresh keeps the token/cost
          // footer + stop badge (otherwise only the bare text survives reload).
          usage: (m.model_info && m.model_info.usage) || null,
          stopReason: (m.model_info && m.model_info.stop_reason) || '',
          confidence: (m.model_info && m.model_info.confidence) || '',
          trace: (m.model_info && m.model_info.trace) || [],
          activity: (m.model_info && m.model_info.activity) || null,   // legacy raw timeline (fallback)
          // Rich timeline replay: restore the masked snapshot so a reopened chat shows the friendly
          // Searching → Generating timeline instead of falling back to the raw ActivityStream.
          timeline: (m.model_info && m.model_info.timeline) || null,
          // Provenance replay (decision #4): the answer_basis envelope carries the label + the
          // cited-or-top-4 sources, so a reopened chat shows the SAME footer + clickable panel.
          answerBasis: (m.model_info && m.model_info.answer_basis) || null,
          citations: (m.model_info && m.model_info.answer_basis && m.model_info.answer_basis.citations) || [],
          // Inline plan artifact: durable anchor(s) linking this message to its plan(s). Present only
          // when the backend flag is on; drives inline-by-plan_id rendering (no runtime anchor).
          planArtifacts: pickArray(m.plan_artifacts),
          // User-uploaded attachments bound to this message (turn-level binding) — served /media/ URLs so
          // the thumbnail survives refresh (the live send-time blob URL is ephemeral).
          attachments: pickArray(m.attachments),
          conversationId: String(id),
        }))
        // Hydrate + reconcile any plans anchored in the loaded history so the inline cards render on
        // open (durable-anchor path). No-op when the feature is off (no plan_artifacts present).
        this._hydratePlanAnchors(id)
        this.repoId = data.repository?.id || data.repository_id || 0
        // Backend serializes agent_profile as a bare PK (integer), with the human name
        // exposed separately as agent_profile_name — so read the id directly (older code
        // expected a nested object, which left selectedAgentId unset and hid the mode pill).
        const agentPk = (data.agent_profile && data.agent_profile.id) || data.agent_profile
        if (agentPk) this.selectedAgentId = String(agentPk)
        this._connect()
      } catch {
        this.error = 'Failed to load conversation'
      } finally {
        this.loadingHistory = false
      }
    },

    // ── Attachments (images/files) staged for the next message ──
    addAttachments(files) {
      for (const file of Array.from(files || [])) {
        if (!file) continue
        const isImage = /^image\//.test(file.type)
        // Blob URL for EVERY attachment (not just images) so the message bubble can open a
        // preview/download window for the exact bytes the user attached — images render inline, docs open
        // in a new tab. Persisted across the send (the bubble keeps it); revoked on removeAttachment.
        this.pendingAttachments.push({
          file, name: file.name, isImage, mime: file.type || '',
          url: URL.createObjectURL(file),
        })
      }
    },
    removeAttachment(i) {
      const a = this.pendingAttachments[i]
      if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } }
      this.pendingAttachments.splice(i, 1)
    },

    // Create (or return) the conversation for the selected agent WITHOUT sending a message. Used so the
    // composer "+" menu can ingest a link/file into a conversation-scoped DocumentSource on a brand-new
    // chat — ChatGPT-style, the chat quietly starts the moment you attach something. Returns the
    // conversation id, or null if it couldn't start (no agent / API error).
    async ensureConversation() {
      if (this.conversationId) return this.conversationId
      if (!this.selectedAgentId) {
        this.error = 'Select an agent to start chatting.'
        notify.warning('Select an agent to start chatting.')
        return null
      }
      try {
        const res = await api.startAgentChat(this.selectedAgentId)
        const d = res.data || {}
        this.conversationId = String(d.conversation_id ?? d.profile_id ?? '')
        this.repoId = d.repository_id || 0
        if (!this.conversationId) throw new Error('no conversation id')
        this._connect()
        this.loadSessions()          // surface the new chat in the sidebar
        this.loadAllSessions(true)   // force-refresh the global recent-chats list + search
        return this.conversationId
      } catch {
        this.error = 'Failed to start chat.'
        return null
      }
    },

    // Canvas signalling for the WS message: `canvas_mode` auto-exposes the design tools for the turn,
    // and `canvas_selection` targets a specific element. For web_builder we send the STABLE element id
    // (not outerHTML) so the backend's builder tools can edit that exact entity (Phase 3B A13/A14);
    // static keeps sending the captured element markup.
    _canvasSendOpts() {
      let canvas
      try { canvas = useCanvasStore() } catch (_e) { return {} }
      const opts = {}
      if (canvas.mode) opts.canvasMode = true
      const sel = canvas.selectedElement
      if (sel) {
        opts.canvasSelection = canvas.provider === 'web_builder'
          ? { provider: 'web_builder', element_id: sel.element_id, route: canvas.route, page_id: canvas.pageId }
          : sel
      }
      return opts
    },

    // Upload staged attachments to the current conversation and return their stable attachment_ids (in
    // order) plus the doc entries that still need ingest-waiting. Shared by the normal + steering send
    // paths so BOTH reliably echo attachment_ids back to the backend (the binding key). Awaited fully
    // before the WS message is sent, so a message never races ahead of its uploads.
    async _uploadAttachments(atts) {
      const attachmentIds = []
      const docs = []
      for (const a of atts) {
        try {
          const res = await api.uploadConversationFile(this.conversationId, a.file)
          const attId = res?.data?.attachment_id
          const fileId = res?.data?.id
          if (attId) attachmentIds.push(attId)
          if (!a.isImage && fileId != null) docs.push({ id: fileId, name: a.name })
        } catch {
          this.error = 'Failed to upload an attachment.'
        }
      }
      if (atts.length && attachmentIds.length === 0) {
        // Uploads ran but no ids came back — the backend safety net (turn-scoped binding) still covers
        // this, but log it so a real regression is visible rather than silent.
        console.warn('[chat] attachments uploaded but no attachment_id returned — relying on backend fallback')
      }
      return { attachmentIds, docs }
    },

    async sendMessage(text) {
      const content = (text || '').trim()
      const atts = this.pendingAttachments.slice()
      if (!content && atts.length === 0) return

      // Mid-run STEERING: the agent is already running. Don't start a second turn and don't drop the
      // message — send it as a steering message. The backend queues it and the running agent observes it
      // between steps. If the user ATTACHED files, upload them first and send their attachment_ids so the
      // reference is bound to this steering message too (previously attachments were silently dropped here,
      // which is one way the "agent can't see the uploaded image" race happened).
      if (this.isStreaming) {
        if ((!content && atts.length === 0) || !this.conversationId || !this._conn) return
        this.messages.push({
          id: nid(), role: 'user', content, status: 'done', queued: true,
          attachments: atts.map((a) => ({ name: a.name, isImage: a.isImage, url: a.url, mime: a.mime })),
        })
        this.pendingAttachments = []
        const { attachmentIds: steerIds } = await this._uploadAttachments(atts)
        this._conn.sendMessage(content, this.selectedAgentId, null, {
          ...this._canvasSendOpts(),
          attachmentIds: steerIds,
          clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })
        return
      }

      // No agents at all → don't silently swallow the message. Tell the user what to do.
      if (this.needsAgent) {
        this.error = 'Create an agent before sending a message.'
        notify.warning('Create an agent before you can chat — no agents exist yet.')
        return
      }

      // Start a conversation on the first message (or reuse one already created — e.g. by
      // ensureConversation() when the user added a link before typing).
      if (!this.conversationId) {
        const cid = await this.ensureConversation()
        if (!cid) return
      } else if (!this._conn) {
        this._connect()
      }

      // Show the user turn (with attachment previews) and the assistant placeholder up-front.
      this.messages.push({
        id: nid(), role: 'user', content, status: 'done',
        attachments: atts.map((a) => ({ name: a.name, isImage: a.isImage, url: a.url, mime: a.mime })),
      })
      this.pendingAttachments = [] // claimed by this turn; the message bubble keeps the preview urls
      this._beginAssistant()

      // Upload attachments to the conversation BEFORE sending the text — the backend auto-attaches
      // recent images (within one message) to the vision model, so they must exist first. Non-image
      // documents become conversation-scoped RAG sources (MarkItDown): converted once, then searchable.
      //
      // ChatGPT-style: when a document is attached WITH the question, HOLD the turn until the doc has
      // finished converting/indexing so the agent has the content on its FIRST answer (no "your file is
      // still being processed" reply). We show a "Reading your document…" state on the assistant bubble
      // instead of a toast, and the composer stays disabled (isStreaming) meanwhile. Images need only the
      // upload (auto-attached to vision), so they don't gate the send.
      // Collected in upload order so the backend binds them to THIS message with the correct ordinal
      // (turn-level attachment binding). We echo back the stable `attachment_id` (uuid), not the DB pk.
      let attachmentIds = []
      if (atts.length) {
        const assistantMsg = this._cur()
        const uploaded = await this._uploadAttachments(atts)
        attachmentIds = uploaded.attachmentIds
        const docs = uploaded.docs
        if (docs.length && assistantMsg) {
          assistantMsg.prepStatus = docs.length > 1
            ? `Reading your ${docs.length} documents…`
            : `Reading ${docs[0].name}…`
          for (const d of docs) {
            const st = await this._awaitAttachmentIngest(d.id)
            if (st === 'failed') notify.error(`Could not process ${d.name}.`)
            // 'timeout' → fall through and send anyway; the backend gives the honest "still processing"
            // answer and a safety-wait covers the last-mile race.
          }
          assistantMsg.prepStatus = ''
        }
      }

      // Bind attachments to THIS exact message via explicit ids (+ a client message id for idempotency),
      // instead of the backend guessing "newest upload in the conversation".
      this._conn?.sendMessage(content, this.selectedAgentId, null, {
        ...this._canvasSendOpts(),
        attachmentIds,
        clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
    },

    // Await a just-uploaded document through the MarkItDown pipeline. Resolves 'ready' | 'failed' |
    // 'timeout'. WS push is primary for index status, but polling is the reliable gate the composer
    // awaits before firing the turn. Bounded (~60s) so a stuck conversion can never hang the send.
    async _awaitAttachmentIngest(fileId) {
      for (let i = 0; i < 40; i++) {
        let d
        try { d = (await api.getAgentFileStatus(fileId)).data } catch { d = null }
        const st = d?.index_status
        if (st === 'ready') return 'ready'
        if (st === 'failed') return 'failed'
        await new Promise((r) => setTimeout(r, 1500))
      }
      return 'timeout'
    },

    stop() {
      this._conn?.stop()
      // Clear any pending approval so _endAssistant is allowed to finalize (Stop must always end the
      // turn, even mid-approval). The backend's stop_execution also cancels the server-side HITL wait.
      this.hitlRequests = []
      this.awaitingApproval = false
      this._endAssistant()
    },

    // ── HITL approval responses (sent over the same WS the backend awaits on) ──
    respondHitl({ request_id, response_value, feedback }) {
      this._conn?.sendHitlResponse(request_id, response_value, feedback)
      // Optimistically clear; the hitl_response_ack will also clear it.
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== request_id)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    dismissHitl(requestId) {
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    // ── Manual Mode plan approval (v3 Layer 2) ──
    approvePlan() {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('approve')
    },
    rejectPlan() {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('reject')
    },
    // Request changes: hand the feedback to the agent, which re-plans and asks again.
    revisePlan(feedback) {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('revise', feedback)
    },
    // Resume after the server approves the plan: re-run the last user instruction (now unblocked).
    _resumeAfterPlan() {
      const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(lastUser.content, this.selectedAgentId)
    },
    // Resume after a revision request: the feedback IS the next instruction (shown as a user turn),
    // and the agent re-plans from it.
    _resumeAfterRevise(feedback) {
      const text = (feedback || '').trim()
      if (!text) return
      if (!this._conn && this.conversationId) this._connect()
      this.messages.push({ id: nid(), role: 'user', content: text, status: 'done' })
      this._beginAssistant()
      this._conn?.sendMessage(text, this.selectedAgentId)
    },

    skipHitl(requestId) {
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    retryLast() {
      if (this.isStreaming) return
      const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      const last = this.messages[this.messages.length - 1]
      if (last && last.role === 'assistant') this.messages.pop()
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(lastUser.content, this.selectedAgentId)
    },

    // Regenerate the answer for a given message: re-run the user turn that produced it (drop
    // everything after that user message, then re-send it).
    regenerate(messageId) {
      if (this.isStreaming) return
      const idx = this.messages.findIndex((m) => m.id === messageId)
      if (idx < 0) return
      let userIdx = idx
      if (this.messages[idx].role !== 'user') {
        userIdx = -1
        for (let i = idx; i >= 0; i--) { if (this.messages[i].role === 'user') { userIdx = i; break } }
      }
      const userMsg = this.messages[userIdx]
      if (!userMsg || userMsg.role !== 'user') return
      this.messages = this.messages.slice(0, userIdx + 1)   // keep the user turn, drop the rest
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(userMsg.content, this.selectedAgentId)
    },

    // Edit a user message and re-submit: replace its text, drop everything after it, re-send.
    editAndResend(messageId, newText) {
      const text = (newText || '').trim()
      if (!text || this.isStreaming) return
      const idx = this.messages.findIndex((m) => m.id === messageId)
      if (idx < 0 || this.messages[idx].role !== 'user') return
      this.messages[idx].content = text
      this.messages = this.messages.slice(0, idx + 1)
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(text, this.selectedAgentId)
    },

    // Thumbs up/down on an assistant message (toggles). Stored on the message; ready to POST to a
    // feedback endpoint later.
    setFeedback(messageId, value) {
      const m = this.messages.find((x) => x.id === messageId)
      if (m) m.feedback = m.feedback === value ? null : value
    },

    // ---- Connection + streaming internals ----
    _connectionHandlers() {
      return {
        onEvent: (msg) => this._onEvent(msg),
        onOpen: () => {
          // Reconnected after a mid-turn drop. The backend keeps the turn alive and PERSISTS its
          // answer (turn lifetime is decoupled from the socket), so recover by reloading history.
          if (this._recovering) this._recoverAfterReconnect()
        },
        onError: (em) => {
          if (!this.isStreaming) return
          // Only a TERMINAL give-up (reconnect attempts exhausted) is a real error. Transient
          // blips just mean "reconnecting" — don't scare the user or kill the turn.
          if (em && /please refresh/i.test(em)) this._errAssistant(em)
          else this._enterReconnecting()
        },
        onClose: () => {
          // Abnormal drop mid-stream. Do NOT finalize as interrupted — the backend turn survives.
          // Show "Reconnecting…"; ChatConnection auto-reconnects and onOpen recovers the result.
          if (this.isStreaming) this._enterReconnecting()
        },
      }
    },

    // Industry practice: ONE stable socket per endpoint (repoId), decoupled from conversation/route
    // changes. The conversation_id travels per-message, so switching conversations must NOT churn the
    // socket — we reuse the live one and just point it at the new conversation. Only a different repo
    // endpoint (or no socket yet) creates a connection.
    _connect() {
      const repo = this.repoId || 0
      if (this._conn && this._conn.repoId === repo) {
        this._conn.setConversation(this.conversationId)
        this._conn.connect(repo)   // idempotent: no-op if already OPEN/CONNECTING, reconnects if dead
        this._conn.prewarm(this.selectedAgentId)
        return
      }
      this._teardown(false)        // repo changed (or first connect) -> (re)create
      this._conn = new ChatConnection(this.conversationId, this._connectionHandlers())
      this._conn.connect(repo)
      this._conn.prewarm(this.selectedAgentId)
    },

    // Open the chat socket EARLY (when the chat page loads / an agent is selected) and pre-build the
    // selected agent's server-side runtime, so the FIRST message reuses the runner instead of paying
    // the ~6.6s cold build. Without this the socket only opens lazily on first send (no idle window).
    prewarmAgent() {
      if (!this.selectedAgentId) return
      this._connect()
    },

    // Clear the per-turn UI/streaming state WITHOUT touching the socket (used when switching
    // conversations — the socket is shared and must stay alive).
    _clearTurnState() {
      this.isStreaming = false
      this._assistantId = null
      this._recovering = false
    },

    // Full teardown — ONLY for logout / app unmount. Closes the socket for good (no reconnect).
    disconnect() {
      this._teardown(true)
    },

    // Mid-turn socket drop: enter a soft "reconnecting" state instead of erroring. Idempotent.
    _enterReconnecting() {
      if (this._recovering) return
      this._recovering = true
      const m = this._cur()
      if (m && m.activity) m.activity.reconnecting = true
    },

    // Socket came back after a drop: the turn likely finished on the backend while we were away.
    // Reload history (polling briefly in case it's still finishing), then swap in the saved answer.
    async _recoverAfterReconnect() {
      this._recovering = false
      const m = this._cur()
      if (m && m.activity) m.activity.reconnecting = false
      const hadAssistantBefore = this.messages.filter((x) => x.role === 'assistant').length
      for (let i = 0; i < 10; i++) {
        const landed = await this._refreshHistory(hadAssistantBefore)
        if (landed) { this.isStreaming = false; this._assistantId = null; return }
        if (!this.isStreaming) return
        await new Promise((r) => setTimeout(r, 2500))
      }
      // Waited ~25s and the turn never landed — clear the spinner without a scary error.
      this._endAssistant()
    },

    // Re-fetch conversation messages from the server. Returns true once the turn that was running
    // during the drop has been persisted (a new assistant message is present).
    async _refreshHistory(prevAssistantCount = 0) {
      try {
        const res = await api.getConversation(this.conversationId)
        const rows = pickArray((res.data || {}).messages)
        const assistantCount = rows.filter((m) => (m.role === 'assistant')).length
        if (assistantCount <= prevAssistantCount) return false   // turn not persisted yet
        this.messages = rows.map((m) => ({
          id: nid(),
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          status: 'done',
          error: '',
          toolCalls: [],
          isLongResponse: !!(m.model_info && m.model_info.is_long_response),
          longAnswerRef: (m.model_info && m.model_info.long_answer_ref) || '',
          usage: (m.model_info && m.model_info.usage) || null,
          stopReason: (m.model_info && m.model_info.stop_reason) || '',
          confidence: (m.model_info && m.model_info.confidence) || '',
          trace: (m.model_info && m.model_info.trace) || [],
          activity: (m.model_info && m.model_info.activity) || null,
          planArtifacts: pickArray(m.plan_artifacts),
          // User-uploaded attachments bound to this message (served URLs; survive refresh).
          attachments: pickArray(m.attachments),
          conversationId: String(this.conversationId),
        }))
        this._hydratePlanAnchors(this.conversationId)
        return true
      } catch {
        return false
      }
    },

    // Inline plan artifact: hydrate snapshots for plans anchored in the loaded history so their inline
    // cards render on open. If no anchor is present but an assistant turn exists, attempt ONE lazy
    // reconcile (idempotent) to upgrade a legacy plan, then reload history to pick up its anchor.
    // Gated + safe: a complete no-op when the feature is off.
    _hydratePlanAnchors(cid) {
      if (cid == null) return
      try {
        const plan = usePlanStore()
        const runIds = new Set()
        for (const m of this.messages) {
          for (const a of (m.planArtifacts || [])) if (a && a.run_id) runIds.add(a.run_id)
        }
        if (runIds.size) { for (const rid of runIds) plan.hydrateRun(rid); return }
        if (!this.messages.some((m) => m.role === 'assistant')) return   // no plan possible
        plan.reconcileConversation(cid).then((r) => {
          if (r && r.created > 0 && String(cid) === String(this.conversationId)) {
            this._reloadHistoryForAnchors(cid)
          }
        })
      } catch (_e) { /* plan store optional */ }
    },

    // After a lazy reconcile attaches anchors, re-map plan_artifacts onto the in-memory messages (by
    // assistant order — message order is stable) and hydrate the newly-anchored runs.
    async _reloadHistoryForAnchors(cid) {
      try {
        const res = await api.getConversation(cid)
        if (String(cid) !== String(this.conversationId)) return
        const assistantRows = pickArray((res.data || {}).messages).filter((m) => m.role === 'assistant')
        let ai = 0
        for (const m of this.messages) {
          if (m.role !== 'assistant') continue
          const src = assistantRows[ai++]
          if (src && Array.isArray(src.plan_artifacts) && src.plan_artifacts.length) {
            m.planArtifacts = src.plan_artifacts
          }
        }
        const plan = usePlanStore()
        for (const m of this.messages) {
          for (const a of (m.planArtifacts || [])) if (a && a.run_id) plan.hydrateRun(a.run_id)
        }
      } catch (_e) { /* noop */ }
    },

    _teardown(clearStreaming = true) {
      if (this._conn) {
        this._conn.close()
        this._conn = null
      }
      if (clearStreaming) {
        this.isStreaming = false
        this._assistantId = null
      }
    },

    _beginAssistant() {
      this._recovering = false   // fresh turn must never inherit a stale "reconnecting" state
      this._taskRunActive = false   // a new turn hasn't entered a multi-step task run yet
      const activity = createActivity()
      startActivity(activity)
      this.messages.push({
        id: nid(),
        role: 'assistant',
        content: '',
        status: 'streaming',
        error: '',
        toolCalls: [],
        planArtifacts: [], // inline plan anchors attached live from plan_event (durable-anchor path)
        citations: [], // P6: KB sources for the "Sources" panel (set on assistant_message_complete)
        answerBasis: null, // provenance envelope (label + cited-or-top4) set on assistant_message_complete
        activity, // legacy raw timeline (see activityStream.js) — fallback when rich streaming is OFF
        timeline: null, // rich-streaming snapshot, pinned on completion (friendly, param-free)
        _serverMid: null, // §4b: server's per-turn message_id, adopted from the first stamped event
      })
      this._assistantId = this.messages[this.messages.length - 1].id
      this.isStreaming = true
      _tl.reset()   // fresh rich-streaming timeline for this turn
    },

    _cur() {
      return this.messages.find((m) => m.id === this._assistantId)
    },

    _endAssistant() {
      // While a human approval is pending, DON'T finalize the turn. The task/CRS path can emit a
      // premature "complete" for the step-0 text while the agent is actually blocked on an approval
      // card; finalizing here would show "Done", hide the Stop button, and orphan the pending card.
      // The REAL completion (after the human responds, once hitlRequests is empty) ends the turn.
      if (this.hitlRequests.length > 0) return
      const m = this._cur()
      if (m) {
        if (m.activity) finishActivity(m.activity)
        _tl.finalize()
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()   // pin the rich timeline onto this message
        if (m.status === 'streaming') m.status = 'done'
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
    },

    _persistTurnMeta(m) {
      // Snapshot the finished activity timeline back to the server so the "Done · N steps · …"
      // accordion + reasoning survive a page refresh (usage/stop are already persisted server-side).
      // Best-effort: the row was just saved by the turn, so the backend attaches this to it.
      try {
        if (!m || !m.activity || !this.conversationId || !this._conn) return
        const activity = JSON.parse(JSON.stringify(m.activity))
        // Also persist the rich-streaming timeline snapshot so a refresh renders the masked timeline
        // (Searching → Generating, friendly labels) instead of falling back to the raw ActivityStream.
        const timeline = m.timeline ? JSON.parse(JSON.stringify(m.timeline)) : null
        this._conn.send({ type: 'persist_turn_meta', conversation_id: this.conversationId, activity, timeline })
      } catch { /* best-effort — never block the turn */ }
    },

    _errAssistant(err) {
      const m = this._cur()
      if (m) {
        m.status = 'error'
        m.error = err || 'Something went wrong.'
        // interrupt (not finish): the live timeline collapses to "Interrupted", not "Done".
        if (m.activity) interruptActivity(m.activity, m.error)
        _tl.interrupt(m.error)
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
    },

    _onEvent(msg) {
      const t = msg?.type
      if (t === 'ping') return   // server keepalive heartbeat — nothing to render
      // Inline plan artifact (INLINE_PLAN_ARTIFACT_PLAN.md): a pushed, exact-version plan snapshot.
      // Owned entirely by the plan store — it carries no chat content/usage. Scope to THIS window's
      // conversation (the frame is broadcast to the user group with conversation_id inside). The store
      // applies by (version, sequence) and dedups by event_id; this handler never derives state.
      if (t === 'plan_event') {
        const pcid = msg.conversation_id
        if (pcid == null || this.conversationId == null || String(pcid) === String(this.conversationId)) {
          try {
            usePlanStore().applyPlanEvent(msg)
            // Live anchor: attach this plan to the current assistant turn so its inline card renders
            // immediately (before the durable anchor is persisted + reloaded on next open). This matches
            // the eventual server anchor (same turn's assistant message).
            const cur = this._cur() || this.messages.filter((x) => x.role === 'assistant').slice(-1)[0]
            const pid = msg.plan_id || (msg.plan_view && msg.plan_view.plan_id)
            const rid = msg.run_id || (msg.plan_view && msg.plan_view.run_id)
            if (cur && pid && rid) {
              if (!Array.isArray(cur.planArtifacts)) cur.planArtifacts = []
              if (!cur.planArtifacts.some((a) => a.plan_id === pid)) {
                cur.planArtifacts.push({ plan_id: pid, run_id: rid, ordinal: cur.planArtifacts.length })
              }
            }
          } catch (_e) { /* plan store optional */ }
        }
        return
      }
      // Canvas + Live Preview events (static + web_builder providers) are owned by the canvas store —
      // it reacts to canvas_session_started / preview_ready / preview_updated / preview_failed / etc.
      // handleEvent() returns true when it consumed the event, so we don't also run it through the chat
      // switch below (these carry no chat content/usage).
      try { if (useCanvasStore().handleEvent(msg)) return } catch (_e) { /* canvas store optional */ }
      // Rich streaming: friendly, param-free activity (Searching → Generating). Feed the shared
      // timeline reducer and stop — these 6 events carry no content/usage to process further.
      if (isRichEvent(msg)) { _tl.ingest(msg); return }
      const m = this._cur()
      // §4b stale/interrupted-stream guard (defense-in-depth — the backend also drops these
      // server-side). A streamed event carries the server's per-turn message_id; the first one we
      // see binds the bubble, and any later event from a DIFFERENT (superseded) turn is ignored so it
      // can't overwrite the live answer, leak tool-call JSON, or pollute the activity timeline.
      if (m && msg && msg.message_id != null && STREAM_ID_TYPES.has(t)) {
        if (m._serverMid == null) m._serverMid = msg.message_id
        else if (m._serverMid !== msg.message_id) return
      }
      // Feed the live activity timeline (Thinking → tools → Generating → Done). The
      // 'error' type is fed inside its case below (after the benign-rejection filter).
      if (m && m.activity && t !== 'error') ingestActivity(m.activity, msg)
      switch (t) {
        case 'turn_resumed':
          // We reconnected (e.g. after a refresh) to a turn still running on the server. Open a fresh
          // streaming assistant message so the live tokens land; assistant_message_complete will
          // replace it with the full cleaned text. Guard against double-starting.
          if (!this.isStreaming) this._beginAssistant()
          break
        case 'turn_not_running':
          break   // nothing in flight — saved history (if any) is already loaded
        case 'assistant_message_chunk':
          if (m) m.content += msg.chunk || ''
          break
        case 'assistant_message_complete':
          // The backend sends the CLEANED prose here (tool-call JSON stripped). Always
          // replace the live-streamed text with it so any raw JSON that streamed
          // token-by-token is corrected to clean prose. Tool calls still render as
          // cards via the tool_call/tool_result events + activity timeline.
          if (m && msg.full_message != null) m.content = msg.full_message
          if (m && msg.usage) m.usage = msg.usage // per-response token counts
          if (m && msg.stop_reason) { m.stopReason = msg.stop_reason; m.confidence = msg.confidence }
          if (m && Array.isArray(msg.citations)) m.citations = msg.citations // P6: KB sources
          if (m && msg.answer_basis) m.answerBasis = msg.answer_basis // provenance footer + cited-or-top4
          // TASK/CRS runs stream an assistant_message_complete after EVERY ReAct step (agent_runner
          // _ask_llm), not just the last one — the run keeps going (planning → 13 steps → tools). Those
          // are INTERMEDIATE: update the bubble text but DON'T end the turn, or the UI shows "Done" while
          // the agent is still working. The turn ends only on the real completion signal
          // (agent_session_complete / agent_event session_complete). For the normal chat path (no task
          // run active) this remains the terminal event.
          if (this._taskRunActive) break
          this._endAssistant()
          this._persistTurnMeta(m)   // snapshot the finished timeline so it survives a refresh
          break
        case 'chat_response':
        case 'assistant':
        case 'assistant_message': {
          const c = msg.content || msg.message || msg.full_message
          if (m && c) m.content = c
          this._endAssistant()
          break
        }
        case 'tool_call':
          if (m) m.toolCalls.push({ name: msg.tool || msg.tool_name || 'tool', status: 'running' })
          break
        case 'tool_result': {
          if (m) {
            const name = msg.tool_name || msg.tool
            const tc =
              m.toolCalls.find((x) => x.name === name) ||
              m.toolCalls[m.toolCalls.length - 1]
            if (tc) tc.status = msg.success === false ? 'error' : 'done'
          }
          break
        }
        // ── Human-in-the-loop: the backend gated a tool for approval ──────────────
        case 'hitl_request': {
          // Scope to THIS window's conversation. HITL requests are broadcast to the user-level group,
          // so every open chat window/tab receives them; only show the card in the window whose
          // conversation triggered the turn (fall back to showing it when no id is present).
          const _hcid = msg.conversation_id || msg.payload?.conversation_id
          if (_hcid && this.conversationId && String(_hcid) !== String(this.conversationId)) break
          // Avoid duplicates if the event is re-delivered.
          if (!this.hitlRequests.some((r) => r.request_id === msg.request_id)) {
            this.hitlRequests.push({
              request_id: msg.request_id,
              interaction_type: msg.interaction_type,
              response_type: msg.response_type,
              summary: msg.summary,
              services: msg.services || [],
              payload: msg.payload || {},
              options: msg.options || [],
              urgency: msg.urgency || 'medium',
              timeout_at: msg.timeout_at || null,
            })
          }
          // Keep the turn ALIVE while this approval is pending. The task/CRS path can emit a premature
          // "complete" for the step-0 text BEFORE this card arrives — which already flipped the turn to
          // "Done" and hid the Stop control. Re-open the streaming turn (re-binding the assistant
          // bubble if it was finalized) so the timeline shows "awaiting approval" and the card + Stop
          // stay visible until the human responds.
          this.awaitingApproval = true
          this.isStreaming = true
          {
            const cur = this._cur()
              || this.messages.filter((x) => x.role === 'assistant').slice(-1)[0]
            if (cur) {
              if (this._assistantId == null) this._assistantId = cur.id
              if (cur.status === 'done') cur.status = 'streaming'
            }
          }
          break
        }
        case 'hitl_response_ack':
          this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== msg.request_id)
          if (this.hitlRequests.length === 0) this.awaitingApproval = false
          break
        // ── Mid-run steering: a message the user sent while the agent was working ──
        case 'message_queued':
          // ack that the backend queued the steering message (the optimistic bubble already shows it).
          break
        case 'steering_applied': {
          // the running agent picked up a queued message — drop the "queued" flag on that bubble.
          const qm = [...this.messages].reverse().find(
            (m) => m.role === 'user' && m.queued && (m.content || '') === (msg.message || ''))
          if (qm) qm.queued = false
          break
        }
        // ── Task/CRS run lifecycle: a multi-step run (plan → tools) streams an assistant_message_complete
        //    PER step; the turn must end only on the run's terminal event, not the first step. ──
        case 'agent_planning':
          this._taskRunActive = true   // a multi-step task run is in progress
          break
        case 'agent_plan_generated':
          // A `display_only` plan comes from the native chat path purely to render the plan in the
          // timeline — it is NOT a multi-step TASK run and this turn ends on assistant_message_complete
          // (no agent_session_complete follows). Flipping _taskRunActive here would suppress that end
          // signal and lock the composer in steering mode forever. Only real task runs (no display_only)
          // set the flag.
          if (!msg.display_only) this._taskRunActive = true
          // The inline plan card is anchored durably via the message's plan_artifacts (persisted +
          // pushed via plan_event), not a runtime anchor id — nothing to set here.
          break
        case 'agent_session_complete':
        case 'agent_session_stopped':
        case 'agent_session_error':
          this._taskRunActive = false
          this._endAssistant()
          break
        case 'agent_event': {
          const aev = msg.event || msg.data?.event
          if (aev === 'session_start') this._taskRunActive = true
          else if (aev === 'session_complete' || aev === 'session_error') {
            this._taskRunActive = false
            this._endAssistant()
          }
          break
        }
        // ── v3 Plan Gate (Manual Mode): a plan is ready and awaits a human. The timeline label is
        // already shown via the catch-all ingest above; surface the approval card with the content.
        case 'plan_approval_required':
          this.pendingPlan = msg.plan || {}
          break
        // Human approved server-side → resume by re-sending the original instruction (it now
        // executes because the plan is approved). Rejection just clears the card + ends the turn.
        case 'plan_approved':
          this.pendingPlan = null
          this._resumeAfterPlan()
          break
        case 'plan_rejected':
          this.pendingPlan = null
          this._endAssistant()
          break
        // Human requested changes → the feedback becomes the next instruction; the agent re-plans.
        case 'plan_revise':
          this.pendingPlan = null
          this._resumeAfterRevise(msg.feedback)
          break
        case 'agent_session_complete':
          this._endAssistant()
          break
        case 'stop_acknowledged':
          this._endAssistant()
          break
        case 'error': {
          const em = msg.error || msg.message || ''
          // Benign control-message rejections (e.g. "Unknown message type: ...")
          // must not fail the turn — the actual chat_message still streams/saves.
          if (/unknown message type/i.test(em)) break
          if (m && m.activity) ingestActivity(m.activity, msg) // mark active step red
          this._errAssistant(em)
          break
        }
        default:
          // agent_typing / thought / planning / step — ignored for now
          break
      }
    },
  },
})
