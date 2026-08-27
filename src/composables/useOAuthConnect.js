// Reusable OAuth "connect with your account" popup flow.
//
// Extracted from the original Connections.vue handler so the new Connectors page drives the exact same
// provider OAuth flow. Opens the provider authorize URL in a popup, then resolves when the callback
// posts back `oauth-connection-result`.
//
// A CLOSED POPUP IS NOT A FAILURE, and treating it as one is what this file got wrong.
//
// Django 4.2 defaults `SECURE_CROSS_ORIGIN_OPENER_POLICY` to `same-origin`, so the callback page was
// served with `Cross-Origin-Opener-Policy: same-origin`. A popup that has navigated cross-origin (to
// accounts.google.com and back) under that policy has its `window.opener` SEVERED — so the callback
// posted nothing, closed on its timer, and the poll below rejected with "Connection window was closed"
// for a Google connection that had fully succeeded: tokens stored, scopes granted, and visible the
// moment the user refreshed. Being told the opposite of what happened is worse than a plain error,
// because it invites a retry of something that already worked.
//
// The header is fixed server-side (`agent/services/oauth_popup.py`). This file no longer TRUSTS the
// message either: a lost `postMessage` has other causes — an extension, a parent that navigated, a
// listener attached late — and the only authority on whether a connection exists is the server. So on
// a closed popup we ASK, and report failure only if the connection genuinely is not there.
//
// Usage:
//   import { connectOAuth } from '@/composables/useOAuthConnect'
//   await connectOAuth(api, providerSlug, { owner: 'org', scopes: 'a,b' })

// Written by the popup as a second channel in case the message is lost. Kept in sync with
// `_STORAGE_KEY` in agent/services/oauth_popup.py.
const RESULT_KEY = 'aadml:oauth-result'

function readStoredResult() {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    if (!raw) return null
    localStorage.removeItem(RESULT_KEY)   // consume it, so a stale result cannot satisfy a later attempt
    return JSON.parse(raw)
  } catch {
    return null   // partitioned or blocked storage throws rather than returning null
  }
}

// The server is the only authority on whether the connection exists. Returns true/false, never throws —
// a failed status check must not turn into "connection failed", which is a different claim.
async function isConnected(api, providerSlug) {
  try {
    const { data } = await api.getConnections()
    const rows = data?.results || data?.connections || data || []
    const slug = String(providerSlug || '').toLowerCase()
    return (Array.isArray(rows) ? rows : []).some((c) => {
      const s = String(c.provider_slug || c.provider || '').toLowerCase()
      const status = String(c.status || '').toLowerCase()
      return s === slug && status !== 'disconnected' && status !== 'revoked' && status !== 'error'
    })
  } catch {
    return false
  }
}

export function connectOAuth(api, providerSlug, opts = {}) {
  return new Promise((resolve, reject) => {
    // Clear any result left by a previous attempt before opening, or a stale success could satisfy
    // a connect the user then cancels.
    readStoredResult()

    api
      .startConnection(providerSlug, opts)
      .then((response) => {
        const redirectUrl = response.data?.redirect_url
        if (!redirectUrl) {
          reject(new Error('No redirect URL received'))
          return
        }

        const popup = window.open(
          redirectUrl,
          'oauth-connection',
          'width=600,height=700,left=200,top=100'
        )
        if (!popup) {
          reject(new Error('Popup blocked — please allow popups for this site'))
          return
        }

        let settled = false
        const cleanup = () => {
          if (settled) return false
          settled = true
          window.removeEventListener('message', onMessage)
          clearInterval(popupPoll)
          clearTimeout(timeout)
          return true
        }

        const onMessage = (event) => {
          if (event.data?.type !== 'oauth-connection-result') return
          if (!cleanup()) return
          if (event.data.status === 'success') resolve(true)
          else reject(new Error(event.data.error || 'Connection failed'))
        }
        window.addEventListener('message', onMessage)

        // The popup vanished without telling us anything. Before calling that a failure, check whether
        // the connection actually landed — see the note at the top of this file.
        const settleFromServer = async (fallbackMessage) => {
          const stored = readStoredResult()
          if (stored) {
            if (stored.status === 'success' || stored.ok) return resolve(true)
            return reject(new Error(stored.error || stored.message || fallbackMessage))
          }
          if (await isConnected(api, providerSlug)) return resolve(true)
          reject(new Error(fallbackMessage))
        }

        const popupPoll = setInterval(() => {
          if (!popup.closed) return
          if (!cleanup()) return
          // A small delay: the popup can close a beat before the server has finished committing, and
          // asking too early would produce the very false negative this exists to prevent.
          setTimeout(() => settleFromServer('Connection window was closed before it finished'), 600)
        }, 500)

        const timeout = setTimeout(() => {
          if (!cleanup()) return
          try { popup.close() } catch { /* already gone */ }
          settleFromServer('Connection timed out')
        }, 120000)
      })
      .catch((error) => {
        reject(new Error(error.response?.data?.error || 'Failed to start connection'))
      })
  })
}
