// @vitest-environment jsdom
// Integrations › Agent integrations: the person's own agents, each channel on/off, Set up and Guide links.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getAgents: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

import AgentIntegrationsList from './AgentIntegrationsList.vue'

const RouterLink = { props: ['to'], template: '<a class="rl" :data-to="to"><slot /></a>' }
const mountList = async (agents) => {
  api.getAgents.mockResolvedValue({ data: agents })
  const w = mount(AgentIntegrationsList, { global: { stubs: { RouterLink, 'router-link': RouterLink } } })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('AgentIntegrationsList', () => {
  it('lists only the agents the person owns, with each channel on or off', async () => {
    const w = await mountList([
      { id: 2, name: 'Support bot', is_owner: true, ws_chat_enabled: true, signal_enabled: false, is_public: true },
      { id: 3, name: 'Shared with me', is_owner: false, ws_chat_enabled: true, signal_enabled: true, is_public: true },
      { id: 1, name: 'Alpha', is_owner: true, ws_chat_enabled: false, signal_enabled: true, is_public: false },
    ])
    const rows = w.findAll('li')
    expect(rows.map(r => r.find('.truncate').text())).toEqual(['Alpha', 'Support bot'])   // sorted, no shared agent
    expect(rows[0].text()).toContain('WebSocket off')
    expect(rows[0].text()).toContain('Webhook on')
    expect(rows[0].text()).toContain('Widget off')
    expect(rows[1].text()).toContain('WebSocket on')
    expect(rows[1].text()).toContain('Widget on')
    const links = rows[1].findAll('a.rl').map(a => [a.text(), a.attributes('data-to')])
    expect(links).toEqual([['Guide', '/dashboard/integrations/agents/2#guide'], ['Set up', '/dashboard/integrations/agents/2']])
  })

  it('search narrows the list, and says when nothing matches', async () => {
    const w = await mountList([
      { id: 1, name: 'Alpha', is_owner: true }, { id: 2, name: 'Beta', is_owner: true },
    ])
    await w.find('input[type=search]').setValue('bet')
    expect(w.findAll('li').map(r => r.find('.truncate').text())).toEqual(['Beta'])
    await w.find('input[type=search]').setValue('zzz')
    expect(w.text()).toContain('No agent matches')
  })

  it('a person with no agents is offered to create one; a failed load can be retried', async () => {
    let w = await mountList([])
    expect(w.text()).toContain('You have no agents yet')
    api.getAgents.mockRejectedValueOnce(new Error('down'))
    w = mount(AgentIntegrationsList, { global: { stubs: { RouterLink, 'router-link': RouterLink } } })
    await flushPromises()
    expect(w.text()).toContain('Could not load your agents')
    api.getAgents.mockResolvedValue({ data: [{ id: 5, name: 'Back', is_owner: true }] })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.findAll('li')).toHaveLength(1)
  })
})
