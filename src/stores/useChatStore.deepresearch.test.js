// The depth has to reach the wire, or it is a control that does nothing. Three seams have silently
// dropped a per-turn composer flag before, so each one is pinned: the store's send options, the service's
// payload keys, and the rule that a depth is only sent when the mode is actually on.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

vi.mock('../services/api', () => ({
  default: {
    uploadConversationFile: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    startAgentChat: vi.fn(),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const armed = () => {
  const chat = useChatStore()
  const sendMessage = vi.fn()
  chat.conversationId = 'c1'
  chat.selectedAgentId = 7
  chat.agents = [{ id: 7, name: 'Researcher' }]
  chat._conn = { sendMessage, isOpen: true, setConversation: vi.fn() }
  return { chat, sendMessage }
}

const optsOf = (sendMessage) => sendMessage.mock.calls.at(-1)[3]

describe('useChatStore — Deep Research', () => {
  it('starts off, at the Standard depth', () => {
    const chat = useChatStore()
    expect(chat.researchMode).toBe(false)
    expect(chat.researchDepth).toBe('standard')
  })

  it('sends neither flag while the mode is off', async () => {
    const { chat, sendMessage } = armed()
    await chat.sendMessage('what is the latest python')
    expect(optsOf(sendMessage).researchMode).toBeUndefined()
    expect(optsOf(sendMessage).researchDepth).toBeUndefined()
  })

  it('sends the mode AND the chosen depth once it is on', async () => {
    const { chat, sendMessage } = armed()
    chat.researchMode = true
    chat.researchDepth = 'deep'
    await chat.sendMessage('compare the three frameworks')
    expect(optsOf(sendMessage)).toMatchObject({ researchMode: true, researchDepth: 'deep' })
  })

  it('a depth left over from a previous run is not sent once the mode is off again', async () => {
    const { chat, sendMessage } = armed()
    chat.researchDepth = 'deep'
    chat.researchMode = false
    await chat.sendMessage('just answer me')
    expect(optsOf(sendMessage).researchDepth).toBeUndefined()
  })
})

describe('chatService — the payload keys the backend reads', () => {
  it('research_mode and research_depth are on the chat_message frame', async () => {
    const { ChatConnection } = await import('../services/chatService')
    const svc = new ChatConnection()
    const sent = []
    svc._send = (p) => sent.push(p)
    svc.conversationId = 'c1'
    svc.sendMessage('go', 7, null, { researchMode: true, researchDepth: 'quick' })
    expect(sent[0]).toMatchObject({ research_mode: true, research_depth: 'quick' })
  })

  it('both are omitted rather than sent false/empty, so a plain turn is byte-identical', async () => {
    const { ChatConnection } = await import('../services/chatService')
    const svc = new ChatConnection()
    const sent = []
    svc._send = (p) => sent.push(p)
    svc.conversationId = 'c1'
    svc.sendMessage('go', 7, null, {})
    expect('research_mode' in sent[0] && sent[0].research_mode !== undefined).toBe(false)
    expect(sent[0].research_depth).toBeUndefined()
  })
})
