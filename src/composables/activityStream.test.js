import { describe, it, expect } from 'vitest'
import { createActivity, start, ingest, finish } from './activityStream'

function lastStep(a) {
  return a.steps[a.steps.length - 1]
}

describe('activityStream — explicit approval / blocked states', () => {
  it('marks a tool step as pending_approval on hitl_request', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'WRITE_FILE', parameters: { path: 'x.txt' } })
    ingest(a, { type: 'hitl_request', request_id: 'r1', summary: 'Write x.txt?' })
    const s = lastStep(a)
    expect(s.status).toBe('pending_approval')
    expect(s.label.toLowerCase()).toContain('approval')
  })

  it('resolves an approved tool to done when its result arrives', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'WRITE_FILE' })
    ingest(a, { type: 'hitl_request', request_id: 'r1' })
    ingest(a, { type: 'tool_result', success: true })
    expect(lastStep(a).status).toBe('done')
  })

  it('marks a tool as blocked on tool_blocked', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'DB_EXECUTE' })
    ingest(a, { type: 'tool_blocked', tool: 'DB_EXECUTE', reason: 'Blocked by PLAN_ONLY' })
    const s = lastStep(a)
    expect(s.status).toBe('blocked')
    expect(s.error).toContain('PLAN_ONLY')
  })

  it('marks rejected via hitl_resolved(approved=false)', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'SEND_EMAIL' })
    ingest(a, { type: 'hitl_request', request_id: 'r1' })
    ingest(a, { type: 'hitl_resolved', approved: false, reason: 'User said no' })
    expect(lastStep(a).status).toBe('rejected')
  })

  it('a pending approval still open at turn end fails safe (blocked, not done)', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'SUPERSEDE_MEMORY' })
    ingest(a, { type: 'hitl_request', request_id: 'r1' })
    finish(a)
    expect(lastStep(a).status).toBe('blocked')
    expect(a.done).toBe(true)
  })

  it('normal read-only tool runs and completes with no approval state', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'DB_QUERY' })
    ingest(a, { type: 'tool_result', success: true })
    finish(a)
    const statuses = a.steps.map((s) => s.status)
    expect(statuses).not.toContain('pending_approval')
    expect(statuses).not.toContain('blocked')
    expect(lastStep(a).status).toBe('done')
  })

  it('preserves existing error behavior', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_call', tool: 'READ_FILE' })
    ingest(a, { type: 'tool_result', success: false, error: 'boom' })
    expect(lastStep(a).status).toBe('error')
    expect(lastStep(a).error).toBe('boom')
  })
})
