// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentActivityTimeline from './AgentActivityTimeline.vue'

// A message the person sent while the run worked, taken in by the run, sits in the run's step list where
// it was taken in. Their own words stay readable when the finished card is collapsed, and they are not
// counted as the agent's steps.
const step = (id, label) => ({ stepId: id, phase: 'using_tools', label, status: 'ok', durationMs: 900 })
const steer = { stepId: 'steer_1', phase: 'steer', label: 'end with PINEAPPLE', status: 'ok', isSteer: true }

describe('AgentActivityTimeline — steering lines', () => {
  it('shows the steer under the collapsed header and does not count it as a step', () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [step('a', 'Searching the web'), steer, step('b', 'Reading pages')], running: false, isComplete: true },
    })
    expect(w.find('.at-head').text()).toContain('2 steps')
    const lines = w.find('[data-test="timeline-steers"]')
    expect(lines.exists()).toBe(true)
    expect(lines.text()).toContain('You added:')
    expect(lines.text()).toContain('end with PINEAPPLE')
  })

  it('places it between the steps it came between when expanded', async () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [step('a', 'Searching the web'), steer, step('b', 'Reading pages')], running: false, isComplete: true },
    })
    await w.find('.at-head').trigger('click')
    const rows = w.findAll('.agent-step').map((r) => r.text())
    expect(rows[0]).toContain('Searching the web')
    expect(rows[1]).toContain('You added:')
    expect(rows[1]).toContain('end with PINEAPPLE')
    expect(rows[2]).toContain('Reading pages')
    expect(w.find('[data-test="timeline-steers"]').exists()).toBe(false)   // not twice when expanded
  })

  it('shows it live, in place, while the run is still working', () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [step('a', 'Searching the web'), steer], running: true, isComplete: false },
    })
    expect(w.find('.agent-step.is-steer').text()).toContain('end with PINEAPPLE')
  })
})
