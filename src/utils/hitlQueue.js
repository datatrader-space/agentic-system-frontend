// The queue of approval cards a chat surface shows (ADM-1281 / 1283): one set of rules for the chat store and every
// surface that keeps its own queue (`composables/useHitl`).
//
// - Skip moves a card to the back of the queue; it is never dropped, since the run still waits on it.
// - Dismiss is only for a card with nothing to answer: a notification, a card past its deadline, or one the run
//   replaced. Every other card is answered, skipped or cancelled ("Cancel this step", a deny the server records).
// - A card the run replaced (it restarted and asked again, or ended: the server marks it `superseded`) reads so for a
//   moment, with no buttons, and then goes.

/** How long a replaced card stays on screen before it goes. */
export const SUPERSEDED_CARD_MS = 8000

/** The reason "Cancel this step" sends with its deny. */
export const CANCEL_STEP_FEEDBACK = 'cancelled by you'

/** A card whose deadline passed: the server has closed it. */
export function hitlExpired(card, now = Date.now()) {
  return !!card?.timeout_at && new Date(card.timeout_at).getTime() <= now
}

/** Nothing to answer on this card: a notification, an expired card, or one the run replaced. */
export function hitlNothingToAnswer(card, now = Date.now()) {
  return !!card && (card.response_type === 'none' || card.state === 'superseded' || hitlExpired(card, now))
}

/** Is any card still holding a turn open? A parked card does not (its run ended its turn), nor a replaced one. */
export function hasLiveHitlCard(cards) {
  return (cards || []).some((r) => !r.parked && r.state !== 'superseded')
}

/** The queue with ``requestId`` moved to the back (a new array; unchanged when it is alone or absent). */
export function skipHitlCard(cards, requestId) {
  const list = cards || []
  const card = list.find((r) => r.request_id === requestId)
  if (!card || list.length < 2) return list
  return [...list.filter((r) => r.request_id !== requestId), card]
}

/** The queue with ``requestId`` marked replaced and moved behind every card that still waits, so a live card (the
 * one asked again) is answered first. ``answered`` (a card this page answered a moment ago) comes back so the person
 * sees why their answer did nothing. */
export function supersedeHitlCard(cards, requestId, answered = null) {
  const list = cards || []
  const card = list.find((r) => r.request_id === requestId) || answered
  if (!card) return list
  return [...list.filter((r) => r.request_id !== requestId), { ...card, state: 'superseded' }]
}
