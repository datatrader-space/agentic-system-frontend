// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentActivityTimeline from './AgentActivityTimeline.vue'

// The header's step count is the work the agent did, not the run getting ready. A tester's "ACK" turn
// read "Done · 10 steps" over setup labels for stages that did nothing (2026-10-26).
const setup = (id, phase, label) => ({ stepId: id, phase, label, status: 'ok', durationMs: 20 })
const work = (id, label) => ({ stepId: id, phase: 'using_tools', label, status: 'ok', durationMs: 900 })

const head = (steps) => mount(AgentActivityTimeline, {
  props: { steps, running: false, isComplete: true },
}).find('.at-head').text()

describe('AgentActivityTimeline — the step count leaves out setup rows', () => {
  it('a turn that only got ready and answered shows no step count', () => {
    const t = head([
      setup('s1', 'preparing', 'Getting ready'),
      setup('s2', 'build_tde_call', 'Working out the best approach'),
      setup('s3', 'build_capability_resolve', 'Finding the right tools'),
    ])
    expect(t).not.toMatch(/\d+ steps?/)
  })

  it('counts only the work rows beside setup rows', () => {
    const t = head([
      setup('s1', 'build_tde_call', 'Working out the best approach'),
      setup('s2', 'planning', 'Planning'),
      work('a', 'Searching the web'),
      work('b', 'Reading pages'),
    ])
    expect(t).toContain('2 steps')
  })

  it('the setup rows are still in the list when expanded', async () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [setup('s1', 'build_tde_call', 'Working out the best approach'), work('a', 'Searching the web')],
               running: false, isComplete: true },
    })
    expect(w.find('.at-head').text()).toContain('1 step')
    await w.find('.at-head').trigger('click')
    expect(w.text()).toContain('Working out the best approach')
    expect(w.text()).toContain('Searching the web')
  })
})
