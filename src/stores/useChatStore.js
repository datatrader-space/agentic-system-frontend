// Pinia store — real chat thread + session history (Phase 2 backend wiring).
//
// Flow: pick an Agent Profile → first message starts a conversation
// (POST /agents/<id>/chat/) → live tokens stream over the chat WebSocket
// (ChatConnection). History loads via GET /conversations/.
import { defineStore } from 'pinia'
import api from '../services/api'
import { ChatConnection } from '../services/chatService'

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

    // Agent selection
    agents: [],
    selectedAgentId: null,
    agentsLoaded: false,
    agentsLoading: false,

    // Sidebar history
    sessions: [],
    sessionsLoading: false,

    loadingHistory: false,
    error: '',

    _conn: null,
    _assistantId: null,
  }),
  getters: {
    isEmpty: (s) => s.messages.length === 0,
    currentAgent: (s) =>
      s.agents.find((a) => String(a.id) === String(s.selectedAgentId)) || null,
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

    // ---- Conversation lifecycle ----
    reset() {
      this._teardown()
      this.messages = []
      this.conversationId = null
      this.error = ''
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

    async sendMessage(text) {
      const content = (text || '').trim()
      if (!content || this.isStreaming) return

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
        } catch {
          this.error = 'Failed to start chat.'
          return
        }
      } else if (!this._conn) {
        this._connect()
      }

      this.messages.push({ id: nid(), role: 'user', content, status: 'done' })
      this._beginAssistant()
      this._conn?.sendMessage(content, this.selectedAgentId)
    },

    stop() {
      this._conn?.stop()
      this._endAssistant()
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
      this.messages.push({
        id: nid(),
        role: 'assistant',
        content: '',
        status: 'streaming',
        error: '',
        toolCalls: [],
      })
      this._assistantId = this.messages[this.messages.length - 1].id
      this.isStreaming = true
    },

    _cur() {
      return this.messages.find((m) => m.id === this._assistantId)
    },

    _endAssistant() {
      const m = this._cur()
      if (m && m.status === 'streaming') m.status = 'done'
      this.isStreaming = false
      this._assistantId = null
    },

    _errAssistant(err) {
      const m = this._cur()
      if (m) {
        m.status = 'error'
        m.error = err || 'Something went wrong.'
      }
      this.isStreaming = false
      this._assistantId = null
    },

    _onEvent(msg) {
      const t = msg?.type
      const m = this._cur()
      switch (t) {
        case 'assistant_message_chunk':
          if (m) m.content += msg.chunk || ''
          break
        case 'assistant_message_complete':
          if (m && !m.content && msg.full_message) m.content = msg.full_message
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
