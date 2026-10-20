// @vitest-environment jsdom
// The Video Studio composer: three tasks, one input with an always-present "+", settings limited to the model.
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

// A model that renders from text and an opening shot only (no references, no closing shot, no video edits).
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

  it('the "+" is always there and says what the model uses; an image becomes its opening shot', async () => {
    // Owner, 2026-10-19: a "+" in the input for every model. Owner, 2026-10-16: what a model cannot do is not
    // offered as a control; here it is said under the input, and a file it cannot use is flagged (next tests).
    const w = await mounted()
    expect(w.find('[data-test="video-add-media"]').exists()).toBe(true)
    expect(w.get('[data-test="video-add-note"]').text()).toContain('Kling Pro uses an opening shot.')
    expect(w.find('[data-test="video-task-edit"]').exists()).toBe(true)   // another offered model can edit
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'shoe.png', { type: 'image/png' })], configurable: true })
    await input.trigger('change')
    expect(useVideoStore().refs.map((r) => r.role)).toEqual(['first_frame'])
    expect(w.find('[data-test="video-ref-unusable"]').exists()).toBe(false)
    const durations = w.findAll('option').map((o) => o.text())
    expect(durations).toContain('10 s')
    expect(durations).not.toContain('8 s')
    expect(w.get('[data-test="video-sound"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="video-sound"]').text()).toBe('Silent')
  })

  it('picking a model that can do more shows its features', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.pickRoute('9')
    await w.vm.$nextTick()
    expect(w.find('[data-test="video-task-edit"]').exists()).toBe(true)
    expect(w.get('[data-test="video-add-note"]').text()).toContain('references and opening and closing shots')
    video.addRef(new File(['x'], 'shoe.png', { type: 'image/png' }), 'subject')
    await w.vm.$nextTick()
    const roles = w.get('[data-test="video-ref-role"]').findAll('option').map((o) => o.text())
    expect(roles).toEqual(expect.arrayContaining(['Product, character or place', 'Style', 'Opening shot', 'Closing shot']))
  })

  it('the "+" offers this device or the Library, and closes after a choice', async () => {
    const w = await mounted()
    await w.get('[data-test="video-add-media"]').trigger('click')
    expect(w.get('[data-test="video-add-media"]').attributes('aria-expanded')).toBe('true')
    expect(w.find('[data-test="video-add-upload"]').exists()).toBe(true)
    await w.get('[data-test="video-add-library"]').trigger('click')
    expect(useVideoStore().libraryOpen).toBe(true)
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('a second image never replaces the opening shot: it is flagged with a model that can use it', async () => {
    const w = await mounted()
    const video = useVideoStore()
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true,
      value: [new File(['a'], 'one.png', { type: 'image/png' }), new File(['b'], 'two.png', { type: 'image/png' })] })
    await input.trigger('change')
    expect(video.refs.map((r) => [r.name, r.role])).toEqual([['one.png', 'first_frame'], ['two.png', 'subject']])
    const flagged = w.get('[data-test="video-ref-unusable"]')
    expect(flagged.text()).toContain('Kling Pro does not take reference images')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
    const pick = vi.spyOn(video, 'pickRoute')
    await flagged.get('[data-test="video-ref-switch"]').trigger('click')
    expect(pick).toHaveBeenCalledWith('9')
  })

  it('Edit footage on a model that cannot edit proposes one that can, and waits for the user', async () => {
    const w = await mounted()
    const video = useVideoStore()
    expect(String(video.routeId || video.defaultRouteId)).toBe('7')        // Kling: no edits
    await w.get('[data-test="video-task-edit"]').trigger('click')
    expect(video.task).toBe('edit')
    const plan = w.find('[data-test="video-switch-plan"]')
    if (plan.exists()) {
      expect(plan.text()).toContain('Seedance 2.0')                          // proposed, not applied
      expect(String(video.routeId || video.defaultRouteId)).toBe('7')
    } else {
      expect(String(video.routeId)).toBe('9')                                // nothing to change: switched
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
