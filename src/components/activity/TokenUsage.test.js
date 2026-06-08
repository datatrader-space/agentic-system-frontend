// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TokenUsage from './TokenUsage.vue'

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
