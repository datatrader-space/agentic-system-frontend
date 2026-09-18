// @vitest-environment jsdom
//
// The two panels that close the learning plane's measurement gaps:
//
//   * HOLDOUT — injection used to be unmeasured. Advisories reached every matching turn and nothing
//     compared outcomes against not receiving them, so the platform could promote an instinct that
//     made the agent worse. The API now reports a control arm; this is the surface that shows it.
//   * REVIEW  — nothing sampled what the extractor produced, so a regression in its prompt would
//     have stayed invisible. A verdict here becomes ordinary evidence (correction / contradiction).
//
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const get = vi.fn()
const post = vi.fn()
vi.mock('../../services/api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a), patch: vi.fn() } }))

const success = vi.fn()
const error = vi.fn()
vi.mock('@/composables/useNotify', () => ({ notify: { success: (...a) => success(...a), error: (...a) => error(...a) } }))
vi.mock('@iconify/vue', () => ({ Icon: { template: '<i />' } }))

import AdminLearningMonitor from './AdminLearningMonitor.vue'

const HARMFUL = {
  instinct_id: 'always-grep-first--agent-4',
  injected_n: 40, injected_success_rate: 0.40,
  held_out_n: 40, held_out_success_rate: 0.90,
  delta: -0.5, conclusive: true,
}
const HELPFUL = {
  instinct_id: 'migrations-before-seed--agent-4',
  injected_n: 30, injected_success_rate: 0.93,
  held_out_n: 25, held_out_success_rate: 0.72,
  delta: 0.21, conclusive: true,
}

function snapshot(overrides = {}) {
  return {
    window_days: 7,
    runs: { total: 3, by_status: { reviewed: 3 }, by_skip_reason: {}, recent: [], errors: [], by_agent: [] },
    memory: { available: true, added: [], corrections: [], topics: [] },
    instincts: {
      available: true, total: 2, by_status: {}, by_domain: {}, multi_run_evidence: 2, recent: [],
      holdout: { percent: 10, conclusive: [HELPFUL, HARMFUL], accumulating: 5, harmful: [HARMFUL] },
      review_queue: [{
        id: 'migrations-before-seed--agent-4', trigger: 'seeding a catalog after a schema change',
        action: 'Run migrations before seeding data.', domain: 'coding', scope: 'agent',
        confidence: 0.74, runs: 6, at: '2026-09-18T10:00:00Z',
      }],
      ...(overrides.instincts || {}),
    },
    cost: { calls: 0, total_cost_usd: 0, by_model: {} },
    schedule: { interval_seconds: 600, enabled: true },
    scope: {},
  }
}

async function mountWith(snap) {
  get.mockImplementation((url) => {
    if (String(url).includes('/scope/')) return Promise.resolve({ data: { agents: [], conversations: [] } })
    return Promise.resolve({ data: snap })
  })
  const w = mount(AdminLearningMonitor)
  await flushPromises()
  return w
}

beforeEach(() => {
  get.mockReset(); post.mockReset(); success.mockReset(); error.mockReset()
})

describe('AdminLearningMonitor — holdout panel', () => {
  it('reports both arms and the delta for a conclusive instinct', async () => {
    const w = await mountWith(snapshot())
    w.vm.tab = 'holdout'
    await flushPromises()

    const text = w.text()
    expect(text).toContain('migrations-before-seed--agent-4')
    expect(text).toContain('93%')      // with advice
    expect(text).toContain('72%')      // held out
    expect(text).toContain('+21 pts')
  })

  it('warns loudly when an instinct is measured harmful', async () => {
    const w = await mountWith(snapshot())
    w.vm.tab = 'holdout'
    await flushPromises()

    expect(w.find('.harm-banner').exists()).toBe(true)
    expect(w.text()).toContain('1 instinct measured harmful')
    expect(w.text()).toContain('-50 pts')
  })

  it('says how many are still accumulating rather than showing an empty table', async () => {
    const w = await mountWith(snapshot({
      instincts: { holdout: { percent: 10, conclusive: [], accumulating: 12, harmful: [] }, review_queue: [] },
    }))
    w.vm.tab = 'holdout'
    await flushPromises()

    expect(w.find('.empty-state').exists()).toBe(true)
    expect(w.text()).toContain('12 instincts still')
    expect(w.text()).toContain('20 runs on each side')
  })
})

describe('AdminLearningMonitor — review queue', () => {
  it('offers a verdict on each unreviewed instinct', async () => {
    const w = await mountWith(snapshot())
    w.vm.tab = 'review'
    await flushPromises()

    const buttons = w.findAll('.review-actions button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toContain('Good')
    expect(buttons[1].text()).toContain('Not useful')
  })

  it('posts the verdict and drops the instinct from the queue', async () => {
    post.mockResolvedValue({ data: { instinct_id: 'migrations-before-seed--agent-4', confidence: 0.81 } })
    const w = await mountWith(snapshot())
    w.vm.tab = 'review'
    await flushPromises()

    await w.findAll('.review-actions button')[0].trigger('click')
    await flushPromises()

    expect(post).toHaveBeenCalledWith('/admin/observability/learning/review/', {
      instinct_id: 'migrations-before-seed--agent-4', verdict: 'good',
    })
    expect(success).toHaveBeenCalled()
    expect(w.vm.reviewQueue).toHaveLength(0)
  })

  it('sends "bad" for a rejection — which the backend records as a verified contradiction', async () => {
    post.mockResolvedValue({ data: { confidence: 0.31 } })
    const w = await mountWith(snapshot())
    w.vm.tab = 'review'
    await flushPromises()

    await w.findAll('.review-actions button')[1].trigger('click')
    await flushPromises()

    expect(post.mock.calls[0][1].verdict).toBe('bad')
  })

  it('keeps the instinct in the queue when the verdict could not be recorded', async () => {
    post.mockRejectedValue({ response: { data: { detail: 'nope' } } })
    const w = await mountWith(snapshot())
    w.vm.tab = 'review'
    await flushPromises()

    await w.findAll('.review-actions button')[0].trigger('click')
    await flushPromises()

    expect(error).toHaveBeenCalledWith('nope')
    expect(w.vm.reviewQueue).toHaveLength(1)
  })

  it('shows a clean empty state once everything has been judged', async () => {
    const w = await mountWith(snapshot({
      instincts: { holdout: { percent: 10, conclusive: [], accumulating: 0, harmful: [] }, review_queue: [] },
    }))
    w.vm.tab = 'review'
    await flushPromises()

    expect(w.find('.review-actions').exists()).toBe(false)
    expect(w.text()).toContain('Nothing waiting for review')
  })
})
