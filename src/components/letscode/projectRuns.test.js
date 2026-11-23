// @vitest-environment jsdom
// The phone view's chats of one project and what each is doing (ADM-1330).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { projectOfChatUrl, loadRunningRows, chatState, projectChats, notifyChatNeedsYou } from './projectRuns'

describe('projectOfChatUrl', () => {
  it('reads the project of a Let\'s Code chat, and nothing else', () => {
    expect(projectOfChatUrl('/dashboard/lets-code?project=14')).toBe('14')
    expect(projectOfChatUrl('/dashboard/lets-code?project=14&chat=7')).toBe('14')
    expect(projectOfChatUrl('/dashboard/chat/7')).toBe('')
    expect(projectOfChatUrl('/elsewhere?project=14')).toBe('')
    expect(projectOfChatUrl('')).toBe('')
  })
})

describe('loadRunningRows', () => {
  it('reads every page of both running states and keeps this project\'s rows', async () => {
    const pages = {
      'needs_input:': { sessions: [{ conversation_id: 1, state: 'needs_input', chat_url: '/dashboard/lets-code?project=14' }], next_cursor: 'c2' },
      'needs_input:c2': { sessions: [{ conversation_id: 2, state: 'needs_input', chat_url: '/dashboard/chat/2' }], next_cursor: null },
      'working:': { sessions: [{ conversation_id: 3, state: 'working', chat_url: '/dashboard/lets-code?project=99' },
        { conversation_id: 4, state: 'working', chat_url: '/dashboard/lets-code?project=14' }], next_cursor: null },
    }
    const api = { getSessions: vi.fn(({ state, cursor = '' }) => Promise.resolve({ data: pages[`${state}:${cursor}`] })) }
    const rows = await loadRunningRows(api, 14, new Set(['2']))
    expect(Object.keys(rows).sort()).toEqual(['1', '2', '4'])          // 2 is the project's by its history
    expect(api.getSessions).toHaveBeenCalledTimes(3)
  })

  it('stops on a cursor it has already read', async () => {
    const api = { getSessions: vi.fn(() => Promise.resolve({ data: { sessions: [], next_cursor: 'same' } })) }
    await loadRunningRows(api, 14)
    expect(api.getSessions).toHaveBeenCalledTimes(4)                    // two pages per state, then it stops
  })
})

describe('chatState', () => {
  const running = { 5: { state: 'working' }, 6: { state: 'needs_input' } }
  it('the chat on screen says what it is doing itself', () => {
    expect(chatState(5, { chat: { conversationId: 5, hitlRequests: [{}], isBusy: true }, running })).toBe('needs_input')
    expect(chatState(7, { chat: { conversationId: 7, hitlRequests: [], isBusy: true }, running })).toBe('working')
  })
  it('another chat is the server\'s row, then what this page left running said, else idle', () => {
    const chat = { conversationId: 1, hitlRequests: [], isBusy: false, parkedRuns: { 6: 'working', 8: 'done' } }
    expect(chatState(6, { chat, running })).toBe('needs_input')
    expect(chatState(8, { chat, running })).toBe('done')
    expect(chatState(9, { chat, running })).toBe('idle')
  })
})

describe('projectChats', () => {
  it('puts the chats that need the person first, then the working ones, then the rest in order', () => {
    const list = projectChats({
      conversations: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }],
      running: { 3: { state: 'needs_input', summary: 'Approve npm test' }, 2: { state: 'working', summary: 'x' },
        44: { state: 'working', title: 'From a newer page', summary: 'y' } },
      chat: { conversationId: null, hitlRequests: [], isBusy: false, parkedRuns: {} },
    })
    expect(list.map((c) => [c.id, c.state])).toEqual([['3', 'needs_input'], ['2', 'working'], ['44', 'working'], ['1', 'idle']])
    expect(list[0].summary).toBe('Approve npm test')
    expect(list[2].title).toBe('From a newer page')
    expect(list[3].summary).toBe('')
  })
})

describe('notifyChatNeedsYou', () => {
  let made
  beforeEach(() => {
    made = []
    globalThis.Notification = class { constructor(title, opts) { made.push({ title, ...opts }) } }
    globalThis.Notification.permission = 'granted'
  })
  afterEach(() => { delete globalThis.Notification; vi.restoreAllMocks() })

  it('notifies a chat that waits for the person while the page is in the background', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    notifyChatNeedsYou({ title: 'The Coding Agent needs you', body: 'Approve  npm test', conversationId: '77', repoId: 14 })
    expect(made).toEqual([expect.objectContaining({ title: 'The Coding Agent needs you', body: 'Approve npm test', tag: 'needs-77' })])
  })

  it('stays quiet while the page is in front of the person, without permission, or without a chat or project', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    notifyChatNeedsYou({ title: 'x', conversationId: '77', repoId: 14 })
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    notifyChatNeedsYou({ title: 'x', conversationId: '', repoId: 14 })
    notifyChatNeedsYou({ title: 'x', conversationId: '77', repoId: null })
    globalThis.Notification.permission = 'denied'
    notifyChatNeedsYou({ title: 'x', conversationId: '77', repoId: 14 })
    expect(made).toEqual([])
  })
})
