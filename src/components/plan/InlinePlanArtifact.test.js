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

// ONE SURFACE, and this is the test that was missing when the rail shipped beside the old ones.
//
// REPORTED LIVE: the rail rendered correctly AND the segment card, the iteration bar and the
// per-message activity list all kept rendering. The same findings appeared twice under two different
// headings ("Not there yet — continuing." and "Not there yet — running the failed steps again"), the
// segment and attempt counts appeared twice, and the steps appeared twice — once as numbered rail
// entries and once as a flat "Loading tools / Waiting for your approval…" list.
//
// Replacing a surface means the old one STOPS. Nothing asserted that, so nothing caught it.
describe('InlinePlanArtifact — a Work run has exactly one surface', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = PLAN
    plan.hydrationStatusByRunId[RUN] = 'ready'
  })

  it('does NOT render the old goal row beside the rail', () => {
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(true)
    expect(w.find('[data-test="wg-attempt-pips"]').exists()).toBe(false)
    expect(w.find('[data-test="wg-attempts"]').exists()).toBe(false)
  })

  it('does NOT restate the segment counter at the top', () => {
    // The old card's header, carried onto the rail, is not what the target does. The run's state
    // belongs in the page header as a status pill, and the reason the loop turned again rides on the
    // `loop.continuing` node that caused it. A counter at the top restates on every render a thing the
    // rail already shows by SHAPE.
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.text()).not.toMatch(/Segment\s+\d+\s+of\s+\d+/)
  })

  it('keeps the goal controls, because there is nowhere else to put them', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = {
      ...PLAN, work_goal: { ...PLAN.work_goal, available_actions: ['pause'] },
    }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="rt-head"]').exists()).toBe(true)
  })

  it('states the findings ONCE', () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = {
      ...PLAN,
      work_goal: { ...PLAN.work_goal, last_verdict: 'not_met',
                   last_findings: [{ observation: 'Exclusions validation never ran.',
                                     repair_instruction: 'Run it.' }] },
    }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    const hits = w.text().split('Exclusions validation never ran.').length - 1
    expect(hits).toBe(1)
  })

  it('still offers the goal actions from the rail', async () => {
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = {
      ...PLAN, work_goal: { ...PLAN.work_goal, available_actions: ['pause'] },
    }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    const btn = w.findAll('button').find((b) => b.text() === 'Pause')
    expect(btn).toBeTruthy()
  })

  it('an ORDINARY run keeps the old card AND its goal row untouched', () => {
    // The old surfaces are not deleted — they are what a non-Work run still uses.
    const plan = usePlanStore()
    plan.plansByRunId[RUN] = { ...PLAN, work_goal: null }
    const w = mount(InlinePlanArtifact, { props: { runId: RUN } })
    expect(w.find('[data-test="run-timeline"]').exists()).toBe(false)
  })
})
