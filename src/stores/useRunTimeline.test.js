// The reducer is the whole fix, so it is tested as a reducer: a log in, a tree out.
//
// Spec §11 acceptance tests 1 (no duplicates on replay) and 7 (order safety) are the two that decide
// whether the rail can be trusted, and both are properties of THIS file, not of the component.
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunTimeline, eventsFromSnapshot, runHasEnded } from './useRunTimeline'

const RUN = 'run_1543'

// Conv 1543 as the server actually reports it: four steps, a second attempt, an unmet goal carrying
// the findings that caused the loop to re-enter, and a terminal run.
const SNAPSHOT = {
  run_status: 'completed',
  plan_status_label: 'Completed',
  steps: [
    { step_id: 'op_1', title: 'Detect the major visible architectural walls', status: 'completed', status_user: 'completed', duration_ms: 18100 },
    { step_id: 'op_2', title: 'Validate the wall coordinates', status: 'completed', status_user: 'completed', duration_ms: 41700 },
    { step_id: 'op_3', title: 'Render the coordinates through FitMyWall', status: 'completed', status_user: 'completed', duration_ms: 5800 },
    { step_id: 'op_4', title: 'Audit the exact returned overlay', status: 'completed', status_user: 'completed', duration_ms: 14600 },
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

describe('useRunTimeline — the reducer', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const ev = (seq, kind, node_id, payload = {}, type = 'step') =>
    ({ seq, kind, type, node_id, payload })

  it('appends a node and renders it in append order', () => {
    store.apply(RUN, ev(1, 'append', 'a'))
    store.apply(RUN, ev(2, 'append', 'b'))
    expect(store.nodesFor(RUN).map((n) => n.node_id)).toEqual(['a', 'b'])
  })

  it('PATCHES a node that already exists instead of appending beside it', () => {
    // THE DUPLICATE CARD BUG, as a unit test. A second announcement of a node is not a second node.
    store.apply(RUN, ev(1, 'append', 'a', { label: 'first' }))
    store.apply(RUN, ev(2, 'append', 'a', { label: 'second' }))
    const nodes = store.nodesFor(RUN)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].label).toBe('second')
  })

  it('drops an event it has already applied', () => {
    store.apply(RUN, ev(1, 'append', 'a'))
    expect(store.apply(RUN, ev(1, 'append', 'a'))).toBe('duplicate')
    expect(store.nodesFor(RUN)).toHaveLength(1)
  })

  it('§11.1 replaying the whole log twice produces an identical tree', () => {
    const log = eventsFromSnapshot(SNAPSHOT)
    store.applyAll(RUN, log)
    const once = JSON.stringify(store.nodesFor(RUN))
    store.applyAll(RUN, log)          // every event is now <= lastSeq
    expect(JSON.stringify(store.nodesFor(RUN))).toBe(once)
  })

  it('§11.7 duplicated frames cannot corrupt the tree', () => {
    // Redelivery is the common case (reconnect, at-least-once transport). The tree must be identical
    // to the one a clean log produces -- not merely "close".
    const log = eventsFromSnapshot(SNAPSHOT)
    store.applyAll(RUN, log)
    const clean = JSON.stringify(store.nodesFor(RUN))
    store.reset(RUN)
    store.applyAll(RUN, [...log.slice(0, 3), ...log, ...log.slice(0, 5)])
    expect(JSON.stringify(store.nodesFor(RUN))).toBe(clean)
  })

  it('§11.7 an out-of-order frame is REFUSED, not absorbed', () => {
    // Deliberately not "sort and apply". A patch applied before its append would create a node with no
    // identity, and a delta would stream into nothing -- a tree that looks fine and is wrong. Refusing
    // and declaring the hole is the honest failure, and the client can refetch from `lastSeq`.
    const log = eventsFromSnapshot(SNAPSHOT)
    store.applyAll(RUN, [log[0], log[4], log[1]])
    expect(store.hasGapFor(RUN)).toBe(true)
  })

  it('refuses to apply out of order and says the tree has a hole', () => {
    // Applying a patch before its append would create a node with no identity.
    store.apply(RUN, ev(1, 'append', 'a'))
    expect(store.apply(RUN, ev(5, 'patch', 'a', { x: 1 }))).toBe('gap')
    expect(store.hasGapFor(RUN)).toBe(true)
  })

  it('never conjures a node from a patch or a delta', () => {
    expect(store.apply(RUN, ev(1, 'patch', 'ghost', { x: 1 }))).toBe('ignored')
    expect(store.apply(RUN, ev(1, 'delta', 'ghost', { text: 'hi' }))).toBe('ignored')
    expect(store.nodesFor(RUN)).toHaveLength(0)
  })

  it('streams delta text into the node that owns it', () => {
    store.apply(RUN, ev(1, 'append', 'm', {}, 'message'))
    store.apply(RUN, ev(2, 'delta', 'm', { text: 'Hel' }))
    store.apply(RUN, ev(3, 'delta', 'm', { text: 'lo' }))
    expect(store.nodesFor(RUN)[0].buffer).toBe('Hello')
  })

  it('keeps runs apart', () => {
    store.apply(RUN, ev(1, 'append', 'a'))
    store.apply('other', ev(1, 'append', 'z'))
    expect(store.nodesFor(RUN).map((n) => n.node_id)).toEqual(['a'])
    expect(store.nodesFor('other').map((n) => n.node_id)).toEqual(['z'])
  })
})

describe('eventsFromSnapshot — the P0 bridge', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  it('lands every plan step at once, keyed on its server step id', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    const steps = store.nodesFor(RUN).filter((n) => n.type === 'step')
    expect(steps.map((s) => s.node_id)).toEqual(['op_1', 'op_2', 'op_3', 'op_4'])
    expect(steps[1].label).toBe('Validate the wall coordinates')
  })

  it('A RETRY IS THE SAME STEP — the plan never grows', () => {
    // Conv 1543 turned twice. Four steps must stay four steps, each carrying attempt 2.
    store.ingestSnapshot(RUN, SNAPSHOT)
    const steps = store.nodesFor(RUN).filter((n) => n.type === 'step')
    expect(steps).toHaveLength(4)
    expect(steps.every((s) => s.attempt === 2)).toBe(true)
  })

  it('puts the reason the loop re-entered on a node, with its findings', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    const v = store.nodesFor(RUN).find((n) => n.type === 'loop.continuing')
    expect(v).toBeTruthy()
    expect(v.findings[0].issue).toContain('Exclusions validation never ran')
    expect(v.findings[0].remedy).toContain('Run it and include')
  })

  it('emits no verdict node when the goal was met', () => {
    store.ingestSnapshot(RUN, { ...SNAPSHOT, work_goal: { last_verdict: 'met', attempts: [], last_findings: [] } })
    expect(store.nodesFor(RUN).find((n) => n.type === 'loop.continuing')).toBeFalsy()
  })

  it('ends once, with words rather than an enum', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    const t = store.nodesFor(RUN).filter((n) => n.type === 'run.completed')
    expect(t).toHaveLength(1)
    expect(t[0].label).toBe('Completed')
    expect(t[0].steps).toBe(4)
    expect(t[0].retried).toBe(1)
  })

  it('does not end a run that is still going', () => {
    store.ingestSnapshot(RUN, { ...SNAPSHOT, run_status: 'executing' })
    expect(store.nodesFor(RUN).find((n) => n.type === 'run.completed')).toBeFalsy()
  })

  it('re-ingesting the same snapshot does not duplicate or reorder the rail', () => {
    store.ingestSnapshot(RUN, SNAPSHOT)
    const before = store.nodesFor(RUN).map((n) => n.node_id)
    store.ingestSnapshot(RUN, SNAPSHOT)
    expect(store.nodesFor(RUN).map((n) => n.node_id)).toEqual(before)
  })

  it('uses the SERVER node_id, not a name it derived', () => {
    store.ingestSnapshot(RUN, { ...SNAPSHOT, steps: [
      { node_id: 'op_9', step_id: 'stale', title: 'Validate the wall coordinates', status: 'completed' }] })
    expect(store.nodesFor(RUN).filter((n) => n.type === 'step')[0].node_id).toBe('op_9')
  })

  it('DROPS a step the server could not identify rather than giving it a position', () => {
    // An index fallback is the duplicate-card shape: on the next render the same work lands under a
    // different positional id and appends beside itself instead of patching.
    store.ingestSnapshot(RUN, { ...SNAPSHOT, steps: [
      { node_id: 'op_1', title: 'Validate the wall coordinates', status: 'completed' },
      { title: 'a step with no identity at all', status: 'pending' }] })
    const steps = store.nodesFor(RUN).filter((n) => n.type === 'step')
    expect(steps.map((x) => x.node_id)).toEqual(['op_1'])
    const plan = store.nodesFor(RUN).find((n) => n.type === 'plan.created')
    expect(plan.unidentified).toBe(1)
  })

  it('survives a snapshot with nothing in it', () => {
    expect(eventsFromSnapshot(null)).toEqual([])
    store.ingestSnapshot(RUN, { steps: [] })
    expect(store.nodesFor(RUN).filter((n) => n.type === 'step')).toHaveLength(0)
  })
})

describe('attempts are tries at the goal, not inner loop rows (prod conv 1626)', () => {
  it('three segments with four repair-loop rows is attempt 3, 2 retried', async () => {
    const { eventsFromSnapshot } = await import('./useRunTimeline')
    const events = eventsFromSnapshot({
      run_status: 'completed',
      steps: [{ step_id: 'op_1', title: 'Find Redis', status: 'completed' }],
      work_goal: { state: 'ACHIEVED', segments_used: 3,
        attempts: [{ n: 1 }, { n: 2 }, { n: 1 }, { n: 2 }],
        verdicts: [{ segment: 1 }, { segment: 2 }, { segment: 3 }] },
    })
    const retry = events.find((e) => e.type === 'step.retry')
    expect(retry.payload.attempt).toBe(3)
    expect(events.find((e) => e.type === 'run.completed').payload.retried).toBe(2)
  })
})

describe('a run that ended leaves no step running', () => {
  // Prod conv 1645: a provider refusal paused the Work goal with its only step still `in_progress`, and the
  // rail kept the live ring spinning under "Paused" beside an "Active plan 0/1" chip.
  const paused = (goalState, runStatus = 'paused') => ({
    run_status: runStatus,
    steps: [{ step_id: 'op_1', title: 'search web', status: 'in_progress', status_user: 'in_progress' }],
    work_goal: { state: goalState, segments_used: 1, verdicts: [] },
  })
  const stepState = (plan) => eventsFromSnapshot(plan).find((e) => e.type === 'step').payload.state

  it('an in-progress step on a closed Work goal is stopped, not active', () => {
    expect(stepState(paused('PAUSED'))).toBe('stopped')
  })

  it('an in-progress step on a blocked run is stopped', () => {
    expect(stepState({ ...paused('ACTIVE', 'blocked') })).toBe('stopped')
  })

  it('a run still going keeps its active step', () => {
    expect(stepState(paused('ACTIVE', 'executing'))).toBe('active')
  })

  it('runHasEnded reads the run and the goal', () => {
    expect(runHasEnded(paused('PAUSED'))).toBe(true)
    expect(runHasEnded(paused('ACTIVE', 'executing'))).toBe(false)
    expect(runHasEnded({ run_status: 'completed', steps: [] })).toBe(true)
    expect(runHasEnded(null)).toBe(false)
  })
})
