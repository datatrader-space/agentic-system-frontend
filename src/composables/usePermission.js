// usePermission — Coding Agent Runtime (Phase 6). Handles the `permission_request` WS event (the agent
// paused on a protected/risky action) and sends the user's allow/deny back as `permission_response`.
// Mirrors useHitl: handle<Event> returns true when it consumes the event; respond<...> sends over the
// same socket. No native dialogs — the card is rendered by PermissionCard.vue.
import { ref, toRaw } from 'vue'

const LABEL_TO_CHOICE = {
  'Allow once': 'allow_once',
  'Allow for this task': 'allow_task',
  'Always allow for this project': 'allow_project',
  'Deny': 'deny',
}

export function choiceForLabel(label) {
  if (LABEL_TO_CHOICE[label]) return LABEL_TO_CHOICE[label]
  return String(label || '').toLowerCase().includes('deny') ? 'deny' : 'allow_once'
}

export function usePermission(sendFn, getConversationId) {
  const permissionRequests = ref([])   // [{ card, message_id, expired }]

  function handlePermissionEvent(evt) {
    if (!evt || evt.type !== 'permission_request') return false
    permissionRequests.value.push({ card: evt.card || {}, message_id: evt.message_id || '', expired: false })
    return true
  }

  // A card asked at the end of a turn belongs to that turn. Once another turn starts, its request is gone: it shows
  // as expired, never with live buttons (phase 8 run 3, finding 34: a turn-1 card kept "Allow once" on later turns).
  function expirePermissions() {
    for (const r of permissionRequests.value) r.expired = true
  }

  // Returns the choice ('allow_*' | 'deny') so the caller can decide whether to auto-continue the task, or null when
  // the card is not one this page still waits on (expired with its turn): nothing is sent for it.
  function respondPermission(card, choiceOrLabel) {
    // Matched by raw identity — queued objects are reactive proxies, so a raw `card` won't === r.card.
    const raw = toRaw(card)
    if (permissionRequests.value.some((r) => toRaw(r.card) === raw && r.expired)) return null
    const choice = LABEL_TO_CHOICE[choiceOrLabel] ? LABEL_TO_CHOICE[choiceOrLabel]
      : (['allow_once', 'allow_task', 'allow_project', 'deny', 'always_deny'].includes(choiceOrLabel)
        ? choiceOrLabel : choiceForLabel(choiceOrLabel))
    try { sendFn({ type: 'permission_response', card, choice }) } catch (e) { /* noop */ }
    permissionRequests.value = permissionRequests.value.filter((r) => toRaw(r.card) !== raw)
    return choice
  }

  function clearPermissions() { permissionRequests.value = [] }

  return { permissionRequests, handlePermissionEvent, respondPermission, expirePermissions, clearPermissions, choiceForLabel }
}
