// @vitest-environment jsdom
// Every run, in Chat or Work alike, is shown on the same inline plan card (one engine, LONG_RUN phase 5): Work mode's
// rail, goal row and iteration bar are gone with Work mode's goal and segments.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import InlinePlanArtifact from './InlinePlanArtifact.vue'
import { usePlanStore } from '../../stores/usePlanStore'

const RUN = 'run_1543'
const PLAN = {
  run_id: RUN, run_status: 'executing', plan_status: 'executing', plan_status_user: 'active',
  plan_status_label: 'Active',
  steps: [{ step_id: 'op_1', title: 'Validate the wall coordinates', status: 'completed', status_user: 'completed' }],
}

describe('InlinePlanArtifact — which surface a run gets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = PLAN
    plan.hydrationStatusByRunId[RUN] = 'ready'
  })

  it('a run gets the plan card, with no rail beside it', () => {
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('section').exists()).toBe(true)
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(false)
    expect(w.text()).toContain('Validate the wall coordinates')
  })

  it('a stepless ordinary plan that already stopped draws nothing (prod conv 1662)', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, steps: [], total_step_count: 0,
                               plan_status: 'blocked', plan_status_user: 'blocked', plan_status_label: 'Blocked' }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.html()).not.toContain('Blocked')
    expect(w.find('section').exists()).toBe(false)
  })

  it('a stepless plan that is still planning draws nothing either (prod conv 1666)', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, steps: [], total_step_count: 0,
                               plan_status: 'planning', plan_status_user: 'active', plan_status_label: 'Planning' }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('section').exists()).toBe(false)
  })

  it('the card appears as soon as the plan has a step', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, plan_status: 'planning', plan_status_user: 'active' }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('section').exists()).toBe(true)
  })
})

// Plan mode (backend phase 4): the plan is answered on plan mode's own card, so its inline card shows the plan but
// never offers Approve a second time.
describe('InlinePlanArtifact — a plan answered on plan mode\'s card', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, plan_status: 'pending_approval', plan_status_user: 'awaiting_approval',
                               plan_status_label: 'Awaiting approval', available_actions: ['approve', 'reject', 'request_changes'] }
    plan.hydrationStatusByRunId[RUN] = 'ready'
  })

  it('outside plan mode the card offers its decision buttons', () => {
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('.ipc-ft').exists()).toBe(true)
  })

  it('in plan mode the same plan has no second set of buttons', () => {
    usePlanStore().markPlanModeRun(RUN, 'pv-1')
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('.ipc-ft').exists()).toBe(false)
    expect(w.text()).toContain('Validate the wall coordinates')
  })
})
