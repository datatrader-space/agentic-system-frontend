// Pinia store — real chat thread + session history (Phase 2 backend wiring).
//
// Flow: pick an Agent Profile → first message starts a conversation
// (POST /agents/<id>/chat/) → live tokens stream over the chat WebSocket
// (ChatConnection). History loads via GET /conversations/.
import { defineStore } from 'pinia'
import api from '../services/api'
import { ChatConnection } from '../services/chatService'
import { createActivity, start as startActivity, ingest as ingestActivity, finish as finishActivity } from '../composables/activityStream'

let _seq = 0
const nid = () => `m${++_seq}`

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

    // Human-in-the-loop approval queue (tools the backend gated for approval). Rendered by HITLModal.
    hitlRequests: [],

    // Manual Mode plan awaiting human approval (v3 Layer 2). Rendered by PlanApprovalCard; null when
    // none pending. Approving resumes the run (re-sends the last user message).
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

    loadingHistory: false,
    error: '',

    _conn: null,
    _assistantId: null,
  }),
  getters: {
    isEmpty: (s) => s.messages.length === 0,
    currentAgent: (s) =>
      s.agents.find((a) => String(a.id) === String(s.selectedAgentId)) || null,
    // Running session totals (this chat). Prefer a turn's EXACT completed usage; while a turn is
    // still streaming, fall back to its live activity-token counter so the footer ticks up mid-run
    // and finalises exactly. Turns with neither contribute 0; auto-resets when messages clear.
    sessionTokens: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.total_tokens) || (m.activity && m.activity.tokens && m.activity.tokens.total) || 0), 0),
    sessionCost: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.cost_usd) || (m.activity && m.activity.tokens && m.activity.tokens.cost) || 0), 0),
  },
  actions: {
    // ---- Agents + history ----
    async loadAgents() {
      // agentsLoading is set synchronously, so concurrent mount-time calls from
      // LeftSidebar / ChatWelcome / ChatWorkspace collapse into a single request.
      if (this.agentsLoaded || this.agentsLoading) return
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

    setAgent(id) {
      this.selectedAgentId = String(id)
      this.loadSessions()
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
    async loadAllSessions() {
      if (this.allSessionsLoading) return
      this.allSessionsLoading = true
      try {
        const res = await api.getConversations({ ordering: '-updated_at', limit: 200 })
        this.allSessions = pickArray(res.data)
      } catch {
        /* non-fatal */
      } finally {
        this.allSessionsLoading = false
      }
    },

    // ---- Conversation lifecycle ----
    reset() {
      this._teardown()
      this.messages = []
      this.conversationId = null
      this.error = ''
      this.pendingPlan = null
      this._clearAttachments()
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
      if (String(this.conversationId) === String(id) && this.messages.length) return
      this._teardown()
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
          conversationId: String(id),
        }))
        this.repoId = data.repository?.id || data.repository_id || 0
        if (data.agent_profile?.id) this.selectedAgentId = String(data.agent_profile.id)
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
        this.pendingAttachments.push({
          file, name: file.name, isImage,
          url: isImage ? URL.createObjectURL(file) : '',
        })
      }
    },
    removeAttachment(i) {
      const a = this.pendingAttachments[i]
      if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } }
      this.pendingAttachments.splice(i, 1)
    },

    async sendMessage(text) {
      const content = (text || '').trim()
      const atts = this.pendingAttachments.slice()
      if ((!content && atts.length === 0) || this.isStreaming) return

      // Start a conversation on the first message.
      if (!this.conversationId) {
        if (!this.selectedAgentId) {
          this.error = 'Select an agent to start chatting.'
          return
        }
        try {
          const res = await api.startAgentChat(this.selectedAgentId)
          const d = res.data || {}
          this.conversationId = String(d.conversation_id ?? d.profile_id ?? '')
          this.repoId = d.repository_id || 0
          if (!this.conversationId) throw new Error('no conversation id')
          this._connect()
          this.loadSessions() // surface the new chat in the sidebar
          this.loadAllSessions() // refresh the global recent-chats list + search
        } catch {
          this.error = 'Failed to start chat.'
          return
        }
      } else if (!this._conn) {
        this._connect()
      }

      // Show the user turn (with attachment previews) and the assistant placeholder up-front.
      this.messages.push({
        id: nid(), role: 'user', content, status: 'done',
        attachments: atts.map((a) => ({ name: a.name, isImage: a.isImage, url: a.url })),
      })
      this.pendingAttachments = [] // claimed by this turn; the message bubble keeps the preview urls
      this._beginAssistant()

      // Upload attachments to the conversation BEFORE sending the text — the backend auto-attaches
      // recent images (within one message) to the vision model, so they must exist first.
      if (atts.length) {
        try {
          for (const a of atts) await api.uploadConversationFile(this.conversationId, a.file)
        } catch {
          this.error = 'Failed to upload an attachment.'
        }
      }

      this._conn?.sendMessage(content, this.selectedAgentId)
    },

    stop() {
      this._conn?.stop()
      this._endAssistant()
    },

    // ── HITL approval responses (sent over the same WS the backend awaits on) ──
    respondHitl({ request_id, response_value, feedback }) {
      this._conn?.sendHitlResponse(request_id, response_value, feedback)
      // Optimistically clear; the hitl_response_ack will also clear it.
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== request_id)
    },

    dismissHitl(requestId) {
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
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
    _connect() {
      this._teardown(false)
      this._conn = new ChatConnection(this.conversationId, {
        onEvent: (msg) => this._onEvent(msg),
        onError: () => {
          if (this.isStreaming) this._errAssistant('Connection error')
        },
        onClose: () => {
          if (this.isStreaming) this._endAssistant()
        },
      })
      this._conn.connect(this.repoId || 0)
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
      const activity = createActivity()
      startActivity(activity)
      this.messages.push({
        id: nid(),
        role: 'assistant',
        content: '',
        status: 'streaming',
        error: '',
        toolCalls: [],
        activity, // live "what the agent is doing" timeline (see activityStream.js)
      })
      this._assistantId = this.messages[this.messages.length - 1].id
      this.isStreaming = true
    },

    _cur() {
      return this.messages.find((m) => m.id === this._assistantId)
    },

    _endAssistant() {
      const m = this._cur()
      if (m) {
        if (m.activity) finishActivity(m.activity)
        if (m.status === 'streaming') m.status = 'done'
      }
      this.isStreaming = false
      this._assistantId = null
    },

    _errAssistant(err) {
      const m = this._cur()
      if (m) {
        m.status = 'error'
        m.error = err || 'Something went wrong.'
        if (m.activity) finishActivity(m.activity)
      }
      this.isStreaming = false
      this._assistantId = null
    },

    _onEvent(msg) {
      const t = msg?.type
      const m = this._cur()
      // Feed the live activity timeline (Thinking → tools → Generating → Done). The
      // 'error' type is fed inside its case below (after the benign-rejection filter).
      if (m && m.activity && t !== 'error') ingestActivity(m.activity, msg)
      switch (t) {
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
          this._endAssistant()
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
        case 'hitl_request':
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
          break
        case 'hitl_response_ack':
          this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== msg.request_id)
          break
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
