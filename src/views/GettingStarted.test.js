// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), RouterLink: { template: '<a><slot /></a>' } }))
const api = vi.hoisted(() => ({
  getOnboardingStatus: vi.fn(() => Promise.resolve({ data: { done: {} } })),
  getCurrentUser: vi.fn(() => Promise.resolve({ data: { user: { first_name: 'Ada' } } })),
  listAgentTemplates: vi.fn(() => Promise.resolve({ data: { templates: [{ id: 11, name: 'Researcher' }] } })),
  createAgentFromTemplate: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))

import GettingStarted from './GettingStarted.vue'

let wrapper
beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('GettingStarted — Use template', () => {
  it('creates ONE agent when "Use template" is clicked twice quickly', async () => {
    let resolveCreate
    api.createAgentFromTemplate.mockReturnValue(new Promise((r) => { resolveCreate = r }))
    wrapper = mount(GettingStarted, { global: { stubs: { Icon: true, RouterLink: true } } })
    await flushPromises()
    const btn = wrapper.findAll('.template-card button')[0]
    await btn.trigger('click')
    await btn.trigger('click')
    expect(api.createAgentFromTemplate).toHaveBeenCalledTimes(1)
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('Creating')
    resolveCreate({ data: { id: 99 } })
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/dashboard/agents/99/editor')
  })
})
