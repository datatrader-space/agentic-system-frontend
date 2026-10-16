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

const ROUTE = {
  route_id: 7, model_id: 'kwaivgi/kling-v3.0-pro', name: 'Kling Pro', via: 'openrouter', state: 'active',
  connections: [{ route_id: 7 }],
  outputs: { durations: [5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false,
             frame_roles: ['first_frame'] },
}

describe('VideoComposerPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { routes: [ROUTE], default_route_id: 7 } })
  })

  it('shows the three tasks and switches between them', async () => {
    const w = mount(VideoComposerPanel, { props: { draft: '' } })
    expect(w.findAll('[role="radio"]').map((b) => b.text())).toEqual([
      expect.stringContaining('Quick clip'), expect.stringContaining('Story video'), expect.stringContaining('Edit footage')])
    await w.find('[data-test="video-task-story"]').trigger('click')
    expect(useVideoStore().task).toBe('story')
    expect(w.find('[data-test="video-estimate"]').text()).toContain('Plan the story')
  })

  it('offers only the model\'s values and disables what it cannot do', async () => {
    const w = mount(VideoComposerPanel, { props: { draft: 'a shoe' } })
    await new Promise((r) => setTimeout(r, 0))
    await w.vm.$nextTick()
    const durations = w.findAll('option').map((o) => o.text())
    expect(durations).toContain('10 s')
    expect(durations).not.toContain('8 s')
    expect(w.find('[data-test="video-slot-last_frame"]').attributes('disabled')).toBeDefined()
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
  })

  it('nothing to estimate without a description', () => {
    const w = mount(VideoComposerPanel, { props: { draft: '' } })
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
  })
})
