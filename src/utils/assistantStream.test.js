import { describe, it, expect } from 'vitest'
import { applyAssistantWsEvent } from './assistantStream'

const blank = () => ({ answer: '', sources: [], suggested_actions: [], no_answer: false, fallback_message: '' })

describe('applyAssistantWsEvent — dual protocol', () => {
  // ── Dedicated Help Assistant path (flag OFF) ──
  it('dedicated path streams text + citations + actions + done', () => {
    const p = blank()
    applyAssistantWsEvent(p, { type: 'assistant_start' })
    applyAssistantWsEvent(p, { type: 'assistant_delta', delta: 'To add ' })
    applyAssistantWsEvent(p, { type: 'assistant_delta', delta: 'a KB…' })
    applyAssistantWsEvent(p, { type: 'citations', sources: [{ content_title: 'KB', section_heading: 'Add', url: '/x#add' }] })
    applyAssistantWsEvent(p, { type: 'suggested_actions', actions: [{ type: 'open_section', label: 'Open', url: '/x#add' }] })
    const done = applyAssistantWsEvent(p, { type: 'assistant_done' })
    expect(p.answer).toBe('To add a KB…')
    expect(p.sources).toHaveLength(1)
    expect(p.suggested_actions).toHaveLength(1)
    expect(done.done).toBe(true)
  })

  // ── Generic chat engine path (flag ON) ──
  it('engine path streams text via chunks + completes', () => {
    const p = blank()
    applyAssistantWsEvent(p, { type: 'conversation_created', conversation_id: 42 })
    applyAssistantWsEvent(p, { type: 'assistant_message_chunk', chunk: 'Open ' })
    applyAssistantWsEvent(p, { type: 'assistant_message_chunk', chunk: 'Connectors.' })
    const r = applyAssistantWsEvent(p, { type: 'assistant_message_complete', full_message: 'Open Connectors and click Connect.' })
    expect(p.answer).toBe('Open Connectors and click Connect.')
    expect(r.done).toBe(true)
  })

  it('engine path renders citations from assistant_message_complete', () => {
    const p = blank()
    applyAssistantWsEvent(p, { type: 'assistant_message_complete', full_message: 'x', citations: [
      { n: 1, title: 'Connect GitHub', section: 'Connect GitHub', url: '/dashboard/help-center/article/connect-github#connect-github' },
    ] })
    expect(p.sources).toEqual([{
      content_title: 'Connect GitHub', section_heading: 'Connect GitHub',
      url: '/dashboard/help-center/article/connect-github#connect-github',
    }])
  })

  it('engine path renders a late suggested_actions event (after completion)', () => {
    const p = blank()
    applyAssistantWsEvent(p, { type: 'assistant_message_complete', full_message: 'x' })
    applyAssistantWsEvent(p, { type: 'suggested_actions', actions: [{ type: 'start_tour', label: 'Start tour: Connect GitHub' }] })
    expect(p.suggested_actions).toHaveLength(1)
    expect(p.suggested_actions[0].label).toContain('Start tour')
  })

  it('does NOT double-apply citations (only one source of truth per turn)', () => {
    const p = blank()
    applyAssistantWsEvent(p, { type: 'assistant_message_complete', full_message: 'x', citations: [{ title: 'A', section: 'S', url: '/a' }] })
    expect(p.sources).toHaveLength(1)
    // A stray dedicated 'citations' event would replace (not append) — still one set, no dup accumulation.
    applyAssistantWsEvent(p, { type: 'citations', sources: [{ content_title: 'A', section_heading: 'S', url: '/a' }] })
    expect(p.sources).toHaveLength(1)
  })

  it('ignores engine noise (tool_call / reasoning_delta / ping)', () => {
    const p = blank()
    for (const t of ['tool_call', 'reasoning_delta', 'auto_status', 'ping']) {
      const r = applyAssistantWsEvent(p, { type: t, chunk: 'nope' })
      expect(r.done).toBe(false)
    }
    expect(p.answer).toBe('')
  })

  it('surfaces errors', () => {
    expect(applyAssistantWsEvent(blank(), { type: 'error', error: 'boom' }).error).toBe('boom')
  })
})
