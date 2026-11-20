// The Workflow Builder agent bar's conversation (ADM-1333, plan D6 and §3.4): a chat with the person's Super Agent on
// the EXISTING agent socket (`ws/chat/agent/`, services/chatService.js ChatConnection: the same client, heartbeat and
// reconnect as the main chat), scoped to the workflow open in the builder.
//
//   const chat = useWorkflowAgentChat({ graphId: () => props.graphId, onProposal: (frame) => proposal.receive(frame) })
//   chat.send('Add a step that posts the summary to Slack')
//   chat.stop(); chat.newConversation()
//
// WHY NOT THE CHAT STORE. useChatStore is the main chat page's one conversation (its messages, its socket, its history
// lists). Hosting a second conversation there would switch the page's conversation under the person, so the bar keeps its
// own ChatConnection and only the reducer for the frames it shows: streamed text, tool steps (useAgentTimeline, the
// same reducer the chat uses), the proposal, and errors with their real reason.
//
// THE CONVERSATION. The bar sends its first message with no conversation id, like the agent quick-test panel; the server
// creates the conversation and answers `conversation_created`. It never refreshes the main chat's history lists, so the
// chat page is not disturbed; the conversation is an ordinary Super Agent chat and is listed in the person's history.
//
// Every message carries `workflow_context: {graph_id: <integer>}`; the server hands the turn the two workflow tools only
// when the signed-in person owns that workflow. The agent never saves.
import { ref, shallowRef, computed, getCurrentScope, onScopeDispose } from 'vue'
import { ChatConnection } from '@/services/chatService'
import { useChatStore } from '@/stores/useChatStore'
import { useAgentTimeline } from '@/composables/useAgentTimeline'
import { ThinkStreamFilter, stripThinkBlocks } from '@/utils/thinkFilter'

// The answer to a message that the bar cannot show (an approval card, a question, a plan to approve).
export const NEEDS_CHAT = 'The agent is waiting for an answer that this bar cannot show. Open the conversation in Chat to answer it.'
const LOST_REPLY = 'The connection dropped while the agent was answering, and its reply did not reach this bar. Open the conversation in Chat to read it.'
const INTERRUPTED ='This reply was interrupted because the server restarted. Send your message again.'
// Frames of a turn that end it.
const ENDS_TURN = new Set(['agent_session_complete', 'agent_session_stopped', 'agent_session_error'])
// Frames that ask the person something the bar does not draw.
const ASKS_IN_CHAT = new Set(['hitl_request', 'permission_request', 'plan_approval_required', 'full_doc_cost_approval'])

let seq = 0
const nid = () => `wfa-${Date.now().toString(36)}-${(seq += 1)}`

export function useWorkflowAgentChat({ graphId, onProposal, connectionFactory = (cid, handlers) => new ChatConnection(cid, handlers) } = {}) {
  const readGraphId = () => Number(typeof graphId === 'function' ? graphId() : graphId?.value ?? graphId)

  const messages = ref([])           // [{ id, role, content, status, error, errorCode, steps, toolCalls, proposalId, needsChat }]
  const busy = ref(false)
  const stopping = ref(false)
  const conversationId = ref(null)
  const agent = shallowRef(null)     // the Super Agent's card
  const agentError = ref('')
  const connection = ref('idle')     // idle | connecting | open | reconnecting | lost
  const timeline = useAgentTimeline()
  const think = new ThinkStreamFilter()

  let conn = null
  let assistantId = null
  let awaitingCreate = false
  let droppedDuringTurn = false   // the socket closed while a turn was running: its reply may have been missed

  // The connection's conversation, set WITHOUT ChatConnection.setConversation: that asks the server to resume a turn,
  // which is for opening a chat on a page, and its `turn_not_running` answer would race the message about to be sent.
  // On a reopen the connection asks for it itself (chatService onopen).
  const follow = (c, id) => { if (c) c.conversationId = id }

  const current = () => messages.value.find((m) => m.id === assistantId) || null
  const lastAssistant = () => [...messages.value].reverse().find((m) => m.role === 'assistant') || null
  const liveSteps = computed(() => timeline.steps.value.filter((s) => s.phase !== 'reasoning'))
  const liveStatus = computed(() => timeline.currentStatus.value?.label || '')

  async function ensureAgent() {
    if (agent.value) return agent.value
    agentError.value = ''
    let card = null
    try { card = await useChatStore().ensureSuperAgent() } catch { card = null }
    if (!card || card.id == null) {
      agentError.value = 'Your Super Agent could not be loaded, so the agent bar cannot send. Check your connection and try again.'
      return null
    }
    agent.value = card
    return card
  }

  function ensureConn() {
    if (conn) return conn
    connection.value = 'connecting'
    conn = connectionFactory(conversationId.value, {
      onOpen: () => { connection.value = 'open' },
      onClose: () => { connection.value = 'reconnecting'; if (busy.value) droppedDuringTurn = true },
      onError: () => { if (connection.value !== 'lost') connection.value = 'reconnecting' },
      onConnectionState: (state) => { connection.value = state === 'lost' ? 'lost' : 'open' },
      onEvent,
    })
    if (agent.value) conn.prewarm(agent.value.id)
    conn.connect(0)
    return conn
  }

  function endTurn(status = 'done') {
    const m = current()
    if (status === 'error') timeline.fail()
    else if (status === 'stopped') timeline.interrupt('Stopped')
    else timeline.finalize()
    if (m) {
      if (m.status === 'streaming') m.status = status
      m.steps = timeline.snapshot().steps.filter((s) => s.phase !== 'reasoning')
    }
    assistantId = null
    busy.value = false
    stopping.value = false
  }

  function failTurn(message, code = '') {
    const m = current()
    if (m) {
      m.error = message
      m.errorCode = code || ''
      m.status = 'error'
    }
    endTurn('error')
  }

  /** Send one message. Resolves false (with the reason on screen) when it could not be sent. */
  async function send(text) {
    const content = String(text || '').trim()
    if (!content || busy.value) return false
    const gid = readGraphId()
    if (!Number.isInteger(gid) || gid <= 0) {
      agentError.value = 'This workflow is not saved yet, so the agent cannot read it. Save it first.'
      return false
    }
    const sa = await ensureAgent()
    if (!sa) return false
    const c = ensureConn()
    follow(c, conversationId.value)
    messages.value.push({ id: nid(), role: 'user', content, status: 'done' })
    assistantId = nid()
    messages.value.push({ id: assistantId, role: 'assistant', content: '', status: 'streaming', error: '', errorCode: '', steps: [], toolCalls: [], proposalId: null, needsChat: false })
    timeline.reset()
    think.reset()
    busy.value = true
    awaitingCreate = !conversationId.value
    droppedDuringTurn = false
    // The one chat_message builder (services/chatService.js sendMessage), scoped to the workflow; the conversation id
    // is the connection's own (`follow` above).
    c.sendMessage(content, String(sa.id), null, {
      clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      workflowContext: { graph_id: gid },
    })
    return true
  }

  /** Stop the turn. The bar is released at once; a late frame of the stopped turn is not drawn. */
  function stop() {
    if (!busy.value || !conn) return
    stopping.value = true
    conn.stop()
    const m = current()
    if (m) m.status = 'stopped'
    endTurn('stopped')
  }

  /** Start over: the next message opens a new conversation. */
  function newConversation() {
    if (busy.value) stop()
    messages.value = []
    conversationId.value = null
    awaitingCreate = false
    timeline.reset()
    follow(conn, null)
  }

  function reconnectNow() { conn?.reconnectNow() }

  function onEvent(msg) {
    const t = msg?.type
    if (!t || t === 'ping' || t === 'pong') return
    if (t === 'conversation_created') {
      if (awaitingCreate && msg.conversation_id != null) {
        awaitingCreate = false
        conversationId.value = String(msg.conversation_id)
        follow(conn, conversationId.value)
      }
      return
    }
    // The socket also carries frames for the person's other conversations (the user group): only this one's are drawn.
    if (msg.conversation_id != null && String(msg.conversation_id) !== String(conversationId.value ?? '')) return

    if (t === 'workflow_proposal') {
      if (Number(msg.graph_id) !== readGraphId()) return
      const m = current() || lastAssistant()
      if (m) m.proposalId = msg.proposal_id
      try { onProposal?.(msg) } catch { /* the conversation goes on without the proposal */ }
      return
    }

    const m = current()
    if (!m) {
      // A turn's last answer frame may come after the end frame: it is the authoritative text.
      if (t === 'assistant_message_complete' && msg.full_message != null) {
        const last = lastAssistant()
        if (last && last.status === 'done') last.content = stripThinkBlocks(msg.full_message)
      }
      return
    }
    if (t !== 'error') timeline.ingest(msg)

    if (ASKS_IN_CHAT.has(t)) {
      m.needsChat = true
      if (t === 'plan_approval_required' || t === 'full_doc_cost_approval') endTurn('done')
      return
    }

    switch (t) {
      case 'assistant_message_chunk':
        if (msg.replace) { m.content = ''; think.reset() }
        m.content += think.feed(msg.chunk || '')
        break
      case 'assistant_message_complete':
        if (msg.full_message != null) { m.content = stripThinkBlocks(msg.full_message); think.reset() }
        endTurn('done')
        break
      case 'chat_response':
      case 'assistant':
      case 'assistant_message': {
        const c = msg.content || msg.message || msg.full_message
        if (c) m.content = stripThinkBlocks(c)
        endTurn('done')
        break
      }
      case 'tool_call':
        m.toolCalls.push({ name: msg.tool || msg.tool_name || 'tool', status: 'running', error: '' })
        break
      case 'tool_result': {
        const name = msg.tool_name || msg.tool
        const tc = m.toolCalls.find((x) => x.name === name && x.status === 'running') || m.toolCalls[m.toolCalls.length - 1]
        if (tc) {
          tc.status = msg.success === false ? 'error' : 'done'
          if (msg.success === false) tc.error = msg.error || ''
        }
        break
      }
      case 'stop_acknowledged':
        m.status = 'stopped'
        endTurn('stopped')
        break
      case 'turn_progress':
        if (msg.interrupted) failTurn(INTERRUPTED)
        break
      case 'turn_not_running':
        // Asked after a reconnect: nothing runs any more, so the reply (if any) was sent while the socket was down.
        if (msg.interrupted) failTurn(INTERRUPTED)
        else if (droppedDuringTurn) { m.needsChat = true; failTurn(LOST_REPLY) }
        break
      case 'run_finished': {
        const status = msg.status || 'completed'
        if (status === 'error') failTurn(msg.error || 'The agent’s turn ended with an error before it answered.', msg.code || '')
        else if (status === 'stopped') { m.status = 'stopped'; endTurn('stopped') }
        else endTurn('done')
        break
      }
      case 'error': {
        const text = msg.error || msg.message || ''
        // A control message the server does not know (e.g. an older server and `agent_prewarm`) is not the turn failing.
        if (/unknown message type/i.test(text)) break
        failTurn(text || 'The agent stopped with an error and sent no reason.', msg.code || '')
        break
      }
      default:
        if (ENDS_TURN.has(t)) endTurn(t === 'agent_session_error' ? 'error' : t === 'agent_session_stopped' ? 'stopped' : 'done')
        break
    }
  }

  function dispose() {
    try { conn?.close() } catch { /* already closed */ }
    conn = null
  }
  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    messages, busy, stopping, conversationId, agent, agentError, connection, liveSteps, liveStatus,
    ensureAgent, send, stop, newConversation, reconnectNow, dispose,
    // for tests and the bar's own wiring
    _onEvent: onEvent,
  }
}
