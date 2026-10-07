// The live view's wire format and input mapping, as pure functions.
//
// The backend relay (`agent/browser_live_consumer.py`) sends each frame as ONE binary message: a 4-byte
// big-endian length, a JSON header of that length, then the JPEG. Input goes back as small JSON events in
// the BROWSER'S pixels, not ours: the header carries the remote viewport (`w` x `h`), and a click on the
// picture is scaled into that space here, so a panel of any width drives the same page.
//
// Kept apart from the component and the socket so the two things most likely to be subtly wrong — where a
// click lands, and which keys are forwarded — can be tested without a DOM or a network.

const _decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null

/** Split one binary frame message into `{ header, jpeg }`, or null when it is not one. */
export function parseFrame(buffer) {
  if (!buffer || buffer.byteLength < 4 || !_decoder) return null
  const view = new DataView(buffer)
  const headLen = view.getUint32(0)
  if (headLen <= 0 || headLen > 65536 || buffer.byteLength < 4 + headLen) return null
  let header
  try {
    header = JSON.parse(_decoder.decode(new Uint8Array(buffer, 4, headLen)))
  } catch (e) {
    return null
  }
  if (!header || header.t !== 'frame') return null
  return { header, jpeg: new Uint8Array(buffer, 4 + headLen) }
}

/**
 * Where a pointer is ON THE REMOTE PAGE, given where it is on the picture.
 * `rect` is the picture's box on our screen; `viewport` is the remote page's size. Clamped to the page:
 * a drag that leaves the picture keeps reporting its nearest edge instead of a point that does not exist.
 */
export function toRemotePoint(clientX, clientY, rect, viewport) {
  if (!rect || !rect.width || !rect.height || !viewport || !viewport.w || !viewport.h) return null
  const x = ((clientX - rect.left) / rect.width) * viewport.w
  const y = ((clientY - rect.top) / rect.height) * viewport.h
  return {
    x: Math.round(Math.max(0, Math.min(viewport.w - 1, x))),
    y: Math.round(Math.max(0, Math.min(viewport.h - 1, y))),
  }
}

const _BUTTONS = ['left', 'middle', 'right']

/** A pointer press or release as the relay accepts it. `detail` is the browser's click count. */
export function pointerEvent(kind, point, button = 0, detail = 1) {
  if (!point) return null
  const out = { t: 'pointer', k: kind, x: point.x, y: point.y }
  if (kind !== 'move') {
    out.b = _BUTTONS[button] || 'left'
    out.c = Math.max(1, Math.min(3, Number(detail) || 1))
  }
  return out
}

/** A wheel turn, in pixels. Lines and pages are converted so a mouse and a trackpad scroll alike. */
export function wheelEvent(point, e) {
  if (!point) return null
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
  return { t: 'wheel', x: point.x, y: point.y, dx: Math.round((e.deltaX || 0) * unit), dy: Math.round((e.deltaY || 0) * unit) }
}

/**
 * What a key press means for the remote page: `{ event }` to forward, `{ paste: true }` to let our own
 * paste handler supply the text, or null to ignore.
 *
 * Ctrl/Cmd+V is NOT forwarded as a key. The remote browser's clipboard is empty and is not ours to read or
 * write; forwarding the chord would paste nothing there. The text comes from the `paste` event on OUR page
 * instead, and is typed in as text.
 */
export function keyAction(e, kind) {
  if (!e || e.isComposing || e.key === 'Process' || e.key === 'Unidentified' || !e.key) return null
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) return { paste: true }
  if (e.key.length > 32) return null
  return { event: { t: 'key', k: kind, key: e.key } }
}

/** Typed or pasted text as one event, cut to what the relay accepts. */
export function textEvent(text) {
  const s = String(text || '')
  return s ? { t: 'text', text: s.slice(0, 4000) } : null
}

/** The words for a session's state, as a person reads them on the card. */
export function stateLabel(session) {
  if (!session) return ''
  if (session.control && session.control.mine) return 'You are in control'
  switch (session.state) {
    case 'REQUESTED':
    case 'PROVISIONING':
    case 'READY':
      return 'Starting'
    case 'ACTIVE':
      // A finished run parks its browser: the session is kept, nothing is running in it, and it comes
      // back when the agent next uses it. "Working" beside a browser that is asleep is not true.
      return session.unwatchable_reason === 'PARKED' ? 'Paused' : 'Working'
    case 'WAITING_HUMAN':
      return 'Waiting for you'
    case 'CHECKPOINTING':
      return 'Saving'
    default:
      return 'Ended'
  }
}

/** What the page is asking a person to do, when it is asking. */
export function challengeLabel(challenge) {
  switch (challenge) {
    case 'CAPTCHA': return 'This page is asking for a verification only a person can complete.'
    case 'MFA': return 'This page is asking for a verification code sent to you.'
    case 'LOGIN': return 'This page is asking you to sign in.'
    default: return challenge ? 'This page needs you.' : ''
  }
}

export const isEnded = (session) => !!session && ['STOPPED', 'FAILED', 'CANCELLED', 'REAPED'].includes(session.state)
