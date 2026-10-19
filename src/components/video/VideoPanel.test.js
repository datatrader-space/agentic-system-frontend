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
    state.video = reactive({ project: null, versions: [], activeVideo: null, panelTab: 'preview', can: {} })
  })

  it('supports arrow, Home and End keys and associates tabs with their panels', async () => {
    const wrapper = mount(VideoPanel, { attachTo: document.body })
    const preview = wrapper.get('#video-tab-preview')
    expect(preview.attributes('aria-controls')).toBe('video-pane-preview')
    await preview.trigger('keydown', { key: 'ArrowRight' })
    expect(state.video.panelTab).toBe('storyboard')
    expect(document.activeElement.id).toBe('video-tab-storyboard')
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
      versions: [], activeVideo: null, panelTab: 'storyboard', can: {},
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
