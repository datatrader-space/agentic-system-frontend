// @vitest-environment jsdom
import { reactive } from 'vue'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
const state = vi.hoisted(() => ({ video: null }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
import StudioSettings from './StudioSettings.vue'
const stubs = { BottomSheet: { template: '<div><slot :sheet="false" /></div>' }, VideoModelPicker: { name: 'VideoModelPicker', props: { kind: String, twoLine: Boolean }, template: '<button>Model {{ kind }}</button>' }, VideoChoice: { props: ['label','options'], template: '<div>{{ label }}</div>' } }
beforeEach(() => { state.video = reactive({ image: { aspect_ratio: '1:1', n: 1 }, imageShapes: ['1:1','16:9'], settings: { duration: 5, aspect_ratio: '16:9', sound: false }, options: { durations: [5], aspectRatios: ['16:9'], resolutions: ['720p'], audio: false }, pendingSwitch: null, applySwitch: vi.fn(), keepCurrentModel: vi.fn() }) })
describe('StudioSettings', () => {
  it('reuses the image model, shape and count controls', () => {
    const w = mount(StudioSettings, { props: { kind: 'image' }, global: { stubs } })
    expect(w.findComponent({ name: 'VideoModelPicker' }).props('twoLine')).toBe(true)
    expect(w.text()).toContain('Model image'); expect(w.text()).toContain('Shape'); expect(w.text()).toContain('How many'); expect(w.text()).not.toContain('Clip length'); w.unmount()
  })
  it('offers only declared video controls and requires an explicit model-switch decision', async () => {
    state.video.pendingSwitch = { changes: [{ field: 'duration', label: 'Length', from: 5, toLabel: '8 s' }], unusable: [] }
    const w = mount(StudioSettings, { props: { kind: 'video' }, global: { stubs } })
    expect(w.text()).toContain('Clip length'); expect(w.text()).toContain('Resolution')
    expect(w.findAll('button').find(button => button.text() === 'Silent video').attributes('disabled')).toBeDefined()
    expect(state.video.applySwitch).not.toHaveBeenCalled()
    await w.findAll('button').find(button => button.text() === 'Keep current model').trigger('click'); expect(state.video.keepCurrentModel).toHaveBeenCalledOnce(); w.unmount()
  })
})
