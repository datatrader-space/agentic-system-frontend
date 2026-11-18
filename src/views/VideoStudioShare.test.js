// @vitest-environment jsdom
// A share link (ADM-1248): the server checks it; an editor lands in the Studio, a reviewer in the project's review, and
// a revoked, expired or workspace-only link says why it cannot be opened.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }))
import api from '../services/api'
import VideoStudioShare from './VideoStudioShare.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' } }
describe('VideoStudioShare', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redeems the token and opens an editor in the Studio', async () => {
    api.post.mockResolvedValue({ data: { project_id: 'p1', role: 'editor' } })
    mount(VideoStudioShare, { props: { token: 'tok' }, global: { stubs } }); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/share/redeem/', { token: 'tok' })
    expect(replace).toHaveBeenCalledWith({ name: 'video-studio-dashboard', query: { project: 'p1' } })
  })

  it('opens a commenter in the review', async () => {
    api.post.mockResolvedValue({ data: { project_id: 'p1', role: 'commenter' } })
    mount(VideoStudioShare, { props: { token: 'tok' }, global: { stubs } }); await flushPromises()
    expect(replace).toHaveBeenCalledWith({ name: 'video-studio-project-room', params: { projectId: 'p1', tab: 'review' } })
  })

  it.each([
    ['link_revoked', 'was revoked'], ['link_expired', 'has expired'], ['link_not_for_you', 'only for people in the project’s workspace'],
  ])('explains %s and does not open anything', async (code, text) => {
    api.post.mockRejectedValue({ response: { status: 403, data: { error: { code, message: 'x', field: '' } } } })
    const w = mount(VideoStudioShare, { props: { token: 'tok' }, global: { stubs } }); await flushPromises()
    expect(w.get('[data-test="vss-error"]').text()).toContain(text)
    expect(replace).not.toHaveBeenCalled()
    expect(w.text()).not.toContain('Try again')
  })
})
