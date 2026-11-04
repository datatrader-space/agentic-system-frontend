// @vitest-environment jsdom
// The storyboard plan card (ADM-1146 built the backend, ADM-1170 the screen): one Generate for every scene, the total
// and the most it can charge, and the scene jobs shown inside it, never as cards with their own Generate.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import api from '../../services/api'
import VideoPlanCard from './VideoPlanCard.vue'
import VideoJobsTray from './VideoJobsTray.vue'
import { useVideoStore } from '../../stores/useVideoStore'

const scene = (i, over = {}) => ({ scene_id: `s${i}`, order: i, title: `Scene ${i + 1}`, intent: '', planned_ms: 5000,
  continues_previous: false, job_id: `j${i}`, state: 'awaiting_authorization', phase: '', estimate_usd: '0.50', output: null, held: '', ...over })
const plan = (over = {}) => ({ plan_id: 'p1', state: 'waiting', conversation_id: 'c1', scenes: [scene(0), scene(1), scene(2)],
  estimate_usd: '1.50', max_usd: '2.10', allowed_actions: ['start', 'decline'], created_at: '2026-11-04T10:00:00Z', ...over })

describe('VideoPlanCard', () => {
  let video
  beforeEach(() => { setActivePinia(createPinia()); video = useVideoStore(); vi.clearAllMocks() })

  it('shows every scene, the total and the most, and starts all scenes with one Generate', async () => {
    api.post.mockResolvedValue({ data: plan({ state: 'approved', allowed_actions: ['stop'] }) })
    video._putPlan(plan())
    const w = mount(VideoPlanCard, { props: { plan: video.plans.p1 } })
    expect(w.findAll('.vpc-scene')).toHaveLength(3)
    expect(w.get('[data-test="video-plan-total"]').text()).toBe('About $1.50 in all, at most $2.10.')
    expect(w.text()).toContain('Nothing is spent until you press Generate')
    await w.get('[data-test="video-plan-start"]').trigger('click'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/plans/p1/start/', {})
    expect(video.plans.p1.state).toBe('approved')
  })

  it('offers only the actions the server allows', async () => {
    const w = mount(VideoPlanCard, { props: { plan: plan({ state: 'done', allowed_actions: [], actual_cost_usd: '1.44' }) } })
    expect(w.find('[data-test="video-plan-start"]').exists()).toBe(false)
    expect(w.find('[data-test="video-plan-stop"]').exists()).toBe(false)
    expect(w.get('[data-test="video-plan-total"]').text()).toBe('Cost $1.44.')
    await w.setProps({ plan: plan({ state: 'approved', allowed_actions: ['stop'], scenes: [scene(0, { state: 'ready' }), scene(1, { state: 'running', phase: 'Rendering' })] }) })
    expect(w.text()).toContain('Making 1 of 2')
    expect(w.text()).toContain('Rendering')
    expect(w.find('[data-test="video-plan-stop"]').exists()).toBe(true)
  })
})

describe('VideoJobsTray with a plan', () => {
  let video
  beforeEach(() => { setActivePinia(createPinia()); video = useVideoStore(); vi.clearAllMocks() })

  it("shows a waiting plan as one card and not its scenes' own Generate cards", () => {
    video._putPlan(plan())
    for (const i of [0, 1, 2]) video._put({ job_id: `j${i}`, plan_id: 'p1', state: 'awaiting_authorization', operation: 'generate', conversation_id: 'c1', created_at: `2026-11-04T10:00:0${i}Z` })
    video._put({ job_id: 'other', state: 'awaiting_authorization', operation: 'image', conversation_id: 'c1', created_at: '2026-11-04T10:01:00Z' })
    const w = mount(VideoJobsTray, { props: { conversationId: 'c1' }, global: { stubs: { VideoJobCard: { props: ['job'], template: '<div class="card">{{ job.job_id }}</div>' } } } })
    expect(w.findAll('[data-test="video-plan-waiting"]')).toHaveLength(1)
    expect(w.findAll('.card').map(c => c.text())).toEqual(['other'])
  })

  it('reads the plans of a conversation it opens, and mirrors a plan frame', async () => {
    api.get.mockImplementation(url => Promise.resolve({ data: url === '/video/plans/' ? { plans: [plan()] } : { jobs: [], has_more: false } }))
    await video.loadJobs('c1'); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/plans/', { params: { conversation_id: 'c1' } })
    expect(video.plansFor('c1').map(p => p.plan_id)).toEqual(['p1'])
    video.onPlanFrame({ plan_id: 'p1', state: 'done', allowed_actions: [] })
    expect(video.plans.p1.state).toBe('done')
  })
})
