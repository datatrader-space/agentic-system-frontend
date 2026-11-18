// @vitest-environment jsdom
// ADM-1284: the turn header says how the turn ENDED (the summary's final_status and stop reason), as Claude Code shows
// it. A failed call keeps its own red row and never turns a good turn into "Completed with issues".
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentActivityTimeline from './AgentActivityTimeline.vue'

const ok = { stepId: 'A', phase: 'using_tools', label: 'Read the file', status: 'ok', reason: '', nextAction: '' }
const failed = { stepId: 'B', phase: 'using_tools', label: 'Run a command', status: 'failed',
  reason: 'This waits for your approval', nextAction: '' }
const head = (summary, extra = {}) => mount(AgentActivityTimeline, {
  props: { steps: [ok, failed], summary, isComplete: true, ...extra },
})

describe('AgentActivityTimeline: the header is how the turn ended', () => {
  it('a completed turn with a failed row is not "with issues"', () => {
    const w = head({ finalStatus: 'completed', stopReason: 'task_completed', durationMs: 4200 })
    expect(w.text()).toContain('Thought for 4.2s')
    expect(w.text()).not.toContain('with issues')
    expect(w.get('.at-check').classes()).toContain('ok')
    expect(w.get('.at-card').classes()).not.toContain('at-warn')
  })

  it('a turn paused for money says so, with the pause mark', () => {
    const w = head({ finalStatus: 'paused', stopReason: 'balance_empty' })
    expect(w.get('.at-head-text').text()).toContain('Paused — balance ran out')
    expect(w.find('[data-test="timeline-ended-on-hold"]').exists()).toBe(true)
    expect(w.find('.at-check').exists()).toBe(false)
    expect(w.get('.at-card').classes()).toContain('at-warn')
  })

  it('a turn waiting on the person says "Waiting for you"', () => {
    const w = head({ finalStatus: 'waiting', stopReason: 'approval_wait' })
    expect(w.get('.at-head-text').text()).toContain('Waiting for you')
    expect(w.find('[data-test="timeline-ended-on-hold"]').exists()).toBe(true)
  })

  it('a turn whose answer could not be checked says "Not verified"', () => {
    const w = head({ finalStatus: 'not_verified', stopReason: 'action_obligations_unmet' })
    expect(w.get('.at-head-text').text()).toContain('Not verified')
    expect(w.get('.at-check').classes()).toContain('warn')
  })

  it('a turn the person stopped says so, without a warning', () => {
    const w = head({ finalStatus: 'completed', stopReason: 'stopped_by_user' })
    expect(w.get('.at-head-text').text()).toContain('Stopped by you')
    expect(w.get('.at-card').classes()).not.toContain('at-warn')
  })

  it('the public tier keeps its simple words', () => {
    const w = head({ finalStatus: 'paused' }, { publicSafe: true })
    expect(w.text()).toContain('Completed')
    expect(w.text()).not.toContain('Paused')
  })

  it('takes no has-failures prop any more', () => {
    expect(Object.keys(AgentActivityTimeline.props)).not.toContain('hasFailures')
  })
})
