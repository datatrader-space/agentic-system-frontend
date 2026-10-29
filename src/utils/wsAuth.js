// A browser chat socket carries its token as a WebSocket subprotocol, never in the URL (security S5): a URL
// is written to proxy and access logs and kept in the browser history, and the browser's WebSocket API
// cannot set an Authorization header. The server (agent/ws_auth.py) verifies `aadml.auth.<base64url(token)>`,
// drops it from the connection, and selects `aadml.chat`; a token that does not verify refuses the socket.
export const CHAT_PROTOCOL = 'aadml.chat'
const AUTH_PROTOCOL_PREFIX = 'aadml.auth.'

function base64url(text) {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The subprotocols to open a chat socket with: `new WebSocket(url, chatAuthProtocols(token))`. */
export function chatAuthProtocols(token) {
  return [CHAT_PROTOCOL, AUTH_PROTOCOL_PREFIX + base64url(String(token))]
}
