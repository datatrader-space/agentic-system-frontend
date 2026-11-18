// @vitest-environment jsdom
// The agent editor's test chat shows "Saved to memory" like New Chat and Let's Code (backend ADM-1264 M3): a
// `memory_saved` frame puts the saved memory under the answer; an answer with no save has no row.
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
import MemoryChips from './chat/MemoryChips.vue'

const SAVED = { ref: 'm:351', kind: 'fact', id: 351, scope: 'user', via: 'saved',
  text: 'The clothing store ships only within Pakistan.' }

beforeEach(() => {
  setActivePinia(createPinia())
  FakeSocket.instances = []
  globalThis.WebSocket = FakeSocket
  Object.values(api).forEach((f) => f.mockReset())
  api.get.mockResolvedValue({ data: { results: [] } })
  api.getLlmModels.mockResolvedValue({ data: [] })
  api.getAgent.mockResolvedValue({ data: { id: 12, name: 'Agent' } })
  localStorage.clear()
})

async function emulatorWithAnswer() {
  const w = mount(AgentEmulator, { props: { agentId: 12 }, shallow: true })
  await flushPromises()
  const sock = FakeSocket.instances[FakeSocket.instances.length - 1]
  expect(sock).toBeTruthy()
  const send = (frame) => sock.onmessage({ data: JSON.stringify(frame) })
  send({ type: 'assistant_message', content: 'I have noted your preference.' })
  await flushPromises()
  return { w, send }
}

const savedRows = (w) => w.findAllComponents(MemoryChips).filter((c) => c.props('field') === 'memoriesSaved')

describe('AgentEmulator — Saved to memory', () => {
  it('shows a real save under the answer', async () => {
    const { w, send } = await emulatorWithAnswer()
    send({ type: 'memory_saved', conversation_id: '77', memories: [SAVED] })
    send({ type: 'memory_saved', conversation_id: '77', memories: [SAVED] })
    await flushPromises()
    const rows = savedRows(w)
    expect(rows).toHaveLength(1)
    expect(rows[0].props('label')).toBe('Saved to memory')
    expect(rows[0].props('message').memoriesSaved).toEqual([SAVED])
  })

  it('keeps the row of a saved answer after a reload', async () => {
    localStorage.setItem('emu:conv:12', '77')
    api.getConversation.mockResolvedValue({ data: { messages: [
      { role: 'user', content: 'remember: we only ship within Pakistan' },
      { role: 'assistant', content: 'Saved.', model_info: { memories_saved: [SAVED] } },
      { role: 'assistant', content: 'Hello.', model_info: {} },
    ] } })
    const w = mount(AgentEmulator, { props: { agentId: 12 }, shallow: true })
    await flushPromises()
    const rows = savedRows(w)
    expect(rows).toHaveLength(1)
    expect(rows[0].props('message').content).toBe('Saved.')
  })

  it('shows no row when nothing was saved, whatever the answer says', async () => {
    const { w } = await emulatorWithAnswer()
    expect(w.text()).toContain('I have noted your preference.')
    expect(savedRows(w)).toHaveLength(0)
  })
})
