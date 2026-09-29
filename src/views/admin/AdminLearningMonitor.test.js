// @vitest-environment jsdom
//
// THE LEARNING MONITOR — is each agent learning?
//
// Overview and Agents read outcomes from /admin/observability/learning/agents/: runs by how they ended, the
// agent's own mistakes apart from the environment's, warned mistakes repeated, a trend with its reasons.
// Memory, Practices and Pipeline keep what the page always had — and two panels that close measurement gaps:
//   * HOLDOUT — whether a learned practice helps, against conversations held out from it.
//   * REVIEW  — a person's verdict on what the learner produced becomes ordinary evidence.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const get = vi.fn()
const post = vi.fn()
const patch = vi.fn()
vi.mock('../../services/api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a), patch: (...a) => patch(...a) } }))

const success = vi.fn()
const error = vi.fn()
vi.mock('@/composables/useNotify', () => ({ notify: { success: (...a) => success(...a), error: (...a) => error(...a) } }))
vi.mock('@iconify/vue', () => ({ Icon: { template: '<i />' } }))
// jsdom has no canvas; the charts are Chart.js's to draw, the data handed to them is ours to check.
vi.mock('vue-chartjs', () => ({
  Bar: { props: ['data', 'options'], template: '<div class="chart-stub" :data-series="data.datasets.map((d) => d.label).join(\'|\')"></div>' },
}))

import AdminLearningMonitor from './AdminLearningMonitor.vue'

const HARMFUL = { instinct_id: 'always-grep-first--agent-4', injected_n: 40, injected_success_rate: 0.40, held_out_n: 40, held_out_success_rate: 0.90, delta: -0.5, conclusive: true }
const HELPFUL = { instinct_id: 'migrations-before-seed--agent-4', injected_n: 30, injected_success_rate: 0.93, held_out_n: 25, held_out_success_rate: 0.72, delta: 0.21, conclusive: true }

function day (d, extra = {}) {
  return { day: d, runs: 4, success: 3, partial: 1, failed: 0, stopped: 0, own_mistakes: 1, environment_failures: 1, repeated: 0,
    warnings: 1, warnings_scored: 1, memories_saved: 2, memories_corrected: 0, success_rate: 0.75, mistakes_per_run: 0.25, repeat_rate: 0, ...extra }
}
function totals (extra = {}) {
  return { runs: 20, success: 16, partial: 2, failed: 2, stopped: 1, own_mistakes: 4, environment_failures: 6, warnings: 9,
    warnings_scored: 6, repeated: 2, memories_saved: 12, memories_corrected: 3, success_rate: 0.8, mistakes_per_run: 0.2, repeat_rate: 0.3333, ...extra }
}
const STORE = {
  agent: { id: 3163, name: 'kurumera mcp agent', builtin: false, owner: 'sajid@example.com' },
  current: totals(), previous: totals({ success_rate: 0.6, mistakes_per_run: 0.5, runs: 10 }),
  trend: { status: 'improving', reasons: ['success up 20 points', 'fewer of its own mistakes per run'] },
  practices: { active: 3, candidate: 20, retired: 40 }, spark: [0.5, null, 0.75, 1],
}
const BROKEN = {
  agent: { id: 2992, name: 'waqar store agent', builtin: false, owner: 'waqar@example.com' },
  current: totals({ success_rate: 0.4, repeated: 4, warnings_scored: 6, repeat_rate: 0.6667 }), previous: totals(),
  trend: { status: 'needs_attention', reasons: ['success down 40 points', 'repeated 67% of the mistakes it was warned about'] },
  practices: { active: 1, candidate: 2, retired: 0 }, spark: [0.4],
}

function board () {
  return { window_days: 7, generated_at: '2026-09-29T12:00:00Z', series: [day('2026-09-28'), day('2026-09-29')],
    totals: totals(), previous: totals({ success_rate: 0.7, mistakes_per_run: 0.4, repeat_rate: 0.5 }),
    agents: [BROKEN, STORE], thresholds: { min_runs: 5 } }
}
function detail () {
  return { ...board(), agents: [STORE], detail: {
    tools: [{ tool: 'READ_FILE', own: 2, environment: 0 }, { tool: 'MCP_KURUMERA_GET_STORE_CONTEXT', own: 0, environment: 5 }],
    recent_mistakes: [{ episode: 2902, goal: 'Count the lines in /tmp/acc-alpha.md', at: '2026-09-28T10:00:00Z', tool: 'READ_FILE',
      error: 'ABSOLUTE_PATH_NOT_ALLOWED', args: '{"path": "/tmp/acc-alpha.md"}', recovered: true, recovery_args: '{"path": "acc-alpha.md"}' }],
    practices: [{ id: 112, trigger: 'asked for the number of products', action: 'Use the total count the tool reports.', status: 'active', confidence: 0.71, runs: 3 }],
    practice_counts: { active: 3, candidate: 20, retired: 40 },
  } }
}
function snapshot (overrides = {}) {
  return {
    window_days: 7,
    runs: { source: 'agent.MemoryAutopilotRun', total: 3, by_status: { reviewed: 3 }, pending_review: 0, recent: [], errors: [], by_agent: [] },
    memory: { available: true, facts_added: 1, facts_invalidated: 0, topics_total: 0, topics: [], corrections: [],
      added: [{ id: 1, statement: 'We deploy on Tuesday mornings.', topic: { scope: 'agent', title: 'Deploys' }, source: 'distilled', current: true, at: '2026-09-29T10:00:00Z', agent: { name: 'kurumera mcp agent' } }] },
    instincts: {
      available: true, total: 2, multi_run_evidence: 2, recent: [],
      holdout: { percent: 10, conclusive: [HELPFUL, HARMFUL], accumulating: 5, harmful: [HARMFUL] },
      review_queue: [{ id: 'migrations-before-seed--agent-4', trigger: 'seeding a catalog after a schema change', action: 'Run migrations before seeding data.', domain: 'coding', scope: 'agent', confidence: 0.74, runs: 6 }],
      ...(overrides.instincts || {}),
    },
    cost: { calls: 4, total_cost_usd: 0.012, prompt_tokens: 100, completion_tokens: 20, by_model: {} },
    schedule: { available: true, interval_seconds: 600, enabled: true },
    scope: {},
  }
}

async function mountWith (snap = snapshot()) {
  get.mockImplementation((url, config) => {
    if (String(url).includes('/scope/')) return Promise.resolve({ data: { agents: [], conversations: [] } })
    if (String(url).includes('/agents/')) return Promise.resolve({ data: config?.params?.agent_id ? detail() : board() })
    return Promise.resolve({ data: snap })
  })
  const w = mount(AdminLearningMonitor)
  await flushPromises()
  return w
}

async function openTab (w, key) {
  await w.find(`[data-tab="${key}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); success.mockReset(); error.mockReset()
})

describe('AdminLearningMonitor — overview', () => {
  it('leads with outcomes against the previous window', async () => {
    const w = await mountWith()
    const success = w.find('[data-kpi="success"]')
    expect(success.text()).toContain('80%')
    expect(success.text()).toContain('+10 pts')
    expect(success.find('.delta').classes()).toContain('good')
    const repeats = w.find('[data-kpi="repeats"]')
    expect(repeats.text()).toContain('33%')
    expect(repeats.find('.delta').classes()).toContain('good')      // fewer repeats is good news
    expect(w.findAll('.chart-stub').map((c) => c.attributes('data-series'))).toEqual([
      'Success rate|Succeeded|Partly done|Failed',
      "Warned mistake repeated|Agent's own mistakes|Environment failures",
    ])
  })

  it('names the agents that need attention, with the reasons, and opens one', async () => {
    const w = await mountWith()
    const list = w.find('.attention-list')
    expect(list.text()).toContain('waqar store agent')
    expect(list.text()).toContain('repeated 67% of the mistakes it was warned about')
    expect(list.text()).not.toContain('kurumera mcp agent')
    await list.find('button').trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/admin/observability/learning/agents/', { params: { days: 7, agent_id: 2992 }, noCache: true })
    expect(w.find('[data-tab="agents"]').classes()).toContain('active')
  })
})

describe('AdminLearningMonitor — agents', () => {
  it('shows every agent with its trend and the numbers behind it', async () => {
    const w = await mountWith()
    await openTab(w, 'agents')
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[1].text()).toContain('Improving')
    expect(rows[1].text()).toContain('success up 20 points')
    expect(rows[1].find('[data-label="Practices"]').text()).toContain('3 active')
  })

  it('opens an agent: its failing tools, and each mistake with what was passed and what worked', async () => {
    const w = await mountWith()
    await openTab(w, 'agents')
    await w.findAll('tbody tr')[1].trigger('click')
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Tools that failed')
    expect(text).toContain('{"path": "/tmp/acc-alpha.md"}')
    expect(text).toContain('{"path": "acc-alpha.md"}')
    expect(text).toContain('fixed on retry')
    expect(text).toContain('Use the total count the tool reports.')
    await w.find('.agent-detail .button').trigger('click')                 // All agents
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
})

describe('AdminLearningMonitor — holdout', () => {
  async function holdout (snap = snapshot()) {
    const w = await mountWith(snap)
    await openTab(w, 'practices')
    await w.find('[data-view="holdout"]').trigger('click')
    await flushPromises()
    return w
  }

  it('reports both arms and the difference for a conclusive practice', async () => {
    const text = (await holdout()).text()
    expect(text).toContain('migrations-before-seed--agent-4')
    expect(text).toContain('93%')
    expect(text).toContain('72%')
    expect(text).toContain('+21 pts')
  })

  it('warns loudly when a practice is measured harmful', async () => {
    const w = await holdout()
    expect(w.find('.harm-banner').exists()).toBe(true)
    expect(w.text()).toContain('1 instinct measured harmful')
    expect(w.text()).toContain('-50 pts')
  })

  it('says how many are still accumulating rather than showing an empty table', async () => {
    const w = await holdout(snapshot({ instincts: { holdout: { percent: 10, conclusive: [], accumulating: 12, harmful: [] }, review_queue: [] } }))
    expect(w.text()).toContain('12 instincts still accumulating')
    expect(w.text()).toContain('20 runs on each side')
  })
})

describe('AdminLearningMonitor — review queue', () => {
  it('posts the verdict and drops the practice from the queue', async () => {
    post.mockResolvedValue({ data: { confidence: 0.81 } })
    const w = await mountWith()
    await openTab(w, 'practices')
    const buttons = w.findAll('.review-actions button')
    expect(buttons.map((b) => b.text())).toEqual(['Good', 'Not useful'])
    await buttons[0].trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/admin/observability/learning/review/', { instinct_id: 'migrations-before-seed--agent-4', verdict: 'good' })
    expect(success).toHaveBeenCalled()
    expect(w.text()).toContain('Nothing waiting for review')
  })

  it('sends "bad" for a rejection, and keeps the practice when the verdict could not be recorded', async () => {
    post.mockRejectedValue({ response: { data: { detail: 'nope' } } })
    const w = await mountWith()
    await openTab(w, 'practices')
    await w.findAll('.review-actions button')[1].trigger('click')
    await flushPromises()
    expect(post.mock.calls[0][1].verdict).toBe('bad')
    expect(error).toHaveBeenCalledWith('nope')
    expect(w.findAll('.review-actions')).toHaveLength(1)
  })
})

describe('AdminLearningMonitor — memory and pipeline', () => {
  it('lists the facts saved in the window', async () => {
    const w = await mountWith()
    await openTab(w, 'memory')
    expect(w.text()).toContain('We deploy on Tuesday mornings.')
  })

  it('saves the sweep interval only once it changed, and queues a sweep on request', async () => {
    patch.mockResolvedValue({ data: { available: true, interval_seconds: 1800, enabled: true } })
    post.mockResolvedValue({ data: { queued: true } })
    const w = await mountWith()
    await openTab(w, 'pipeline')
    const save = w.findAll('button').find((b) => b.text().includes('Save changes'))
    expect(save.attributes('disabled')).toBeDefined()
    await w.findAll('.presets button').find((b) => b.text() === '30m').trigger('click')
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()
    expect(patch).toHaveBeenCalledWith('/admin/observability/learning/schedule/', { interval_minutes: 30, enabled: true })
    await w.findAll('button').find((b) => b.text().includes('Run now')).trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/admin/observability/learning/sweep/', {})
  })
})
