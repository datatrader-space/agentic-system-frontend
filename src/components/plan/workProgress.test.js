// Work Mode V2, phase 10 — the gate: a run renders about six rows, not forty.
//
// The two ways this can go wrong are opposite, and both are tested here:
//   * folding too little, and the reader stops reading the list;
//   * folding a FAILURE into a count, and the one row that mattered disappears into "×12".

import { describe, it, expect } from 'vitest'
import { foldMilestones, wasFolded, isOrchestration } from './workProgress'

const step = (i, over = {}) => ({
  stepId: `s${i}`, label: 'Reading a saved file', status: 'ok', phase: 'retrieving_context',
  durationMs: 100, ...over,
})

describe('folding an activity list into milestones', () => {
  it('collapses consecutive identical rows into one that says how many', () => {
    const folded = foldMilestones([step(1), step(2), step(3)])
    expect(folded).toHaveLength(1)
    expect(folded[0].repeatCount).toBe(3)
  })

  it('keeps the label the backend wrote and only adds the count', () => {
    // Inventing wording here would be a second place friendly labels are decided.
    expect(foldMilestones([step(1), step(2)])[0].label).toBe('Reading a saved file')
  })

  it('does not collapse rows that are merely similar', () => {
    const folded = foldMilestones([step(1), step(2, { label: 'Writing a file' }), step(3)])
    expect(folded.map((s) => s.repeatCount)).toEqual([1, 1, 1])
  })

  it('only collapses rows that are ADJACENT', () => {
    // Read, write, read is three things that happened in an order, not two reads.
    const folded = foldMilestones([step(1), step(2, { label: 'Writing a file' }), step(3)])
    expect(folded).toHaveLength(3)
  })

  it('collapses consecutive verification rows even when their labels differ', () => {
    // How many dispatches a check took is a question about our machinery, not about the user's work.
    const folded = foldMilestones([
      step(1, { label: 'Checking the work', phase: 'verifying' }),
      step(2, { label: 'Checking the page', phase: 'verifying' }),
      step(3, { label: 'Checking the links', phase: 'verifying' }),
    ])
    expect(folded).toHaveLength(1)
    expect(folded[0].repeatCount).toBe(3)
  })

  it('sums the durations of what it folded', () => {
    expect(foldMilestones([step(1), step(2), step(3)])[0].durationMs).toBe(300)
  })

  it('records every id it stands for, so a click can expand exactly those', () => {
    expect(foldMilestones([step(1), step(2)])[0].foldedIds).toEqual(['s1', 's2'])
  })

  it('never mutates the rows it was given', () => {
    const input = [step(1), step(2)]
    foldMilestones(input)
    expect(input[0].repeatCount).toBeUndefined()
    expect(input[0].durationMs).toBe(100)
  })
})

describe('what must never be folded away', () => {
  it('a failed row stands alone', () => {
    const folded = foldMilestones([step(1), step(2, { status: 'failed' }), step(3)])
    expect(folded).toHaveLength(3)
    expect(folded[1].status).toBe('failed')
  })

  it('a failure is not swallowed by the fold before it', () => {
    // "Reading a saved file ×12" over an error is the exact bug this guards.
    const folded = foldMilestones([step(1), step(2), step(3, { status: 'failed' })])
    expect(folded[folded.length - 1].status).toBe('failed')
    expect(folded[0].repeatCount).toBe(2)
  })

  it('an interrupted row stands alone', () => {
    expect(foldMilestones([step(1), step(2, { status: 'interrupted' })])).toHaveLength(2)
  })

  it('the row still running stands alone, so the live one is visible', () => {
    const folded = foldMilestones([step(1), step(2), step(3, { status: 'running' })])
    expect(folded[folded.length - 1].status).toBe('running')
  })
})

describe('the gate: forty calls read as a handful of rows', () => {
  it('a realistic run folds to roughly six rows', () => {
    const raw = [
      ...Array.from({ length: 11 }, (_, i) => step(i, { label: 'Reading a saved file' })),
      ...Array.from({ length: 4 }, (_, i) => step(20 + i, { label: 'Searching the workspace' })),
      step(30, { label: 'Writing a file' }),
      ...Array.from({ length: 8 }, (_, i) => step(40 + i, { label: 'Checking the work', phase: 'verifying' })),
      step(50, { label: 'Writing a file' }),
      ...Array.from({ length: 12 }, (_, i) => step(60 + i, { label: 'Reading a saved file' })),
      step(80, { label: 'Publishing the site' }),
    ]
    // Seven distinct things happened; thirty-eight calls carried them out. The gate is that the reader
    // sees the former, so this asserts the shape rather than a number nobody would defend on its own.
    expect(raw.length).toBeGreaterThan(35)
    expect(foldMilestones(raw).length).toBeLessThanOrEqual(8)
    expect(foldMilestones(raw).map((s) => s.label)).toEqual([
      'Reading a saved file', 'Searching the workspace', 'Writing a file', 'Checking the work',
      'Writing a file', 'Reading a saved file', 'Publishing the site',
    ])
  })

  it('an already-short list offers no toggle, because there is nothing to reveal', () => {
    const raw = [step(1), step(2, { label: 'Writing a file' })]
    expect(wasFolded(foldMilestones(raw), raw)).toBe(false)
  })

  it('a folded list does offer one', () => {
    const raw = [step(1), step(2)]
    expect(wasFolded(foldMilestones(raw), raw)).toBe(true)
  })
})

describe('telling work from orchestration', () => {
  it('a verification row is orchestration', () => {
    expect(isOrchestration({ phase: 'verifying' })).toBe(true)
  })

  it('actually doing the work is not', () => {
    expect(isOrchestration({ phase: 'using_tools' })).toBe(false)
  })

  it('a missing row is not orchestration rather than an exception', () => {
    expect(isOrchestration(null)).toBe(false)
  })
})

describe('edge cases that reach this from a reloaded thread', () => {
  it('an empty list folds to an empty list', () => {
    expect(foldMilestones([])).toEqual([])
  })

  it('a null list folds to an empty list', () => {
    expect(foldMilestones(null)).toEqual([])
  })

  it('null rows are dropped rather than rendered', () => {
    expect(foldMilestones([null, step(1), undefined])).toHaveLength(1)
  })
})
