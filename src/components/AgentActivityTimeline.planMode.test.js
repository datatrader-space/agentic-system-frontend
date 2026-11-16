// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentActivityTimeline from './AgentActivityTimeline.vue'

// Plan mode only reads (backend phase 4): a call it refused is a plain "Not run" step, in the neutral colour, never a
// failure line.
describe('AgentActivityTimeline — a call plan mode did not run', () => {
  it('shows the step with "Not run: plan mode only reads", not as an error', () => {
    const w = mount(AgentActivityTimeline, {
      props: {
        steps: [
          { stepId: 'a', phase: 'using_tools', label: 'Reading the routes', status: 'ok', durationMs: 900 },
          { stepId: 'b', phase: 'using_tools', label: 'Writing a file', status: 'held', reason: 'Not run: plan mode only reads' },
        ],
        running: true, isComplete: false,
      },
    })
    const rows = w.findAll('.agent-step')
    expect(rows[1].classes()).toContain('is-held')
    expect(rows[1].find('[data-test="at-step-held"]').text()).toBe('Not run: plan mode only reads')
    expect(rows[1].find('.agent-step-error').exists()).toBe(false)
    expect(rows[1].find('.agent-step-icon').classes()).toContain('icon-held')
  })
})
