// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TokenUsage from './TokenUsage.vue'
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
