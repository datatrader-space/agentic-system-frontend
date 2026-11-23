// @vitest-environment jsdom
// An image of a run, or the objects found on one (ADM-1351): a thumbnail that opens full size in a new tab, boxes
// drawn over the image with the count said in words, a camera frame named, and a failed link shown with Retry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const apiMock = vi.hoisted(() => ({ getWorkflowImage: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))
const { default: WfImagePreview } = await import('./WfImagePreview.vue')
const { default: OutputTree } = await import('./OutputTree.vue')
const { resetImageLinks } = await import('@/utils/wfImages')

let wrapper
beforeEach(() => {
  resetImageLinks()
  apiMock.getWorkflowImage.mockReset()
  apiMock.getWorkflowImage.mockImplementation(async (id) => ({ data: { url: `https://s3.example/${id}?sig=1`, expires_in: 900 } }))
})
afterEach(() => { wrapper?.unmount(); wrapper = null })

describe('WfImagePreview', () => {
  it('an image is a thumbnail with alt text that opens full size in a new tab', async () => {
    wrapper = mount(WfImagePreview, { props: { image: { kind: 'image', id: 'u1', width: 640, height: 480 }, label: 'image' } })
    await flushPromises()
    const a = wrapper.get('a')
    expect(a.attributes('href')).toBe('https://s3.example/u1?sig=1')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    expect(a.attributes('aria-label')).toBe('Image image. Opens full size in a new tab')
    const im = wrapper.get('img')
    expect(im.attributes('alt')).toBe('Image image')
    expect(im.attributes('loading')).toBe('lazy')
    expect(im.attributes('width')).toBe('640')
    expect(wrapper.text()).toContain('640 × 480')
  })

  it('detections draw each box over the image and say the count in words', async () => {
    const detections = {
      kind: 'detections', image: { kind: 'image', id: 'p1' }, size: [200, 100],
      items: [
        { class: 'cat', score: 0.91, box: [10, 20, 60, 80], polygon: null },
        { class: 'cat', score: 0.5, box: [100, 10, 150, 50], polygon: [[100, 10], [150, 10], [150, 50]] },
        { class: 'dog', score: 0.7, box: [0, 0, 20, 20], polygon: null },
      ],
    }
    wrapper = mount(WfImagePreview, { props: { detections, label: 'detections' } })
    await flushPromises()
    expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 200 100')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('rect.wip-box')).toHaveLength(3)
    expect(wrapper.findAll('rect.wip-halo')).toHaveLength(3)
    expect(wrapper.findAll('polygon')).toHaveLength(1)
    expect(wrapper.get('figcaption').text()).toContain('3 objects: cat 2, dog 1')
    expect(wrapper.get('img').attributes('alt')).toBe('Image with the objects found: 3 objects: cat 2, dog 1')
    const labels = wrapper.findAll('.wip-label')
    expect(labels.map((l) => l.text())).toEqual(['cat 91%', 'cat 50%', 'dog 70%'])
    expect(labels[0].attributes('style')).toContain('left: 5%')
  })

  it('a camera frame is named, and asks for no link', async () => {
    wrapper = mount(WfImagePreview, { props: { image: { kind: 'image', event: 12 } } })
    await flushPromises()
    expect(wrapper.text()).toContain('Camera frame #12')
    expect(apiMock.getWorkflowImage).not.toHaveBeenCalled()
  })

  it('a link that cannot be read is shown with Retry, which asks again', async () => {
    apiMock.getWorkflowImage.mockRejectedValueOnce({ response: { status: 403, data: { error: 'You cannot view this image.' } } })
    wrapper = mount(WfImagePreview, { props: { image: { kind: 'image', id: 'x' } } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('You cannot view this image.')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('a').attributes('href')).toBe('https://s3.example/x?sig=1')
  })

  it('an image whose link expired on screen is asked for again once', async () => {
    wrapper = mount(WfImagePreview, { props: { image: { kind: 'image', id: 'e' } } })
    await flushPromises()
    await wrapper.get('img').trigger('error')
    await flushPromises()
    expect(apiMock.getWorkflowImage).toHaveBeenCalledTimes(2)
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be shown')
  })
})

describe('OutputTree shows the images of a value', () => {
  it('a Find objects output shows its detections once (not its image again) above the tree', async () => {
    const value = {
      detections: { kind: 'detections', image: { kind: 'image', id: 'p' }, size: [10, 10], items: [{ class: 'cat', score: 1, box: [0, 0, 5, 5] }] },
      count: 1, image: { kind: 'image', id: 'p' },
    }
    wrapper = mount(OutputTree, { props: { value, insertable: false } })
    await flushPromises()
    expect(wrapper.findAllComponents(WfImagePreview)).toHaveLength(1)
    expect(wrapper.text()).toContain('1 object: cat 1')
    expect(wrapper.text()).toContain('count')
  })

  it('every crop is a thumbnail; a sample shows none; the schema view shows none', async () => {
    const images = Array.from({ length: 30 }, (_, i) => ({ kind: 'image', id: `c${i}` }))
    wrapper = mount(OutputTree, { props: { value: { images, count: 30 }, insertable: false } })
    await flushPromises()
    expect(wrapper.findAllComponents(WfImagePreview)).toHaveLength(30)
    wrapper.unmount()
    wrapper = mount(OutputTree, { props: { value: { image: { kind: 'image', id: '(image)' } }, insertable: false } })
    expect(wrapper.findAllComponents(WfImagePreview)).toHaveLength(0)
    wrapper.unmount()
    wrapper = mount(OutputTree, { props: { value: { images }, base: 'nodes.crop.output', mode: 'schema' } })
    expect(wrapper.findAllComponents(WfImagePreview)).toHaveLength(0)
  })
})
