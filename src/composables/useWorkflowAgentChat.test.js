// useWorkflowAgentChat (ADM-1333, plan D6): the agent bar's own conversation on the agent socket client. Only its own
// conversation's frames are drawn, and a turn that ends badly says what happened.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => ({ ensureSuperAgent: async () => ({ id: 3 }) }) }))
const { useWorkflowAgentChat } = await import('./useWorkflowAgentChat')
const { ChatConnection, browserTimeZone } = await import('@/services/chatService')

// The real ChatConnection (it builds the frames); only its transport is replaced, so no WebSocket opens.
class TestConnection extends ChatConnection {
  constructor(cid, handlers) { super(cid, handlers); this.sent = [] }
  connect() { this.isOpen = true; this.handlers.onOpen?.() }
  _send(obj) { this.sent.push(obj) }
}

function setup(graphId = 9) {
  let c = null
  const onProposal = vi.fn()
  const chat = useWorkflowAgentChat({
    graphId: () => graphId,
    onProposal,
    connectionFactory: (cid, handlers) => (c = new TestConnection(cid, handlers)),
  })
  return { chat, onProposal, conn: () => c }
}

describe('useWorkflowAgentChat', () => {
  it('refuses to send for a workflow without an integer id, with the reason', async () => {
    const { chat, conn } = setup('new')
    expect(await chat.send('hi')).toBe(false)
    expect(chat.agentError.value).toMatch(/Save it first/)
    expect(conn()).toBe(null)
  })

  it('sends through ChatConnection.sendMessage with an integer graph_id and the time zone', async () => {
    const { chat, conn } = setup(9)
    expect(await chat.send('build it')).toBe(true)
    const [f] = conn().sent
    expect(f).toMatchObject({ type: 'chat_message', message: 'build it', agentId: '3', workflow_context: { graph_id: 9 } })
    expect(Number.isInteger(f.workflow_context.graph_id)).toBe(true)
    expect(f.timezone).toBe(browserTimeZone())
    expect(f.client_message_id).toMatch(/^c-/)
  })

  it('draws only its own conversation: another chat’s frames are dropped', async () => {
    const { chat, conn, onProposal } = setup()
    await chat.send('hi')
    conn().handlers.onEvent({ type: 'conversation_created', conversation_id: 11 })
    expect(chat.conversationId.value).toBe('11')
    expect(conn().conversationId).toBe('11')
    expect(conn().sent.some((x) => x.type === 'resume')).toBe(false)   // set directly: no resume races the turn
    conn().handlers.onEvent({ type: 'assistant_message_chunk', chunk: 'other chat', conversation_id: 12 })
    conn().handlers.onEvent({ type: 'workflow_proposal', graph_id: 9, proposal_id: 'p', operations: [], conversation_id: 12 })
    conn().handlers.onEvent({ type: 'assistant_message_chunk', chunk: 'mine' })
    expect(chat.messages.value[1].content).toBe('mine')
    expect(onProposal).not.toHaveBeenCalled()
    conn().handlers.onEvent({ type: 'workflow_proposal', graph_id: 9, proposal_id: 'p', operations: [], conversation_id: 11 })
    expect(onProposal).toHaveBeenCalledTimes(1)
    expect(chat.messages.value[1].proposalId).toBe('p')
  })

  it('a turn whose reply was lost while the socket was down says so; a run that failed says so', async () => {
    const { chat, conn } = setup()
    await chat.send('hi')
    conn().handlers.onEvent({ type: 'turn_not_running' })   // not after a drop: ignored
    expect(chat.busy.value).toBe(true)
    conn().handlers.onClose()
    conn().handlers.onEvent({ type: 'turn_not_running' })
    expect(chat.busy.value).toBe(false)
    expect(chat.messages.value[1].error).toMatch(/did not reach this bar/)
    expect(chat.messages.value[1].needsChat).toBe(true)

    await chat.send('again')
    conn().handlers.onEvent({ type: 'run_finished', status: 'error' })
    expect(chat.messages.value[3].status).toBe('error')
    expect(chat.messages.value[3].error).toMatch(/ended with an error/)
  })
})
