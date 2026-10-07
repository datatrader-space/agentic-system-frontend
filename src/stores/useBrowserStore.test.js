// The browser card's store: which browser a conversation is using, and who drives it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

import api from '../services/api'
import { notify } from '../composables/useNotify'
import { useBrowserStore, POLL_MS } from './useBrowserStore'

const card = (over = {}) => ({
  session_id: 'bs_1', state: 'ACTIVE', site: 'shop.example', address: 'https://shop.example/cart',
  watchable: true, action_count: 3, control: { holder: 'agent', epoch: 1, mine: false }, ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

describe('which browser a conversation is using', () => {
  it('is asked for when the conversation opens', async () => {
    api.get.mockResolvedValue({ data: { session: card() } })
    const browser = useBrowserStore()
    browser.bind(42)
    await vi.waitFor(() => expect(browser.hasSession).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/browser/sessions/current/', { params: { conversation_id: 42 }, noCache: true })
    expect(browser.label).toBe('Working')
  })

  it('is empty for a conversation that never browsed, and no card is shown', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    browser.bind(42)
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(browser.hasSession).toBe(false)
    expect(browser.thumbUrl).toBe('')
  })

  it('does not carry one chat\'s browser into the next', async () => {
    api.get.mockResolvedValueOnce({ data: { session: card() } })
    const browser = useBrowserStore()
    browser.bind(42)
    await vi.waitFor(() => expect(browser.hasSession).toBe(true))
    browser.show()
    api.get.mockResolvedValueOnce({ data: { session: null } })
    browser.bind(43)
    expect(browser.session).toBeNull()
    expect(browser.open).toBe(false)
  })

  it('ignores an answer that arrives after the chat has changed', async () => {
    let answer
    api.get.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve }))
    const browser = useBrowserStore()
    browser.bind(42)
    browser.conversationId = 43                      // the user moved on while the request was out
    answer({ data: { session: card() } })
    await Promise.resolve(); await Promise.resolve()
    expect(browser.hasSession).toBe(false)
  })
})

describe('polling', () => {
  it('happens only while a turn is running', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    browser.bind(42)
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(api.get).toHaveBeenCalledTimes(1)        // an idle chat asks nothing

    browser.follow(true)
    await vi.advanceTimersByTimeAsync(POLL_MS * 2 + 50)
    const whileRunning = api.get.mock.calls.length
    expect(whileRunning).toBeGreaterThanOrEqual(3)

    browser.follow(false)                            // one last look, then quiet
    await vi.advanceTimersByTimeAsync(50)
    const afterEnd = api.get.mock.calls.length
    expect(afterEnd).toBe(whileRunning + 1)
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(api.get).toHaveBeenCalledTimes(afterEnd)
  })

  // Seen live on 2026-10-07, conversation 2636: a NEW chat starts its turn before it has an id. The
  // "a turn is running" signal came first and had no conversation to ask about; the id arrived, was asked
  // about once (no browser yet), and nothing ever asked again. The agent browsed three pages and the card
  // appeared only after a reload.
  it('starts when a new chat gets its id after its turn has already begun', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    browser.follow(true)                             // the turn began; the chat has no id yet
    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(api.get).not.toHaveBeenCalled()

    browser.bind(2636)                               // the id arrives
    await vi.advanceTimersByTimeAsync(50)
    expect(api.get).toHaveBeenCalledTimes(1)
    api.get.mockResolvedValue({ data: { session: card() } })   // the agent opens its browser
    await vi.advanceTimersByTimeAsync(POLL_MS + 50)
    expect(browser.hasSession).toBe(true)
  })

  it('keeps asking when the user switches to another chat while a turn runs, and stops when it ends', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    browser.bind(42)
    browser.follow(true)
    browser.bind(43)
    await vi.advanceTimersByTimeAsync(POLL_MS + 50)
    const asked = api.get.mock.calls.filter(([, o]) => o.params.conversation_id === 43).length
    expect(asked).toBeGreaterThanOrEqual(2)

    browser.follow(false)
    await vi.advanceTimersByTimeAsync(50)
    const settled = api.get.mock.calls.length
    browser.bind(44)                                 // an idle chat is asked about once, never polled
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(api.get).toHaveBeenCalledTimes(settled + 1)
  })

  // Seen live on 2026-10-07, conversation 2638. The shell re-creates the chat view when /chat/new becomes
  // /chat/<id>, and sets the new view up before it cleans the old one up.
  it('is not stopped by the cleanup of a chat view that has been replaced', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    const oldView = browser.attach()
    browser.follow(true)                             // the turn begins in the new chat
    browser.bind(2638)                               // its id arrives; the address changes
    const newView = browser.attach()                 // the new view is set up first…
    expect(newView).not.toBe(oldView)
    browser.bind(2638)
    browser.follow(true)
    browser.show()
    browser.detach(oldView)                          // …and only then is the old one cleaned up
    await vi.advanceTimersByTimeAsync(50)
    const before = api.get.mock.calls.length
    api.get.mockResolvedValue({ data: { session: card() } })
    await vi.advanceTimersByTimeAsync(POLL_MS * 2 + 50)
    expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(before + 2)
    expect(browser.hasSession).toBe(true)
  })

  it('is stopped and closed when the view that owns it goes away', async () => {
    api.get.mockResolvedValue({ data: { session: card() } })
    const browser = useBrowserStore()
    const view = browser.attach()
    browser.bind(42)
    browser.follow(true)
    await vi.waitFor(() => expect(browser.hasSession).toBe(true))
    browser.show()
    browser.detach(view)                             // the user left the chat for another page
    expect(browser.open).toBe(false)
    const settled = api.get.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(api.get).toHaveBeenCalledTimes(settled)
  })

  it('asks for a new thumbnail only when the browser has moved', () => {
    const browser = useBrowserStore()
    browser.applySession(card())
    const first = browser.thumbTick
    browser.applySession(card())
    expect(browser.thumbTick).toBe(first)
    browser.applySession(card({ action_count: 4 }))
    expect(browser.thumbTick).toBe(first + 1)
    browser.applySession(card({ action_count: 4, address: 'https://shop.example/checkout' }))
    expect(browser.thumbTick).toBe(first + 2)
  })

  it('builds a same-origin thumbnail address with nothing secret in it', () => {
    const browser = useBrowserStore()
    browser.applySession(card({ session_id: 'bs a/b' }))
    expect(browser.thumbUrl).toBe(`/api/browser/sessions/bs%20a%2Fb/frame/?t=${browser.thumbTick}`)
  })
})

describe('taking and handing back control', () => {
  it('asks the backend and applies the card it answers with', async () => {
    api.post.mockResolvedValue({ data: {} })
    api.get.mockResolvedValue({ data: { session: card({ control: { holder: 'human', epoch: 2, mine: true } }) } })
    const browser = useBrowserStore()
    browser.applySession(card())
    expect(await browser.takeControl()).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/browser/sessions/bs_1/take-control/', {})
    expect(browser.mine).toBe(true)
    expect(browser.label).toBe('You are in control')

    api.get.mockResolvedValue({ data: { session: card({ control: { holder: 'agent', epoch: 3, mine: false } }) } })
    expect(await browser.releaseControl()).toBe(true)
    expect(api.post).toHaveBeenLastCalledWith('/browser/sessions/bs_1/release-control/', {})
    expect(browser.mine).toBe(false)
  })

  it('says so when somebody else already has the browser', async () => {
    api.post.mockRejectedValue({ response: { status: 409 } })
    const browser = useBrowserStore()
    browser.applySession(card())
    expect(await browser.takeControl()).toBe(false)
    expect(notify.error).toHaveBeenCalledWith('Somebody already has control of this browser.')
    expect(browser.busy).toBe(false)
  })

  it('does nothing without a session', async () => {
    const browser = useBrowserStore()
    expect(await browser.takeControl()).toBe(false)
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('the pane', () => {
  it('opens only when there is a browser to show', () => {
    const browser = useBrowserStore()
    browser.show()
    expect(browser.open).toBe(false)
    browser.applySession(card())
    browser.show()
    expect(browser.open).toBe(true)
    browser.toggle()
    expect(browser.open).toBe(false)
  })

  it('closes when the session is gone', () => {
    const browser = useBrowserStore()
    browser.applySession(card())
    browser.show()
    browser.applySession(null)
    expect(browser.open).toBe(false)
  })
})
