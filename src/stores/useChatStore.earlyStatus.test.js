// The turn's first status, at once (turn-start work, 2026-11-25). The server sends `agent_status` phase `analyzing`
// ("Analyzing your request") on the sending socket as soon as the message is saved, before the run host picks the turn
// up; the host later sends the same phase. One row, relabelled, never two; another chat's never draws one.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

vi.mock('../services/api', () => ({
  default: {
    getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [] } })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

const EARLY = { type: 'agent_status', phase: 'analyzing', label: 'Analyzing your request', conversation_id: '41' }

function sent(conversationId = '41') {
  const chat = useChatStore()
  chat._conn = { send: vi.fn(), sendIfOpen: vi.fn(), sendHitlResponse: vi.fn() }
  chat.conversationId = conversationId
  chat._beginAssistant()                       // the person's message went out: the turn's bubble is open
  return chat
}
const analyzing = (chat) => chat.liveSteps.filter((r) => r.phase === 'analyzing')

beforeEach(() => setActivePinia(createPinia()))

describe('the early Analyzing status', () => {
  it('is the turn\'s first status row at once', () => {
    const chat = sent()
    chat._onEvent(EARLY)
    expect(chat.liveSteps).toHaveLength(1)
    expect(chat.liveSteps[0]).toMatchObject({ phase: 'analyzing', label: 'Analyzing your request', status: 'running' })
    expect(chat.liveStatus.phase).toBe('analyzing')
    expect(chat._cur().prepStatus || '').toBe('')
  })

  it("the run host's frame with the same phase updates the SAME row, over its socket or the user group", () => {
    const chat = sent()
    chat._onEvent(EARLY)
    const row = chat.liveSteps[0]
    chat._onEvent({ ...EARLY, label: 'Analyzing your request', via_user_group: true })
    chat._onEvent({ ...EARLY, label: 'Reading the project' })
    expect(analyzing(chat)).toHaveLength(1)
    expect(chat.liveSteps[0]).toBe(row)
    expect(row.label).toBe('Reading the project')
    // The run goes on: the next phase is a row of its own, and Analyzing is closed.
    chat._onEvent({ type: 'agent_status', phase: 'thinking', label: 'Thinking', conversation_id: '41' })
    expect(chat.liveSteps.map((r) => r.phase)).toEqual(['analyzing', 'thinking'])
    expect(row.status).not.toBe('running')
  })

  it("another chat's early status draws nothing here", () => {
    const chat = sent('41')
    chat._onEvent({ ...EARLY, conversation_id: '99' })
    expect(chat.liveSteps).toHaveLength(0)
  })

  it('a chat with no conversation yet takes no status that names one', () => {
    const chat = useChatStore()
    chat.conversationId = null
    chat._beginAssistant()
    chat._onEvent(EARLY)
    expect(chat.liveSteps).toHaveLength(0)
  })

  it('a status naming no conversation (the older socket frames) is drawn as before', () => {
    const chat = sent()
    chat._onEvent({ type: 'agent_status', phase: 'thinking', label: 'Thinking' })
    expect(chat.liveSteps).toHaveLength(1)
  })
})
