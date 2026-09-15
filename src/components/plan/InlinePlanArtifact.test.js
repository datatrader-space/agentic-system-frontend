// @vitest-environment jsdom
// NO FLAG. The rail is the implementation for a Work run, wired unconditionally.
//
// What selects it is the run's own shape, not a rollout switch: a Work run spans segments, and a card
// per segment is what made the transcript unreadable. An ordinary run is a handful of steps the
// existing card reads fine, so it keeps it — the same way every other behaviour here follows the run's
// mode rather than a toggle.
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
  work_goal: { state: 'ACTIVE', outcome: 'detect the walls', segments_used: 2, max_segments: 12,
               last_verdict: 'not_met', last_findings: [], attempts: [], available_actions: [] },
}

describe('InlinePlanArtifact — which surface a run gets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = PLAN
    plan.hydrationStatusByRunId[RUN] = 'ready'
  })

  it('a WORK run gets the rail, with no flag to turn it on', () => {
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(true)
  })

  it('never shows both at once — one surface, not two', () => {
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(true)
    expect(w.findAll('.uplan__step, .iplan__step').length).toBe(0)
  })

  it('an ORDINARY run keeps the existing card', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, work_goal: null }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(false)
  })
})
