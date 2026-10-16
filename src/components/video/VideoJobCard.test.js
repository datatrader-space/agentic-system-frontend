// @vitest-environment jsdom
// The job card says what will happen and what it costs before anything is spent.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import api from '../../services/api'
import VideoJobCard from './VideoJobCard.vue'

const base = {
  job_id: 'j1', operation: 'generate', model: 'kwaivgi/kling-v3.0-pro', conversation_id: 'c1',
  created_at: '2026-10-15T10:00:00Z', effective_config: { prompt: 'a shoe', duration: 10, aspect_ratio: '16:9' },
  references: [{ attachment_id: 'a', role: 'subject' }],
}

describe('VideoJobCard', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('an estimate shows the price and the changes to accept, and Generate starts it', async () => {
    const job = { ...base, state: 'awaiting_authorization',
                  quote: { estimate_usd: '1.120000', max_usd: '1.120000', pricing_status: 'exact',
                           adjustments: [{ field: 'duration', requested: 12, proposed: 10, reason: 'renders 3-10 s' }] } }
    api.post.mockResolvedValue({ data: { ...job, state: 'queued' } })
    const w = mount(VideoJobCard, { props: { job } })
    expect(w.text()).toContain('$1.12')
    expect(w.text()).toContain('Length')
    expect(w.text()).toContain('12 → 10')
    await w.find('[data-test="video-generate"]').trigger('click')
    expect(api.post).toHaveBeenCalledWith('/video/jobs/j1/start/', { accept: true })
  })

  it('an unknown price says so and names the hold', () => {
    const job = { ...base, state: 'awaiting_authorization',
                  quote: { estimate_usd: '0', max_usd: '2.000000', pricing_status: 'unknown', adjustments: [] } }
    const w = mount(VideoJobCard, { props: { job } })
    expect(w.text()).toContain('publishes no price')
    expect(w.text()).toContain('$2.00')
  })

  it('a render in flight shows its phase and offers Stop waiting, never a percentage', () => {
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'running', phase: 'Rendering' } } })
    expect(w.text()).toContain('Rendering')
    expect(w.text()).not.toMatch(/\d+%/)
    expect(w.text()).toContain('Stop waiting')
  })

  it('an uncertain submission says it was not resent', () => {
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'submission_uncertain', phase: 'Checking' } } })
    expect(w.text()).toContain('NOT sent again')
  })

  it('a failure shows the reason', () => {
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'failed', error: { message: 'Monthly limit reached.' } } } })
    expect(w.find('[role="alert"]').text()).toContain('Monthly limit reached.')
  })
})
