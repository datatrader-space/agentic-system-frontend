// @vitest-environment jsdom
// A chat panel left while its first requests were still loading must never open a WebSocket afterwards
// (page-speed plan Phase 5 item 16): the socket would live on, reconnecting, for a panel that is gone.
// Also: a failed models call must not stop the planner / repository chat from connecting.
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

import PlannerChat from './PlannerChat.vue'
import RepositoryChat from './RepositoryChat.vue'
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

describe('PlannerChat', () => {
  it('opens no socket when unmounted while history is loading', async () => {
    const d = deferred()
    api.get.mockImplementationOnce(() => d.promise)
    const w = mount(PlannerChat, { props: { systemId: 4 }, ...shallow })
    w.unmount()
    d.resolve({ data: { results: [] } })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(0)
  })

  it('still connects when the models call fails', async () => {
    api.getLlmModels.mockRejectedValue(new Error('500'))
    const w = mount(PlannerChat, { props: { systemId: 4 }, ...shallow })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(1)
    w.unmount()
  })
})

describe('RepositoryChat', () => {
  it('opens no socket when unmounted while history is loading', async () => {
    const d = deferred()
    api.get.mockImplementationOnce(() => d.promise)
    const w = mount(RepositoryChat, { props: { repository: { id: 9, name: 'r' } }, ...shallow })
    w.unmount()
    d.resolve({ data: { results: [] } })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(0)
  })

  it('still connects when the models call fails', async () => {
    api.getLlmModels.mockRejectedValue(new Error('500'))
    const w = mount(RepositoryChat, { props: { repository: { id: 9, name: 'r' } }, ...shallow })
    await flushPromises()
    expect(FakeSocket.instances).toHaveLength(1)
    w.unmount()
  })
})

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
