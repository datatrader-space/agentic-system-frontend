// @vitest-environment jsdom
// The agent pages around the editor — library, guardrails, monitor, overview.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const api = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), delete: vi.fn(),
  getAgentsPage: vi.fn(), getAgentStats: vi.fn(), getAgents: vi.fn(), unpauseAgent: vi.fn(),
  getAgent: vi.fn(), updateAgent: vi.fn(), getAgentEffectivePolicy: vi.fn(), getAgentActionUsage: vi.fn(),
  getAgentMonitoring: vi.fn(), publishAgent: vi.fn(), unpublishAgent: vi.fn(), rollbackAgent: vi.fn(),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const routeBox = vi.hoisted(() => ({ route: null }))

vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm, useConfirm: () => confirm }))
vi.mock('@/composables/useBreadcrumbs', () => ({ setBreadcrumbLabel: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => routeBox.route, useRouter: () => router }))

import AgentLibrary from './AgentLibrary.vue'
import AgentApprovalsPage from './AgentApprovalsPage.vue'
import AgentMonitor from './AgentMonitor.vue'
import AgentOverview from './AgentOverview.vue'
import AgentSummaryCards from '../components/agent-overview/AgentSummaryCards.vue'
import AgentActionsPreview from '../components/agent-overview/AgentActionsPreview.vue'

const Link = { props: ['to'], template: '<a class="rl" :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot/></a>' }
const OwnerFilter = { props: ['modelValue'], emits: ['update:modelValue'], template: '<div class="owner-stub" />' }
const stubs = {
  Icon: true, OwnerFilter, ContextProfilePicker: true, StatusBadge: true,
  RouterLink: Link, 'router-link': Link,
  MetricCard: true, PublishControlsCard: true, LastTestResultCard: true, ActivitySummaryChart: true,
  RecentRunsList: true, HealthIndicatorsBar: true, AgentQuickTestPanel: true,
  AgentBrainPreview: true, ConnectedCredentialsPreview: true, AutonomySummaryCard: true,
}
const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))
const agentRow = (id) => ({ id, name: `Agent ${id}`, tools_count: 1, is_owner: true })

beforeEach(() => {
  vi.clearAllMocks()
  routeBox.route = reactive({ params: { id: '7' }, query: {}, path: '/dashboard/agents/7' })
  api.get.mockResolvedValue({ data: [] })
})

describe('AgentLibrary', () => {
  // The list as the server holds it; a delete removes from it, so a refetch shows the truth.
  let server
  beforeEach(() => {
    server = Array.from({ length: 9 }, (_, i) => agentRow(i + 1))
    api.getAgentsPage.mockImplementation((p) => {
      const rows = p.owner ? [] : server
      return Promise.resolve({ data: { count: rows.length, results: rows.slice((p.page - 1) * p.page_size, p.page * p.page_size) } })
    })
    api.getAgentStats.mockImplementation(() => Promise.resolve({ data: { total: server.length, live: 0, idle: server.length, tools: 0 } }))
    api.delete.mockImplementation((url) => {
      server = server.filter(a => `/agents/${a.id}/` !== url)
      return Promise.resolve({})
    })
    confirm.mockResolvedValue(true)
  })

  async function deleteFirstCard(w) {
    await w.find('.b-more').trigger('click')
    await w.find('.menu .danger').trigger('click')
    await flushPromises()
  }

  it('refetches the list and the stats after a delete', async () => {
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    expect(w.findAll('article.card')).toHaveLength(8)
    await deleteFirstCard(w)

    expect(api.delete).toHaveBeenCalledWith('/agents/1/')
    expect(api.getAgentsPage).toHaveBeenCalledTimes(2)
    expect(api.getAgentStats).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('8 agents')                 // the hero count is the server's, refreshed
    expect(w.findAll('article.card')).toHaveLength(8)      // the 9th moved up onto this page
    expect(w.find('nav.pager').exists()).toBe(false)       // one page now
  })

  it('steps back a page when the deleted agent was the last one on it', async () => {
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    await w.findAll('nav.pager .pg.num')[1].trigger('click')
    await flushPromises()
    expect(w.findAll('article.card')).toHaveLength(1)
    const before = api.getAgentsPage.mock.calls.length
    await deleteFirstCard(w)

    expect(api.delete).toHaveBeenCalledWith('/agents/9/')
    // Page 2 no longer exists — it must not be asked for (a real server answers that with an error).
    const after = api.getAgentsPage.mock.calls.slice(before).map(c => c[0].page)
    expect(after.length).toBeGreaterThan(0)
    expect(after.every(p => p === 1)).toBe(true)
    expect(w.findAll('article.card')).toHaveLength(8)
    expect(w.find('h3').text()).not.toContain("Couldn't load")
  })

  it('"Clear filters" clears the owner filter too', async () => {
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    w.findComponent(OwnerFilter).vm.$emit('update:modelValue', 'me')
    await flushPromises()
    expect(api.getAgentsPage.mock.calls.at(-1)[0].owner).toBe('me')
    expect(w.text()).toContain('No agents match your search')

    await button(w, 'Clear filters').trigger('click')
    await flushPromises()
    expect(w.findComponent(OwnerFilter).props('modelValue')).toBe('')
    expect(api.getAgentsPage.mock.calls.at(-1)[0].owner).toBeUndefined()
    expect(w.findAll('article.card')).toHaveLength(8)
  })
})

describe('AgentApprovalsPage', () => {
  it('a failed load is shown, Save stays off, and Retry recovers', async () => {
    api.getAgent.mockRejectedValueOnce(new Error('boom'))
    api.getAgentEffectivePolicy.mockResolvedValue({ data: {} })
    const w = mount(AgentApprovalsPage, { global: { stubs } })
    await flushPromises()

    expect(w.text()).toContain('Could not load this agent’s guardrails.')
    const save = button(w, 'Save guardrails')
    expect(save.attributes('disabled')).toBeDefined()
    await save.trigger('click')
    expect(api.updateAgent).not.toHaveBeenCalled()         // the defaults on screen are never written

    api.getAgent.mockResolvedValueOnce({ data: { agent_policy: { risk_ceiling: 'low', keep_me: 1 }, agent_run_mode: 'manual', tools: [] } })
    await button(w, 'Retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Could not load this agent’s guardrails.')
    expect(save.attributes('disabled')).toBeUndefined()

    api.updateAgent.mockResolvedValue({ data: {} })
    await save.trigger('click')
    await flushPromises()
    expect(api.updateAgent.mock.calls[0][1].agent_policy).toMatchObject({ risk_ceiling: 'low', keep_me: 1 })
  })

  it('Save is on after a normal load', async () => {
    api.getAgent.mockResolvedValue({ data: { agent_policy: {}, tools: [] } })
    api.getAgentEffectivePolicy.mockResolvedValue({ data: {} })
    const w = mount(AgentApprovalsPage, { global: { stubs } })
    expect(button(w, 'Save guardrails').attributes('disabled')).toBeDefined()   // not before it has loaded
    await flushPromises()
    expect(button(w, 'Save guardrails').attributes('disabled')).toBeUndefined()
    expect(w.find('.load-error').exists()).toBe(false)
  })
})

describe('AgentMonitor', () => {
  it('"← Agents" goes back to the agents list', async () => {
    api.getAgentMonitoring.mockResolvedValue({ data: {} })
    api.get.mockResolvedValue({ data: { name: 'A' } })
    const w = mount(AgentMonitor, { global: { stubs } })
    await flushPromises()
    await button(w, '← Agents').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/dashboard/agents')
  })
})

describe('overview links open real editor steps', () => {
  const STEP_KEYS = ['identity', 'brain', 'tools', 'team', 'skills', 'credentials', 'autonomy', 'scope', 'final']
  const stepsIn = (w) => w.findAll('a.rl').map(a => a.attributes('data-to'))
    .map(to => (to.match(/[?&]step=([a-z_]+)/) || [])[1]).filter(Boolean)

  it('AgentOverview sub-nav', async () => {
    api.get.mockResolvedValue({ data: { id: 7, name: 'A' } })
    const w = mount(AgentOverview, { global: { stubs: { ...stubs, AgentSummaryCards: true, AgentActionsPreview: true } } })
    await flushPromises()
    const steps = stepsIn(w)
    expect(steps).toEqual(['final', 'brain', 'tools', 'tools', 'autonomy'])
    for (const s of steps) expect(STEP_KEYS).toContain(s)
  })

  it('AgentSummaryCards and AgentActionsPreview', () => {
    const cards = mount(AgentSummaryCards, { props: { agent: { id: 7 } }, global: { stubs } })
    expect(stepsIn(cards)).toEqual(['tools', 'tools', 'credentials', 'autonomy'])
    const actions = mount(AgentActionsPreview, { props: { agent: { id: 7 } }, global: { stubs } })
    expect(stepsIn(actions)).toEqual(['tools'])
  })
})
