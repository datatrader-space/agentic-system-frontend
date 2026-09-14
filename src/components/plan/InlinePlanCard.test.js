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
