// ADM-1302 — a Work turn's timeline keeps its narration in order with its tool calls, each call's IN and OUT, and a
// snapshot a reload draws the same rows from. A Chat turn's stays as it was.
import { describe, it, expect } from 'vitest'
import { useAgentTimeline } from './useAgentTimeline'
import { workRows, INLINE_IO_CHARS } from '../components/chat/workRail'

// One Work turn, frame by frame, as the socket sends it: the round's text, then its call (the raw `tool_call` before
// the activity line derived from it), the result, then the next round.
function runTurn(tl, { bigOutput = false } = {}) {
  tl.addText('I will read ', true)
  tl.addText('the file first.')
  tl.ingest({ type: 'agent_status', phase: 'generating', label: 'Generating response' })
  tl.ingest({ type: 'tool_call', tool: 'CODE_READ_FILE', tool_call_id: 'c1', tool_input: { path: 'src/app.py' } })
  tl.ingest({ type: 'agent_step_started', step_id: 'step_c1', tool_call_id: 'c1', phase: 'reading', label: 'Reading a file' })
  tl.ingest({ type: 'tool_result', tool: 'CODE_READ_FILE', tool_call_id: 'c1', success: true,
              output: bigOutput ? 'z'.repeat(INLINE_IO_CHARS + 10) : 'print(1)', result_ref: 'step:41' })
  tl.ingest({ type: 'agent_step_completed', step_id: 'step_c1', tool_call_id: 'c1', status: 'ok', duration_ms: 1200 })
  tl.addText('The file prints 1.', true)
  tl.ingest({ type: 'agent_turn_summary', final_status: 'completed' })
}

describe('useAgentTimeline — a Work turn', () => {
  it('narration rows sit in order between the tool rows', () => {
    const tl = useAgentTimeline()
    tl.reset('work')
    runTurn(tl)
    const rows = workRows(tl.steps.value)
    expect(rows.map((r) => r.kind)).toEqual(['text', 'tool', 'text'])
    expect(rows[0].step.text).toBe('I will read the file first.')      // the status phase between chunks did not split it
    expect(rows[2].step.text).toBe('The file prints 1.')
  })

  it('a call carries its tool, its whole IN and OUT and its ref, even though the raw frame came first', () => {
    const tl = useAgentTimeline()
    tl.reset('work')
    runTurn(tl)
    const row = tl.steps.value.find((s) => s.toolCallId === 'c1')
    expect(row).toMatchObject({ tool: 'CODE_READ_FILE', input: { path: 'src/app.py' }, output: 'print(1)',
                                ioRef: 'step:41', status: 'ok', durationMs: 1200 })
  })

  it('a result for a row that opens later still lands on it', () => {
    const tl = useAgentTimeline()
    tl.reset('work')
    tl.ingest({ type: 'tool_result', tool: 'A', tool_call_id: 'x', success: false, error: 'boom' })
    tl.ingest({ type: 'agent_step_started', step_id: 'step_x', tool_call_id: 'x', phase: 'using', label: 'Working' })
    expect(tl.steps.value[0]).toMatchObject({ tool: 'A', error: 'boom' })
  })

  it('the snapshot says Work and draws the same rows; a long OUT is kept as its ref', () => {
    const tl = useAgentTimeline()
    tl.reset('work')
    runTurn(tl, { bigOutput: true })
    const live = workRows(tl.steps.value, { finished: true, hasAnswer: true }).map((r) => [r.kind, r.key])
    const snap = JSON.parse(JSON.stringify(tl.snapshot()))           // what persist_turn_meta saves and a reload reads
    expect(snap.mode).toBe('work')
    expect(workRows(snap.steps, { finished: true, hasAnswer: true }).map((r) => [r.kind, r.key])).toEqual(live)
    const row = snap.steps.find((s) => s.toolCallId === 'c1')
    expect(row.output).toBeUndefined()
    expect(row.outputChars).toBe(INLINE_IO_CHARS + 10)
    expect(row.ioRef).toBe('step:41')
    expect(row.input).toEqual({ path: 'src/app.py' })                // short: kept inline
  })

  it('a plan is placed once, where it was given', () => {
    const tl = useAgentTimeline()
    tl.reset('work')
    tl.addText('Planning.', true)
    tl.addPlan('P1', 'R1')
    tl.addPlan('P1', 'R1')
    expect(tl.steps.value.filter((s) => s.isPlan).length).toBe(1)
  })
})

describe('useAgentTimeline — a Chat turn keeps today\'s shape', () => {
  it('keeps no narration and no IN/OUT', () => {
    const tl = useAgentTimeline()
    tl.reset('chat')
    runTurn(tl)
    expect(tl.steps.value.some((s) => s.isText)).toBe(false)
    const row = tl.steps.value.find((s) => s.toolCallId === 'c1')
    expect(row.input).toBeUndefined()
    expect(row.output).toBeUndefined()
    expect(tl.snapshot().mode).toBeUndefined()
  })
})
