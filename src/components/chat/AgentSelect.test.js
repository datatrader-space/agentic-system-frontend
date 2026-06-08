// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentSelect from './AgentSelect.vue'

const AGENTS = [
  { id: 1, name: 'codding_agent' },
  { id: 2, name: 'devops_agent' },
  { id: 3, name: 'research_agent' },
  { id: 4, name: 'support_bot' },
  { id: 5, name: 'sql_agent' },
  { id: 6, name: 'coding_helper' },
]

describe('AgentSelect — searchable agent picker', () => {
  it('shows the selected agent name on the pill', () => {
    const w = mount(AgentSelect, { props: { agents: AGENTS, selectedId: 2 } })
    expect(w.text()).toContain('devops_agent')
  })

  it('opens an autocomplete and filters by typed text', async () => {
    const w = mount(AgentSelect, { props: { agents: AGENTS, selectedId: 1 } })
    await w.find('.asel-btn').trigger('click')
    expect(w.find('.asel-search').exists()).toBe(true)
    await w.find('.asel-search').setValue('cod')
    const names = w.findAll('.asel-item').map((b) => b.text())
    expect(names).toEqual(['codding_agent', 'coding_helper']) // only the matches
  })

  it('emits select with the chosen agent and closes', async () => {
    const w = mount(AgentSelect, { props: { agents: AGENTS, selectedId: 1 } })
    await w.find('.asel-btn').trigger('click')
    await w.find('.asel-search').setValue('devops')
    await w.find('.asel-item').trigger('click')
    expect(w.emitted('select')[0][0]).toEqual({ id: 2, name: 'devops_agent' })
    expect(w.find('.asel-search').exists()).toBe(false) // popover closed
  })

  it('shows an empty state when nothing matches', async () => {
    const w = mount(AgentSelect, { props: { agents: AGENTS, selectedId: 1 } })
    await w.find('.asel-btn').trigger('click')
    await w.find('.asel-search').setValue('zzz')
    expect(w.findAll('.asel-item').length).toBe(0)
    expect(w.find('.asel-empty').exists()).toBe(true)
  })

  it('is disabled and labelled when there are no agents', () => {
    const w = mount(AgentSelect, { props: { agents: [], selectedId: null } })
    expect(w.find('.asel-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('No agents')
  })
})
