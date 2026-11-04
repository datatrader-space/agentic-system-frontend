// @vitest-environment jsdom
// The Projects page (owner, 2026-10-20): a project opens in the chat it was last open in; one never opened in a chat
// opens with ?project= (a new chat). Opening a project made a new, empty chat every time before.
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { projects: [
  { project_id: 'p-apple', title: 'apple', aspect_ratio: '9:16', updated_at: '2026-10-20T12:53:00Z', conversation_id: 2876, thumbnail_url: '/api/library/v1/thumbnail/' },
  { project_id: 'p-pear', title: 'pear', aspect_ratio: '1:1', updated_at: '2026-10-19T10:00:00Z', conversation_id: null },
] } }), post: vi.fn().mockResolvedValue({data:{project_id:'new'}}) } }))

import VideoStudioProjects from './VideoStudioProjects.vue'
import api from '../services/api'

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
