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
  const permissionRequests = ref([])   // [{ card, message_id }]

  function handlePermissionEvent(evt) {
    if (!evt || evt.type !== 'permission_request') return false
    permissionRequests.value.push({ card: evt.card || {}, message_id: evt.message_id || '' })
    return true
  }

  // Returns the choice ('allow_*' | 'deny') so the caller can decide whether to auto-continue the task.
  function respondPermission(card, choiceOrLabel) {
    const choice = LABEL_TO_CHOICE[choiceOrLabel] ? LABEL_TO_CHOICE[choiceOrLabel]
      : (['allow_once', 'allow_task', 'allow_project', 'deny', 'always_deny'].includes(choiceOrLabel)
        ? choiceOrLabel : choiceForLabel(choiceOrLabel))
    try { sendFn({ type: 'permission_response', card, choice }) } catch (e) { /* noop */ }
    // Dequeue by raw identity — queued objects are reactive proxies, so a raw `card` won't === r.card.
    const raw = toRaw(card)
    permissionRequests.value = permissionRequests.value.filter((r) => toRaw(r.card) !== raw)
    return choice
  }

  function clearPermissions() { permissionRequests.value = [] }

  return { permissionRequests, handlePermissionEvent, respondPermission, clearPermissions, choiceForLabel }
}
