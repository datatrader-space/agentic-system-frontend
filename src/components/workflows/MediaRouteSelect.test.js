// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SchemaForm from './SchemaForm.vue'
import { wfFields } from '../../config/wfNodeDefinitions'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), getMediaRoutes: vi.fn() } }))
const createForm = (data) => mount(SchemaForm, { props: { data, fields: wfFields('media.generate') } })
const modelOptions = wrapper => wrapper.get('[aria-label="Media model"]').findAll('option').map(option => option.element.value)

describe('Canvas media model selection', () => {
  beforeEach(() => vi.resetAllMocks())

  it('offers only proven routes and writes the selected route into the node', async () => {
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [
      { route_id: 7, name: 'Proven image', ready: true },
      { route_id: 8, name: 'Unproven image', ready: false },
      { route_id: 9, name: 'Unspecified readiness' },
    ] } })
    const data = reactive({ operation: 'image', route_id: '' })
    const w = createForm(data); await flushPromises()
    expect(api.getMediaRoutes).toHaveBeenCalledExactlyOnceWith('image')
    expect(modelOptions(w)).toEqual(['', '7'])
    await w.get('[aria-label="Media model"]').setValue('7')
    expect(data.route_id).toBe('7')
    expect(w.emitted('change')).toContainEqual(['route_id', '7'])
    expect(wfFields('media.generate').find(field => field.key === 'operation').options).not.toContain('train')
    w.unmount()
  })

  it('clears the previous route and ignores stale responses after operation changes', async () => {
    let finishMusic
    api.getMediaRoutes.mockImplementation(operation => operation === 'music'
      ? new Promise(resolve => { finishMusic = resolve })
      : Promise.resolve({ data: { routes: [{ route_id: operation, name: operation, ready: true }] } }))
    const data = reactive({ operation: 'image', route_id: 'image' })
    const w = createForm(data); await flushPromises()
    const operation = w.find('select')
    await operation.setValue('music')
    expect(data.route_id).toBe('')
    expect(w.get('[aria-label="Media model"]').attributes('disabled')).toBeDefined()
    await operation.setValue('speech'); await flushPromises()
    expect(modelOptions(w)).toEqual(['', 'speech'])
    finishMusic({ data: { routes: [{ route_id: 'late-music', ready: true }] } }); await flushPromises()
    expect(modelOptions(w)).toEqual(['', 'speech'])
    expect(api.getMediaRoutes.mock.calls.map(call => call[0])).toEqual(['image', 'music', 'speech'])
    w.unmount()
  })

  it('loads video models from the proven text-to-video schema endpoint', async () => {
    api.get.mockResolvedValue({ data: { routes: [
      { route_id: 'v', name: 'Video' },
      { route_id: 'blocked', name: 'Unproven', ready: false },
    ] } })
    const w = createForm(reactive({ operation: 'video', route_id: '' })); await flushPromises()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/video/routes/', { params: { task: 'text_to_video' } })
    expect(api.getMediaRoutes).not.toHaveBeenCalled()
    expect(modelOptions(w)).toEqual(['', 'v'])
    w.unmount()
  })

  it('preserves proven saved choices when the inspector switches to another node', async () => {
    api.getMediaRoutes.mockImplementation(operation => Promise.resolve({ data: { routes: [{ route_id: operation, name: operation, ready: true }] } }))
    const first = reactive({ operation: 'image', route_id: 'image' })
    const second = reactive({ operation: 'music', route_id: 'music' })
    const w = createForm(first); await flushPromises()
    await w.setProps({ data: second }); await flushPromises()
    expect(first.route_id).toBe('image'); expect(second.route_id).toBe('music')
    expect(modelOptions(w)).toEqual(['', 'music'])
    w.unmount()
  })

  it('fails closed when model discovery fails and allows a read-only retry', async () => {
    api.getMediaRoutes.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ data: { routes: [{ route_id: 'r', ready: true }] } })
    const data = reactive({ operation: 'image', route_id: 'old' })
    const w = createForm(data); await flushPromises()
    expect(data.route_id).toBe('')
    expect(w.get('[role="alert"]').text()).toContain('Could not load proven models')
    expect(w.get('[aria-label="Media model"]').attributes('disabled')).toBeDefined()
    await w.get('[role="alert"] button').trigger('click'); await flushPromises()
    expect(modelOptions(w)).toEqual(['', 'r'])
    expect(w.find('[role="alert"]').exists()).toBe(false)
    w.unmount()
  })
})
