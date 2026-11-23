// @vitest-environment jsdom
// The model of a "Model call" step (ADM-1333) and, with Images filled in (ADM-1351 phase 3), whether that model takes
// images (the model list's supports_vision): the server refuses a run that sends images to one that does not.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import LlmModelField from './LlmModelField.vue'
import { editorHarness } from '../wfNodeModal.testHarness'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))

const MODELS = [
  { id: 1, name: 'Vision Pro', model_id: 'acme/vision-pro', supports_vision: true },
  { id: 2, name: 'Text Only', model_id: 'acme/text-only', supports_vision: false },
]
let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; apiMock.get.mockReset() })

async function mountField(data, models = MODELS) {
  apiMock.get.mockResolvedValue({ data: models })
  const ctx = editorHarness({ nodeId: 'think', nodes: [{ id: 'think', type: 'llm.call', data }], render: () => h(LlmModelField) })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  await flushPromises()
  return ctx
}
const note = () => wrapper.find('[data-test="lm-vision"]')

describe('LlmModelField with images', () => {
  it('says nothing about images while Images is empty', async () => {
    await mountField({ prompt: 'x', images: '  ', model_id: 2 })
    expect(note().exists()).toBe(false)
  })

  it('says a model that does not take images is refused, in words', async () => {
    await mountField({ prompt: 'x', images: '{{trigger.photo}}', model_id: 2 })
    expect(note().text()).toBe('Text Only does not take images, so a run with images is refused. Choose a model that takes images, or empty Images.')
    expect(note().classes()).toContain('is-bad')
  })

  it('says a model that takes images does', async () => {
    await mountField({ prompt: 'x', images: '{{trigger.photo}}', model_id: 1 })
    expect(note().text()).toBe('Vision Pro takes images: they are sent with the prompt.')
    expect(note().classes()).not.toContain('is-bad')
  })

  it('with the platform default, says the model must take images', async () => {
    await mountField({ prompt: 'x', images: '{{trigger.photo}}', model_id: null })
    expect(note().text()).toContain('the model must take images')
  })

  it('a failed model list keeps the saved model, offers Retry, and makes no claim about images', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('down'))
    const ctx = editorHarness({ nodeId: 'think', nodes: [{ id: 'think', type: 'llm.call', data: { images: '{{trigger.photo}}', model_id: 2 } }], render: () => h(LlmModelField) })
    wrapper = mount(ctx.Host, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not load the models.')
    expect(note().exists()).toBe(false)
    apiMock.get.mockResolvedValue({ data: MODELS })
    await wrapper.find('.lm-btn').trigger('click')
    await flushPromises()
    expect(note().classes()).toContain('is-bad')
  })
})
