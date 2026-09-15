// @vitest-environment jsdom
// Inline plan artifact card — renders the approved state set + emits approval decisions.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InlinePlanCard from './InlinePlanCard.vue'

const view = (over = {}) => ({
  run_id: 'r1', title: 'P', plan_status: 'pending_approval', plan_status_user: 'awaiting_approval',
  version_number: 1, available_actions: ['approve', 'reject', 'request_changes'],
  steps: [{ step_id: 'a', status: 'pending', status_user: 'pending' }],
  total_step_count: 1, completed_step_count: 0, current_step_id: 'a', ...over,
})

describe('InlinePlanCard', () => {
  it('shows Approve when awaiting approval and emits decide', async () => {
    const w = mount(InlinePlanCard, { props: { plan: view() } })
    const approve = w.findAll('button').find((b) => b.text().includes('Approve'))
    expect(approve).toBeTruthy()
    await approve.trigger('click')
    expect(w.emitted().decide[0][0]).toEqual({ decision: 'approve', comment: '' })
  })

  it('renders a blocked step with a waiting subtag (distinct pill)', () => {
    const w = mount(InlinePlanCard, { props: { plan: view({
      plan_status: 'blocked', plan_status_user: 'blocked',
      steps: [{ step_id: 'a', status: 'blocked', status_user: 'blocked', block_reason: 'need key' }],
    }) } })
    expect(w.text()).toContain('Blocked')
    expect(w.text()).toContain('waiting')
    expect(w.text()).toContain('need key')
  })

  it('renders a failed step distinctly from blocked', () => {
    const w = mount(InlinePlanCard, { props: { plan: view({
      plan_status: 'failed', plan_status_user: 'failed',
      steps: [{ step_id: 'a', status: 'failed', status_user: 'failed', failure_summary: 'exit 1' }],
    }) } })
    expect(w.text()).toContain('Failed')
    expect(w.text()).toContain('exit 1')
  })

  it('collapses to compact when completed', () => {
    const w = mount(InlinePlanCard, { props: { plan: view({
      plan_status: 'completed', plan_status_user: 'completed',
    }) } })
    expect(w.classes()).toContain('collapsed')
  })

  it('shows a reconnecting indicator when the connection is stale', () => {
    const w = mount(InlinePlanCard, { props: { plan: view(), connState: 'stale' } })
    expect(w.text()).toContain('Reconnecting')
  })

  it('maps raw status when status_user is absent (hydrated snapshot)', () => {
    const w = mount(InlinePlanCard, { props: { plan: {
      title: 'P', plan_status: 'executing',
      steps: [{ step_id: 'a', status: 'started' }],
      total_step_count: 1, completed_step_count: 0, current_step_id: 'a', available_actions: [],
    } } })
    expect(w.text()).toContain('Active')
  })
})

describe('the repair loop is visible on the card', () => {
  // PRODUCTION CONV 1518. Five repair passes over eleven minutes, every one rejected with named
  // findings, and the card read "Active 3 / 3" with three green ticks throughout — the same thing it
  // shows for a run that got it right on the first pass. Steps tick when they produce evidence and do
  // not un-tick when a verifier rejects it, so the step count cannot tell those two runs apart. The
  // attempt number is the only thing that can.
  const withRepair = (repair) => ({
    plan_status_user: 'active', total_step_count: 3, completed_step_count: 3,
    steps: [], repair,
  })

  it('shows which attempt, of how many', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: withRepair({ attempt: 3, max_attempts: 5, in_progress: true, findings: [] }) },
    })
    expect(w.text()).toContain('attempt 3')
    expect(w.text()).toContain('5')
  })

  it('names what it is fixing, so the counter is not just a spinner', () => {
    const w = mount(InlinePlanCard, {
      props: {
        plan: withRepair({
          attempt: 2, max_attempts: 5, in_progress: true,
          findings: [{ observation: 'wall_1 top edge is horizontal' },
                     { observation: 'wall_3 covers visible ceiling' }],
        }),
      },
    })
    expect(w.text()).toContain('wall_1 top edge is horizontal')
    expect(w.text()).toContain('wall_3 covers visible ceiling')
  })

  it('says nothing on the first pass — one attempt is not a loop', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: withRepair({ attempt: 1, max_attempts: 5, in_progress: true, findings: [] }) },
    })
    expect(w.text()).not.toContain('attempt 1')
  })

  it('says nothing once the loop has stopped', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: withRepair({ attempt: 5, max_attempts: 5, in_progress: false, findings: [] }) },
    })
    expect(w.text()).not.toContain('attempt 5')
  })

  it('is absent for an ordinary run that never entered a loop', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: { plan_status_user: 'active', total_step_count: 3, completed_step_count: 3, steps: [] } },
    })
    expect(w.text()).not.toContain('attempt')
  })
})

describe('a run that stopped responding says so', () => {
  // PRODUCTION CONV 1522. A container restart took a live turn's in-memory state with it. The run sat
  // at `executing` with its last tool result minutes old, and the card showed a spinner — for the
  // twenty minutes before the reclaim sweep would have closed it. The runtime knew within seconds
  // (`stalled_runs._heartbeat_age_seconds`); the payload the card polls never carried it.
  const withLiveness = (liveness) => ({
    plan_status_user: 'active', total_step_count: 3, completed_step_count: 1, steps: [], liveness,
  })

  it('shows the note when the backend reports a stall', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: withLiveness({ stalled: true, seconds_since_activity: 300,
                                    note: 'No activity for 5m 0s while the run still reads as running.' }) },
    })
    expect(w.text()).toContain('No activity for 5m 0s')
  })

  it('says nothing on a healthy run', () => {
    const w = mount(InlinePlanCard, { props: { plan: withLiveness(null) } })
    expect(w.text()).not.toContain('No activity')
  })

  it('says nothing when the backend reports it is alive', () => {
    const w = mount(InlinePlanCard, {
      props: { plan: withLiveness({ stalled: false, seconds_since_activity: 12 }) },
    })
    expect(w.text()).not.toContain('No activity')
  })
})

// A raw enum leaked into the badge. Production conv 1542 rendered `insufficient_evidence` verbatim
// beside states written as "Active" and "Paused", because the state was in neither map and `planLabel`
// falls through to the raw value.
describe('a run that could not be verified', () => {
  const card = (plan) => mount(InlinePlanCard, { props: { plan } })

  it('shows a human label, not the enum', () => {
    const t = card({ plan_status: 'insufficient_evidence', steps: [] }).text()
    expect(t).toContain('Not verified')
    expect(t).not.toContain('insufficient_evidence')
  })

  it('does not disguise it as completed or failed', () => {
    // The backend keeps this status distinct precisely because it is neither; collapsing it here
    // would undo that in the one place a person reads it.
    const t = card({ plan_status: 'insufficient_evidence', steps: [] }).text()
    expect(t).not.toContain('Completed')
    expect(t).not.toContain('Failed')
  })

  it('still honours a server-sent user label', () => {
    const t = card({ plan_status: 'insufficient_evidence', plan_status_user: 'paused',
                     steps: [] }).text()
    expect(t).toContain('Paused')
  })
})
