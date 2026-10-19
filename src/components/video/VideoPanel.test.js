// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { video: null } }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: null }) }))
vi.mock('../../services/api', () => ({ default: { getConversationMedia: vi.fn() } }))
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
