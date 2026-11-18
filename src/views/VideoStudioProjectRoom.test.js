// @vitest-environment jsdom
// A project's room (ADM-1248): review, canvas and (for managers) spend tabs; the review status control only for those
// the server lets set it; a project the person cannot reach says so.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
import api from '../services/api'
import VideoStudioProjectRoom from './VideoStudioProjectRoom.vue'

const project = (abilities, extra = {}) => ({ project_id: 'p1', title: 'Launch film', my_role: 'editor', owner: { id: 1, name: 'Ana' }, review_status: 'in_review', abilities,
  scenes: [{ scene_id: 's1', title: 'Opening' }], ...extra })
const stubs = {
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
  ProjectReviewPanel: { props: ['projectId', 'abilities', 'targets'], template: '<div data-test="review-stub">{{ targets.map(t => t.label).join("|") }}</div>' },
  ProjectShareDialog: true,
}
function route(p) {
  return (url) => url.endsWith('/versions/') ? Promise.resolve({ data: { versions: [{ attachment_id: 'a1', version: 2, title: 'Take' }] } })
    : url.endsWith('/usage/') ? Promise.resolve({ data: { members: [{ user: { id: 2, name: 'Ben' }, jobs: 3, spent_usd: '1.20' }], total_usd: '1.20' } })
      : Promise.resolve({ data: p })
}

describe('VideoStudioProjectRoom', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the review with every scene and version as a target, and the status control for an editor', async () => {
    api.get.mockImplementation(route(project({ view: true, comment: true, approve: true, edit: true, review: true })))
    api.post.mockResolvedValue({ data: { review_status: 'approved' } })
    const w = mount(VideoStudioProjectRoom, { props: { projectId: 'p1', tab: 'review' }, global: { stubs } }); await flushPromises()
    expect(w.get('[data-test="room-role"]').text()).toContain('you are editor')
    expect(w.get('[data-test="review-stub"]').text()).toBe('Scene 1: Opening|Version 2: Take')
    expect(w.find('[data-test="room-tab-usage"]').exists()).toBe(false)
    await w.get('[data-test="room-review-status"]').setValue('approved'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/review/', { status: 'approved' })
  })

  it('gives a viewer no status control and no Open in the Studio', async () => {
    api.get.mockImplementation(route(project({ view: true }, { my_role: 'viewer' })))
    const w = mount(VideoStudioProjectRoom, { props: { projectId: 'p1' }, global: { stubs } }); await flushPromises()
    expect(w.find('[data-test="room-review-status"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Open in the Studio')
    expect(w.text()).toContain('In review')
  })

  it('shows a manager the spend by person', async () => {
    api.get.mockImplementation(route(project({ view: true, usage: true, manage: true }, { my_role: 'manager' })))
    const w = mount(VideoStudioProjectRoom, { props: { projectId: 'p1', tab: 'usage' }, global: { stubs } }); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/p1/usage/')
    expect(w.text()).toContain('Ben'); expect(w.text()).toContain('$1.20')
  })

  it('says when the project cannot be reached', async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: { error: { code: 'not_found', message: 'Not found.' } } } })
    const w = mount(VideoStudioProjectRoom, { props: { projectId: 'p1' }, global: { stubs } }); await flushPromises()
    expect(w.text()).toContain('you do not have access to it')
  })
})
