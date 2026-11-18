// @vitest-environment jsdom
// The Community page (backend CREATIVE_SUITE_P7_P8_PLAN.md section 4): shared templates, remix into one's own project,
// report, withdraw, and sharing a project only with what was ticked, a rights statement and a confirmation.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tpl = (over = {}) => ({ template_id: 't1', title: 'Coffee ad', publisher: 'Ana', mine: false, status: 'published', rights_statement: 'I made it. Remix freely.',
  includes: { brief: true, scenes: 3, timeline: false, files: [{ media_type: 'image', role: '' }] }, remix_count: 2, cover_url: '/api/video/community/templates/t1/cover/', ...over })
const state = vi.hoisted(() => ({ templates: [] }))
vi.mock('../services/api', () => ({ default: {
  getCommunityTemplates: vi.fn(() => Promise.resolve({ data: { templates: state.templates } })),
  communityTemplateAction: vi.fn((id, action) => Promise.resolve({ data: action === 'remix' ? { project_id: 'new-p', title: 'Remix of Coffee ad' } : {} })),
  shareCommunityTemplate: vi.fn(() => Promise.resolve({ data: {} })),
  get: vi.fn(url => Promise.resolve({ data: url === '/video/projects/' ? { projects: [{ project_id: 'p1', title: 'Mine' }] }
    : { items: [{ attachment_id: 'f1', title: 'logo.png', media_type: 'image' }, { attachment_id: 'd1', title: 'notes.pdf', media_type: 'document' }], has_more: false } })),
} }))

import VideoStudioCommunity from './VideoStudioCommunity.vue'
import api from '../services/api'

const RouterLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
const mountPage = () => mount(VideoStudioCommunity, { global: { stubs: { RouterLink } } })

beforeEach(() => { vi.clearAllMocks(); state.templates = [tpl()] })

describe('VideoStudioCommunity', () => {
  it('lists shared templates with what they include', async () => {
    const w = mountPage()
    await flushPromises()
    const card = w.get('[data-test="vcm-card"]')
    expect(card.text()).toContain('Coffee ad')
    expect(card.text()).toContain('Includes brief, 3 scenes, 1 file.')
    expect(card.text()).toContain('2 remixes')
  })

  it('remixes into a new project of one\'s own and links to it', async () => {
    const w = mountPage()
    await flushPromises()
    await w.get('[data-test="vcm-remix"]').trigger('click')
    await flushPromises()
    const [id, action, , key] = api.communityTemplateAction.mock.calls[0]
    expect([id, action]).toEqual(['t1', 'remix'])
    expect(key).toBeTruthy()
    expect(w.get('[data-test="vcm-message"]').text()).toContain('Remix of Coffee ad')
    expect(JSON.parse(w.get('[data-test="vcm-message"] a').attributes('data-to'))).toEqual({ name: 'video-studio-dashboard', query: { project: 'new-p' } })
  })

  it('shows why a remix was refused', async () => {
    api.communityTemplateAction.mockRejectedValueOnce({ response: { data: { error: { message: 'This template is no longer shared, so it cannot be remixed.' } } } })
    const w = mountPage()
    await flushPromises()
    await w.get('[data-test="vcm-remix"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="vcm-message"]').text()).toContain('no longer shared')
  })

  it('reports with a reason', async () => {
    const w = mountPage()
    await flushPromises()
    await w.get('[data-test="vcm-report-open"]').trigger('click')
    await w.get('[data-test="vcm-report-form"] select').setValue('spam')
    await w.get('[data-test="vcm-report-form"]').trigger('submit')
    await flushPromises()
    expect(api.communityTemplateAction).toHaveBeenCalledWith('t1', 'report', { reason: 'spam', details: '' })
  })

  it('one\'s own template is withdrawn after an inline confirmation, never remixed or reported', async () => {
    state.templates = [tpl({ mine: true })]
    const w = mountPage()
    await flushPromises()
    expect(w.find('[data-test="vcm-remix"]').exists()).toBe(false)
    expect(w.find('[data-test="vcm-report-open"]').exists()).toBe(false)
    await w.get('[data-test="vcm-withdraw"]').trigger('click')
    expect(api.communityTemplateAction).not.toHaveBeenCalled()
    await w.get('[data-test="vcm-withdraw-yes"]').trigger('click')
    await flushPromises()
    expect(api.communityTemplateAction).toHaveBeenCalledWith('t1', 'withdraw')
  })

  it('shares only the ticked parts and files, and needs the rights confirmation', async () => {
    const w = mountPage()
    await flushPromises()
    const dialog = w.get('[data-test="vcm-share"]').element
    dialog.showModal = vi.fn(); dialog.close = vi.fn()
    await w.get('[data-test="vcm-share-open"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="vcm-share-project"]').setValue('p1')
    await flushPromises()
    const files = w.findAll('[data-test="vcm-share"] input[type="checkbox"][value]')
    expect(files.map(f => f.attributes('value'))).toEqual(['f1'])  // a document is not offered
    await files[0].setValue(true)
    await w.get('[data-test="vcm-share-title"]').setValue('Coffee template')
    await w.get('[data-test="vcm-allow-scenes"]').setValue(false)
    await w.get('[data-test="vcm-share-rights"]').setValue('I made everything here. Anyone may remix it.')
    await w.get('[data-test="vcm-share"] form').trigger('submit')
    expect(api.shareCommunityTemplate).not.toHaveBeenCalled()
    expect(w.get('[data-test="vcm-share-error"]').text()).toContain('Confirm')
    await w.get('[data-test="vcm-share-confirm"]').setValue(true)
    await w.get('[data-test="vcm-share"] form').trigger('submit')
    await flushPromises()
    expect(api.shareCommunityTemplate).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'p1', title: 'Coffee template', files: ['f1'],
      allow: { brief: true, scenes: false, timeline: false }, rights_confirmed: true }))
    expect(dialog.close).toHaveBeenCalled()
  })
})
