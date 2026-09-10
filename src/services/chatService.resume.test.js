/**
 * Opening a conversation must ASK whether a turn is running for it.
 *
 * WHAT THIS IS FOR — a run started by a webhook (also: a signal, a schedule) while the chat was closed.
 * The user opened that chat and saw their own message and nothing else; the answer appeared only after a
 * full page refresh. The whole progress-snapshot pipeline behind `turn_resumed` was working — nothing
 * ever asked for it.
 *
 * Cause: `resume` was sent from `onopen` alone, and the app deliberately keeps ONE stable socket per
 * endpoint across conversation changes (see `_connect`). Switching conversations therefore assigned
 * `conversationId` and sent nothing. A page refresh "fixed" it only because a refresh builds a new
 * socket, which is what fires `onopen`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatConnection } from './chatService'

class FakeSocket {
  static OPEN = 1
  constructor() {
    this.readyState = 1
    this.sent = []
  }
  send(payload) { this.sent.push(JSON.parse(payload)) }
  close() {}
}

describe('ChatConnection.setConversation', () => {
  let conn
  let sock

  beforeEach(() => {
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    conn = new ChatConnection(null, {})
    sock = new FakeSocket()
    conn.ws = sock
    conn.isOpen = true
  })

  const resumes = () => sock.sent.filter((m) => m.type === 'resume')

  it('asks the server to resume when pointed at a new conversation', () => {
    conn.setConversation('1319')
    expect(resumes()).toEqual([{ type: 'resume', conversation_id: '1319' }])
  })

  it('asks again when the user switches to a different conversation', () => {
    conn.setConversation('1319')
    conn.setConversation('1320')
    expect(resumes().map((m) => m.conversation_id)).toEqual(['1319', '1320'])
  })

  it('does not re-ask for the conversation it is already on', () => {
    // `_connect()` is idempotent and runs on several paths; re-asking on each would re-attach the live
    // stream and replay pending HITL cards for no reason.
    conn.setConversation('1319')
    conn.setConversation('1319')
    conn.setConversation(1319)      // same id, different type — still the same conversation
    expect(resumes()).toHaveLength(1)
  })

  it('sends nothing when the socket is not open yet', () => {
    // `onopen` sends the resume itself in that case, so queuing a second one would double it.
    conn.isOpen = false
    conn.setConversation('1319')
    expect(resumes()).toHaveLength(0)
    expect(conn.queue).toHaveLength(0)
  })

  it('sends nothing when cleared to no conversation', () => {
    conn.setConversation('1319')
    conn.setConversation(null)
    expect(resumes()).toHaveLength(1)
  })

  it('still records the conversation id it was given', () => {
    conn.setConversation('1319')
    expect(conn.conversationId).toBe('1319')
  })
})
