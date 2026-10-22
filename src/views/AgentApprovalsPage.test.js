// @vitest-environment jsdom
// The per-tool approval card names the agent's tools from the agent record itself (its `tools` are full
// ToolDefinition rows). It used to download every page of /tools/definitions/ to do that
// (page-speed plan Phase 5 item 5).
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ data: {} })),
  getAgent: vi.fn(),
  getAgentEffectivePolicy: vi.fn(() => Promise.resolve({ data: {} })),
}))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '7' }, query: {} }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import AgentApprovalsPage from './AgentApprovalsPage.vue'

describe('AgentApprovalsPage — tool names', () => {
  it('lists the selected tools by name without fetching the tool catalog', async () => {
    api.getAgent.mockResolvedValue({ data: {
      id: 7, agent_policy: {}, agent_run_mode: 'manual',
      tools: [{ id: 3, name: 'SEND_EMAIL', display_name: 'Send email' }, { id: 4, name: 'WEB_SEARCH', display_name: 'Web search' }],
    } })
    const w = mount(AgentApprovalsPage, { global: { stubs: { Icon: true, ContextProfilePicker: true } } })
    await flushPromises()
    const urls = api.get.mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.startsWith('/tools/definitions'))).toBe(false)
    expect(w.text()).toContain('Send email')
    expect(w.text()).toContain('Web search')
  })
})
