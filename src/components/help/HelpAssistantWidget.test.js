// @vitest-environment jsdom
// Help Assistant streaming safety (page-speed plan Phase 5 item 16):
//  - an answer that goes silent on an open socket ends (watchdog), so the typing dots and the disabled Send
//    cannot last forever;
//  - a socket is never opened after the widget is gone.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getAssistantConfig: vi.fn(),
  getBuiltinHelpAssistant: vi.fn(),
  chatHelpAssistant: vi.fn(),
  askHelpAssistant: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../composables/useGuidedTour', () => ({ useGuidedTour: () => ({ launch: vi.fn() }) }))

class FakeSocket {
  static instances = []
  static OPEN = 1
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; FakeSocket.instances.push(this) }
  send(d) { this.sent.push(d) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen && this.onopen() }
}

import HelpAssistantWidget from './HelpAssistantWidget.vue'

const transport = { mode: 'websocket', ws_url: '/ws/chat/agent/', engine: 'agent', token: 't', expires_in: 300 }
const stubs = { Icon: true, transition: false }

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  globalThis.WebSocket = FakeSocket
  Object.values(api).forEach((f) => f.mockReset())
  api.getAssistantConfig.mockResolvedValue({ data: { available: true, transport } })
  api.chatHelpAssistant.mockResolvedValue({ data: { answer: 'From HTTP', sources: [], suggested_actions: [] } })
})
afterEach(() => vi.useRealTimers())

async function openAndAsk() {
  const w = mount(HelpAssistantWidget, { props: { open: false }, global: { stubs } })
  await w.setProps({ open: true })
  await flushPromises()
  w.vm.ask('How do I connect GitHub?')
  await flushPromises()
  return w
}

describe('HelpAssistantWidget', () => {
  it('a silent socket cannot keep the typing dots forever: the watchdog ends the turn and HTTP answers', async () => {
    const w = await openAndAsk()
    expect(FakeSocket.instances).toHaveLength(1)
    FakeSocket.instances[0].open()
    await flushPromises()
    expect(w.find('.typing').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(90000)
    await flushPromises()
    expect(w.find('.typing').exists()).toBe(false)
    expect(api.chatHelpAssistant).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('From HTTP')
    w.unmount()
  })

  it('a socket that never opens gives up and falls back to HTTP', async () => {
    const w = await openAndAsk()
    expect(FakeSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()
    expect(w.find('.typing').exists()).toBe(false)
    expect(api.chatHelpAssistant).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('opens no socket when the widget is gone before the token arrives', async () => {
    const w = mount(HelpAssistantWidget, { props: { open: false }, global: { stubs } })
    await w.setProps({ open: true })
    await flushPromises()
    let release
    api.getAssistantConfig.mockImplementationOnce(() => new Promise((r) => { release = r }))
    w.vm.ask('Anything?')
    await flushPromises()
    // detectMode() inside ask() is now waiting; finish it, then unmount while ensureSocket waits for its token.
    release({ data: { available: true, transport } })
    let releaseToken
    api.getAssistantConfig.mockImplementationOnce(() => new Promise((r) => { releaseToken = r }))
    await flushPromises()
    w.unmount()
    releaseToken?.({ data: { available: true, transport } })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(0)
  })
})
