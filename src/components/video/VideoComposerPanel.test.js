// @vitest-environment jsdom
// Video mode in the composer: three tasks, role-tagged reference slots, settings limited to the model.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../../stores/useChatStore', () => ({
  useChatStore: () => ({ selectedAgentId: 5, conversationId: null, ensureConversation: vi.fn() }),
}))

import api from '../../services/api'
import VideoComposerPanel from './VideoComposerPanel.vue'
import { useVideoStore } from '../../stores/useVideoStore'

// A model that renders from text and a start frame only (no references, no end frame, no video edits).
const ROUTE = {
  route_id: 7, model_id: 'kwaivgi/kling-v3.0-pro', name: 'Kling Pro', via: 'openrouter', state: 'active',
  connections: [{ route_id: 7 }], offered: ['text_to_video', 'image_to_video'],
  outputs: { durations: [5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false },
}
// A model that also takes references, start + end frames and edits uploaded video.
const FULL = {
  ...ROUTE, route_id: 9, model_id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', connections: [{ route_id: 9 }],
  offered: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video', 'edit_uploaded'],
}

async function mounted(draft = 'a shoe') {
  const w = mount(VideoComposerPanel, { props: { draft } })
  await new Promise((r) => setTimeout(r, 0))
  await w.vm.$nextTick()
  return w
}

describe('VideoComposerPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { routes: [ROUTE, FULL], default_route_id: 7 } })
  })

  it('shows Story video beside Quick clip, and switches between them', async () => {
    const w = await mounted('')
    await w.find('[data-test="video-task-story"]').trigger('click')
    expect(useVideoStore().task).toBe('story')
    expect(w.find('[data-test="video-estimate"]').text()).toContain('Plan the story')
  })

  it('lets keyboard users choose the next workflow', async () => {
    const w = await mounted('')
    await w.find('[data-test="video-task-quick"]').trigger('keydown', { key: 'ArrowRight' })
    expect(useVideoStore().task).toBe('story')
    expect(w.find('[data-test="video-task-story"]').attributes('tabindex')).toBe('0')
    w.unmount()
  })

  it('a model without references, end frame or video edits shows none of them', async () => {
    // Owner, 2026-10-16: show only what the selected model can do, so nobody is offered a dead control.
    const w = await mounted()
    expect(w.find('[data-test="video-slot-first_frame"]').exists()).toBe(true)
    expect(w.find('[data-test="video-slot-subject"]').exists()).toBe(false)
    expect(w.find('[data-test="video-slot-style"]').exists()).toBe(false)
    expect(w.find('[data-test="video-slot-last_frame"]').exists()).toBe(false)
    expect(w.find('[data-test="video-task-edit"]').exists()).toBe(false)
    const durations = w.findAll('option').map((o) => o.text())
    expect(durations).toContain('10 s')
    expect(durations).not.toContain('8 s')
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
  })

  it('picking a model that can do more shows its features', async () => {
    const w = await mounted()
    useVideoStore().pickRoute('9')
    await w.vm.$nextTick()
    for (const t of ['video-slot-subject', 'video-slot-first_frame', 'video-slot-last_frame', 'video-slot-style',
                     'video-task-edit']) {
      expect(w.find(`[data-test="${t}"]`).exists()).toBe(true)
    }
  })

  it('switching to a model that cannot edit shows what changes and waits for the user', async () => {
    // Owner review 2026-10-19: never switched behind the user — the plan is shown, nothing moves until applied.
    const w = await mounted()
    const video = useVideoStore()
    video.pickRoute('9')
    await w.vm.$nextTick()
    video.setTask('edit')
    video.pickRoute('7')
    await w.vm.$nextTick()
    expect(video.task).toBe('edit')
    const plan = w.find('[data-test="video-switch-plan"]')
    expect(plan.exists()).toBe(true)
    expect(plan.text()).toContain('cannot edit footage')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="video-switch-keep"]').trigger('click')
    expect(video.task).toBe('edit')
    expect(String(video.routeId)).toBe('9')
    video.pickRoute('7')
    await w.vm.$nextTick()
    await w.find('[data-test="video-switch-apply"]').trigger('click')
    expect(video.task).toBe('quick')
    expect(String(video.routeId)).toBe('7')
  })

  it('a reference the model cannot use stays on screen, flagged', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.addRef(new File(['x'], 'look.png', { type: 'image/png' }), 'style')
    await w.vm.$nextTick()
    const chip = w.find('[data-test="video-ref-unusable"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('does not take style references')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
  })

  it('nothing to estimate without a description', () => {
    const w = mount(VideoComposerPanel, { props: { draft: '' } })
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
  })
})


describe('studio project preparation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.get.mockResolvedValue({ data: { routes: [ROUTE], default_route_id: 7 } })
  })
  it('does not request a render estimate if the project could not be created', async () => {
    const video = useVideoStore()
    vi.spyOn(video, 'createProject').mockResolvedValue(null)
    const request = vi.spyOn(video, 'request')
    const wrapper = mount(VideoComposerPanel, { props: { draft: 'Product reveal', ensureProject: true } })
    await wrapper.get('[data-test="video-estimate"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.emitted('done')).toBeUndefined()
    wrapper.unmount()
  })
  it('saves quick clips as projects before requesting an estimate', async () => {
    const video = useVideoStore()
    const project = vi.spyOn(video, 'createProject').mockResolvedValue({ project_id: 'p1' })
    const request = vi.spyOn(video, 'request').mockResolvedValue(true)
    const wrapper = mount(VideoComposerPanel, { props: { draft: 'Product reveal', ensureProject: true } })
    await wrapper.get('[data-test="video-estimate"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(project).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Product reveal' }))
    expect(project.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0])
    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })
})
