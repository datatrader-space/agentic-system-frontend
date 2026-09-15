// @vitest-environment jsdom
// Each attempt's OUTCOME, not just how many there were.
//
// Production conv 1541 ended with attempt 3 ACCEPTED/met and nothing on screen said so. The row could
// show a rejection — its findings are carried — and had no way at all to show an acceptance, which
// reads as "it gave up" rather than "it got there and the goal check disagreed".
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkGoalRow from './WorkGoalRow.vue'

const goal = (over = {}) => ({
  state: 'ACTIVE', outcome: 'detect the walls', segments_used: 2, max_segments: 12,
  last_verdict: 'not_met', last_findings: [], available_actions: ['pause'], ...over,
})
const row = (over) => mount(WorkGoalRow, { props: { goal: goal(over) } })

describe('WorkGoalRow attempt pips', () => {
  it('shows one pip per attempt', () => {
    const w = row({ attempts_used: 3,
                    attempts: [{ n: 1, verdict: 'not_met' }, { n: 2, verdict: 'not_met' },
                               { n: 3, verdict: 'met' }] })
    const pips = w.get('[data-test="wg-attempt-pips"]').findAll('.wg__pip')
    expect(pips).toHaveLength(3)
    expect(pips.map((p) => p.text())).toEqual(['1', '2', '3'])
  })

  it('marks a pass differently from a rejection', () => {
    const w = row({ attempts_used: 2,
                    attempts: [{ n: 1, verdict: 'not_met' }, { n: 2, verdict: 'met' }] })
    const pips = w.get('[data-test="wg-attempt-pips"]').findAll('.wg__pip')
    expect(pips[0].classes()).toContain('bad')
    expect(pips[1].classes()).toContain('ok')
    expect(pips[1].classes()).not.toContain('bad')
  })

  it('marks the attempt that is still running', () => {
    const w = row({ attempts_used: 2,
                    attempts: [{ n: 1, verdict: 'not_met' },
                               { n: 2, verdict: '', state: 'EXECUTING' }] })
    const pips = w.get('[data-test="wg-attempt-pips"]').findAll('.wg__pip')
    expect(pips[1].classes()).toContain('live')
    expect(pips[1].classes()).not.toContain('ok')
  })

  it('names each outcome in plain words for hover', () => {
    const w = row({ attempts_used: 1, attempts: [{ n: 1, verdict: 'met' }] })
    expect(w.get('.wg__pip').attributes('title')).toBe('Attempt 1: passed')
  })

  it('renders nothing when the run kept no attempts', () => {
    // THE REGRESSION THAT MATTERS: this row renders for every Work run, including ones with no
    // repair loop at all.
    expect(row({}).find('[data-test="wg-attempt-pips"]').exists()).toBe(false)
  })

  it('still shows the segment count it always did', () => {
    expect(row({}).text()).toContain('Segment 2 of 12')
  })
})
