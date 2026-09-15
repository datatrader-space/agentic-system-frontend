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
import { useChatStore } from '../../stores/useChatStore'

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

// THE ANSWER BELONGS ON THE RAIL — between the steps that produced it and the verdict that judged it.
// Outside the rail it reads as a wall of output with no relationship to the work above it.
//
// And placement alone is not enough. Conv 1543's answer is a ~4 KB JSON document, so putting it on the
// rail unchanged would move the wall rather than remove it. A structured answer collapses to one line
// read FROM the document — its own `status` and issue count, never invented — and expands on demand.
describe('RunTimeline — the model\'s answer sits on the rail', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const railWith = (messages) => {
    const chat = useChatStore()
    chat.messages = messages
    store.ingestSnapshot(RUN, SNAPSHOT)
    return mount(RunTimeline, { props: { runId: RUN } })
  }

  const JSON_ANSWER = JSON.stringify({
    status: 'needs_review', attempt_count: 2,
    issues: ['exclusions did not pass', 'render_validation failed'],
    coordinates: { walls: [{ id: 'wall_left' }] },
  })

  it('renders prose inline, as prose', () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: 'Verified on revision 3.' }])
    expect(w.find('[data-test="rt-answer-m1"]').text()).toContain('Verified on revision 3.')
  })

  it('COLLAPSES a JSON answer instead of moving the wall onto the rail', () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: JSON_ANSWER }])
    const node = w.find('[data-test="rt-answer-m1"]')
    expect(node.exists()).toBe(true)
    expect(node.text()).not.toContain('wall_left')       // the body is not dumped
    expect(node.text()).toContain('needs review')        // read from the document's own status
    expect(node.text()).toContain('2 issues')
  })

  it('expands the document on demand', async () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: JSON_ANSWER }])
    await w.find('[data-test="rt-answer-toggle-m1"]').trigger('click')
    expect(w.find('[data-test="rt-answer-m1"]').text()).toContain('wall_left')
  })

  it('PREFERS the sentence the agent wrote over a derived one', () => {
    // Agent 3316's contract now opens with `summary`. A derived "needs review · 2 issues" line is
    // accurate telemetry; the written sentence is narration, and narration is what the rail is for.
    const w = railWith([{ id: 'm1', role: 'assistant', content: JSON.stringify({
      status: 'needs_review', issues: ['a', 'b'],
      summary: 'The right wall window was not rendered as an exclusion, so the overlay audit failed.',
    }) }])
    const t = w.find('[data-test="rt-answer-m1"]').text()
    expect(t).toContain('right wall window was not rendered')
    expect(t).not.toContain('2 issues')
  })

  it('falls back to a derived line when the agent wrote none', () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: JSON_ANSWER }])
    expect(w.find('[data-test="rt-answer-m1"]').text()).toContain('needs review')
  })

  it('ignores a blank summary rather than showing an empty line', () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: JSON.stringify({
      status: 'needs_review', issues: ['a'], summary: '   ' }) }])
    expect(w.find('[data-test="rt-answer-m1"]').text()).toContain('needs review')
  })

  it('never invents a summary it cannot read', () => {
    const w = railWith([{ id: 'm1', role: 'assistant', content: '{"walls": []}' }])
    expect(w.find('[data-test="rt-answer-m1"]').text()).toContain('structured result')
  })

  it('ignores the user\'s own messages and empty ones', () => {
    const w = railWith([
      { id: 'u1', role: 'user', content: 'detect the walls' },
      { id: 'm0', role: 'assistant', content: '   ' },
      { id: 'm1', role: 'assistant', content: 'Done.' },
    ])
    expect(w.find('[data-test="rt-answer-u1"]').exists()).toBe(false)
    expect(w.find('[data-test="rt-answer-m0"]').exists()).toBe(false)
    expect(w.find('[data-test="rt-answer-m1"]').exists()).toBe(true)
  })

  it('still shows the steps and the verdict around it', () => {
    // The answer is an addition to the narrative, not a replacement for it.
    const w = railWith([{ id: 'm1', role: 'assistant', content: 'Done.' }])
    expect(w.findAll('[data-test^="rt-step-"]')).toHaveLength(4)
    expect(w.find('[data-test^="rt-verdict-"]').exists()).toBe(true)
  })
})

// START TO END. The target rail opens with the request and closes with what the run cost; without
// those it opens mid-story and ends without answering the one question a reader has at the bottom.
describe('RunTimeline — the run reads start to end', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const railWith = (messages, snap = SNAPSHOT) => {
    const chat = useChatStore()
    chat.messages = messages
    store.ingestSnapshot(RUN, snap)
    return mount(RunTimeline, { props: { runId: RUN } })
  }

  it('opens with what was asked', () => {
    const w = railWith([{ id: 'u1', role: 'user', content: 'Detect the walls and render them.' }])
    expect(w.find('[data-test="rt-request"]').text()).toContain('Detect the walls and render them.')
  })

  it('shows the request IN FULL rather than truncating it', () => {
    const long = 'Detect the walls. '.repeat(30)
    const w = railWith([{ id: 'u1', role: 'user', content: long }])
    expect(w.find('[data-test="rt-request"]').text().length).toBeGreaterThan(300)
  })

  it('draws no request node when there is no user message', () => {
    expect(railWith([]).find('[data-test="rt-request"]').exists()).toBe(false)
  })

  it('closes with the time, tokens and cost', () => {
    const snap = { ...SNAPSHOT, work_goal: { ...SNAPSHOT.work_goal,
      totals: { duration_ms: 221000, total_tokens: 31400, cost_usd: '0.06' } } }
    const t = railWith([], snap).find('[data-test="rt-terminal"]').text()
    expect(t).toContain('3m 41s')
    expect(t).toContain('31.4k tokens')
    expect(t).toContain('$0.06')
  })

  it('omits a total it does not know rather than printing a zero', () => {
    // A confident "0 tokens · $0" is worse than silence: it reads as a free run.
    const t = railWith([]).find('[data-test="rt-terminal"]').text()
    expect(t).not.toContain('tokens')
    expect(t).not.toContain('$')
    expect(t).toContain('Ran 4 steps')
  })
})

describe('RunTimeline — a step can be opened', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const withTools = () => {
    const chat = useChatStore()
    chat.messages = []
    store.ingestSnapshot(RUN, { ...SNAPSHOT, steps: SNAPSHOT.steps.map((s, i) => (i === 1
      ? { ...s, tool_hints: ['EXECUTE_SCRIPT', 'ANALYZE_MEDIA'], details: 'checked the junctions' }
      : s)) })
    return mount(RunTimeline, { props: { runId: RUN } })
  }

  it('is collapsed by default, so scanning the run is not buried in detail', () => {
    expect(withTools().find('[data-test="rt-step-detail-op_2"]').exists()).toBe(false)
  })

  it('opens to show what the step could reach for', async () => {
    const w = withTools()
    await w.find('[data-test="rt-step-toggle-op_2"]').trigger('click')
    const d = w.find('[data-test="rt-step-detail-op_2"]')
    expect(d.text()).toContain('EXECUTE_SCRIPT')
    expect(d.text()).toContain('checked the junctions')
  })

  it('offers no chevron on a step with nothing to show', () => {
    expect(withTools().find('[data-test="rt-step-toggle-op_1"]').exists()).toBe(false)
  })
})
