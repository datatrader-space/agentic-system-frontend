// @vitest-environment jsdom
// Deploy & Integrate panel — the access key can be generated whichever channel is on.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const api = vi.hoisted(() => ({ get: vi.fn(), getAgentShare: vi.fn(), rotateSignalApiKey: vi.fn(), updateAgent: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())

vi.mock('../../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm, useConfirm: () => confirm }))
vi.mock('vue-router', () => ({ RouterLink: { props: ['to'], template: '<a class="rl"><slot/></a>' } }))

import DeploySettings from './DeploySettings.vue'

const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))
const openPanel = async (agent) => {
  api.getAgentShare.mockResolvedValue({ data: { is_public: false } })
  const w = mount(DeploySettings, {
    props: { modelValue: false, agent },
    global: { stubs: { Teleport: true, Transition: false, Icon: true, SignalPanel: true } },
  })
  await w.setProps({ modelValue: true })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('DeploySettings access key', () => {
  it('Live Chat on: generates the first key without asking', async () => {
    api.rotateSignalApiKey.mockResolvedValue({ data: { api_key: 'sk-signal-new' } })
    const agent = reactive({ id: 7, ws_chat_enabled: true, signal_enabled: false, signal_api_key: null })
    const w = await openPanel(agent)
    expect(w.text()).toContain('Not generated yet')

    await button(w, 'Generate').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(api.rotateSignalApiKey).toHaveBeenCalledWith(7)
    expect(agent.signal_api_key).toBe('sk-signal-new')
    expect(w.text()).toContain('sk-signal-new')
  })

  it('Webhook only (Live Chat off): the key row is on the Webhook card', async () => {
    api.rotateSignalApiKey.mockResolvedValue({ data: { api_key: 'sk-signal-hook' } })
    const agent = reactive({ id: 7, ws_chat_enabled: false, signal_enabled: true, signal_api_key: null })
    const w = await openPanel(agent)

    await button(w, 'Generate').trigger('click')
    await flushPromises()
    expect(agent.signal_api_key).toBe('sk-signal-hook')
  })

  it('both channels on: one key row, and rotating an existing key asks first', async () => {
    confirm.mockResolvedValue(false)
    const agent = reactive({ id: 7, ws_chat_enabled: true, signal_enabled: true, signal_api_key: 'sk-signal-live' })
    const w = await openPanel(agent)
    const rotate = w.findAll('button').filter(b => b.text().trim().startsWith('Rotate'))
    expect(rotate).toHaveLength(1)

    await rotate[0].trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(api.rotateSignalApiKey).not.toHaveBeenCalled()
    expect(agent.signal_api_key).toBe('sk-signal-live')
  })
})
