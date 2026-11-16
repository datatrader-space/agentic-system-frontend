// The sessions screen's state: the person's runs across their chats (backend run_coordinator/services/run_sessions.py,
// LONG_RUN_LIKE_CLAUDE_CODE_PLAN.md 3.6).
//
// One row per chat (its latest run) with the state a person reads (the backend's words in `state_label`), the line
// saying what it is doing or asking, and the open card to answer from the list. The rows follow the person's runs
// live over a chat socket of their own (the person's `user_<id>` group): a `run_state`, `hitl_request`,
// `hitl_resolved` or `run_finished` frame names a chat, and that chat's row is read again from the authorized endpoint.
// Nothing is taken from the frame itself. Answers and Stop go over the same socket, as the chat sends them
// (`hitl_response`, `stop_execution`).
import { defineStore } from 'pinia'
import api from '../services/api'
import { ChatConnection } from '../services/chatService'

export const SESSION_STATES = ['needs_input', 'working', 'done', 'failed', 'stopped']

// The frames that say a chat's row may have changed.
const ROW_FRAMES = new Set(['run_state', 'hitl_request', 'hitl_resolved', 'hitl_response_ack', 'run_finished',
  'stop_acknowledged'])
// The frames that say the person's pending approvals may have changed ("Waiting for you" at the top of the page).
const APPROVAL_FRAMES = new Set(['hitl_request', 'hitl_resolved', 'hitl_response_ack', 'approval_pending'])
// Several frames for one chat arrive together (a tool call, its result, a status line): one read for all of them.
const REFRESH_AFTER_MS = 400

let _conn = null
const _timers = new Map()
let _approvalsTimer = null

function _byNewest(a, b) {
  return String(b.started_at || '').localeCompare(String(a.started_at || ''))
}

export const useSessionsStore = defineStore('sessions', {
  state: () => ({
    items: [],
    nextCursor: null,
    filter: '',          // '' = every state
    loading: false,
    loadingMore: false,
    loadError: false,
    needsInputCount: 0,
    // Rows with an action in flight: { [conversationId]: 'answer' | 'stop' }.
    busy: {},
    // The last refusal the server sent for an action from this screen (shown beside the list).
    actionError: '',
    live: false,
    // "Waiting for you": the person's own pending approvals from every source (GET /run-coordinator/approvals/),
    // answered from this page (POST .../<id>/answer/). Only the person's own: the server filters them.
    approvals: [],
    approvalsLoaded: false,
    // { [approvalId]: 'approve' | 'decline' } while an answer is on its way.
    approvalBusy: {},
    // { [approvalId]: 'what the server said' } after a refused answer, shown beside that row.
    approvalErrors: {},
  }),
  actions: {
    async load({ reset = true } = {}) {
      if (reset) {
        this.loading = true
        this.loadError = false
      } else {
        if (!this.nextCursor || this.loadingMore) return
        this.loadingMore = true
      }
      const filter = this.filter
      try {
        const params = { ...(filter ? { state: filter } : {}), ...(reset ? {} : { cursor: this.nextCursor }) }
        const { data } = await api.getSessions(params)
        if (filter !== this.filter) return          // the filter changed while this page was on its way
        const rows = data?.sessions || []
        this.items = reset ? rows : [...this.items, ...rows.filter((r) => !this.items.some((i) => i.run_id === r.run_id))]
        this.nextCursor = data?.next_cursor || null
      } catch (e) {
        if (reset) this.loadError = true
        else this.actionError = "More sessions couldn't be loaded. Try again."
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    loadMore() { return this.load({ reset: false }) },
    setFilter(state) {
      const next = SESSION_STATES.includes(state) ? state : ''
      if (next === this.filter && this.items.length) return
      this.filter = next
      this.items = []
      this.nextCursor = null
      return this.load()
    },
    async refreshCount() {
      try {
        const { data } = await api.getSessionNeedsInputCount()
        this.needsInputCount = Number(data?.count) || 0
      } catch (e) { /* the badge keeps its last number; the next poll tries again */ }
    },
    // Read one chat's row again and put it where it belongs (or take it out).
    async refreshConversation(conversationId) {
      const cid = String(conversationId || '')
      if (!cid) return
      let row = null
      try {
        const { data } = await api.getSessionForConversation(cid)
        row = data || null
      } catch (e) {
        if (e?.response?.status !== 404) return    // a failed read leaves the row as it was
      }
      const rest = this.items.filter((i) => String(i.conversation_id) !== cid)
      if (!row || (this.filter && row.state !== this.filter)) {
        this.items = rest
      } else {
        // A row older than the last one loaded belongs to a page not loaded yet: it comes with that page.
        const last = this.items[this.items.length - 1]
        const known = this.items.some((i) => String(i.conversation_id) === cid)
        if (known || !this.nextCursor || !last || _byNewest(row, last) <= 0) this.items = [...rest, row].sort(_byNewest)
        else this.items = rest
      }
      if (this.busy[cid]) {
        const { [cid]: _done, ...others } = this.busy
        this.busy = others
      }
      this.refreshCount()
    },
    _scheduleRefresh(conversationId) {
      const cid = String(conversationId || '')
      if (!cid) return
      clearTimeout(_timers.get(cid))
      _timers.set(cid, setTimeout(() => { _timers.delete(cid); this.refreshConversation(cid) }, REFRESH_AFTER_MS))
    },
    async loadApprovals() {
      try {
        const { data } = await api.getPendingApprovals()
        this.approvals = Array.isArray(data?.approvals) ? data.approvals : []
        // An error for a row that is gone has nothing left to sit beside.
        const ids = new Set(this.approvals.map((a) => String(a.id)))
        this.approvalErrors = Object.fromEntries(Object.entries(this.approvalErrors).filter(([k]) => ids.has(k)))
      } catch (e) {
        // A failed read keeps the rows already shown; the next frame or focus reads again.
      } finally {
        this.approvalsLoaded = true
      }
    },
    _scheduleApprovals() {
      clearTimeout(_approvalsTimer)
      _approvalsTimer = setTimeout(() => { _approvalsTimer = null; this.loadApprovals() }, REFRESH_AFTER_MS)
    },
    // Approve or decline one pending approval. Its row goes on success and the list is read again; a refusal is
    // said beside the row, which stays.
    async answerApproval(approval, approved, feedback = '') {
      const id = String(approval?.id || '')
      if (!id || this.approvalBusy[id]) return false
      this.approvalBusy = { ...this.approvalBusy, [id]: approved ? 'approve' : 'decline' }
      const { [id]: _old, ...otherErrors } = this.approvalErrors
      this.approvalErrors = otherErrors
      try {
        await api.answerApproval(id, { approved, feedback })
        this.approvals = this.approvals.filter((a) => String(a.id) !== id)
        this.loadApprovals()
        if (approval.conversation_id) this._scheduleRefresh(approval.conversation_id)
        this.refreshCount()
        return true
      } catch (e) {
        const said = e?.response?.data?.error
        this.approvalErrors = { ...this.approvalErrors,
          [id]: said ? String(said) : "The answer couldn't be sent. Try again." }
        return false
      } finally {
        const { [id]: _done, ...rest } = this.approvalBusy
        this.approvalBusy = rest
      }
    },
    _onEvent(evt) {
      if (!evt || !evt.type) return
      if (APPROVAL_FRAMES.has(evt.type)) this._scheduleApprovals()
      if (ROW_FRAMES.has(evt.type)) {
        const cid = evt.conversation_id || evt.payload?.conversation_id
        // An MCP client's approval names its MCP session ("mcp:<session>"), not a chat: no session row to read.
        if (cid && !String(cid).startsWith('mcp:')) this._scheduleRefresh(cid)
        else if (evt.request_id) {
          // `hitl_resolved` names only the card: the row that shows it is read again.
          const row = this.items.find((i) => i.request?.request_id === evt.request_id)
          if (row) this._scheduleRefresh(row.conversation_id)
        }
        return
      }
      if (evt.type === 'error' && evt.error) {
        this.actionError = String(evt.error)
        if (evt.conversation_id) this._scheduleRefresh(evt.conversation_id)
      }
    },
    connect() {
      if (_conn) return
      _conn = new ChatConnection(null, {
        onEvent: (evt) => this._onEvent(evt),
        onOpen: () => { this.live = true },
        onClose: () => { this.live = false },
        // Back after a gap: frames sent meanwhile were missed, so the list is read again.
        onConnectionState: (s) => { if (s === 'open') { this.load(); this.loadApprovals() } },
      })
      _conn.connect(0)
    },
    disconnect() {
      for (const t of _timers.values()) clearTimeout(t)
      _timers.clear()
      clearTimeout(_approvalsTimer)
      _approvalsTimer = null
      if (_conn) { _conn.close(); _conn = null }
      this.live = false
    },
    // Answer a waiting row's card from the list: the chat's own `hitl_response`.
    respond(row, { request_id, response_value, feedback }) {
      if (!_conn || !row || !request_id) return
      this.actionError = ''
      this.busy = { ...this.busy, [String(row.conversation_id)]: 'answer' }
      _conn.sendHitlResponse(request_id, response_value, feedback || '')
    },
    // Stop a run from the list: the chat's own `stop_execution`, for that chat.
    stop(row) {
      if (!_conn || !row) return
      this.actionError = ''
      this.busy = { ...this.busy, [String(row.conversation_id)]: 'stop' }
      _conn.send({ type: 'stop_execution', conversation_id: String(row.conversation_id) })
    },
  },
})
