// @vitest-environment jsdom
// What the agent made in the chat shows in My results too (live 2026-10-28: its relit photo was only in the chat).
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('../../services/api', () => ({ default: { getConversationMedia: vi.fn() } }))
import api from '../../services/api'
import AgentMadeMedia from './AgentMadeMedia.vue'
import { useChatStore } from '../../stores/useChatStore'

describe('AgentMadeMedia', () => {
  it('lists the chat\'s own results, leaves out what a job card shows, and reads again when a turn ends', async () => {
    const pinia = createPinia(); setActivePinia(pinia)
    api.getConversationMedia.mockResolvedValue({ data: { media: [
      { attachment_id: 'relit', url: '/relit.png', media_type: 'image', title: 'Golden hour' },
      { attachment_id: 'job-out', url: '/job.mp4', media_type: 'video', title: 'A job result' }] } })
    const w = mount(AgentMadeMedia, { props: { conversationId: 7, exclude: ['job-out'] }, global: { plugins: [pinia], stubs: { MediaThumb: { props: ['alt'], template: '<img :alt="alt" />' } } } })
    await flushPromises()
    expect(api.getConversationMedia).toHaveBeenCalledWith(7, { source: 'generated' })
    expect(w.findAll('li').map(li => li.text())).toEqual(['Golden hourDownload'])
    expect(w.emitted('count').at(-1)).toEqual([1])
    const chat = useChatStore(pinia)
    chat.isStreaming = true; await flushPromises(); chat.isStreaming = false; await flushPromises()
    expect(api.getConversationMedia).toHaveBeenCalledTimes(2)
    w.unmount()
  })
})
