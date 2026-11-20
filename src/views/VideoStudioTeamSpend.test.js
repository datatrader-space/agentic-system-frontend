// @vitest-environment jsdom
// Team spend (ADM-1248): what each member spent this month and their limit; an admin sets a limit or pauses a member,
// everyone else only reads what the server returned.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() }, clearApiCache: vi.fn() }))
import api from '../services/api'
import VideoStudioTeamSpend from './VideoStudioTeamSpend.vue'
import { useWorkspace } from '../composables/useWorkspace'
import { ref } from 'vue'

const rows = (canManage) => ({ workspace: { id: 7, name: 'Acme film' }, month: '2026-11', can_manage: canManage, members: [
  { user: { id: 2, name: 'Ben', email: 'ben@acme.com' }, role: 'member', spent_usd: '4.50', held_usd: '1.00', monthly_limit_usd: '10.00', paused: false },
  { user: { id: 3, name: 'Cy', email: 'cy@acme.com' }, role: 'member', spent_usd: '0', held_usd: '0', monthly_limit_usd: null, paused: false },
] })
function route(canManage) {
  return (url) => url === '/v2/workspaces/' ? Promise.resolve({ data: [{ id: 7, name: 'Acme film', org_name: 'Acme' }] }) : Promise.resolve({ data: rows(canManage) })
}

describe('VideoStudioTeamSpend', () => {
  // The Studio menu's workspace is Acme film: the page works in it.
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); useWorkspace().switchWorkspace({ id: 7, name: 'Acme film', slug: 'acme-film' }, { id: 1, name: 'Acme', slug: 'acme' }) })

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

// ISSUE-19: the picker starts on the workspace the Studio menu shows, never the first one listed, and the two stay in step.
describe('VideoStudioTeamSpend workspace', () => {
  const list = [{ id: 4, name: 'ADM-243 Acceptance 2026-08-31', org_name: 'Tests', org_id: 2, org_slug: 'tests' }, { id: 7, name: 'Acme film', org_name: 'Acme', org_id: 1, org_slug: 'acme' }]
  const answer = url => url === '/v2/workspaces/' ? Promise.resolve({ data: list }) : Promise.resolve({ data: { ...rows(false), workspace: { id: Number(/workspaces\/(\d+)/.exec(url)?.[1]), name: 'W' } } })
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('opens on the menu\'s workspace and follows a switch in the menu', async () => {
    const ws = useWorkspace(); ws.switchWorkspace({ id: 7, name: 'Acme film' }, { id: 1, name: 'Acme', slug: 'acme' })
    api.get.mockImplementation(answer)
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    expect(w.get('[data-test="vts-workspace"]').element.value).toBe('7')
    expect(api.get).toHaveBeenCalledWith('/billing/workspaces/7/member-spend/')
    expect(api.get).not.toHaveBeenCalledWith('/billing/workspaces/4/member-spend/')
    ws.switchWorkspace({ id: 4, name: 'ADM-243 Acceptance 2026-08-31' }, { id: 2, name: 'Tests', slug: 'tests' }); await flushPromises()
    expect(w.get('[data-test="vts-workspace"]').element.value).toBe('4')
    expect(api.get).toHaveBeenCalledWith('/billing/workspaces/4/member-spend/')
    w.unmount()
  })

  it('switches the menu\'s workspace when another is picked on the page', async () => {
    const ws = useWorkspace(); ws.switchWorkspace({ id: 7, name: 'Acme film' }, { id: 1, name: 'Acme', slug: 'acme' })
    api.get.mockImplementation(answer)
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    await w.get('[data-test="vts-workspace"]').setValue('4'); await flushPromises()
    expect(ws.activeWorkspace.value.id).toBe(4)
    expect(ws.activeOrg.value.name).toBe('Tests')
    expect(api.get).toHaveBeenCalledWith('/billing/workspaces/4/member-spend/')
    w.unmount()
  })

  it('picks nothing in personal mode and asks the person to choose', async () => {
    useWorkspace().clearWorkspace()
    api.get.mockImplementation(answer)
    const w = mount(VideoStudioTeamSpend); await flushPromises()
    expect(w.get('[data-test="vts-workspace"]').element.value).toBe('')
    expect(w.find('[data-test="vts-choose"]').exists()).toBe(true)
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/member-spend/'))
    w.unmount()
  })
})

// ISSUE-15: the signed-in person is "You"; others by name with their email as the second line.
it('names the signed-in person "You" and others by name, email second', async () => {
  useWorkspace().switchWorkspace({ id: 7, name: 'Acme film' }, { id: 1, name: 'Acme', slug: 'acme' })
  api.get.mockImplementation(route(false))
  const w = mount(VideoStudioTeamSpend, { global: { provide: { studioUser: ref({ id: 2, email: 'ben@acme.com' }) } } }); await flushPromises()
  const [ben, cy] = w.findAll('[data-test="vts-row"]')
  expect(ben.get('th strong').text()).toBe('You')
  expect(ben.get('th').text()).not.toContain('ben@acme.com')
  expect(cy.get('th strong').text()).toBe('Cy')
  expect(cy.get('th small').text()).toBe('cy@acme.com, member')
  w.unmount()
})

// ISSUE-17: on a phone each member is a stacked card: the table, its rows and cells are blocks no wider than the screen.
it('lays each member out as a stacked card on a phone, with nothing wider than the screen', async () => {
  const src = (await import('./VideoStudioTeamSpend.vue?raw')).default
  const phone = src.slice(src.indexOf('@media(max-width:720px)'))
  expect(phone).toContain('.vts-table,.vts-table tbody,.vts-table tr{display:block;width:100%')
  expect(phone).toContain('flex-wrap:wrap')
  expect(phone).toContain('.vts-save .vts-btn{width:100%}')
  expect(src).toMatch(/\.vts\{[^}]*min-width:0/)
})
