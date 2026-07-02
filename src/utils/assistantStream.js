/**
 * Pure mapper for AI Assistant WS events → the widget bubble payload.
 *
 * Supports BOTH protocols so the widget works whether the transport is the dedicated
 * Help Assistant consumer or the shared chat engine (/ws/chat/agent/):
 *   dedicated:  assistant_start | assistant_delta | citations | suggested_actions | no_answer | assistant_done
 *   engine:     conversation_created | assistant_message_chunk | assistant_message_complete
 *               (+ shared suggested_actions) ; ignores tool_call / reasoning_delta / auto_status / ...
 *
 * Mutates `payload` in place and returns { done, error, convId } control signals.
 * Never double-applies citations (engine citations ride on assistant_message_complete;
 * the dedicated path uses the citations event — a turn only sees one of the two).
 */
export function applyAssistantWsEvent(payload, ev) {
  const out = { done: false, error: null, convId: null }
  if (!ev || !ev.type) return out
  const p = payload
  switch (ev.type) {
    // ── Dedicated Help Assistant protocol ──
    case 'assistant_start': break
    case 'assistant_delta': p.answer = (p.answer || '') + (ev.delta || ''); break
    case 'citations': p.sources = ev.sources || []; break
    case 'no_answer':
      p.no_answer = true
      p.fallback_message = ev.fallback_message || ''
      p.suggested_actions = ev.suggested_actions || []
      break
    case 'assistant_done': out.done = true; break

    // ── Generic chat engine protocol ──
    case 'conversation_created': out.convId = ev.conversation_id || ev.id || null; break
    case 'assistant_message_chunk': p.answer = (p.answer || '') + (ev.chunk || ''); break
    case 'assistant_message_complete':
      if (ev.full_message) p.answer = ev.full_message
      if (Array.isArray(ev.citations)) {
        p.sources = ev.citations
          .map(c => ({ content_title: c.title || c.name, section_heading: c.section, url: c.url }))
          .filter(s => s.url || s.content_title)
      }
      out.done = true
      break

    // ── Shared ──
    case 'suggested_actions': p.suggested_actions = ev.actions || ev.suggested_actions || []; break
    case 'error': out.error = ev.error || 'stream'; break
    default: break   // ignore ping / tool_call / reasoning_delta / auto_status / ...
  }
  return out
}
