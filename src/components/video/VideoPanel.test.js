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

// Owner review 2026-10-19: the finishing controls reach the exported cut. Trims, captions and music are saved
// as a timeline revision, and Export renders that revision (not just a list of aspect ratios).
describe('Timeline and export', () => {
  const take = (id, ms) => ({ attachment_id: id, url: `/${id}.mp4`, version: 1, duration_ms: ms })
  beforeEach(() => {
    state.video = reactive({
      versions: [], activeVideo: null, panelTab: 'storyboard', can: {}, sessionImages: [], loadSessionImages: vi.fn(), refs: [],
      project: { project_id: 'p1', title: 'Launch', scenes: [
        { scene_id: 's1', title: 'Hook', planned_ms: 4000, selected_take: take('a', 4000) },
        { scene_id: 's2', title: 'Close', planned_ms: 4000, selected_take: take('b', 5000) }],
      assets: [{ asset_id: 1, role: 'music', media_type: 'audio', attachment_id: 'song-1', url: '/s.mp3' }],
      timeline: null },
      saveTimeline: vi.fn(async (edl) => {
        state.video.project.timeline = { revision: 2, revision_id: 77, edl }
        return state.video.project.timeline
      }),
      exportTimeline: vi.fn(async () => ({ job_id: 'e1' })),
      patchProject: vi.fn(),
    })
  })

  it('export saves the edited cut first and renders that revision', async () => {
    const w = mount(VideoPanel, { attachTo: document.body })
    const ends = w.findAll('[aria-label$="end in seconds"]')
    await ends[0].setValue('2.5')
    await ends[0].trigger('change')
    await w.get('[data-test="video-tl-add-caption"]').trigger('click')
    await w.get('[aria-label="Caption 1 text"]').setValue('Only $4.50')
    await w.get('[aria-label="Caption 1 text"]').trigger('change')
    await w.get('[data-test="video-tl-music"]').setValue('song-1')
    await w.get('[data-test="video-export"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const edl = state.video.saveTimeline.mock.calls[0][0]
    expect(edl.tracks[0].clips).toEqual([{ scene_id: 's1', out_ms: 2500 }, { scene_id: 's2' }])
    expect(edl.tracks.find((t) => t.kind === 'text').cues[0]).toMatchObject({ text: 'Only $4.50', start_ms: 0 })
    expect(edl.tracks.find((t) => t.kind === 'audio').clips[0]).toMatchObject({ attachment_id: 'song-1', duck: true })
    expect(state.video.exportTimeline).toHaveBeenCalledWith(['16:9'], expect.objectContaining({ revisionId: 77 }))
    w.unmount()
  })

  it('a trim past the end of its take is refused before anything is saved', async () => {
    const w = mount(VideoPanel, { attachTo: document.body })
    const ends = w.findAll('[aria-label$="end in seconds"]')
    await ends[0].setValue('9')
    await ends[0].trigger('change')
    expect(w.text()).toContain('the take is only 4 s long')
    expect(w.get('[data-test="video-export"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="video-export"]').trigger('click')
    expect(state.video.saveTimeline).not.toHaveBeenCalled()
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
