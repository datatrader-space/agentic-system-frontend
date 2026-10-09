// A turn that is still running is not one to recover.
//
// MEASURED, production conversation 2659 (2026-10-08). The chat socket opened with the first message
// already on its way, so the store began "recovering": reading history every 2.5 seconds for an answer
// that might have been saved while nobody was listening. The turn was not lost at all. It was waiting
// 3.5 minutes for the sandbox server to start and sent a status line every 15 seconds. After 36 reads
// (105 seconds) recovery gave up and marked the turn finished: the composer came back, the status line
// went away, and the browser preview never appeared, with the work still running on the server.
//
// Recovery now looks for proof that the turn is alive (a frame of the turn itself, or the server
// answering "it is running") and goes back to listening when it finds it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getConversation = vi.fn()
vi.mock('../services/api', () => ({
  default: { getConversation: (...a) => getConversation(...a), get: vi.fn(), post: vi.fn() },
}))

import { useChatStore } from './useChatStore'

const USER_ROW = { id: 1, role: 'user', content: 'open the page' }
const ANSWER_ROW = { id: 2, role: 'assistant', content: 'The page title is Tide.' }

function socket() {
  const sent = []
  return { sent, sendIfOpen: (frame) => sent.push(frame), send: (frame) => sent.push(frame) }
}

describe('recovery does not settle a turn that is still running', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    getConversation.mockReset()
    getConversation.mockResolvedValue({ data: { messages: [USER_ROW] } })   // no answer saved yet
  })
  afterEach(() => vi.useRealTimers())

  function running() {
    const s = useChatStore()
    s.conversationId = 2659
    s._conn = socket()
    s._beginAssistant()
    return s
  }

  it('goes back to listening when a frame of the turn arrives', async () => {
    const s = running()
    const done = s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(1000)
    s._onEvent({ type: 'agent_status', phase: 'starting_sandbox', label: 'Starting the sandbox' })
    await vi.advanceTimersByTimeAsync(5000)
    await done
    expect(s.isStreaming).toBe(true)
    const reads = getConversation.mock.calls.length
    await vi.advanceTimersByTimeAsync(110000)          // long past the old 90-second give-up
    expect(s.isStreaming).toBe(true)
    expect(getConversation.mock.calls.length).toBe(reads)   // and it has stopped reading history
  })

  it('a ten-minute wait with a status line every 15 seconds stays busy to the end', async () => {
    const s = running()
    s._recoverAfterReconnect()
    for (let second = 15; second <= 600; second += 15) {
      await vi.advanceTimersByTimeAsync(15000)
      s._onEvent({ type: 'agent_status', phase: 'starting_sandbox', label: `Starting the sandbox (${second}s)` })
      expect(s.isStreaming).toBe(true)
    }
    s._onEvent({ type: 'assistant_message_complete', full_message: 'The page title is Tide.' })
    expect(s.isStreaming).toBe(false)
    expect(s.messages[s.messages.length - 1].content).toBe('The page title is Tide.')
  })

  it('asks the server, and its "still running" answer is enough on a silent socket', async () => {
    const s = running()
    const done = s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(6000)
    const asked = s._conn.sent.filter((f) => f.type === 'turn_progress')
    expect(asked.length).toBeGreaterThan(0)
    expect(asked[0].conversation_id).toBe(2659)
    s._onEvent({ type: 'turn_progress', conversation_id: '2659', progress: { step: 2, tool: 'BROWSER_NAVIGATE' } })
    await vi.advanceTimersByTimeAsync(3000)
    await done
    expect(s.isStreaming).toBe(true)
    await vi.advanceTimersByTimeAsync(110000)
    expect(s.isStreaming).toBe(true)
  })

  it('does not ask before the turn has had time to register', async () => {
    const s = running()
    s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(1000)
    expect(s._conn.sent.filter((f) => f.type === 'turn_progress')).toEqual([])
  })

  it('a keepalive ping is not proof of a running turn', async () => {
    const s = running()
    const done = s._recoverAfterReconnect()
    for (let i = 0; i < 40; i++) {
      await vi.advanceTimersByTimeAsync(2500)
      s._onEvent({ type: 'ping' })
    }
    await done
    expect(s.isStreaming).toBe(false)                  // nothing saved, nothing running: settled, as before
  })

  it('still settles on the saved answer when the turn did finish while away', async () => {
    const s = running()
    getConversation.mockResolvedValue({ data: { messages: [USER_ROW, ANSWER_ROW] } })
    await s._recoverAfterReconnect()
    expect(s.isStreaming).toBe(false)
    expect(s.messages[s.messages.length - 1].content).toBe('The page title is Tide.')
  })

  it('still gives up when the server says nothing is running and no answer was saved', async () => {
    const s = running()
    const done = s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(6000)
    s._onEvent({ type: 'turn_progress', conversation_id: '2659', progress: {}, interrupted: false })
    await vi.advanceTimersByTimeAsync(100000)
    await done
    expect(s.isStreaming).toBe(false)
  })

  it('runs one recovery at a time however many things ask for it', async () => {
    const s = running()
    s._recoverAfterReconnect()
    s._recoverAfterReconnect()
    s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(2600)
    expect(getConversation.mock.calls.length).toBe(2)   // one loop: a read at 0s and one at 2.5s
  })

  it('a frame from a turn that already ended does not count', async () => {
    const s = useChatStore()
    s.conversationId = 2659
    s._conn = socket()
    s._onEvent({ type: 'agent_status', phase: 'thinking', label: 'late frame' })
    expect(s._turnAliveAt).toBe(0)
  })

  it('a resumed turn keeps being asked where it is after recovery steps aside', async () => {
    const s = running()
    s._startProgressPolling()
    const done = s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(3000)
    s._onEvent({ type: 'turn_progress', conversation_id: '2659', progress: { step: 1 } })
    await vi.advanceTimersByTimeAsync(3000)
    await done
    expect(s._progressTimer).not.toBe(null)
    s._stopProgressPolling()
    s._stopDeafWatchdog()
  })
})
