// @vitest-environment jsdom
// The Projects page (owner, 2026-10-20): a project opens in the chat it was last open in; one never opened in a chat
// opens with ?project= (a new chat). Opening a project made a new, empty chat every time before.
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { projects: [
  { project_id: 'p-apple', title: 'apple', aspect_ratio: '9:16', updated_at: '2026-10-20T12:53:00Z', conversation_id: 2876 },
  { project_id: 'p-pear', title: 'pear', aspect_ratio: '1:1', updated_at: '2026-10-19T10:00:00Z', conversation_id: null },
] } }) } }))

import VideoStudioProjects from './VideoStudioProjects.vue'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('VideoStudioProjects', () => {
  it('links a project to its last chat, and a project in no chat to a new one', async () => {
    const w = mount(VideoStudioProjects, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } })
    await flush(); await flush()
    const to = w.findAll('[data-test="vsp-project"]').map((a) => JSON.parse(a.attributes('data-to')))
    expect(to).toEqual([{ name: 'video-studio', query: { conversation: '2876' } }, { name: 'video-studio', query: { project: 'p-pear' } }])
  })
})
