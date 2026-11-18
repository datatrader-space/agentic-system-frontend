// @vitest-environment jsdom
// Team spend (ADM-1248): what each member spent this month and their limit; an admin sets a limit or pauses a member,
// everyone else only reads what the server returned.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
import api from '../services/api'
import VideoStudioTeamSpend from './VideoStudioTeamSpend.vue'

const rows = (canManage) => ({ workspace: { id: 7, name: 'Acme film' }, month: '2026-11', can_manage: canManage, members: [
  { user: { id: 2, name: 'Ben', email: 'ben@acme.com' }, role: 'member', spent_usd: '4.50', held_usd: '1.00', monthly_limit_usd: '10.00', paused: false },
  { user: { id: 3, name: 'Cy', email: 'cy@acme.com' }, role: 'member', spent_usd: '0', held_usd: '0', monthly_limit_usd: null, paused: false },
] })
function route(canManage) {
  return (url) => url === '/v2/workspaces/' ? Promise.resolve({ data: [{ id: 7, name: 'Acme film', org_name: 'Acme' }] }) : Promise.resolve({ data: rows(canManage) })
}

describe('VideoStudioTeamSpend', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('lets an admin set a limit and pause a member', async () => {
    api.get.mockImplementation(route(true))
    api.put.mockResolvedValue({ data: { user: { id: 3, name: 'Cy', email: 'cy@acme.com' }, role: 'member', spent_usd: '0', held_usd: '0', monthly_limit_usd: '25.00', paused: true } })
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/billing/workspaces/7/member-spend/')
    expect(w.text()).toContain('$4.50')
    const cy = w.findAll('[data-test="vts-row"]')[1]
    expect(cy.get('[data-test="vts-save"]').attributes('disabled')).toBeDefined()
    await cy.get('[data-test="vts-limit"]').setValue('25')
    await cy.get('[data-test="vts-paused"]').setValue(true)
    await cy.get('[data-test="vts-save"]').trigger('click'); await flushPromises()
    expect(api.put).toHaveBeenCalledWith('/billing/workspaces/7/member-spend/3/', { monthly_limit_usd: '25.00', paused: true })
    expect(w.text()).toContain('Saved for Cy.')
  })

  it('refuses an amount that is not money', async () => {
    api.get.mockImplementation(route(true))
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    const ben = w.findAll('[data-test="vts-row"]')[0]
    await ben.get('[data-test="vts-limit"]').setValue('ten')
    expect(ben.get('[data-test="vts-save"]').attributes('disabled')).toBeDefined()
    expect(ben.text()).toContain('Enter an amount')
  })

  it('shows a member the numbers without any control', async () => {
    api.get.mockImplementation(route(false))
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    expect(w.find('[data-test="vts-limit"]').exists()).toBe(false)
    expect(w.find('[data-test="vts-save"]').exists()).toBe(false)
    expect(w.text()).toContain('$10.00'); expect(w.text()).toContain('No limit')
  })
})
