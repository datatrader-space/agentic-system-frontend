// @vitest-environment jsdom
// The job card says what will happen and what it costs before anything is spent.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

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
    const job = { ...base, state: 'awaiting_authorization', allowed_actions: ['start', 'decline'],
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

  it('the price is an estimate and never a ceiling: the provider bills the final price (owner, 2026-11-03)', () => {
    const ranged = { ...base, state: 'awaiting_authorization',
                     quote: { estimate_usd: '0.30', max_usd: '0.50', pricing_status: 'range', adjustments: [] } }
    let w = mount(VideoJobCard, { props: { job: ranged } })
    expect(w.find('.vjc-price').text()).toBe('About $0.30, an estimate: you pay what the provider bills.')
    expect(w.text()).not.toContain('at most')
    w.unmount()
    const unknown = { ...base, state: 'awaiting_authorization',
                      quote: { estimate_usd: '0', max_usd: '2.000000', pricing_status: 'unknown', adjustments: [] } }
    w = mount(VideoJobCard, { props: { job: unknown } })
    expect(w.find('.vjc-price').text()).toBe(
      'The provider publishes no price for this request; $2.00 is held and you pay what the provider bills.')
    w.unmount()
  })

  it('a media job is titled by what it makes and shows the model by the name the picker used', () => {
    const speech = { ...base, operation: 'speech', modality: 'audio', model: 'eleven_flash_v2', model_name: 'Eleven Flash v2',
                     state: 'ready', effective_config: { prompt: 'Welcome' }, references: [], actual_cost_usd: '0.002320' }
    const w = mount(VideoJobCard, { props: { job: speech } })
    expect(w.find('.vjc-op').text()).toBe('Speech')
    expect(w.find('.vjc-model').text()).toBe('Eleven Flash v2')
    // An operation the card does not name yet takes the kind of thing it makes, never "Video" for a sound.
    const later = mount(VideoJobCard, { props: { job: { ...speech, operation: 'something_new', model_name: undefined } } })
    expect(later.find('.vjc-op').text()).toBe('Audio')
    expect(later.find('.vjc-model').text()).toBe('eleven_flash_v2')
  })

  it('a finished picture is described by what was asked for, not as a saved frame', () => {
    // 2026-10-27: a Characters portrait was announced to screen readers as "Saved frame".
    const portrait = { ...base, operation: 'image', modality: 'image', state: 'ready', references: [],
                       effective_config: { prompt: 'photorealistic portrait of an adult person' },
                       output: { attachment_id: 'a1', url: '/media/p.png' } }
    const w = mount(VideoJobCard, { props: { job: portrait } })
    expect(w.find('img').attributes('alt')).toBe('photorealistic portrait of an adult person')
    const frame = mount(VideoJobCard, { props: { job: { ...portrait, operation: 'frame', modality: undefined } } })
    expect(frame.find('img').attributes('alt')).toBe('Saved frame')
  })

  it('an unknown price says so and names the hold', () => {
    const job = { ...base, state: 'awaiting_authorization',
                  quote: { estimate_usd: '0', max_usd: '2.000000', pricing_status: 'unknown', adjustments: [] } }
    const w = mount(VideoJobCard, { props: { job } })
    expect(w.text()).toContain('publishes no price')
    expect(w.text()).toContain('$2.00')
  })

  it('a render in flight shows its phase and offers Stop waiting only when the server allows it, never a percentage', async () => {
    api.post.mockResolvedValue({ data: { ...base, state: 'cancelled', allowed_actions: [] } })
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'running', phase: 'Rendering', allowed_actions: ['stop'] } } })
    expect(w.text()).toContain('Rendering')
    expect(w.text()).not.toMatch(/\d+%/)
    await w.find('[data-test="video-stop"]').trigger('click')
    expect(api.post).toHaveBeenCalledWith('/video/jobs/j1/stop/')
    // The same render with no allowed action (a free local edit, or one the server can no longer stop): no Stop.
    const local = mount(VideoJobCard, { props: { job: { ...base, operation: 'trim', state: 'running', phase: 'Rendering', allowed_actions: [] } } })
    expect(local.find('[data-test="video-stop"]').exists()).toBe(false)
    // A paid render whose payload names no actions offers none either (fail closed).
    const unnamed = mount(VideoJobCard, { props: { job: { ...base, state: 'running', phase: 'Rendering' } } })
    expect(unnamed.text()).not.toContain('Stop waiting')
  })

  it('an estimate shows only the buttons the server allows', () => {
    const quote = { estimate_usd: '0.12', max_usd: '0.12', pricing_status: 'exact', adjustments: [] }
    const both = mount(VideoJobCard, { props: { job: { ...base, state: 'awaiting_authorization', quote, allowed_actions: ['start', 'decline'] } } })
    expect(both.find('[data-test="video-generate"]').exists()).toBe(true)
    expect(both.find('[data-test="video-decline"]').exists()).toBe(true)
    const declineOnly = mount(VideoJobCard, { props: { job: { ...base, state: 'awaiting_authorization', quote, allowed_actions: ['decline'] } } })
    expect(declineOnly.find('[data-test="video-generate"]').exists()).toBe(false)
    expect(declineOnly.find('[data-test="video-decline"]').exists()).toBe(true)
    const none = mount(VideoJobCard, { props: { job: { ...base, state: 'awaiting_authorization', quote, allowed_actions: [] } } })
    expect(none.findAll('button')).toHaveLength(0)
  })

  it('a finished job offers no Retry and no server action; another allowed action posts to its own address', async () => {
    const done = mount(VideoJobCard, { props: { job: { ...base, state: 'failed', error: { message: 'No.' }, allowed_actions: [] } } })
    expect(done.text()).not.toMatch(/Retry|Try again|Generate|Stop waiting/)
    api.post.mockResolvedValue({ data: { ...base, state: 'queued', allowed_actions: [] } })
    const other = mount(VideoJobCard, { props: { job: { ...base, state: 'queued', allowed_actions: ['cancel_hold', '../evil'] } } })
    const buttons = other.find('[data-test="video-job-other-actions"]').findAll('button')
    expect(buttons.map(b => b.text())).toEqual(['Cancel hold'])
    await buttons[0].trigger('click')
    expect(api.post).toHaveBeenCalledWith('/video/jobs/j1/cancel_hold/', {})
  })

  it('shows the other pictures of one request beside the first', async () => {
    const job = { ...base, operation: 'image', modality: 'image', state: 'ready', references: [], allowed_actions: [],
                  output: { attachment_id: 'p1', url: '/p1.png', thumbnail_url: '/api/library/p1/thumbnail/' },
                  extra_outputs: [{ attachment_id: 'p2', role: 'output', url: '/p2.png', version: 1, thumbnail_url: '/api/library/p2/thumbnail/' },
                                  { attachment_id: 'p3', role: 'output', url: '/p3.png', version: 1, thumbnail_url: '/api/library/p3/thumbnail/' }] }
    const w = mount(VideoJobCard, { props: { job, inStudio: true } })
    const extras = w.find('[data-test="video-job-extras"]')
    expect(extras.findAll('img').map(i => i.attributes('src'))).toEqual(['/api/library/p2/thumbnail/', '/api/library/p3/thumbnail/'])
    await extras.findAll('button')[1].trigger('click')
    expect(w.emitted('open')).toEqual([[2]])
    // Outside the Studio each one opens the full file.
    const out = mount(VideoJobCard, { props: { job } })
    expect(out.find('[data-test="video-job-extras"] a').attributes('href')).toBe('/p2.png')
  })

  it('an uncertain submission says it was not resent', () => {
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'submission_uncertain', phase: 'Checking' } } })
    expect(w.text()).toContain('NOT sent again')
  })

  it('an expired estimate says so and offers a new one instead of a Generate that can only fail', async () => {
    // Live test 2026-10-16: Generate on a 15-minute-old estimate was refused ("This estimate has expired").
    const job = { ...base, state: 'awaiting_authorization', allowed_actions: ['start', 'decline'],
                  quote: { estimate_usd: '0.12', max_usd: '0.12', pricing_status: 'exact', adjustments: [],
                           expires_at: '2020-01-01T00:00:00Z' } }
    api.post.mockResolvedValue({ data: { ...job, state: 'cancelled' } })
    const heard = []
    const onCompose = (e) => heard.push(e.detail.text)
    window.addEventListener('video-compose', onCompose)
    const w = mount(VideoJobCard, { props: { job } })
    expect(w.find('[data-test="video-generate"]').exists()).toBe(false)
    expect(w.find('[data-test="video-estimate-expired"]').exists()).toBe(true)
    await w.find('[data-test="video-reestimate"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('video-compose', onCompose)
    expect(api.post).toHaveBeenCalledWith('/video/jobs/j1/decline/')
    expect(heard).toEqual(['a shoe'])
  })

  it('a fresh estimate keeps its Generate button', () => {
    const job = { ...base, state: 'awaiting_authorization', allowed_actions: ['start', 'decline'],
                  quote: { estimate_usd: '0.12', max_usd: '0.12', pricing_status: 'exact', adjustments: [],
                           expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() } }
    const w = mount(VideoJobCard, { props: { job } })
    expect(w.find('[data-test="video-generate"]').exists()).toBe(true)
  })

  it('a price under ten cents keeps a third digit only when it has one', () => {
    const at = usd => mount(VideoJobCard, { props: { job: { ...base, state: 'ready', actual_cost_usd: usd, output: { attachment_id: 'o', url: '/o.mp4' } } } }).text()
    expect(at('0.090000')).toContain('Cost $0.09')
    expect(at('0.090000')).not.toContain('$0.090')
    expect(at('0.038731')).toContain('Cost $0.039')
    expect(at('0.002000')).toContain('Cost $0.002')
    expect(at('0.560000')).toContain('Cost $0.56')
  })

  it('a failure shows the reason', () => {
    const w = mount(VideoJobCard, { props: { job: { ...base, state: 'failed', error: { message: 'Monthly limit reached.' } } } })
    expect(w.find('[role="alert"]').text()).toContain('Monthly limit reached.')
  })
})


it('opens a completed result in the dedicated studio with its conversation', async () => {
  setActivePinia(createPinia())
  const wrapper = mount(VideoJobCard, { props: { job: { ...base, state: 'ready', output: { attachment_id: 'out', url: '/clip.mp4' } } } })
  await wrapper.findAll('button').find((b) => b.text() === 'Open in Video Studio').trigger('click')
  expect(push).toHaveBeenCalledWith({ path: '/video-studio', query: { conversation: 'c1' } })
  wrapper.unmount()
})
