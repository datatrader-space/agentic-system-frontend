// @vitest-environment jsdom
import { reactive, ref } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({ session: null }))
vi.mock('../composables/useStudioSession', () => ({ useStudioSession: () => state.session }))
vi.mock('../composables/useStudioExperience', () => ({ useStudioExperience: () => ({ isAgent: ref(false), hintHidden: ref(true), dismissHint: vi.fn() }) }))
import VideoStudioEnhance from './VideoStudioEnhance.vue'
let wrapper
beforeEach(() => {
  state.session = { chat: {}, ready: ref(true), loading: ref(false), error: ref(''), initialize: vi.fn(), video: reactive({ addExistingRef: vi.fn(), refs: [], conversationId: 'c1', local: vi.fn().mockResolvedValue({ job_id: 'local-1' }), request: vi.fn(), requestImage: vi.fn(), start: vi.fn() }) }
})
afterEach(() => wrapper?.unmount())
async function render() { wrapper = mount(VideoStudioEnhance, { global: { stubs: { StudioModeSwitch: true, StudioAgentPanel: true, InputSlot: { name: 'InputSlot', props: ['allowUpload'], template: '<div>Source video</div>' }, ResultsFeed: true } } }); await flushPromises() }
const click = async label => { await wrapper.findAll('button').find(button => button.text() === label).trigger('click'); await flushPromises() }
describe('Enhance free local tools', () => {
  it('requires an existing Library video and leaves paid tools disabled', async () => {
    await render()
    expect(wrapper.get('[data-test="studio-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Choose a source video from the Library')
    expect(wrapper.findComponent({ name: 'InputSlot' }).props('allowUpload')).toBe(false)
    expect(wrapper.findAll('.se-soon button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(state.session.video.local).not.toHaveBeenCalled()
  })
  it.each([['Trim','trim'],['Crop / reframe','crop'],['Retime','retime'],['Captions','caption']])('runs %s only through the allowlisted free operation', async (label, operation) => {
    await render()
    wrapper.findComponent({ name: 'InputSlot' }).vm.$emit('pick', [{ attachment_id: 70, title: 'Owned clip', media_type: 'video' }]); await flushPromises()
    await click(label)
    if (operation === 'caption') await wrapper.get('textarea').setValue('A synthetic caption')
    await click('Apply edit')
    expect(state.session.video.local).toHaveBeenCalledWith(operation, expect.any(Object), { chat: state.session.chat, baseAttachmentId: 70 })
    const params = state.session.video.local.mock.calls[0][1]
    if (operation === 'trim') expect(params).toEqual({ start_ms: 0, end_ms: 5000 })
    if (operation === 'crop') expect(params).toEqual({ aspect_ratio: '9:16', focal_x: 0.5, focal_y: 0.5 })
    if (operation === 'retime') expect(params).toEqual({ factor: 1, keep_pitch: true })
    if (operation === 'caption') expect(params.cues[0]).toEqual({ text: 'A synthetic caption', start_ms: 0, end_ms: 5000 })
    expect(state.session.video.request).not.toHaveBeenCalled(); expect(state.session.video.requestImage).not.toHaveBeenCalled(); expect(state.session.video.start).not.toHaveBeenCalled()
  })
  it('refuses invalid trim times without starting an edit', async () => {
    await render(); wrapper.findComponent({ name: 'InputSlot' }).vm.$emit('pick', [{ attachment_id: 70, media_type: 'video' }]); await flushPromises()
    await wrapper.findAll('input')[0].setValue(8)
    expect(wrapper.get('[data-test="studio-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('End must be after start'); expect(state.session.video.local).not.toHaveBeenCalled()
  })
})
