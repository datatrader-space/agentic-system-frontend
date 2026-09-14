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
import WorkIterationBar from './WorkIterationBar.vue'

const mountBar = (props = {}) => mount(WorkIterationBar, { props })

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

  it('says the run is working between iterations', () => {
    // The reported gap: after iteration 1 finished, nothing was streaming and nothing was rendered,
    // so a run that was verifying its goal and dispatching the next segment looked finished.
    const chat = useChatStore()
    chat.workIteration = { segment: 2, max: 12 }
    const w = mountBar()
    expect(w.get('[data-test="iteration-live"]').text()).toContain('Iteration 2 of 12')
    expect(w.get('[data-test="iteration-live"]').text()).toContain('working')
  })

  it('reports a met goal as met', () => {
    const chat = useChatStore()
    chat.workGoal = { state: 'ACHIEVED', segments: 2, max: 12, findings: [] }
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.text()).toContain('Goal met')
    expect(t.classes()).toContain('ok')
  })

  it('does not dress an exhausted run up as a success', () => {
    const chat = useChatStore()
    chat.workGoal = { state: 'EXHAUSTED', segments: 12, max: 12, findings: [] }
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.text()).toContain('not met')
    expect(t.classes()).toContain('warn')
    expect(t.classes()).not.toContain('ok')
  })

  it('an unknown goal state is never green', () => {
    // Same reasoning as `disposition` on the backend: the unknown case fails closed. A state this
    // component has not been taught must not be presented as a verified success.
    const chat = useChatStore()
    chat.workGoal = { state: 'SOMETHING_NEW', segments: 1, max: 12, findings: [] }
    const t = mountBar().get('[data-test="iteration-outcome"]')
    expect(t.classes()).toContain('warn')
    expect(t.text()).not.toContain('Goal met')
  })

  it('counts the iterations the run actually used', () => {
    const chat = useChatStore()
    chat.workGoal = { state: 'EXHAUSTED', segments: 3, max: 12, findings: [] }
    expect(mountBar().text()).toContain('3 of 12 iterations used')
  })

  it('says "1 iteration", not "1 iterations"', () => {
    const chat = useChatStore()
    chat.workGoal = { state: 'ACHIEVED', segments: 1, max: 12, findings: [] }
    expect(mountBar().text()).toContain('1 of 12 iteration used')
  })

  it('a divider never doubles as the live status', () => {
    // Both would otherwise render at once while a run is in flight, putting "Iteration 2 · working"
    // in the middle of the transcript as well as at the foot of it.
    const chat = useChatStore()
    chat.workIteration = { segment: 3, max: 12 }
    const w = mountBar({ divider: { segment: 1, max: 12 } })
    expect(w.find('[data-test="iteration-live"]').exists()).toBe(false)
    expect(w.get('[data-test="iteration-divider"]').text()).toBe('Iteration 1 of 12')
  })
})
