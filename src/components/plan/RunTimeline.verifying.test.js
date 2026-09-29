// @vitest-environment jsdom
/**
 * The rail must not stop dead at the last green step.
 *
 * MEASURED, production conv 1877 (2026-09-22). A five-step Next.js build finished every step, the
 * backend entered its verification phase, and the card showed nothing underneath step 5 — reported as
 * "step 5 green nothing next showing in ui wht happening.?". The run was healthy and checking; the UI
 * had no way to say so.
 *
 * The old "Verifying results…" row could never cover this. It belonged to the TURN, and verification
 * moved out of the turn into a queued phase — so the row vanished at the exact moment the checking
 * began. This one reads the server's own phase block instead, and therefore cannot claim a check that
 * is not running.
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import RunTimeline from './RunTimeline.vue'

const RUN = 'run_1877'

beforeEach(() => { setActivePinia(createPinia()) })

function render(verification_phase) {
  return mount(RunTimeline, {
    props: { runId: RUN, goal: { state: 'ACTIVE', outcome: 'build it', verification_phase } },
  })
}

const row = (w) => w.find('[data-test="rt-verifying"]')
const label = (w) => w.find('[data-test="rt-verifying-label"]').text()

describe('the verification phase is visible while it runs', () => {
  it('says the work is being checked once the phase is queued', () => {
    const w = render({ state: 'queued', step_count: 5, waiting: true })
    expect(row(w).exists()).toBe(true)
    // The RESULT is what is checked once the work is finished (outcome first), so the row says so and no
    // longer counts steps that are not being re-asked.
    expect(label(w)).toContain('Checking the result')
    expect(label(w)).not.toContain('5 steps')
  })

  it('shows it as live, not finished', () => {
    expect(render({ state: 'queued', step_count: 2, waiting: true })
      .find('[data-test="rt-verifying"]').attributes('data-state')).toBe('active')
  })

  it('stops promising a check the server has given up on', () => {
    // `waiting:false` is the phase-dispatch bound expiring. Still saying "checking" would be a promise
    // the backend is no longer making.
    expect(label(render({ state: 'queued', step_count: 3, waiting: false })))
      .toContain('did not come back')
  })
})

describe('and says what it found once it answers', () => {
  it('reports a pass', () => {
    const w = render({ state: 'done', status: 'PASS', step_count: 4,
                       verified_steps: ['op_1', 'op_2', 'op_3', 'op_4'], seconds: 80.4 })
    expect(label(w)).toContain('everything holds')
    expect(w.find('[data-test="rt-verifying-meta"]').text()).toContain('4/4 proven')
  })

  it('reports how long the check took, which is the first question about a slow one', () => {
    const w = render({ state: 'done', status: 'PASS', step_count: 1,
                       verified_steps: ['op_1'], seconds: 80.4 })
    expect(w.find('[data-test="rt-verifying-meta"]').text()).toContain('1m 20s')
  })

  it('does not dress a failure up as a pass', () => {
    expect(label(render({ state: 'done', status: 'FAIL_RECOVERABLE', step_count: 2,
                          verified_steps: ['op_1'], seconds: 12 })))
      .toContain('found something to fix')
  })

  it('says plainly when nobody could tell', () => {
    expect(label(render({ state: 'done', status: 'UNDECIDABLE', step_count: 2,
                          verified_steps: [], seconds: 9 })))
      .toContain('Could not be checked')
  })
})

describe('and stays out of the way otherwise', () => {
  it('shows nothing for a run that has no verification phase', () => {
    expect(row(render(null)).exists()).toBe(false)
  })

  it('shows nothing for an ordinary chat turn with no goal at all', () => {
    const w = mount(RunTimeline, { props: { runId: RUN, goal: null } })
    expect(w.find('[data-test="rt-verifying"]').exists()).toBe(false)
  })
})

describe('a check under stopped work is not shown as running', () => {
  // Prod conv 2102 (2026-09-29): a stopped run's card spun "Checking the work · 5 steps" under a PAUSED
  // footer until reloaded. The server drops the check for stopped work; the card must not promise it.
  for (const state of ['PAUSED', 'ACHIEVED', 'EXHAUSTED', 'ABANDONED']) {
    it(`says it was not checked when the goal is ${state}`, () => {
      const w = mount(RunTimeline, {
        props: { runId: RUN, goal: { state, outcome: 'build it',
                 verification_phase: { state: 'queued', step_count: 5, waiting: true } } },
      })
      expect(label(w)).toContain('Not checked')
      expect(label(w)).not.toContain('Checking the result')
      expect(row(w).attributes('data-state')).not.toBe('active')
    })
  }

  it('still says checking while the goal is active', () => {
    expect(label(render({ state: 'queued', step_count: 5, waiting: true }))).toContain('Checking the result')
  })
})
