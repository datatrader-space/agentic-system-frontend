// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UnifiedPlanCard from './UnifiedPlanCard.vue'

const plan = (over = {}) => ({
  run_id: 'system_b:5', title: 'Ship feature', summary: 'Do the thing', version_number: 1,
  plan_status: 'pending_approval', approval_status: 'pending', approval_required: true,
  available_actions: ['approve', 'reject', 'request_changes'],
  steps: [
    { step_id: 'a', title: 'Step A', status: 'completed' },
    { step_id: 'b', title: 'Step B', status: 'started' },
    { step_id: 'c', title: 'Step C', status: 'pending' },
  ],
  total_step_count: 3, completed_step_count: 1, current_step_id: 'b', ...over,
})
const btn = (w, text) => w.findAll('button').find((b) => b.text().includes(text))

describe('UnifiedPlanCard', () => {
  it('shows title, status badge and version', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan() } })
    expect(w.text()).toContain('Ship feature')
    expect(w.text()).toContain('Awaiting approval')
    expect(w.text()).toContain('v1')
  })

  it('renders approval actions with the tool-approval note when awaiting + authorized', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan() } })
    expect(btn(w, 'Approve')).toBeTruthy()
    expect(btn(w, 'Reject')).toBeTruthy()
    expect(btn(w, 'Request changes')).toBeTruthy()
    expect(w.text()).toContain('does not approve later risky tools')
  })

  it('emits decide on approve/reject', async () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan() } })
    await btn(w, 'Approve').trigger('click')
    expect(w.emitted('decide')[0][0].decision).toBe('approve')
    await btn(w, 'Reject').trigger('click')
    expect(w.emitted('decide')[1][0].decision).toBe('reject')
  })

  it('request changes reveals a textarea then emits with comment', async () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan() } })
    await btn(w, 'Request changes').trigger('click')
    const ta = w.find('textarea')
    expect(ta.exists()).toBe(true)
    await ta.setValue('please adjust step B')
    await btn(w, 'Send changes').trigger('click')
    const payload = w.emitted('decide').at(-1)[0]
    expect(payload.decision).toBe('request_changes')
    expect(payload.comment).toBe('please adjust step B')
  })

  it('after approval becomes the live checklist (no approval buttons)', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan({ plan_status: 'executing', approval_status: 'approved', available_actions: [] }) } })
    expect(btn(w, 'Approve')).toBeFalsy()
    expect(w.text()).toContain('In progress')
    expect(w.text()).toContain('1/3')
  })

  it('public read-only surface hides actions and tool details', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan({ available_actions: [] }), readOnly: true } })
    expect(btn(w, 'Approve')).toBeFalsy()
    expect(w.text()).toContain('Read-only')
  })

  it('busy disables the action buttons (no double submit)', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan(), busy: true } })
    expect(btn(w, 'Approve').attributes('disabled')).toBeDefined()
  })

  it('renders each supported status label', () => {
    for (const [st, label] of [
      ['completed', 'Completed'], ['failed', 'Failed'], ['rejected', 'Rejected'],
      ['paused', 'Paused'], ['changes_requested', 'Changes requested'], ['cancelled', 'Cancelled'],
    ]) {
      const w = mount(UnifiedPlanCard, { props: { plan: plan({ plan_status: st, available_actions: [] }) } })
      expect(w.text()).toContain(label)
    }
  })

  it('has accessible group + status semantics', () => {
    const w = mount(UnifiedPlanCard, { props: { plan: plan() } })
    expect(w.find('[role="group"]').exists()).toBe(true)
    expect(w.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(w.find('.uplan__toggle').attributes('aria-expanded')).toBeDefined()
  })

  it('approval buttons are gated by canonical available_actions, not status alone', () => {
    // awaiting approval but the canonical snapshot did NOT grant the approve action → no buttons.
    const w = mount(UnifiedPlanCard, { props: { plan: plan({ available_actions: ['reject'] }) } })
    expect(btn(w, 'Approve')).toBeFalsy()
    expect(btn(w, 'Reject')).toBeFalsy() // whole affordance block hidden without approve grant
  })

  it('completed plan collapses by default; awaiting-approval expands', () => {
    const done = mount(UnifiedPlanCard, { props: { plan: plan({ plan_status: 'completed', available_actions: [] }) } })
    expect(done.find('.uplan__caret').classes()).not.toContain('open')
    const pending = mount(UnifiedPlanCard, { props: { plan: plan() } })
    expect(pending.find('.uplan__caret').classes()).toContain('open')
  })
})
