// @vitest-environment jsdom
// The share dialog (ADM-1248): managers invite, change roles, open the project to the workspace and make links whose
// address is shown once; people who cannot manage only see who has access. The server decides; the dialog follows
// the abilities it answers.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
import api from '../../services/api'
import ProjectShareDialog from './ProjectShareDialog.vue'

const managerAccess = {
  project_id: 'p1', my_role: 'owner', abilities: { view: true, comment: true, edit: true, manage: true, own: true },
  owner: { id: 1, name: 'Ana Owner', email: 'ana@acme.com' }, visibility: 'private', workspace: { id: 7, name: 'Acme film' },
  members: [
    { user_id: 1, name: 'Ana Owner', email: 'ana@acme.com', role: 'owner', source: 'owner' },
    { user_id: 2, name: 'Ben Editor', email: 'ben@acme.com', role: 'editor', source: 'invite' },
    { user_id: 3, name: 'Cy Admin', email: 'cy@acme.com', role: 'manager', source: 'workspace' },
  ],
  links: [{ link_id: 9, permission: 'comment', audience: 'anyone', expires_at: '2026-12-01T00:00:00Z', use_count: 2, last_used_at: null, created_by: { id: 1, name: 'Ana Owner' } }],
}
const viewerAccess = { ...managerAccess, my_role: 'viewer', abilities: { view: true }, links: undefined }

const mountOpen = () => mount(ProjectShareDialog, { props: { open: true, projectId: 'p1', title: 'Launch film' }, attachTo: document.body })

describe('ProjectShareDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: managerAccess }) })

  it('lists who has access and lets a manager invite, change a role and remove an invited person', async () => {
    api.post.mockResolvedValue({ data: {} }); api.patch.mockResolvedValue({ data: {} }); api.delete.mockResolvedValue({})
    const w = mountOpen(); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/p1/access/')
    expect(w.findAll('[data-test="share-member"]')).toHaveLength(3)
    expect(w.text()).toContain('from the workspace')
    // Only an invited person has a role select and a Remove button; the owner and workspace members do not.
    expect(w.findAll('[data-test="share-remove"]')).toHaveLength(1)
    await w.get('[data-test="share-invite"] input[type="email"]').setValue('dee@acme.com')
    await w.get('[data-test="share-invite"]').trigger('submit')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/members/', { email: 'dee@acme.com', role: 'editor' })
    await w.get('select[id="psd-role-2"]').setValue('commenter')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/video/projects/p1/members/2/', { role: 'commenter' })
    await w.get('[data-test="share-remove"]').trigger('click'); await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('/video/projects/p1/members/2/')
    w.unmount()
  })

  it('shows a new link once, never lets an edit link go to anyone signed in, and revokes a link', async () => {
    api.post.mockResolvedValue({ data: { link: { link_id: 10 }, url: 'https://aadml.com/video-studio/share/tok123', token: 'tok123' } })
    api.delete.mockResolvedValue({})
    const w = mountOpen(); await flushPromises()
    const [permission, audience] = w.findAll('[data-test="share-link-form"] select')
    await permission.setValue('edit')
    expect(audience.element.value).toBe('workspace')
    expect(audience.find('option[value="anyone"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="share-link-form"]').trigger('submit'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/links/', { permission: 'edit', audience: 'workspace', expires_in_days: 14 })
    expect(w.get('[data-test="share-new-link"] input').element.value).toBe('https://aadml.com/video-studio/share/tok123')
    await w.get('[data-test="share-revoke"]').trigger('click'); await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('/video/projects/p1/links/9/')
    w.unmount()
  })

  it('opens the project to its workspace and needs a second click to transfer ownership', async () => {
    api.patch.mockResolvedValue({ data: { ...managerAccess, visibility: 'workspace' } })
    api.post.mockResolvedValue({ data: { ...managerAccess, my_role: 'manager' } })
    const w = mountOpen(); await flushPromises()
    await w.get('[data-test="share-visibility"]').setValue(true); await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/video/projects/p1/sharing/', { visibility: 'workspace' })
    await w.get('[data-test="share-transfer-select"]').setValue('2')
    await w.findAll('button').find(b => b.text() === 'Transfer').trigger('click')
    expect(api.post).not.toHaveBeenCalled()
    await w.get('[data-test="share-transfer-confirm"]').trigger('click'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/transfer/', { user_id: 2 })
    w.unmount()
  })

  it('shows a viewer who has access but no way to change it', async () => {
    api.get.mockResolvedValue({ data: viewerAccess })
    const w = mountOpen(); await flushPromises()
    expect(w.find('[data-test="share-readonly"]').exists()).toBe(true)
    expect(w.find('[data-test="share-invite"]').exists()).toBe(false)
    expect(w.find('[data-test="share-link-form"]').exists()).toBe(false)
    expect(w.find('[data-test="share-visibility"]').exists()).toBe(false)
    expect(w.find('[data-test="share-remove"]').exists()).toBe(false)
    w.unmount()
  })

  it('says what the server refused, in its words', async () => {
    api.post.mockRejectedValue({ response: { status: 403, data: { error: { code: 'not_in_workspace', message: 'That person is not in this project’s workspace.', field: 'email' } } } })
    const w = mountOpen(); await flushPromises()
    await w.get('[data-test="share-invite"] input[type="email"]').setValue('out@other.com')
    await w.get('[data-test="share-invite"]').trigger('submit'); await flushPromises()
    expect(w.get('[data-test="share-error"]').text()).toBe('That person is not in this project’s workspace.')
    w.unmount()
  })

  it('closes on Escape', async () => {
    const w = mountOpen(); await flushPromises()
    await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toBeTruthy()
    w.unmount()
  })
})
