// @vitest-environment jsdom
// Review (ADM-1248): comments with replies and time codes, resolve and delete as the server allows, and approvals on
// the project, a scene or a version. A viewer reads and cannot comment or decide.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
import api from '../../services/api'
import ProjectReviewPanel from './ProjectReviewPanel.vue'

const comments = [
  { comment_id: 1, target_type: 'project', target_id: 'p1', parent_id: null, author: { id: 2, name: 'Ben' }, body: 'Make the logo bigger', timecode_ms: null, resolved: false, resolved_by: null, created_at: '2026-11-10T10:00:00Z', edited_at: null, can_edit: false, can_delete: false, can_resolve: true },
  { comment_id: 2, target_type: 'project', target_id: 'p1', parent_id: 1, author: { id: 1, name: 'Ana' }, body: 'Done', timecode_ms: null, resolved: false, resolved_by: null, created_at: '2026-11-10T11:00:00Z', edited_at: null, can_edit: true, can_delete: true, can_resolve: false },
  { comment_id: 3, target_type: 'project', target_id: 'p1', parent_id: null, author: { id: 2, name: 'Ben' }, body: 'Old note', timecode_ms: null, resolved: true, resolved_by: { id: 1, name: 'Ana' }, created_at: '2026-11-09T10:00:00Z', edited_at: null, can_edit: false, can_delete: false, can_resolve: true },
]
function route(url) {
  if (url.endsWith('/comments/')) return Promise.resolve({ data: { comments } })
  if (url.endsWith('/approvals/')) return Promise.resolve({ data: { approvals: [{ user: { id: 2, name: 'Ben' }, decision: 'changes_requested', note: 'Logo', updated_at: '2026-11-10T10:00:00Z' }], mine: null } })
  return Promise.reject(new Error(url))
}
const editor = { view: true, comment: true, approve: true, edit: true }
const targets = [{ type: 'scene', id: 's1', label: 'Scene 1: Opening' }, { type: 'version', id: 'a1', label: 'Version 2' }]

describe('ProjectReviewPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockImplementation(route) })

  it('shows open threads with their replies, hides resolved ones until asked, and loads the chosen target', async () => {
    const w = mount(ProjectReviewPanel, { props: { projectId: 'p1', abilities: editor, targets } }); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/p1/comments/', { params: { target_type: 'project', target_id: 'p1' } })
    expect(w.findAll('[data-test="review-comment"]')).toHaveLength(1)
    expect(w.text()).toContain('Done')
    await w.get('input[type="checkbox"]').setValue(true)
    expect(w.findAll('[data-test="review-comment"]')).toHaveLength(2)
    await w.get('[data-test="review-target"]').setValue('version:a1'); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/p1/approvals/', { params: { target_type: 'version', target_id: 'a1' } })
  })

  it('posts a comment at a time code on a version, and resolves a thread', async () => {
    api.post.mockResolvedValue({ data: {} }); api.patch.mockResolvedValue({ data: {} })
    const w = mount(ProjectReviewPanel, { props: { projectId: 'p1', abilities: editor, targets, initialTarget: { type: 'version', id: 'a1' } } }); await flushPromises()
    await w.get('[data-test="review-new-comment"] textarea').setValue('Cut here')
    await w.get('[data-test="review-new-comment"] input[type="text"]').setValue('1:05')
    await w.get('[data-test="review-new-comment"]').trigger('submit'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/comments/', { target_type: 'version', target_id: 'a1', body: 'Cut here', timecode_ms: 65000 })
    await w.get('[data-test="review-resolve"]').trigger('click'); await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/video/comments/1/', { resolved: true })
  })

  it('records an approval with a note and offers to withdraw it', async () => {
    api.post.mockResolvedValue({ data: { approvals: [{ user: { id: 1, name: 'Ana' }, decision: 'approved', note: 'Ready', updated_at: '2026-11-11T00:00:00Z' }], mine: 'approved' } })
    const w = mount(ProjectReviewPanel, { props: { projectId: 'p1', abilities: editor } }); await flushPromises()
    await w.get('[data-test="review-decide"] textarea').setValue('Ready')
    await w.get('[data-test="review-approve"]').trigger('click'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/approvals/', { target_type: 'project', target_id: 'p1', decision: 'approved', note: 'Ready' })
    expect(w.find('[data-test="review-withdraw"]').exists()).toBe(true)
    expect(w.emitted('decided')).toBeTruthy()
  })

  it('gives a viewer no way to comment or decide', async () => {
    const w = mount(ProjectReviewPanel, { props: { projectId: 'p1', abilities: { view: true } } }); await flushPromises()
    expect(w.find('[data-test="review-new-comment"]').exists()).toBe(false)
    expect(w.find('[data-test="review-decide"]').exists()).toBe(false)
    expect(w.text()).toContain('Ask its owner or a manager to let you comment')
  })
})

// ISSUE-15: what the signed-in person wrote or decided says "You"; others are named, an email only as their second line.
it('names the signed-in person "You" and others by name in comments and approvals', async () => {
  const { ref } = await import('vue')
  vi.clearAllMocks()
  api.get.mockImplementation(url => url.endsWith('/comments/')
    ? Promise.resolve({ data: { comments: [
      { comment_id: 1, target_type: 'project', target_id: 'p1', parent_id: null, author: { id: 1, name: 'ana@acme.com' }, body: 'Mine', timecode_ms: null, resolved: false, resolved_by: null, created_at: '2026-11-10T10:00:00Z', edited_at: null, can_edit: true, can_delete: true, can_resolve: true },
      { comment_id: 2, target_type: 'project', target_id: 'p1', parent_id: 1, author: { id: 2, name: 'Ben Ray', email: 'ben@acme.com' }, body: 'Reply', timecode_ms: null, resolved: false, resolved_by: null, created_at: '2026-11-10T11:00:00Z', edited_at: null, can_edit: false, can_delete: false, can_resolve: false }] } })
    : Promise.resolve({ data: { approvals: [{ user: { id: 1, name: 'ana@acme.com' }, decision: 'approved', note: '', updated_at: '2026-11-10T10:00:00Z' }, { user: { id: 3, name: 'cy@acme.com' }, decision: 'changes_requested', note: '', updated_at: '2026-11-10T10:00:00Z' }], mine: null } }))
  const w = mount(ProjectReviewPanel, { props: { projectId: 'p1', abilities: { view: true, comment: true, approve: true } }, global: { provide: { studioUser: ref({ id: 1, email: 'ana@acme.com' }) } } }); await flushPromises()
  const names = w.findAll('[data-test="review-person"]').map(n => n.text())
  expect(names).toEqual(['You', 'cy@acme.com', 'You', 'Ben Ray'])
  expect(w.text()).not.toContain('ana@acme.com')
  expect(w.findAll('.prp-email').map(e => e.text())).toEqual(['ben@acme.com'])
})
