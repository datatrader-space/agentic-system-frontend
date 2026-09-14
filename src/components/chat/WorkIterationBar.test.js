// @vitest-environment jsdom
// The visible half of Work-mode iteration reporting.
//
// The store knew which iteration was running well before anything rendered it, and a value nothing
// displays is not a fix. These assert what the user actually sees: which iteration a section of the
// thread belongs to, that the run is still working between iterations, and how it ended.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import { usePlanStore } from '../../stores/usePlanStore'
import WorkIterationBar from './WorkIterationBar.vue'

const mountBar = (props = {}) => mount(WorkIterationBar, { props })

// A run's status now comes from ONE place: `plan.work_goal`, the RunGoal row delivered by the
// transactional outbox. The first version kept its own copy from live `work_segment` frames, and
// production showed the cost -- the authoritative goal row read "Working - Segment 3 of 12" while this
// bar read "Iteration 1 of 12", because a fault in the headless bridge meant the frames never arrived.
const withGoal = (goal) => {
  const plan = usePlanStore()
  plan.plansByRunId = { r1: { run_id: 'r1', work_goal: goal } }
  plan.activeRunIdsByConversation = { 1529: ['r1'] }
  useChatStore().conversationId = '1529'
}

describe('WorkIterationBar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders nothing at all for an ordinary chat', () => {
    // THE REGRESSION THAT MATTERS: this sits at the foot of every thread in the app.
    expect(mountBar().text()).toBe('')
  })

  it('sections the thread with the iteration number', () => {
    const w = mountBar({ divider: { segment: 2, max: 12 } })
    expect(w.get('[data-test="iteration-divider"]').text()).toBe('Iteration 2 of 12')
  })

  it('omits the total when the run does not declare one', () => {
    expect(mountBar({ divider: { segment: 2, max: 0 } }).text()).toBe('Iteration 2')
  })

  it('reports the iteration the DATABASE says is running', () => {
    // Not a number this component maintained for itself -- that is what went stale.
    withGoal({ state: 'ACTIVE', segments_used: 3, max_segments: 12 })
    const t = mountBar().get('[data-test="iteration-live"]').text()
    expect(t).toContain('Iteration 3 of 12')
    expect(t).toContain('working')
  })

  it('says plainly that more iterations may follow', () => {
    // The reported question: "how does the user know if he needs to wait more, or the agent ended?"
    withGoal({ state: 'ACTIVE', segments_used: 1, max_segments: 12 })
    expect(mountBar().text()).toContain('more iterations may follow')
  })

  it('reads the first iteration as 1, never 0', () => {
    // `segments_used` is incremented BEFORE a segment is dispatched, so it is still 0 while the very
    // first one -- the chat turn that froze the goal -- is executing.
    withGoal({ state: 'ACTIVE', segments_used: 0, max_segments: 12 })
    expect(mountBar().text()).toContain('Iteration 1 of 12')
  })

  it('reports a met goal as met, and as finished', () => {
    withGoal({ state: 'ACHIEVED', segments_used: 2, max_segments: 12 })
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.text()).toContain('Goal met')
    expect(t.text()).toContain('stopped')
    expect(t.classes()).toContain('ok')
  })

  it('does not dress an exhausted run up as a success', () => {
    withGoal({ state: 'EXHAUSTED', segments_used: 12, max_segments: 12 })
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.text()).toContain('not met')
    expect(t.classes()).toContain('warn')
    expect(t.classes()).not.toContain('ok')
  })

  it('an unknown goal state is never green', () => {
    // Same reasoning as `disposition` on the backend: the unknown case fails closed.
    withGoal({ state: 'SOMETHING_NEW', segments_used: 1, max_segments: 12 })
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.classes()).toContain('warn')
    expect(t.text()).not.toContain('Goal met')
  })

  it('counts the iterations the run actually used', () => {
    withGoal({ state: 'EXHAUSTED', segments_used: 3, max_segments: 12 })
    expect(mountBar().text()).toContain('3 of 12 iterations used')
  })

  it('says "1 iteration", not "1 iterations"', () => {
    withGoal({ state: 'ACHIEVED', segments_used: 1, max_segments: 12 })
    expect(mountBar().text()).toContain('1 of 12 iteration used')
  })

  it('a divider never doubles as the live status', () => {
    withGoal({ state: 'ACTIVE', segments_used: 3, max_segments: 12 })
    const w = mountBar({ divider: { segment: 1, max: 12 } })
    expect(w.find('[data-test="iteration-live"]').exists()).toBe(false)
    expect(w.get('[data-test="iteration-divider"]').text()).toBe('Iteration 1 of 12')
  })
})
