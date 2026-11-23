// What runs a workflow now, as the builder groups and words it before publishing (ADM-1351 phase 4).
import { describe, expect, it } from 'vitest'
import { hiddenLine, impactGroups, impactStateLabel, usedBySummary } from './wfPublishImpact'

// The shape of GET /api/workflow-graphs/<id>/impact/ (agent/services/workflow_graph/impact.py).
const IMPACT = {
  workflow: { id: 86, public_id: 'wf_86', published_version: 2 },
  items: [
    { kind: 'trigger', id: 't1', name: 'Every morning (0 7 * * *)', state: 'active', version: null, binding: 'schedule', node_id: 'start' },
    { kind: 'stream', id: 5, name: 'Shelves: Aisle 3 camera', state: 'running', version: 2, project: 9 },
    { kind: 'app', id: 3, name: 'Shop floor app', state: 'disabled', version: null },
    { kind: 'parent', id: 90, name: 'Nightly audit', state: 'published', version: 4 },
  ],
  counts: { stream: 3, batch: 1, app: 1, trigger: 1, parent: 1 },
  not_shown: { stream: 2, batch: 1, app: 0 },
  total: 7,
  confirm: true,
  message: '3 live streams use this workflow (version 2).',
  notes: ['Only this workflow\'s workspace is read.'],
}

describe('impactGroups', () => {
  it('groups in a fixed order, keeps only kinds with something, and counts what the server did not name', () => {
    const groups = impactGroups(IMPACT)
    expect(groups.map((g) => g.kind)).toEqual(['stream', 'batch', 'app', 'trigger', 'parent'])
    const stream = groups[0]
    expect(stream).toMatchObject({ title: 'Live streams', count: 3, hidden: 2 })
    expect(stream.items.map((i) => i.name)).toEqual(['Shelves: Aisle 3 camera'])
    // A batch the person may not see is counted, never named.
    expect(groups[1]).toMatchObject({ kind: 'batch', count: 1, hidden: 1, items: [] })
  })

  it('an empty or missing answer has no groups', () => {
    expect(impactGroups({ items: [], counts: { stream: 0, batch: 0, app: 0, trigger: 0, parent: 0 }, total: 0 })).toEqual([])
    expect(impactGroups(null)).toEqual([])
  })
})

describe('words', () => {
  it('says how many more the person cannot see, and nothing when none', () => {
    expect(hiddenLine(2)).toBe('2 more you cannot see')
    expect(hiddenLine(0)).toBe('')
  })

  it('reads a state as a person would, keeping an unknown one', () => {
    expect(impactStateLabel('running')).toBe('Running')
    expect(impactStateLabel('disabled')).toBe('Turned off')
    expect(impactStateLabel('needs_review')).toBe('Needs review')
    expect(impactStateLabel('')).toBe('')
  })

  it('"Used by" lists every kind with its count, and is empty when nothing uses the workflow', () => {
    expect(usedBySummary(IMPACT)).toBe('Used by 3 live streams, 1 batch in progress, 1 Connected App, 1 trigger and 1 workflow that runs it.')
    expect(usedBySummary({ total: 2, items: [{ kind: 'trigger', id: 1 }, { kind: 'trigger', id: 2 }], counts: { trigger: 2 } })).toBe('Used by 2 triggers.')
    expect(usedBySummary({ total: 0, items: [], counts: {} })).toBe('')
  })
})
