// @vitest-environment jsdom
// The integration guide — the key can be generated here, and Deploy settings opens from here.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const api = vi.hoisted(() => ({ get: vi.fn(), rotateSignalApiKey: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }))
const routeBox = vi.hoisted(() => ({ route: null }))

vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(), useConfirm: () => vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => routeBox.route, useRouter: () => router, RouterLink: {} }))

import IntegrationGuide from './IntegrationGuide.vue'

const DeploySettings = { name: 'DeploySettings', props: ['modelValue', 'agent'], emits: ['update:modelValue'], template: '<div class="deploy-stub" />' }
const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))
const open = async (agent, tab = 'websocket') => {
  routeBox.route = reactive({ params: { agentId: '3418' }, query: { tab } })
  api.get.mockResolvedValue({ data: agent })
  const w = mount(IntegrationGuide, { global: { stubs: { DeploySettings } } })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('IntegrationGuide', () => {
  for (const tab of ['websocket', 'webhook']) {
    it(`generates the first key on the ${tab} tab and shows it at once`, async () => {
      api.rotateSignalApiKey.mockResolvedValue({ data: { api_key: 'sk-signal-new' } })
      const w = await open({ id: 3418, name: 'A', is_owner: true, signal_api_key: null, signal_enabled: true }, tab)
      expect(w.text()).toContain('<YOUR_API_KEY>')

      await button(w, 'Generate key').trigger('click')
      await flushPromises()

      expect(api.rotateSignalApiKey).toHaveBeenCalledWith(3418)
      expect(w.text()).toContain('sk-signal-new')
      expect(w.text()).not.toContain('<YOUR_API_KEY>')        // the code samples carry it too
      expect(button(w, 'Generate key')).toBeUndefined()       // an existing key is never regenerated from here
    })
  }

  it('a key that exists is shown, with no generate button', async () => {
    const w = await open({ id: 3418, is_owner: true, signal_api_key: 'sk-signal-live' })
    expect(w.text()).toContain('sk-signal-live')
    expect(button(w, 'Generate key')).toBeUndefined()
  })

  it('an agent the user does not own offers neither the key button nor Deploy settings', async () => {
    const w = await open({ id: 3418, name: 'Shared', is_owner: false })
    expect(button(w, 'Generate key')).toBeUndefined()
    expect(button(w, 'Deploy settings')).toBeUndefined()
    expect(w.findComponent(DeploySettings).exists()).toBe(false)
  })

  it('Deploy settings opens from the header, and closing it re-reads the agent', async () => {
    const w = await open({ id: 3418, is_owner: true, is_public: false, public_share_token: 'tok' }, 'widget')
    // The token is still on the agent, but the widget is switched off.
    expect(w.text()).toContain("The public share link isn't enabled yet")

    await button(w, 'Deploy settings').trigger('click')
    const panel = w.findComponent(DeploySettings)
    expect(panel.props('modelValue')).toBe(true)
    expect(panel.props('agent').id).toBe(3418)

    api.get.mockResolvedValue({ data: { id: 3418, is_owner: true, is_public: true, public_share_token: 'tok' } })
    panel.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('AgentChat.init({ token: "tok"')
  })
})
