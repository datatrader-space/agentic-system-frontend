import { ref } from 'vue'
import { hitlNothingToAnswer, skipHitlCard, supersedeHitlCard, SUPERSEDED_CARD_MS } from '@/utils/hitlQueue'

/**
 * Shared human-in-the-loop (HITL) approval handling for the chat surfaces.
 *
 * The backend gates mutating/destructive/external tools for approval and sends a `hitl_request`
 * over the chat WebSocket; the user approves/rejects via <HITLModal>, which sends a `hitl_response`
 * back. This composable centralizes that queue + protocol so every chat surface behaves identically
 * (New Chat, Emulator, Repository/Planner chat). The DB row is the source of truth on the backend —
 * the frontend only renders the prompt and relays the user's decision.
 *
 * @param {(obj: object) => void} sendFn  Sends a JSON message over that surface's WebSocket.
 * @param {() => (string|number|null)} [getConversationId]  Returns THIS window's active conversation
 *   id. HITL requests are broadcast to a user-level group, so every open window/tab receives them;
 *   when provided, we only queue a request whose `conversation_id` matches this window (the one that
 *   triggered the turn). Omit it to keep the old behavior (show everywhere).
 * @returns queue ref + event/response handlers to wire into the surface.
 */
export function useHitl(sendFn, getConversationId = null) {
  const hitlRequests = ref([])
  const answered = new Map()

  /** Feed a raw WS event; returns true if it was a HITL event (so the caller can stop). */
  function handleHitlEvent(evt) {
    if (!evt || !evt.type) return false
    if (evt.type === 'hitl_request') {
      // Strict per-conversation scoping — show the card ONLY in the window viewing its conversation; drop it
      // in every other chat / agent / surface. A legacy card with no conversation_id still falls through.
      const cid = String(evt.conversation_id || evt.payload?.conversation_id || '')
      const mine = String((getConversationId ? getConversationId() : '') || '')
      if (cid && cid !== mine) return true
      if (!hitlRequests.value.some((r) => r.request_id === evt.request_id)) {
        hitlRequests.value.push({
          request_id: evt.request_id,
          interaction_type: evt.interaction_type,
          response_type: evt.response_type,
          summary: evt.summary,
          services: evt.services || [],
          payload: evt.payload || {},
          options: evt.options || [],
          urgency: evt.urgency || 'medium',
          timeout_at: evt.timeout_at || null,
          // Whether it is live, and a Let's Code step's working copy and risk (backend `hitl.frames`, ADM-1281).
          state: evt.state || 'pending',
          working_copy: evt.working_copy ?? null,
          risk: evt.risk || null,
        })
      }
      return true
    }
    if (evt.type === 'hitl_resolved' && evt.status === 'superseded') {
      // The run replaced this card (it restarted and asked again, or ended): it says so for a moment, then goes.
      hitlRequests.value = supersedeHitlCard(hitlRequests.value, evt.request_id, answered.get(evt.request_id))
      answered.delete(evt.request_id)
      setTimeout(() => {
        hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== evt.request_id)
      }, SUPERSEDED_CARD_MS)
      return true
    }
    if (evt.type === 'hitl_response_ack' || evt.type === 'hitl_resolved') {
      // answered on this socket (ack) OR resolved anywhere (broadcast) → clear the card in this window too.
      answered.delete(evt.request_id)
      hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== evt.request_id)
      return true
    }
    return false
  }

  function respondHitl({ request_id, response_value, feedback }) {
    sendFn({ type: 'hitl_response', request_id, response_value, feedback: feedback || '' })
    // Optimistically clear; the hitl_response_ack will also clear it. Kept aside until then, so a card the run replaced
    // meanwhile comes back reading "Replaced".
    const card = hitlRequests.value.find((r) => r.request_id === request_id)
    if (card) answered.set(request_id, card)
    hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== request_id)
  }

  // Only a card with nothing to answer is dismissed; a card that waits is answered, skipped or cancelled.
  function dismissHitl(requestId) {
    const card = hitlRequests.value.find((r) => r.request_id === requestId)
    if (!card || !hitlNothingToAnswer(card)) return
    hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== requestId)
  }

  // Skip: the next card first; this one waits at the back of the queue. Nothing is sent.
  function skipHitl(requestId) {
    hitlRequests.value = skipHitlCard(hitlRequests.value, requestId)
  }

  return { hitlRequests, handleHitlEvent, respondHitl, dismissHitl, skipHitl }
}
