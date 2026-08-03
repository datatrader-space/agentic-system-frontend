import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    setMessageFeedback: vi.fn(() => Promise.resolve({ data: { ok: true } })),
    submitTrainingFeedback: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), show: vi.fn() },
}))

describe('useChatStore — share sheet', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('opens the sheet for the whole thread', () => {
    const chat = useChatStore()
    chat.conversationId = '42'
    chat.openShare()
    expect(chat.shareOpen).toBe(true)
    expect(chat.shareAnchorId).toBeNull()
  })

  it('carries the anchor when opened from one message ("share up to here")', () => {
    const chat = useChatStore()
    chat.conversationId = '42'
    chat.openShare(1234)
    expect(chat.shareOpen).toBe(true)
    expect(chat.shareAnchorId).toBe(1234)
  })

  it('refuses to open on a thread that was never saved', () => {
    const chat = useChatStore()
    chat.conversationId = null
    chat.openShare()
    expect(chat.shareOpen).toBe(false)
  })

  it('clears the anchor on close so the next open is not anchored by accident', () => {
    const chat = useChatStore()
    chat.conversationId = '42'
    chat.openShare(99)
    chat.closeShare()
    expect(chat.shareOpen).toBe(false)
    expect(chat.shareAnchorId).toBeNull()
  })
})

describe('useChatStore — message feedback', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  const seed = (chat, extra = {}) => {
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'answer', serverId: 77, feedback: null, ...extra }]
    return chat.messages[0]
  }

  it('POSTs the thumb against the message DB row', async () => {
    const chat = useChatStore()
    const m = seed(chat)
    await chat.setFeedback('a1', 'up')
    expect(m.feedback).toBe('up')
    expect(api.setMessageFeedback).toHaveBeenCalledWith(77, { value: 'up', reasons: [], comment: '' })
  })

  it('clicking the active thumb again clears it (value null)', async () => {
    const chat = useChatStore()
    const m = seed(chat, { feedback: 'up' })
    await chat.setFeedback('a1', 'up')
    expect(m.feedback).toBeNull()
    expect(api.setMessageFeedback).toHaveBeenCalledWith(77, { value: null, reasons: [], comment: '' })
  })

  it('sends reasons + comment from the thumbs-down sheet, and does NOT toggle off', async () => {
    const chat = useChatStore()
    const m = seed(chat, { feedback: 'down' })
    await chat.setFeedback('a1', 'down', { reasons: ['incorrect'], comment: 'made up a flag' })
    expect(m.feedback).toBe('down')       // detail submit must not clear the thumb
    expect(api.setMessageFeedback).toHaveBeenCalledWith(77, {
      value: 'down', reasons: ['incorrect'], comment: 'made up a flag',
    })
  })

  it('reverts the optimistic thumb when the write fails', async () => {
    api.setMessageFeedback.mockRejectedValueOnce(new Error('boom'))
    const chat = useChatStore()
    const m = seed(chat, { feedback: 'up' })
    await chat.setFeedback('a1', 'down')
    expect(m.feedback).toBe('up')         // a silently-unsaved thumb is worse than none
  })

  it('does not POST when the message has no DB row yet', async () => {
    const chat = useChatStore()
    seed(chat, { serverId: null })
    await chat.setFeedback('a1', 'up')
    expect(api.setMessageFeedback).not.toHaveBeenCalled()
  })

  it('adopts the DB pk from the message_saved event so thumbs become sendable', () => {
    const chat = useChatStore()
    chat._beginAssistant()
    const cur = chat.messages[chat.messages.length - 1]
    expect(cur.serverId).toBeNull()
    chat._onEvent({ type: 'message_saved', message_id: 501, conversation_id: 42 })
    expect(cur.serverId).toBe(501)
  })
})
