// The connector button (CONNECT_SERVICE's typed `chat_action`) lands on the answer it belongs to — live,
// and again from `model_info.chat_actions` after a reload, so it stays in history instead of vanishing the
// way the old modal card did.
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

const act = (extra = {}) => ({ id: 'x1', kind: 'connect', service: 'GitHub', target_kind: 'svc', target_id: 7,
  label: 'Connect GitHub', ...extra })

describe('chat_action', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const lastAssistant = (s) => [...s.messages].reverse().find((m) => m.role === 'assistant')

  it('attaches to the live answer, one per connector + kind', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'chat_action', action: act() })
    s._onEvent({ type: 'chat_action', action: act({ id: 'x2' }) })          // same connector + kind → replaces
    s._onEvent({ type: 'chat_action', action: act({ id: 'x3', kind: 'assign', target_id: 8 }) })
    expect(lastAssistant(s).chatActions.map((a) => a.id)).toEqual(['x2', 'x3'])
  })

  it('still lands when it arrives after the turn released the bubble', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'GitHub is not connected.' })
    s._onEvent({ type: 'chat_action', action: act() })
    expect(lastAssistant(s).chatActions).toHaveLength(1)
  })

  it('ignores a frame with no kind', () => {
    const s = useChatStore()
    s._beginAssistant()
    s._onEvent({ type: 'chat_action', action: {} })
    expect(lastAssistant(s).chatActions).toEqual([])
  })

  it('is restored from model_info on reload', () => {
    const s = useChatStore()
    const m = s._mapServerMessage({ id: 5, role: 'assistant', content: 'x',
      model_info: { chat_actions: [act()] } }, 42)
    expect(m.chatActions).toEqual([act()])
    expect(s._mapServerMessage({ id: 6, role: 'assistant', content: 'y', model_info: {} }, 42).chatActions)
      .toEqual([])
  })
})
