import { describe, it, expect } from 'vitest'
import { useAgentTimeline, isRichEvent } from './useAgentTimeline'

describe('useAgentTimeline — rich streaming render model', () => {
  it('isRichEvent recognizes only the 6 rich events', () => {
    expect(isRichEvent({ type: 'agent_status' })).toBe(true)
    expect(isRichEvent({ type: 'agent_step_started' })).toBe(true)
    expect(isRichEvent({ type: 'agent_turn_summary' })).toBe(true)
    expect(isRichEvent({ type: 'tool_call' })).toBe(false)
    expect(isRichEvent({ type: 'assistant_message_chunk' })).toBe(false)
    expect(isRichEvent(null)).toBe(false)
  })

  it('agent_status updates the live status line', () => {
    const t = useAgentTimeline()
    expect(t.ingest({ type: 'agent_status', phase: 'retrieving_context', label: 'Searching the knowledge base…' })).toBe(true)
    expect(t.currentStatus.value).toEqual({ phase: 'retrieving_context', label: 'Searching the knowledge base…', reason: '' })
  })

  it('agent_step_started creates a running step + sets activeStep', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'step_A', phase: 'using_tools', label: 'Checking Shopify' })
    expect(t.steps.value.length).toBe(1)
    expect(t.steps.value[0]).toMatchObject({ stepId: 'step_A', label: 'Checking Shopify', status: 'running' })
    expect(t.activeStep.value.stepId).toBe('step_A')
  })

  it('agent_step_completed updates the matching step by step_id (with summary + duration)', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'step_A', phase: 'using_tools', label: 'Checking Shopify' })
    t.ingest({ type: 'agent_step_completed', step_id: 'step_A', label: 'Checked Shopify', status: 'ok', summary: '3 orders', duration_ms: 1200 })
    expect(t.steps.value[0]).toMatchObject({ status: 'ok', label: 'Checked Shopify', summary: '3 orders', durationMs: 1200 })
    expect(t.activeStep.value).toBe(null)
  })

  it('matches completions by id even when they arrive out of order', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'retrieving_context', label: 'Searching' })
    t.ingest({ type: 'agent_step_started', step_id: 'B', phase: 'retrieving_context', label: 'Reading' })
    // complete B first, then A
    t.ingest({ type: 'agent_step_completed', step_id: 'B', label: 'Read', status: 'ok' })
    t.ingest({ type: 'agent_step_completed', step_id: 'A', label: 'Searched', status: 'ok' })
    expect(t.steps.value.find((s) => s.stepId === 'A').status).toBe('ok')
    expect(t.steps.value.find((s) => s.stepId === 'B').status).toBe('ok')
  })

  it('agent_step_failed shows reason and next_action', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'step_A', phase: 'using_tools', label: 'Checking Shopify' })
    t.ingest({ type: 'agent_step_failed', step_id: 'step_A', label: 'Could not reach Shopify', reason: 'a connected service needs reconnecting', next_action: 'Reconnect the service and try again' })
    const s = t.steps.value[0]
    expect(s.status).toBe('failed')
    expect(s.reason).toBe('a connected service needs reconnecting')
    expect(s.nextAction).toBe('Reconnect the service and try again')
    expect(t.hasFailures.value).toBe(true)
  })

  it('source_citation aggregates and deduplicates sources', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'source_citation', kind: 'knowledge_base', name: 'Pricing Policy', ref: 'doc/1' })
    t.ingest({ type: 'source_citation', kind: 'knowledge_base', name: 'Pricing Policy', ref: 'doc/1' }) // dup
    t.ingest({ type: 'source_citation', kind: 'connector', name: 'Shopify' })
    expect(t.sources.value.length).toBe(2)
    expect(t.sources.value.map((s) => s.name)).toEqual(['Pricing Policy', 'Shopify'])
  })

  it('agent_turn_summary marks the timeline complete and clears the status line', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working…' })
    t.ingest({ type: 'agent_turn_summary', final_status: 'completed', tools_used_count: 3, sources_used_count: 2 })
    expect(t.isComplete.value).toBe(true)
    expect(t.currentStatus.value).toBe(null)
    expect(t.summary.value).toMatchObject({ finalStatus: 'completed', label: 'Completed', toolsUsedCount: 3, sourcesUsedCount: 2 })
  })

  it('turn summary reflects warnings / failed-safely', () => {
    const warn = useAgentTimeline()
    warn.ingest({ type: 'agent_turn_summary', final_status: 'completed', had_failures: true })
    expect(warn.summary.value.label).toBe('Completed with warnings')

    const failed = useAgentTimeline()
    failed.ingest({ type: 'agent_turn_summary', final_status: 'failed' })
    expect(failed.summary.value.label).toBe('Failed safely')
  })

  it('captures builder-tier fields (tool, args_preview) when present; leaves them empty otherwise', () => {
    const builder = useAgentTimeline()
    builder.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'using_tools', label: 'Checking Shopify', tool: 'SHOPIFY_GET_ORDERS', args_preview: '{"limit": 5}' })
    expect(builder.steps.value[0].tool).toBe('SHOPIFY_GET_ORDERS')
    expect(builder.steps.value[0].argsPreview).toBe('{"limit": 5}')

    // User tier: backend omits tool/args_preview, so they're simply absent (never reconstructed).
    const user = useAgentTimeline()
    user.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'using_tools', label: 'Checking Shopify' })
    expect(user.steps.value[0].tool).toBe('')
    expect(user.steps.value[0].argsPreview).toBe('')
  })

  it('ingest returns false for non-rich events (old UI path untouched)', () => {
    const t = useAgentTimeline()
    expect(t.ingest({ type: 'assistant_message_chunk', chunk: 'hi' })).toBe(false)
    expect(t.ingest({ type: 'tool_result', tool_name: 'X', result: 'y' })).toBe(false)
    expect(t.hasActivity()).toBe(false)
    expect(t.steps.value.length).toBe(0)
  })

  it('builds a full render model from PUBLIC-shaped rich-only events (no raw tool_call/tool_result)', () => {
    const t = useAgentTimeline()
    // Public-tier events: friendly labels, NO tool/args_preview, NO summary/duration, summary = status only.
    t.ingest({ type: 'agent_status', phase: 'retrieving_context', label: 'Searching available resources…' })
    t.ingest({ type: 'agent_step_started', step_id: 's1', phase: 'retrieving_context', label: 'Checking information' })
    t.ingest({ type: 'agent_step_completed', step_id: 's1', label: 'Checking information', status: 'ok' })
    t.ingest({ type: 'source_citation', kind: 'knowledge_base', name: 'Knowledge Base' }) // no ref on public
    t.ingest({ type: 'agent_turn_summary', final_status: 'completed' }) // no counts on public
    expect(t.steps.value.length).toBe(1)
    expect(t.steps.value[0].tool).toBe('') // never reconstructed
    expect(t.sources.value).toEqual([{ kind: 'knowledge_base', name: 'Knowledge Base', ref: '' }])
    expect(t.summary.value.label).toBe('Completed')
    expect(t.summary.value.toolsUsedCount).toBe(null)
    expect(t.isComplete.value).toBe(true)
  })

  it('interrupt() stops a running step (no infinite spinner) and marks the turn interrupted', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'using_tools', label: 'Checking Shopify' })
    expect(t.activeStep.value.stepId).toBe('A') // spinning
    t.interrupt('Connection lost.')
    expect(t.steps.value[0].status).toBe('interrupted')
    expect(t.activeStep.value).toBe(null) // spinner stopped
    expect(t.isComplete.value).toBe(true)
    expect(t.interrupted.value).toBe(true)
    expect(t.summary.value.finalStatus).toBe('interrupted')
    expect(t.summary.value.label).toBe('Interrupted')
  })

  it('fail() — a server error frame reads as failed, never "connection lost" (prod conv 1661)', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'thinking', label: 'Gathering context' })
    t.fail('This provider\'s API key has reached its spending limit')
    expect(t.activeStep.value).toBe(null)
    expect(t.isComplete.value).toBe(true)
    expect(t.interrupted.value).toBe(false)
    expect(t.summary.value.finalStatus).toBe('failed')
    expect(t.summary.value.label).toBe('Failed safely')
  })

  it('interrupt() is idempotent and harmless with nothing running', () => {
    const t = useAgentTimeline()
    t.interrupt('x')
    t.interrupt('x')
    expect(t.isComplete.value).toBe(true)
    expect(t.steps.value.length).toBe(0)
  })

  it('interrupt() does not override an already-failed summary', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_turn_summary', final_status: 'failed' })
    t.interrupt('drop')
    expect(t.summary.value.finalStatus).toBe('failed') // real terminal status wins
  })

  it('reset clears all state for a new turn; snapshot deep-copies', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'agent_step_started', step_id: 'A', phase: 'using_tools', label: 'Working' })
    t.ingest({ type: 'agent_step_completed', step_id: 'A', label: 'Done', status: 'ok' })
    const snap = t.snapshot()
    t.reset()
    expect(t.steps.value.length).toBe(0)
    expect(t.summary.value).toBe(null)
    expect(t.isComplete.value).toBe(false)
    // snapshot is independent of the live refs
    expect(snap.steps.length).toBe(1)
    expect(snap.steps[0].status).toBe('ok')
  })

  it('segments reasoning into one item per thought (reasoning_done closes a burst)', () => {
    const t = useAgentTimeline()
    // first thought
    t.ingest({ type: 'reasoning_delta', text: 'Let me search ' })
    t.ingest({ type: 'reasoning_delta', text: 'the knowledge base.' })
    t.ingest({ type: 'reasoning_done', duration_ms: 1200 })
    // second thought (a fresh burst — must NOT append to the first)
    t.ingest({ type: 'reasoning_delta', text: 'Now build the page.' })
    t.ingest({ type: 'reasoning_done', duration_ms: 3000 })
    // exactly two reasoning items — the LATEST is the tail (what the UI shows while streaming)
    expect(t.reasoning.value.length).toBe(2)
    expect(t.reasoning.value[0].text).toBe('Let me search the knowledge base.')
    expect(t.reasoning.value[1].text).toBe('Now build the page.')
    // reasoning rows carry a 'reasoning' phase so the timeline can keep them OUT of the action list
    expect(t.steps.value.every((s) => s.phase === 'reasoning')).toBe(true)
  })

  // ── phases cannot overlap ────────────────────────────────────────────────
  //
  // MEASURED on production conv 1358. The timeline showed:
  //
  //     Working on: fetch page: asifsolar.com   11.1s
  //     Working...                                  —
  //     Generating response                       6.5s
  //
  // Both numbers covered the SAME 7.4s of round-2 model time, and the 14 rows summed to 23.6s on a
  // turn whose backend trace was ~15s. Cause: a new phase closed only the LAST row, so the earlier
  // "Working on:" phase stayed running and was closed by the terminal sweep — which stamped it with
  // everything that happened afterwards.
  describe('phase rows never overlap', () => {
    it('a new phase closes an EARLIER phase, not just the last row', () => {
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: fetch page' })
      // A tool row lands on top, so the phase row is no longer last.
      t.ingest({ type: 'agent_step_started', step_id: 'step_F', phase: 'other', label: 'Working' })
      t.ingest({ type: 'agent_status', phase: 'generating_answer', label: 'Generating response' })
      const working = t.steps.value.find((s) => s.label === 'Working on: fetch page')
      expect(working.status).toBe('ok')
      expect(working.durationMs).not.toBeNull()
    })

    it('at most one phase row is running at any point', () => {
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: fetch page' })
      t.ingest({ type: 'agent_step_started', step_id: 'step_F', phase: 'other', label: 'Working' })
      t.ingest({ type: 'agent_status', phase: 'generating_answer', label: 'Generating response' })
      const openPhases = t.steps.value.filter((s) => s.isPhase && s.status === 'running')
      expect(openPhases.length).toBe(1)
      expect(openPhases[0].label).toBe('Generating response')
    })

    it('a tool row keeps the BACKEND duration — a phase change must not invent one', () => {
      // FETCH_PAGE really did take 450ms; only the phase rows were wrong.
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: fetch page' })
      t.ingest({ type: 'agent_step_started', step_id: 'step_F', phase: 'other', label: 'Working' })
      t.ingest({ type: 'agent_status', phase: 'generating_answer', label: 'Generating response' })
      const tool = t.steps.value.find((s) => s.stepId === 'step_F')
      expect(tool.status).toBe('running')
      t.ingest({ type: 'agent_step_completed', step_id: 'step_F', duration_ms: 450 })
      expect(tool.durationMs).toBe(450)
    })

    it('the upgrade path also closes an older phase', () => {
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'retrieving_context', label: 'Searching' })
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: fetch page' })
      // same phase → the row is UPGRADED into the tool step rather than duplicated
      t.ingest({ type: 'agent_step_started', step_id: 'step_F', phase: 'using_tools', label: 'Working' })
      const searching = t.steps.value.find((s) => s.label === 'Searching')
      expect(searching.status).toBe('ok')
      expect(t.steps.value.filter((s) => s.isPhase && s.status === 'running').length).toBe(0)
    })

    it('relabelling the SAME phase does not close it', () => {
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: step 1' })
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: step 2' })
      const rows = t.steps.value.filter((s) => s.isPhase)
      expect(rows.length).toBe(1)
      expect(rows[0].status).toBe('running')
      expect(rows[0].label).toBe('Working on: step 2')
    })

    it('the rows sum to no more than the turn', () => {
      const t = useAgentTimeline()
      t.ingest({ type: 'agent_status', phase: 'using_tools', label: 'Working on: fetch page' })
      t.ingest({ type: 'agent_step_started', step_id: 'step_F', phase: 'other', label: 'Working' })
      t.ingest({ type: 'agent_step_completed', step_id: 'step_F', duration_ms: 450 })
      t.ingest({ type: 'agent_status', phase: 'generating_answer', label: 'Generating response' })
      t.ingest({ type: 'agent_turn_summary', final_status: 'completed' })
      const phases = t.steps.value.filter((s) => s.isPhase)
      // No phase may still be open, and none may have absorbed another's time.
      expect(phases.every((s) => s.status === 'ok')).toBe(true)
      const total = phases.reduce((a, s) => a + (s.durationMs || 0), 0)
      expect(total).toBeLessThan(5000)
    })
  })

  it('folds live token metering from token_usage + reconciles on complete', () => {
    const t = useAgentTimeline()
    t.ingest({ type: 'token_usage', total_tokens: 900, cost_usd: 0.004, estimated: true })
    expect(t.tokens.value.total).toBe(900)
    // an exact tick must not be regressed by a smaller estimate
    t.ingest({ type: 'token_usage', total_tokens: 1200, cost_usd: 0.006 })
    t.ingest({ type: 'token_usage', total_tokens: 1100, cost_usd: 0.005, estimated: true })
    expect(t.tokens.value.total).toBe(1200)
    // final exact usage reconciles the counter
    t.ingest({ type: 'assistant_message_complete', usage: { total_tokens: 1300, cost_usd: 0.007 } })
    expect(t.tokens.value.total).toBe(1300)
    expect(t.tokens.value.estimated).toBe(false)
  })
})
