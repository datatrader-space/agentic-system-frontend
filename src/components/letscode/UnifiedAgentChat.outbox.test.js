// @vitest-environment jsdom
// A message sent before the Let's Code chat's socket is open is held and sent when it opens. It used to be
// dropped without a word: the chat showed it with Stop running, and the server never received it
// (prod 2026-11-06, repo 14, sent about a second after the project opened).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: { getLlmModels: vi.fn(() => Promise.resolve({ data: [] })),
             unifiedConfig: vi.fn(() => Promise.resolve({ data: {} })) },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useMemoryToast', () => ({ showMemorySavedToast: vi.fn() }))
vi.mock('@/composables/useVoiceInput', () => ({
  // Every field the template reads is a `{ value: false }` ref; nothing here presses the microphone.
  useVoiceInput: () => new Proxy({}, { get: () => ({ value: false }) }),
}))

class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static instances = []
  constructor(url) { this.url = url; this.readyState = FakeSocket.CONNECTING; this.sent = []; FakeSocket.instances.push(this) }
  send(data) { this.sent.push(JSON.parse(data)) }
  close() { this.readyState = 3 }
  open() { this.readyState = FakeSocket.OPEN; this.onopen && this.onopen() }
}

const stubs = { Icon: true, HITLModal: true, PermissionCard: true, ProposedChangesCard: true,
                AgentModePicker: true, TokenUsage: true }

beforeEach(() => { FakeSocket.instances = []; globalThis.WebSocket = FakeSocket })

describe('UnifiedAgentChat outbox', () => {
  it('holds a message sent before the socket opens and sends it on open', async () => {
    const Chat = (await import('./UnifiedAgentChat.vue')).default
    const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
    await flushPromises()
    const ws = FakeSocket.instances[0]
    w.vm.send('run the tests')
    expect(ws.sent.filter((m) => m.type === 'chat_message')).toEqual([])
    ws.open()
    const chats = ws.sent.filter((m) => m.type === 'chat_message')
    expect(chats).toHaveLength(1)
    expect(chats[0].message).toBe('run the tests')
    w.unmount()
  })

  it('sends at once on an open socket, and only once', async () => {
    const Chat = (await import('./UnifiedAgentChat.vue')).default
    const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
    await flushPromises()
    const ws = FakeSocket.instances[0]
    ws.open()
    w.vm.send('hello')
    ws.open()                                   // a second open event must not resend it
    expect(ws.sent.filter((m) => m.type === 'chat_message')).toHaveLength(1)
    w.unmount()
  })
})
