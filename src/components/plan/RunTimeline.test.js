// @vitest-environment jsdom
// The rail, rendered. The reducer is tested separately; what is pinned here is that the LAYOUT keeps
// the promises the old per-segment cards broke:
//   * four steps stay four steps when the loop turns twice (no new rows per pass),
//   * the retry rides on the step it belongs to,
//   * the reason the loop re-entered is a NODE with its findings, not a divider and not an
//     "Iteration N of M" band (that shape was cut),
//   * the run ends exactly once, in words rather than an enum.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import RunTimeline from './RunTimeline.vue'
import { useRunTimeline } from '../../stores/useRunTimeline'

const RUN = 'run_1543'

const SNAPSHOT = {
  run_status: 'completed',
  plan_status_label: 'Completed',
  steps: [
    { step_id: 'op_1', title: 'Detect the major visible architectural walls', status: 'completed', status_user: 'completed', duration_ms: 18100 },
    { step_id: 'op_2', title: 'Validate the wall coordinates', status: 'completed', status_user: 'completed', duration_ms: 41700 },
    { step_id: 'op_3', title: 'Render the coordinates through FitMyWall', status: 'completed', status_user: 'completed', duration_ms: 5800 },
    { step_id: 'op_4', title: 'Audit the exact returned overlay', status: 'in_progress', status_user: 'in_progress' },
  ],
  work_goal: {
    last_verdict: 'undecidable',
    attempts: [{ n: 1, verdict: 'unconfirmed' }, { n: 2, verdict: 'met' }],
    last_findings: [
      { observation: 'Exclusions validation never ran; scope was wall_outlines.',
        repair_instruction: 'Run it and include the executed result.' },
    ],
  },
}

describe('RunTimeline — one rail', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const railFor = (snap = SNAPSHOT) => {
    store.ingestSnapshot(RUN, snap)
    return mount(RunTimeline, { props: { runId: RUN } })
  }

  it('draws every plan step at once, so the whole run is visible from the start', () => {
    const w = railFor()
    expect(w.findAll('[data-test^="rt-step-"]')).toHaveLength(4)
    expect(w.text()).toContain('Validate the wall coordinates')
  })

  it('A RUN THAT TURNED TWICE IS STILL FOUR STEPS', () => {
    // The old view drew a card per segment; twelve passes meant twelve cards and the reader lost any
    // sense of how much work the run contained.
    const w = railFor()
    expect(w.findAll('[data-test^="rt-step-"]')).toHaveLength(4)
  })

  it('shows the attempt badge ON the step, not as a new row', () => {
    const w = railFor()
    expect(w.find('[data-test="rt-attempt-op_2"]').text()).toContain('attempt 2')
  })

  it('shows no attempt badge on a first pass', () => {
    const w = railFor({ ...SNAPSHOT, work_goal: { last_verdict: 'not_met', attempts: [{ n: 1 }], last_findings: [] } })
    expect(w.find('[data-test="rt-attempt-op_2"]').exists()).toBe(false)
  })

  it('renders the loop verdict as a node carrying its findings', () => {
    const w = railFor()
    const v = w.find('[data-test^="rt-verdict-"]')
    expect(v.exists()).toBe(true)
    expect(v.text()).toContain('Not there yet')
    expect(v.text()).toContain('Exclusions validation never ran')
    expect(v.text()).toContain('Run it and include')
  })

  it('has NO "Iteration N of M" band anywhere', () => {
    // That shape was explicitly cut. Reintroducing it is the failure this test exists to catch.
    expect(railFor().text()).not.toMatch(/iteration\s+\d+\s+of\s+\d+/i)
  })

  it('marks exactly one step live', () => {
    const w = railFor()
    expect(w.findAll('.rt__node.is-live')).toHaveLength(1)
  })

  it('ends exactly once, in words', () => {
    const w = railFor()
    const t = w.findAll('[data-test="rt-terminal"]')
    expect(t).toHaveLength(1)
    expect(t[0].text()).toContain('Completed')
    expect(t[0].text()).not.toContain('insufficient_evidence')
  })

  it('does not draw an ending while the run is still going', () => {
    const w = railFor({ ...SNAPSHOT, run_status: 'executing' })
    expect(w.find('[data-test="rt-terminal"]').exists()).toBe(false)
  })

  it('says so when the log has a hole rather than drawing a tree it cannot trust', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    store.apply(RUN, { seq: 999, kind: 'patch', type: 'step', node_id: 'op_1', payload: {} })
    const w = mount(RunTimeline, { props: { runId: RUN } })
    expect(w.find('[data-test="rt-gap"]').exists()).toBe(true)
  })

  it('renders nothing rather than crashing on an empty run', () => {
    const w = railFor({ steps: [] })
    expect(w.findAll('[data-test^="rt-step-"]')).toHaveLength(0)
  })
})

describe('RunTimeline — a dropped step is never silent', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const withUnidentified = () => {
    store.ingestSnapshot(RUN, { ...SNAPSHOT, steps: [
      { node_id: 'op_1', title: 'Validate the wall coordinates', status: 'completed' },
      { title: 'a step the server did not identify', status: 'pending' }] })
    return mount(RunTimeline, { props: { runId: RUN } })
  }

  it('says how many steps it could not draw', () => {
    // Dropping beats mis-positioning, but silence is worse than either: the rail would under-report
    // how much work the run contains and nobody would know to look.
    const w = withUnidentified()
    expect(w.find('[data-test="rt-unidentified"]').exists()).toBe(true)
    expect(w.find('[data-test="rt-unidentified"]').text()).toContain('1 step')
  })

  it('still draws the steps it COULD identify', () => {
    expect(withUnidentified().findAll('[data-test^="rt-step-"]')).toHaveLength(1)
  })

  it('stays quiet when every step has an identity', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    const w = mount(RunTimeline, { props: { runId: RUN } })
    expect(w.find('[data-test="rt-unidentified"]').exists()).toBe(false)
  })
})
