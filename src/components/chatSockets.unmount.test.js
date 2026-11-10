// @vitest-environment jsdom
// A chat panel left while its first requests were still loading must never open a WebSocket afterwards
// (page-speed plan Phase 5 item 16): the socket would live on, reconnecting, for a panel that is gone.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getLlmModels: vi.fn(),
  getConversation: vi.fn(),
  getAgent: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: new Proxy(api, { get: (t, k) => t[k] || vi.fn(() => Promise.resolve({ data: {} })) }) }))

class FakeSocket {
  static instances = []
  static OPEN = 1
  static CONNECTING = 0
  constructor(url) { this.url = url; this.readyState = 0; FakeSocket.instances.push(this) }
  send() {}
  addEventListener() {}
  removeEventListener() {}
  close() { this.readyState = 3 }
}

import AgentEmulator from './AgentEmulator.vue'

function deferred() { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }

beforeEach(() => {
  setActivePinia(createPinia())
  FakeSocket.instances = []
  globalThis.WebSocket = FakeSocket
  Object.values(api).forEach((f) => f.mockReset())
  api.get.mockResolvedValue({ data: { results: [] } })
  api.getLlmModels.mockResolvedValue({ data: [] })
  localStorage.clear()
})

const shallow = { shallow: true }

describe('AgentEmulator', () => {
  it('opens no socket when unmounted while the saved conversation is loading', async () => {
    localStorage.setItem('emu:conv:12', '77')
    const d = deferred()
    api.getConversation.mockImplementationOnce(() => d.promise)
    const w = mount(AgentEmulator, { props: { agentId: 12 }, ...shallow })
    w.unmount()
    d.resolve({ data: { messages: [] } })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(0)
  })
})
