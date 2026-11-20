// @vitest-environment jsdom
import { reactive } from 'vue'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const state = vi.hoisted(() => ({ video: null }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../../services/api', () => ({ default: { getStudioRoutes: vi.fn() } }))
import api from '../../services/api'
import StudioSettings from './StudioSettings.vue'
import { routeFor, schemaFields } from '../../services/studioModelRoutes'
const stubs = { BottomSheet: { template: '<div><slot :sheet="false" /></div>' }, VideoModelPicker: { name: 'VideoModelPicker', props: { kind: String, twoLine: Boolean }, template: '<button>Model {{ kind }}</button>' }, VideoChoice: { name: 'VideoChoice', props: ['label', 'options', 'modelValue', 'testId'], emits: ['update:modelValue'], template: '<div :data-test="testId">{{ label }}: {{ options.map(o => o.label).join(\'|\') }}</div>' } }
// The shapes GET /api/video/routes/ serves (video_studio/services/route_schema.py).
const IMAGE_ROW = { kind: 'image', route_id: null, model_id: 7, name: 'Nano Banana', schema: { properties: { prompt: { type: 'string' }, aspect_ratio: { type: 'string', title: 'Shape', enum: ['1:1', '16:9'] }, n: { type: 'integer', title: 'Images', minimum: 1, maximum: 4 }, references: { type: 'array' } } }, ui: { order: ['prompt', 'aspect_ratio', 'n', 'references'], fields: {} } }
const KLING = { kind: 'video', route_id: 31, model_id: null, name: 'Kling', connections: [{ route_id: 31 }, { route_id: 32 }], schema: { properties: { prompt: { type: 'string' }, duration: { type: 'integer', title: 'Length (seconds)', enum: [5, 10] }, aspect_ratio: { type: 'string', title: 'Shape', enum: ['16:9', '9:16'] }, seed: { type: 'integer', minimum: 0, maximum: 4294967295 } } }, ui: { order: ['prompt', 'duration', 'aspect_ratio', 'seed'], fields: { duration: { widget: 'segmented', unit: 's' }, seed: { advanced: true } } } }
const VEO = { ...KLING, route_id: 40, name: 'Veo', connections: [{ route_id: 40 }], schema: { properties: { duration: { type: 'integer', enum: [8] }, resolution: { type: 'string', title: 'Resolution', enum: ['720p', '1080p'] }, sound: { type: 'boolean', title: 'Sound' } } }, ui: { order: ['duration', 'resolution', 'sound'], fields: { duration: { unit: 's' } } } }
beforeEach(() => {
  vi.mocked(api.getStudioRoutes).mockReset()
  vi.mocked(api.getStudioRoutes).mockImplementation(task => Promise.resolve({ data: { routes: task === 'text_to_image' ? [IMAGE_ROW] : [IMAGE_ROW, KLING, VEO] } }))
  state.video = reactive({ image: { aspect_ratio: '1:1', n: 1 }, imageModel: { model_id: 7 }, routeId: '', defaultRouteId: 32, settings: { duration: 5, aspect_ratio: '16:9', sound: false }, pendingSwitch: null, applySwitch: vi.fn(), keepCurrentModel: vi.fn() })
})
describe('StudioSettings', () => {
  it('builds the image form from the chosen model\'s schema', async () => {
    const w = mount(StudioSettings, { props: { kind: 'image' }, global: { stubs } })
    await flushPromises()
    expect(api.getStudioRoutes).toHaveBeenCalledWith('text_to_image')
    expect(w.findComponent({ name: 'VideoModelPicker' }).props('twoLine')).toBe(true)
    expect(w.find('[data-test="image-aspect"]').text()).toBe('Shape: 1:1|16:9')
    expect(w.find('[data-test="image-count"]').text()).toBe('How many: 1|2|3|4')
    expect(w.text()).not.toContain('Clip length'); w.unmount()
  })
  it('offers only what the video model declares, by any of its connections, and never an advanced field', async () => {
    state.video.pendingSwitch = { changes: [{ field: 'duration', label: 'Length', from: 5, toLabel: '8 s' }], unusable: [] }
    const w = mount(StudioSettings, { props: { kind: 'video' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="video-length"]').text()).toBe('Clip length: 5 s|10 s')
    expect(w.find('[data-test="video-aspect"]').exists()).toBe(true)
    expect(w.find('[data-test="video-resolution"]').exists()).toBe(false)      // Kling declares no resolution
    expect(w.text()).not.toContain('seed')
    expect(w.findAll('button').find(button => button.text() === 'Silent video').attributes('disabled')).toBeDefined()
    expect(state.video.applySwitch).not.toHaveBeenCalled()
    await w.findAll('button').find(button => button.text() === 'Keep current model').trigger('click'); expect(state.video.keepCurrentModel).toHaveBeenCalledOnce(); w.unmount()
  })
  it('follows a model change and writes a choice into the settings', async () => {
    const w = mount(StudioSettings, { props: { kind: 'video' }, global: { stubs } })
    await flushPromises()
    state.video.routeId = '40'
    await flushPromises()
    expect(w.find('[data-test="video-resolution"]').text()).toBe('Resolution: 720p|1080p')
    const sound = w.find('[data-test="video-sound"]')
    expect(sound.text()).toBe('Sound off')
    await sound.trigger('click')
    expect(state.video.settings.sound).toBe(true)
    w.findAllComponents({ name: 'VideoChoice' }).find(c => c.props('testId') === 'video-resolution').vm.$emit('update:modelValue', '1080p')
    expect(state.video.settings.resolution).toBe('1080p'); w.unmount()
  })
  it('says when the settings could not be read, and reads them again', async () => {
    vi.mocked(api.getStudioRoutes).mockRejectedValueOnce(new Error('offline'))
    const w = mount(StudioSettings, { props: { kind: 'image' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="studio-settings-error"]').text()).toContain("Could not load this model's settings.")
    await w.find('[data-test="studio-settings-error"] button').trigger('click'); await flushPromises()
    expect(w.find('[data-test="image-aspect"]').exists()).toBe(true); w.unmount()
  })
})
describe('studioModelRoutes', () => {
  it('reads choices, ranges and toggles from a schema in its own order', () => {
    expect(schemaFields(VEO).map(f => [f.key, f.kind])).toEqual([['duration', 'choice'], ['resolution', 'choice'], ['sound', 'toggle']])
    expect(schemaFields(IMAGE_ROW).find(f => f.key === 'n').values).toEqual([1, 2, 3, 4])
    expect(schemaFields(null)).toEqual([])
  })
  it('finds a video model by any connection and an image model by its id', () => {
    expect(routeFor([IMAGE_ROW, KLING], { routeId: 32 })).toBe(KLING)
    expect(routeFor([IMAGE_ROW, KLING], { modelId: 7 })).toBe(IMAGE_ROW)
    expect(routeFor([KLING], { routeId: '' })).toBeNull()
  })
})
