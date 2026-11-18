// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { video: null } }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: null }) }))
vi.mock('../../services/api', () => ({ default: { getConversationMedia: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
import VideoPanel from './VideoPanel.vue'

describe('Video workspace navigation', () => {
  beforeEach(() => {
    state.video = reactive({ project: null, versions: [], activeVideo: null, panelTab: 'preview', can: {},
                             sessionImages: [], loadSessionImages: vi.fn(), refs: [] })
  })

  it('supports arrow, Home and End keys and associates tabs with their panels', async () => {
    const wrapper = mount(VideoPanel, { attachTo: document.body })
    const preview = wrapper.get('#video-tab-preview')
    expect(preview.attributes('aria-controls')).toBe('video-pane-preview')
    await preview.trigger('keydown', { key: 'ArrowRight' })
    expect(state.video.panelTab).toBe('images')
    expect(document.activeElement.id).toBe('video-tab-images')
    await wrapper.get('#video-tab-images').trigger('keydown', { key: 'ArrowRight' })
    expect(state.video.panelTab).toBe('storyboard')
    await wrapper.get('#video-tab-storyboard').trigger('keydown', { key: 'End' })
    expect(state.video.panelTab).toBe('versions')
    await wrapper.get('#video-tab-versions').trigger('keydown', { key: 'ArrowRight' })
    expect(state.video.panelTab).toBe('preview')
    await preview.trigger('keydown', { key: 'Home' })
    expect(preview.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })
})

// One editor (VIDEO_CLIP_EDITOR_PLAN.md E1): the storyboard's cut is edited in the clip editor, opened on this project.
describe('Edit the cut', () => {
  const take = (id, ms) => ({ attachment_id: id, url: `/${id}.mp4`, version: 1, duration_ms: ms })
  const scenes = rendered => [{ scene_id: 's1', title: 'Hook', planned_ms: 4000, selected_take: take('a', 4000) },
    { scene_id: 's2', title: 'Close', planned_ms: 4000, selected_take: rendered ? take('b', 5000) : null }]
  const mountWith = rendered => {
    state.video = reactive({ versions: [], activeVideo: null, panelTab: 'storyboard', can: {}, sessionImages: [], loadSessionImages: vi.fn(),
      refs: [], project: { project_id: 'p1', title: 'Launch', scenes: scenes(rendered), assets: [], timeline: null }, patchProject: vi.fn() })
    return mount(VideoPanel, { attachTo: document.body, global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } })
  }

  it('opens the clip editor on this project once every scene has a take', () => {
    const w = mountWith(true)
    const link = w.get('[data-test="video-edit-cut"]')
    expect(JSON.parse(link.attributes('data-to'))).toEqual({ path: '/video-studio/editor', query: { project_id: 'p1' } })
    expect(w.find('[data-test="video-export"]').exists()).toBe(false)            // no second timeline screen
    w.unmount()
  })

  it('waits for every take first', () => {
    const w = mountWith(false)
    expect(w.find('[data-test="video-edit-cut"]').exists()).toBe(false)
    expect(w.text()).toContain('Every scene needs a take before the cut can be edited.')
    w.unmount()
  })
})


// Image mode (D14): the Images tab lists what was made in this session; an image goes into a video as its opening
// shot when the video model starts from one, else as a reference, or is saved as an ingredient.
describe('Images tab', () => {
  const img = { attachment_id: 'img-1', url: '/img-1.png', title: 'Candle', media_type: 'image' }
  beforeEach(() => {
    state.video = reactive({
      project: null, versions: [], activeVideo: null, panelTab: 'images', can: { startFrame: true }, refs: [], studioDraft: 'warm light',
      sessionImages: [img], loadSessionImages: vi.fn(), kind: 'image',
      setKind: vi.fn((k) => { state.video.kind = k }),
      addExistingRef: vi.fn((item, role) => state.video.refs.push({ attachment_id: item.attachment_id, role })),
      createIngredient: vi.fn(async () => ({ ingredient_id: 'i1', name: 'Candle' })),
    })
  })

  it('counts the images on the tab and lists each with its two actions', () => {
    const w = mount(VideoPanel)
    expect(w.get('#video-tab-images').text()).toContain('1')
    expect(w.findAll('[data-test="image-result"]')).toHaveLength(1)
    expect(w.find('[data-test="image-use-in-video"]').exists()).toBe(true)
    expect(w.find('[data-test="image-save-ingredient"]').exists()).toBe(true)
    expect(state.video.loadSessionImages).toHaveBeenCalledWith(null)   // no chat yet: the list is cleared
    w.unmount()
  })

  it('Use in video switches to Video and adds the image as the opening shot, keeping the prompt', async () => {
    const heard = vi.fn()
    window.addEventListener('video-compose', heard)
    const w = mount(VideoPanel)
    await w.get('[data-test="image-use-in-video"]').trigger('click')
    expect(state.video.setKind).toHaveBeenCalledWith('video')
    expect(state.video.addExistingRef).toHaveBeenCalledWith(img, 'first_frame')
    expect(heard.mock.calls[0][0].detail.text).toBe('warm light')
    window.removeEventListener('video-compose', heard)
    state.video.can = { startFrame: false }
    await w.get('[data-test="image-use-in-video"]').trigger('click')
    expect(state.video.addExistingRef).toHaveBeenLastCalledWith(img, 'subject')
    w.unmount()
  })

  it('Save as ingredient asks for a name and saves the image as one', async () => {
    const w = mount(VideoPanel)
    await w.get('[data-test="image-save-ingredient"]').trigger('click')
    await w.get('[data-test="image-ing-name"]').setValue('Lavender candle')
    await w.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r, 0))
    expect(state.video.createIngredient).toHaveBeenCalledWith({ kind: 'product', name: 'Lavender candle', description: '',
                                                               attachmentIds: ['img-1'] })
    expect(w.find('[data-test="image-ing-name"]').exists()).toBe(false)
    w.unmount()
  })
})
