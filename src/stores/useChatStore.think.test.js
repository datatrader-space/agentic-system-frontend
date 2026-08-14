import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from './useChatStore'

describe('useChatStore private reasoning suppression', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does not expose think blocks split across streaming frames', () => {
    const store = useChatStore()
    store._beginAssistant()
    for (const chunk of ['<thi', 'nk>private ', 'reasoning</thi', 'nk>Hello!']) {
      store._onEvent({ type: 'assistant_message_chunk', chunk })
    }
    expect(store.messages.at(-1).content).toBe('Hello!')
  })

  it('sanitizes the terminal frame before it replaces the clean stream', () => {
    const store = useChatStore()
    store._beginAssistant()
    store._onEvent({ type: 'assistant_message_chunk', chunk: 'Hello!' })
    store._onEvent({
      type: 'assistant_message_complete',
      full_message: '<think>private reasoning</think>Hello!',
    })
    expect(store.messages.at(-1).content).toBe('Hello!')
    expect(store.messages.at(-1).status).toBe('done')
  })

  it('replaces an earlier model draft when a new iteration starts', () => {
    const store = useChatStore()
    store._beginAssistant()
    store._onEvent({ type: 'assistant_message_chunk', chunk: 'I will check that first.' })
    store._onEvent({
      type: 'assistant_message_chunk',
      chunk: 'Here is the final answer.',
      replace: true,
    })

    expect(store.messages.at(-1).content).toBe('Here is the final answer.')
  })
})
