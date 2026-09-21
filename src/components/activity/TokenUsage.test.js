// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TokenUsage from './TokenUsage.vue'
import { normalizeUsage } from '../../composables/tokens'
import { normalizeUsage } from '../../composables/tokens'

describe('TokenUsage', () => {
  it('renders nothing without usage', () => {
    const w = mount(TokenUsage, { props: { usage: null } })
    expect(w.text()).toBe('')
  })

  it('renders the full metered line: total · ↑ ↓ · cached · cost', () => {
    const w = mount(TokenUsage, {
      props: { usage: { prompt_tokens: 3212, completion_tokens: 1003, total_tokens: 4215, cached_tokens: 1120, cost_usd: 0.012 } },
    })
    const txt = w.text()
    expect(txt).toContain('4.2k tokens')
    expect(txt).toContain('↑ 3.2k')
    expect(txt).toContain('↓ 1k')
    expect(txt).toContain('1.1k cached')
    expect(txt).toContain('$0.012')
  })

  it('omits cached + cost when the provider did not report them', () => {
    const w = mount(TokenUsage, { props: { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } } })
    const txt = w.text()
    expect(txt).toContain('150 tokens')
    expect(txt).not.toContain('cached')
    expect(txt).not.toContain('$')
  })
})

describe('the figure covers the whole turn, not just the main call', () => {
  // PRODUCTION CONV 1777 (2026-09-19). The UI read "159.7k tokens · $0.004" for a turn that actually
  // made 17 model calls, 201,640 prompt tokens and $0.008 — the six main rounds only, missing the
  // routing call, five embeddings and the assurance pass. Roughly half, and the invisible half is the
  // internal work a user cannot predict.
  const CONV_1777 = {
    prompt_tokens: 26682, completion_tokens: 284, total_tokens: 26966,
    cached_tokens: 26368, cost_usd: 0.004,
    turn_prompt_tokens: 201640, turn_completion_tokens: 1200, turn_total_tokens: 202840,
    turn_cached_tokens: 161664, turn_cost_usd: 0.008, turn_model_calls: 17,
  }

  it('prefers the whole-turn totals when the backend sent them', () => {
    const u = normalizeUsage(CONV_1777)
    expect(u.total).toBe(202840)
    expect(u.prompt).toBe(201640)
    expect(u.cost).toBe(0.008)
    expect(u.cached).toBe(161664)
  })

  it('does not report the main call as if it were the turn', () => {
    const u = normalizeUsage(CONV_1777)
    expect(u.total).not.toBe(26966)
    expect(u.cost).not.toBe(0.004)
  })

  it('carries how many calls the figure covers', () => {
    expect(normalizeUsage(CONV_1777).calls).toBe(17)
  })

  it('falls back to the per-call keys when no turn totals are present', () => {
    // An older message, or a surface that never sends them, must render exactly as before.
    const u = normalizeUsage({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120,
                               cached_tokens: 40, cost_usd: 0.001 })
    expect(u.total).toBe(120)
    expect(u.prompt).toBe(100)
    expect(u.cost).toBe(0.001)
    expect(u.cached).toBe(40)
    expect(u.calls).toBeNull()
  })

  it('still renders nothing without usage', () => {
    expect(normalizeUsage(null)).toBeNull()
  })
})

describe('fresh input is separated from cache reads', () => {
  // MEASURED, prod conv 1807: "↑ 214.7k" on a turn whose cache served 177,361 of it. The two are
  // priced an order of magnitude apart and no reader can tell them apart from one number.
  const usage = {
    turn_total_tokens: 215207, turn_prompt_tokens: 214691, turn_completion_tokens: 516,
    turn_cached_tokens: 177361, turn_cost_usd: 0.01752, turn_model_calls: 11,
  }

  it('reports the fresh input as prompt minus cached', () => {
    expect(normalizeUsage(usage).fresh).toBe(214691 - 177361)
  })

  it('leaves the prompt total itself untouched', () => {
    // It is what the provider reported and what the cost is computed from.
    expect(normalizeUsage(usage).prompt).toBe(214691)
  })

  it('keeps the cached tokens in the cost', () => {
    // Cheap is not free. Hiding cache reads from the bill would be the opposite error.
    expect(normalizeUsage(usage).cost).toBe(0.01752)
  })

  it('fresh plus cached reconciles to the prompt', () => {
    const u = normalizeUsage(usage)
    expect(u.fresh + u.cached).toBe(u.prompt)
  })

  it('is null rather than wrong when the provider reported no cache figure', () => {
    expect(normalizeUsage({ turn_total_tokens: 100, turn_prompt_tokens: 90,
                            turn_completion_tokens: 10 }).fresh).toBeNull()
  })

  it('never goes negative if cached exceeds prompt', () => {
    expect(normalizeUsage({ turn_total_tokens: 10, turn_prompt_tokens: 5,
                            turn_completion_tokens: 5, turn_cached_tokens: 99 }).fresh).toBe(0)
  })
})
