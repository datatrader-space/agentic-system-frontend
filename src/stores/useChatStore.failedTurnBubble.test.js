// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

// Phase 8 run 3, conversation 1281 (finding 36). The build's answer (message 4807) was on screen; the next turn ran
// out of balance. The server sent `error` (wallet_empty), which ended the new bubble as errored, and then the turn's
// `assistant_message_complete` ("I completed this before the run was interrupted… balance $0.09", message 4809). With
// the bubble ended, the frame fell back to "the last assistant bubble WITHOUT an error": the build summary, which then
// showed the failed turn's text and token counts. The database had the two apart.
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn(), getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [] } })) } }))

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('a failed turn writes into its own bubble', () => {
  it('the late answer of a turn that ended on an error never lands on the previous answer', () => {
    const chat = useChatStore()
    chat.conversationId = 1281
    chat._beginAssistant()
    chat._cur().content = 'The clothing store is built and working.'
    chat._cur().usage = { total_tokens: 7346359 }
    chat._endAssistant()
    const build = chat.messages.filter((m) => m.role === 'assistant')[0]

    chat.messages.push({ id: 'u2', role: 'user', content: 'Next: add customer reviews', status: 'done' })
    chat._beginAssistant()
    chat._onEvent({ type: 'error', error: 'Your balance is $0.09. Top up to continue.', code: 'wallet_empty', retryable: false })
    chat._onEvent({ type: 'assistant_message_complete',
                    full_message: 'I completed this before the run was interrupted. Your balance is $0.09.',
                    usage: { total_tokens: 111822 } })

    expect(build.content).toBe('The clothing store is built and working.')
    expect(build.usage).toEqual({ total_tokens: 7346359 })
    const failed = chat.messages.filter((m) => m.role === 'assistant')[1]
    expect(failed.content).toContain('I completed this before the run was interrupted')
    expect(failed.usage).toEqual({ total_tokens: 111822 })
    expect(failed.errorCode).toBe('wallet_empty')
  })
})
