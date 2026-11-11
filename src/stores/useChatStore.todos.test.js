// The agent's task list (TODO_WRITE, AGENT_ENGINE_CAPABILITIES_PLAN.md section 7) lives in the shared chat store, so the
// main chat and Let's Code's chat show the same list. It comes from the conversation on load (a reload keeps it) and
// is replaced whole by each `todo_update` frame of the open conversation; another conversation's frame never lands
// here. A user message also carries the checkpoint Let's Code restores to (metadata.restore_checkpoint_id).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getConversation = vi.fn()
const getConversationMessages = vi.fn()
vi.mock('../services/api', () => ({
  default: {
    getConversation: (...a) => getConversation(...a),
    getConversationMessages: (...a) => getConversationMessages(...a),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getAgent: vi.fn(() => Promise.resolve({ data: {} })),
    getAgentCard: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))
vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    constructor(cid) { this.conversationId = cid }
    connect() {}
    setConversation(c) { this.conversationId = c }
    prewarm() {}
    sendIfOpen() {}
    reconnectNow() {}
    close() {}
  },
  browserTimeZone: () => 'UTC',
}))

import { useChatStore, normalizeTodos } from './useChatStore'

const TODOS = [
  { content: 'Read the router', status: 'completed' },
  { content: 'Add the route', status: 'in_progress', active_form: 'Adding the route' },
  { content: 'Run the tests', status: 'pending' },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('the task list in the shared chat store', () => {
  it('starts empty', () => {
    expect(useChatStore().todos).toEqual([])
  })

  it('takes each todo_update of the open conversation, replacing the list whole', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'todo_update', conversation_id: 41, todos: TODOS })
    expect(s.todos).toEqual([
      { content: 'Read the router', status: 'completed', activeForm: '' },
      { content: 'Add the route', status: 'in_progress', activeForm: 'Adding the route' },
      { content: 'Run the tests', status: 'pending', activeForm: '' },
    ])
    s._onEvent({ type: 'todo_update', conversation_id: '41', todos: [{ content: 'Only this', status: 'completed' }] })
    expect(s.todos).toEqual([{ content: 'Only this', status: 'completed', activeForm: '' }])
  })

  it('never puts another conversation\'s list on the one on screen', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'todo_update', conversation_id: 41, todos: TODOS })
    s._onEvent({ type: 'todo_update', conversation_id: 99, todos: [{ content: 'elsewhere', status: 'pending' }] })
    expect(s.todos.map((t) => t.content)).toEqual(['Read the router', 'Add the route', 'Run the tests'])
  })

  it('an empty update clears the list (the panel hides)', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'todo_update', conversation_id: 41, todos: TODOS })
    s._onEvent({ type: 'todo_update', conversation_id: 41, todos: [] })
    expect(s.todos).toEqual([])
  })

  it('keeps the list over a reload: the conversation brings its todos', async () => {
    getConversation.mockResolvedValue({ data: { id: 41, todos: TODOS, messages: [] } })
    const s = useChatStore()
    await s.openConversation('41')
    expect(s.todos).toHaveLength(3)
    expect(s.todos[1]).toEqual({ content: 'Add the route', status: 'in_progress', activeForm: 'Adding the route' })
  })

  it('switching to a chat with no list, or starting a new chat, clears it', async () => {
    getConversation.mockResolvedValueOnce({ data: { id: 41, todos: TODOS, messages: [] } })
    getConversation.mockResolvedValueOnce({ data: { id: 42, messages: [] } })
    const s = useChatStore()
    await s.openConversation('41')
    expect(s.todos).toHaveLength(3)
    await s.openConversation('42')
    expect(s.todos).toEqual([])
    s.todos = normalizeTodos(TODOS)
    s.reset()
    expect(s.todos).toEqual([])
  })

  it('drops items without words and reads an unknown status as not started', () => {
    expect(normalizeTodos([{ content: '  ', status: 'pending' }, { content: 'x', status: 'weird' }, null, 'text']))
      .toEqual([{ content: 'x', status: 'pending', activeForm: '' }])
    expect(normalizeTodos(undefined)).toEqual([])
  })
})

describe('the restore point on a user message', () => {
  it('is read from the message metadata on load, and kept over a history refresh', async () => {
    const rows = [
      { id: 10, role: 'user', content: 'add a route', metadata: { restore_checkpoint_id: 'cp-7' } },
      { id: 11, role: 'assistant', content: 'Added.' },
      { id: 12, role: 'user', content: 'thanks' },
    ]
    getConversation.mockResolvedValue({ data: { id: 41, messages: rows } })
    const s = useChatStore()
    await s.openConversation('41')
    expect(s.messages.map((m) => m.restoreCheckpointId)).toEqual(['cp-7', null, null])

    getConversationMessages.mockResolvedValue({ data: { results: [...rows, { id: 13, role: 'assistant', content: 'You are welcome.' }], has_more: false } })
    await s._refreshHistory()
    expect(s.messages.map((m) => m.restoreCheckpointId)).toEqual(['cp-7', null, null, null])
  })
})

describe('the restore point of a turn that just ended (live test 2026-11-11)', () => {
  beforeEach(() => { setActivePinia(createPinia()); getConversationMessages.mockReset() })

  it('lands on the message sent in this session, which has no server id yet', async () => {
    const chat = useChatStore()
    chat.conversationId = 3231
    chat.messages = [
      { id: 'a', role: 'user', content: 'List the files.', serverId: 15494 },
      { id: 'b', role: 'assistant', content: 'Here they are.', serverId: 15495 },
      { id: 'c', role: 'user', content: 'Add one line to README.md', serverId: null },
      { id: 'd', role: 'assistant', content: 'Added it.', serverId: 15497 },
    ]
    getConversationMessages.mockResolvedValue({ data: [
      { id: 15494, role: 'user', content: 'List the files.', metadata: {} },
      { id: 15496, role: 'user', content: 'Add one line to README.md', metadata: { restore_checkpoint_id: 1 } },
    ] })
    await chat.refreshRestorePoints()
    expect(chat.messages[2].serverId).toBe(15496)
    expect(chat.messages[2].restoreCheckpointId).toBe(1)
    expect(chat.messages[0].restoreCheckpointId).toBeUndefined()
  })

  it('never gives two identical messages one row, and ignores another conversation', async () => {
    const chat = useChatStore()
    chat.conversationId = 7
    chat.messages = [
      { id: 'x', role: 'user', content: 'Fix it', serverId: 10 },
      { id: 'y', role: 'user', content: 'Fix it', serverId: null },
    ]
    getConversationMessages.mockImplementation(async () => {
      return { data: [
        { id: 10, role: 'user', content: 'Fix it', metadata: { restore_checkpoint_id: 4 } },
        { id: 12, role: 'user', content: 'Fix it', metadata: { restore_checkpoint_id: 5 } },
      ] }
    })
    await chat.refreshRestorePoints()
    expect(chat.messages.map((m) => [m.serverId, m.restoreCheckpointId])).toEqual([[10, 4], [12, 5]])
    chat.conversationId = 8
    getConversationMessages.mockImplementation(async () => { chat.conversationId = 9; return { data: [] } })
    chat.messages = [{ id: 'z', role: 'user', content: 'Fix it', serverId: null }]
    await chat.refreshRestorePoints()
    expect(chat.messages[0].serverId).toBeNull()
  })
})
