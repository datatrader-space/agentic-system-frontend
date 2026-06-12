import { describe, it, expect } from 'vitest'
import { createActivity, start, ingest, finish, interrupt } from './activityStream'

function lastStep(a) {
  return a.steps[a.steps.length - 1]
}

describe('activityStream — tool_progress (per-command live steps)', () => {
  it('opens a step per running command and closes it on done with duration + exit', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_progress', tool: 'SSH_EXEC', index: 1, total: 3, phase: 'running', command: 'docker ps', label: '[1/3] docker ps' })
    const running = a.steps.find((s) => s.cmdIndex === 1)
    expect(running).toBeTruthy()
    expect(running.status).toBe('running')
    ingest(a, { type: 'tool_progress', tool: 'SSH_EXEC', index: 1, total: 3, phase: 'done', command: 'docker ps', exit_code: 0 })
    expect(running.status).toBe('done')
    expect(running.exitCode).toBe(0)
  })

  it('marks a timed-out command as error with a wait-longer hint', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'tool_progress', index: 2, total: 3, phase: 'running', command: 'sleep 999', label: '[2/3] sleep 999' })
    ingest(a, { type: 'tool_progress', index: 2, total: 3, phase: 'done', command: 'sleep 999', exit_code: -2 })
    const s = a.steps.find((x) => x.cmdIndex === 2)
    expect(s.status).toBe('error')
    expect(s.error).toMatch(/timed out/i)
  })
})

describe('activityStream — interrupt (socket dropped mid-stream)', () => {
  it('collapses a running activity to interrupted instead of leaving it spinning', () => {
    const a = createActivity()
    start(a)               // seeds a running "Thinking" step
    expect(a.done).toBe(false)
    expect(a.steps.some((s) => s.status === 'running')).toBe(true)

    interrupt(a, 'Connection lost')

    expect(a.done).toBe(true)            // spinner stops (timeline collapses)
    expect(a.running).toBe(false)
    expect(a.interrupted).toBe(true)     // distinct from a normal finish()
    expect(a.error).toBe('Connection lost')
    // every previously-active step is now errored (not silently "done")
    expect(a.steps.every((s) => s.status !== 'running')).toBe(true)
    expect(lastStep(a).status).toBe('error')
  })

  it('finish() marks done WITHOUT the interrupted flag (the happy path)', () => {
    const a = createActivity()
    start(a)
    finish(a)
    expect(a.done).toBe(true)
    expect(a.interrupted).toBeFalsy()
  })

  it('interrupt is a safe no-op on a null activity', () => {
    expect(() => interrupt(null, 'x')).not.toThrow()
  })
})

describe('activityStream — live token metering (token_usage)', () => {
  it('records a running token snapshot from token_usage', () => {
    const a = createActivity()
    start(a)
    expect(a.tokens).toBeNull()
    ingest(a, { type: 'token_usage', phase: 'stream', estimated: true, prompt_tokens: 3200, completion_tokens: 400, total_tokens: 3600 })
    expect(a.tokens.total).toBe(3600)
    expect(a.tokens.estimated).toBe(true)
  })

  it('an estimate does not regress a larger exact count', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'token_usage', phase: 'iter', estimated: false, total_tokens: 4215, cached_tokens: 1120, cost_usd: 0.012 })
    ingest(a, { type: 'token_usage', phase: 'stream', estimated: true, total_tokens: 3600 })
    expect(a.tokens.total).toBe(4215)       // exact retained
    expect(a.tokens.cached).toBe(1120)
    expect(a.tokens.cost).toBe(0.012)
  })

  it('assistant_message_complete.usage reconciles the final exact tokens', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'token_usage', phase: 'stream', estimated: true, total_tokens: 3000 })
    ingest(a, { type: 'assistant_message_complete', usage: { prompt_tokens: 3212, completion_tokens: 1003, total_tokens: 4215, cached_tokens: 1120, cost_usd: 0.012 } })
    expect(a.tokens.total).toBe(4215)
    expect(a.tokens.estimated).toBe(false)
    expect(a.tokens.cost).toBe(0.012)
  })

  it('renders plan phases as pending (○) roadmap steps, once per turn', () => {
    const a = createActivity()
    start(a)
    const plan = { title: 'Fix imports', phases: [{ phase_number: 1, title: 'Edit app/models.py' }, { phase_number: 2, title: 'Re-run test suite' }] }
    ingest(a, { type: 'plan_approval_required', plan })
    const pend = a.steps.filter((s) => s.phase === 'plan_pending')
    expect(pend.length).toBe(2)
    expect(pend.every((s) => s.status === 'pending')).toBe(true)
    expect(pend[0].label).toBe('Edit app/models.py')
    // idempotent: a repeated event does not duplicate the roadmap
    ingest(a, { type: 'plan_approval_required', plan })
    expect(a.steps.filter((s) => s.phase === 'plan_pending').length).toBe(2)
  })

  it('streams thinking via reasoning_delta and collapses on reasoning_done', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'reasoning_delta', step_id: 'k1', text: 'Let me ' })
    ingest(a, { type: 'reasoning_delta', step_id: 'k1', text: 'inspect the imports.' })
    const think = a.steps.find((s) => s.phase === 'thinking' && s.thinkingText)
    expect(think.thinkingText).toBe('Let me inspect the imports.')
    ingest(a, { type: 'reasoning_done', step_id: 'k1', duration_ms: 18000 })
    const done = a.steps.find((s) => s.id === think.id)
    expect(done.status).toBe('done')
    expect(done.label).toBe('Thought for 18s')
  })
})

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

  it('renders auto_status gate labels (Auto Mode)', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'auto_status', gate: 'plan', decision: 'approved' })
    expect(lastStep(a).label).toContain('plan approved')
    expect(lastStep(a).status).toBe('done')
    ingest(a, { type: 'auto_status', gate: 'progress', decision: 'stop' })
    expect(lastStep(a).label).toContain('stopping')
    expect(lastStep(a).status).toBe('blocked')
  })

  it('renders plan_approval_required as pending approval', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'plan_approval_required', plan: {} })
    expect(lastStep(a).status).toBe('pending_approval')
  })

  it('renders the Question Gate (clarification) labels', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'auto_status', gate: 'question', decision: 'resolved' })
    expect(lastStep(a).label).toContain('direction resolved')
    expect(lastStep(a).status).toBe('done')
    ingest(a, { type: 'auto_status', gate: 'question', decision: 'escalate' })
    expect(lastStep(a).label).toContain('human input needed')
    expect(lastStep(a).status).toBe('blocked')
  })

  it('renders the in-progress "reviewing" states for tool and plan gates', () => {
    const a = createActivity()
    start(a)
    ingest(a, { type: 'auto_status', gate: 'tool', decision: 'reviewing' })
    expect(lastStep(a).label).toContain('reviewing tool risk')
    ingest(a, { type: 'auto_status', gate: 'plan', decision: 'reviewing' })
    expect(lastStep(a).label).toContain('reviewing plan')
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
