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

  it('shows Thinking… at once, then the turn\'s status, and drops it on an error', async () => {
    // The chat showed nothing for seconds while the project's sandbox woke (owner, 2026-11-06).
    const Chat = (await import('./UnifiedAgentChat.vue')).default
    const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
    await flushPromises()
    const ws = FakeSocket.instances[0]
    ws.open()
    w.vm.send('fix the header')
    await flushPromises()
    expect(w.text()).toContain('Thinking…')
    ws.onmessage({ data: JSON.stringify({ type: 'agent_status', phase: 'using_tools', label: "Opening the project's sandbox…" }) })
    await flushPromises()
    expect(w.text()).toContain("Opening the project's sandbox…")
    ws.onmessage({ data: JSON.stringify({ type: 'error', error: 'boom' }) })
    await flushPromises()
    expect(w.text()).not.toContain("Opening the project's sandbox…")
    expect(w.text()).not.toContain('Thinking…')
    w.unmount()
  })

  it('names a tool by its label, never by its name', async () => {
    const Chat = (await import('./UnifiedAgentChat.vue')).default
    const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
    await flushPromises()
    const ws = FakeSocket.instances[0]
    ws.open()
    w.vm.send('run it')
    ws.onmessage({ data: JSON.stringify({ type: 'tool_result', tool: 'CODE_RUN_COMMAND', label: 'Running a command', success: true }) })
    ws.onmessage({ data: JSON.stringify({ type: 'tool_result', tool: 'TOOLSEARCH', success: true }) })
    await flushPromises()
    expect(w.text()).toContain('Running a command')
    expect(w.text()).toContain('Used a tool')
    expect(w.text()).not.toContain('CODE_RUN_COMMAND')
    expect(w.text()).not.toContain('TOOLSEARCH')
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
