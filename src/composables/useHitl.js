import { ref } from 'vue'

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
 * @returns queue ref + event/response handlers to wire into the surface.
 */
export function useHitl(sendFn) {
  const hitlRequests = ref([])

  /** Feed a raw WS event; returns true if it was a HITL event (so the caller can stop). */
  function handleHitlEvent(evt) {
    if (!evt || !evt.type) return false
    if (evt.type === 'hitl_request') {
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
        })
      }
      return true
    }
    if (evt.type === 'hitl_response_ack') {
      hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== evt.request_id)
      return true
    }
    return false
  }

  function respondHitl({ request_id, response_value, feedback }) {
    sendFn({ type: 'hitl_response', request_id, response_value, feedback: feedback || '' })
    // Optimistically clear; the hitl_response_ack will also clear it.
    hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== request_id)
  }

  function dismissHitl(requestId) {
    hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== requestId)
  }

  function skipHitl(requestId) {
    hitlRequests.value = hitlRequests.value.filter((r) => r.request_id !== requestId)
  }

  return { hitlRequests, handleHitlEvent, respondHitl, dismissHitl, skipHitl }
}
