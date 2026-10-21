// @vitest-environment jsdom
// Integrations › Agents: a page of the person's own agents from the server, with search, channel filter, sort,
// tiles counted on the server, and pagination (owner, 2026-10-16).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getAgentsPage: vi.fn(), getAgentStats: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

import AgentIntegrationsList from './AgentIntegrationsList.vue'

const RouterLink = { props: ['to'], template: '<a class="rl" :data-to="to"><slot /></a>' }
const agent = (id, extra = {}) => ({ id, name: `Agent ${id}`, description: `does ${id}`, updated_at: new Date().toISOString(),
  ws_chat_enabled: true, signal_enabled: false, is_public: false, ...extra })
const page = (results, count = results.length) => ({ data: { count, results } })

const mountList = async () => {
  const w = mount(AgentIntegrationsList, { global: { stubs: { RouterLink, 'router-link': RouterLink } } })
  await flushPromises()
  return w
}
const lastParams = () => api.getAgentsPage.mock.calls.at(-1)[0]

beforeEach(() => {
  vi.clearAllMocks()
  api.getAgentStats.mockResolvedValue({ data: { total: 23, any_channel: 9, websocket: 8, live: 2, widget: 1 } })
})
afterEach(() => { vi.useRealTimers() })

describe('AgentIntegrationsList', () => {
  it('asks the server for the first page of MY agents and shows each channel and the tiles', async () => {
    api.getAgentsPage.mockResolvedValue(page([agent(1, { signal_enabled: true }), agent(2, { ws_chat_enabled: false, is_public: true })], 23))
    const w = await mountList()
    expect(lastParams()).toEqual({ owner: 'me', page: 1, page_size: 10, ordering: '-updated_at' })
    expect(api.getAgentStats).toHaveBeenCalledWith({ owner: 'me' })

    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    const cells = (r) => r.findAll('td').slice(1, 4).map(td => td.text())
    expect(cells(rows[0])).toEqual(['On', 'On', 'Off'])
    expect(cells(rows[1])).toEqual(['Off', 'Off', 'On'])
    const links = rows[0].findAll('a.rl').map(a => [a.text(), a.attributes('data-to')])
    expect(links).toContainEqual(['Set up', '/dashboard/integrations/agents/1'])
    expect(links).toContainEqual(['Guide', '/dashboard/integrations/agents/1#guide'])

    expect(w.text()).toContain('Live on a channel')
    expect(w.text()).toContain('of 23 agents')
    expect(w.text()).toContain('Showing 1–10 of 23 agents')
  })

  it('pages through the server, with the current page marked', async () => {
    api.getAgentsPage.mockResolvedValue(page(Array.from({ length: 10 }, (_, i) => agent(i + 1)), 23))
    const w = await mountList()
    const num = (n) => w.findAll('nav[aria-label="Pages"] button').find(b => b.text() === String(n))
    expect(num(3)).toBeTruthy()
    await num(2).trigger('click')
    await flushPromises()
    expect(lastParams().page).toBe(2)
    expect(w.text()).toContain('Showing 11–20 of 23 agents')
    expect(num(2).attributes('aria-current')).toBe('page')
  })

  it('search waits for typing to pause, runs on the server and starts again at page 1', async () => {
    vi.useFakeTimers()
    api.getAgentsPage.mockResolvedValue(page(Array.from({ length: 10 }, (_, i) => agent(i + 1)), 23))
    const w = await mountList()
    await w.findAll('nav[aria-label="Pages"] button').find(b => b.text() === '2').trigger('click')
    await flushPromises()
    api.getAgentsPage.mockClear()
    await w.find('input[type=search]').setValue('supp')
    expect(api.getAgentsPage).not.toHaveBeenCalled()             // not on every keystroke
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(lastParams()).toMatchObject({ search: 'supp', page: 1 })
  })

  it('the channel filter and sort are server parameters', async () => {
    api.getAgentsPage.mockResolvedValue(page([agent(1)]))
    const w = await mountList()
    const [channel, sort] = w.findAll('select')
    await channel.setValue('widget')
    await flushPromises()
    expect(lastParams()).toMatchObject({ channel: 'widget', page: 1 })
    await sort.setValue('name')
    await flushPromises()
    expect(lastParams()).toMatchObject({ channel: 'widget', ordering: 'name' })
  })

  it('no agents at all offers to create one; no match offers to clear the filters', async () => {
    api.getAgentsPage.mockResolvedValue(page([]))
    let w = await mountList()
    expect(w.text()).toContain('No agents yet')
    expect(w.find('a.rl').attributes('data-to')).toBe('/dashboard/agents/new')

    w = await mountList()
    await w.findAll('select')[0].setValue('webhook')
    await flushPromises()
    expect(w.text()).toContain('No agents match')
    await w.findAll('button').find(b => b.text() === 'Clear filters').trigger('click')
    await flushPromises()
    expect(lastParams().channel).toBeUndefined()
  })

  it('a failed load says so and can be retried', async () => {
    api.getAgentsPage.mockRejectedValueOnce(new Error('down'))
    const w = await mountList()
    expect(w.text()).toContain('Could not load your agents')
    api.getAgentsPage.mockResolvedValue(page([agent(5)]))
    await w.findAll('button').find(b => b.text() === 'Try again').trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(1)
  })
})

describe('AgentIntegrationsList in settings', () => {
  it('uses compact cards with the same server ownership filter and setup links', async () => {
    api.getAgentsPage.mockResolvedValue(page([agent(7, { is_public: true })]))
    const w = mount(AgentIntegrationsList, { props: { compact: true }, global: { stubs: { RouterLink, 'router-link': RouterLink } } })
    await flushPromises()
    expect(w.find('.compact-agent-cards').exists()).toBe(true)
    expect(w.find('table').exists()).toBe(false)
    expect(lastParams().owner).toBe('me')
    expect(w.findAll('a.rl').some(link => link.text() === 'Set up' && link.attributes('data-to') === '/dashboard/integrations/agents/7')).toBe(true)
    w.unmount()
  })
})
