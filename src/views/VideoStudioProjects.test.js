// @vitest-environment jsdom
// The Projects page (owner, 2026-10-20): a project opens in the chat it was last open in; one never opened in a chat
// opens with ?project= (a new chat). Opening a project made a new, empty chat every time before.
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { projects: [
  { project_id: 'p-apple', title: 'apple', aspect_ratio: '9:16', updated_at: '2026-10-20T12:53:00Z', conversation_id: 2876, thumbnail_url: '/api/library/v1/thumbnail/' },
  { project_id: 'p-pear', title: 'pear', aspect_ratio: '1:1', updated_at: '2026-10-19T10:00:00Z', conversation_id: null },
] } }), post: vi.fn().mockResolvedValue({data:{project_id:'new'}}) }, clearApiCache: vi.fn() }))

import VideoStudioProjects from './VideoStudioProjects.vue'
import api from '../services/api'
import { useWorkspace } from '../composables/useWorkspace'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('VideoStudioProjects', () => {
  it('links a project to its last chat, and a project in no chat to a new one', async () => {
    const w = mount(VideoStudioProjects, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } })
    await flush(); await flush()
    const to = w.findAll('[data-test="vsp-project"]').map((a) => JSON.parse(a.attributes('data-to')))
    expect(to).toEqual([{ name: 'video-studio-dashboard', query: { conversation: '2876' } }, { name: 'video-studio-dashboard', query: { project: 'p-pear' } }])
  })
  it("shows a project's own video picture, and its shape with a note when it has none or the picture fails", async () => {
    const w = mount(VideoStudioProjects, { global: { stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' } } } })
    await flush(); await flush()
    const [apple, pear] = w.findAll('[data-test="vsp-project"]')
    expect(apple.get('[data-test="vsp-thumbnail"]').attributes('src')).toBe('/api/library/v1/thumbnail/')
    expect(apple.text()).not.toContain('No video yet')
    expect(pear.find('[data-test="vsp-thumbnail"]').exists()).toBe(false)
    expect(pear.text()).toContain('No video yet')
    await apple.get('img').trigger('error')
    expect(apple.find('img').exists()).toBe(false)
    expect(apple.text()).toContain('No video yet')
  })
})

it('creates a named project only on explicit confirmation using the existing endpoint',async()=>{
 const w=mount(VideoStudioProjects,{global:{stubs:{RouterLink:{props:['to'],template:'<a><slot /></a>'}}}})
 await flush();const dialog=w.get('dialog').element;dialog.showModal=vi.fn();dialog.close=vi.fn()
 await w.get('[data-test="vsp-new"]').trigger('click');expect(api.post).not.toHaveBeenCalled()
 expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
 await w.get('input[type="text"]').setValue('  Launch film  ');await w.get('form').trigger('submit');await flush()
 expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/projects/',{title:'Launch film'});expect(dialog.close).toHaveBeenCalledOnce();w.unmount()
})

// Team sharing (ADM-1248): scope tabs, folders, the trash, and what a card shows about who it belongs to.
describe('VideoStudioProjects sharing', () => {
  const stubs = { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }, ProjectShareDialog: { props: ['open', 'projectId'], template: '<div v-if="open" data-test="share-stub">{{ projectId }}</div>' } }
  const shared = { project_id: 'p-shared', title: 'Their film', updated_at: '2026-11-10T10:00:00Z', my_role: 'commenter', owner: { id: 9, name: 'Ana' },
    abilities: { view: true, comment: true, manage: false, own: false }, review_status: 'changes_requested', workspace_id: 7, folder_id: null }
  const mine = { project_id: 'p-mine', title: 'My film', updated_at: '2026-11-10T10:00:00Z', my_role: 'owner', owner: { id: 1, name: 'Me' }, visibility: 'workspace',
    abilities: { view: true, comment: true, edit: true, manage: true, own: true }, review_status: 'approved', workspace_id: 7, folder_id: null }
  const trashed = { project_id: 'p-old', title: 'Old film', trashed_at: '2026-11-01T00:00:00Z', restore_until: '2026-12-01T00:00:00Z', my_role: 'owner', abilities: { own: true } }
  function route(url, config) {
    if (url === '/v2/workspaces/') return Promise.resolve({ data: [{ id: 7, name: 'Acme film' }] })
    if (url === '/video/folders/') return Promise.resolve({ data: { folders: [{ folder_id: 3, workspace_id: 7, name: 'Launch', shared: true, pinned: true, project_count: 1, can_manage: true }] } })
    if (config?.params?.trash) return Promise.resolve({ data: { projects: [trashed] } })
    return Promise.resolve({ data: { projects: [mine, shared] } })
  }

  // The Studio menu's workspace is Acme film (ISSUE-19): its folders are listed.
  beforeEach(() => { useWorkspace().switchWorkspace({ id: 7, name: 'Acme film' }, { id: 1, name: 'Acme', slug: 'acme' }) })

  it("labels a shared project with its owner, my role and its review, and opens the share dialog from the card", async () => {
    api.get.mockImplementation(route)
    const w = mount(VideoStudioProjects, { global: { stubs } }); await flush(); await flush()
    const badges = w.findAll('[data-test="vsp-badges"]').map(b => b.text())
    expect(badges[0]).toContain('Shared with the workspace'); expect(badges[0]).toContain('Approved')
    expect(badges[1]).toContain('Ana, you are commenter'); expect(badges[1]).toContain('Changes requested')
    // Only the owner can move a project to the trash; only a manager can move it between folders.
    expect(w.findAll('[data-test="vsp-trash"]')).toHaveLength(1)
    expect(w.findAll('[data-test="vsp-move"]')).toHaveLength(1)
    await w.findAll('[data-test="vsp-share"]')[1].trigger('click')
    expect(w.get('[data-test="share-stub"]').text()).toBe('p-shared')
  })

  it('lists folders with the pinned one first and filters by a folder', async () => {
    api.get.mockClear(); api.get.mockImplementation(route)
    const w = mount(VideoStudioProjects, { global: { stubs } }); await flush(); await flush()
    expect(w.get('[data-test="vsp-folder"]').text()).toContain('Launch')
    await w.get('[data-test="vsp-folder"]').trigger('click'); await flush()
    expect(api.get).toHaveBeenLastCalledWith('/video/projects/', { params: { scope: 'all', folder: '3' } })
  })

  it('moves a project to the trash only after a second click, and restores or deletes for good from the trash', async () => {
    api.get.mockImplementation(route); api.post.mockClear(); api.post.mockResolvedValue({ data: {} }); api.delete = vi.fn().mockResolvedValue({})
    const w = mount(VideoStudioProjects, { global: { stubs } }); await flush(); await flush()
    await w.get('[data-test="vsp-trash"]').trigger('click')
    expect(api.post).not.toHaveBeenCalled()
    await w.get('[data-test="vsp-trash-confirm"]').trigger('click'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p-mine/trash/')
    await w.get('[data-test="vsp-scope-trash"]').trigger('click'); await flush()
    expect(w.text()).toContain('Can be restored until')
    await w.get('[data-test="vsp-restore"]').trigger('click'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p-old/restore/')
    await w.findAll('button').find(b => b.text() === 'Delete for good').trigger('click')
    await w.get('[data-test="vsp-purge"]').trigger('click'); await flush()
    expect(api.delete).toHaveBeenCalledWith('/video/projects/p-old/')
  })

  it('starts the workspace picker on the menu\'s workspace, not the first listed, and follows the menu (ISSUE-19)', async () => {
    const ws = useWorkspace(); ws.switchWorkspace({ id: 7, name: 'Acme film' }, { id: 1, name: 'Acme', slug: 'acme' })
    api.get.mockClear(); api.get.mockImplementation((url, config) => url === '/v2/workspaces/'
      ? Promise.resolve({ data: [{ id: 4, name: 'ADM-243 Acceptance 2026-08-31', org_id: 2, org_name: 'Tests' }, { id: 7, name: 'Acme film', org_id: 1, org_name: 'Acme' }] })
      : route(url, config))
    const w = mount(VideoStudioProjects, { global: { stubs } }); await flush(); await flush()
    expect(w.get('[data-test="vsp-workspace"]').element.value).toBe('7')
    expect(api.get).toHaveBeenCalledWith('/video/folders/', { params: { workspace_id: '7' } })
    ws.switchWorkspace({ id: 4, name: 'ADM-243 Acceptance 2026-08-31' }, { id: 2, name: 'Tests', slug: 'tests' }); await flush(); await flush()
    expect(w.get('[data-test="vsp-workspace"]').element.value).toBe('4')
    w.unmount()
  })
})
