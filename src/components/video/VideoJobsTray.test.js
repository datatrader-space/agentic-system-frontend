// @vitest-environment jsdom
// The job tray above the box: open work and failures, but a failure is superseded once a newer job starts in the same
// chat (owner, 2026-10-20: a refused render's card stayed after the retry had rendered).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import VideoJobsTray from './VideoJobsTray.vue'
import { useVideoStore } from '../../stores/useVideoStore'

const job = (id, state, at, over = {}) => ({ job_id: id, state, operation: 'generate', conversation_id: 'c1',
                                             created_at: at, error_message: 'Key limit exceeded', ...over })

describe('VideoJobsTray', () => {
  let video
  beforeEach(() => { setActivePinia(createPinia()); video = useVideoStore() })
  const ids = (w) => w.findAll('[data-test^="video-job-"]').map((c) => c.attributes('data-test'))

  it('keeps a failure in view until a newer job starts in the chat', async () => {
    video._put(job('a', 'failed', '2026-10-20T12:20:00Z'))
    const w = mount(VideoJobsTray, { props: { conversationId: 'c1' } })
    expect(ids(w)).toEqual(['video-job-failed'])
    video._put(job('b', 'awaiting_authorization', '2026-10-20T12:31:00Z'))
    await w.vm.$nextTick()
    expect(ids(w)).toEqual(['video-job-awaiting_authorization'])
    video._put(job('b', 'ready', '2026-10-20T12:31:00Z'))
    await w.vm.$nextTick()
    expect(w.find('[data-test="video-jobs-tray"]').exists()).toBe(false)     // the result is in the chat
  })

  it('announces a music job as audio, never as a video', async () => {
    video._put(job('m', 'awaiting_authorization', '2026-10-27T12:00:00Z', { operation: 'music', modality: 'audio' }))
    const w = mount(VideoJobsTray, { props: { conversationId: 'c1' } })
    video._put(job('m', 'running', '2026-10-27T12:00:00Z', { operation: 'music', modality: 'audio', phase: 'rendering' }))
    await w.vm.$nextTick()
    expect(w.find('[role="status"]').text()).toBe('Audio: rendering.')
  })

  it('a failure after the newest job still shows', async () => {
    video._put(job('a', 'ready', '2026-10-20T12:00:00Z'))
    video._put(job('b', 'failed', '2026-10-20T12:30:00Z'))
    const w = mount(VideoJobsTray, { props: { conversationId: 'c1' } })
    expect(ids(w)).toEqual(['video-job-failed'])
  })
})
