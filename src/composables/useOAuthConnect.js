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

import { runOAuthPopup } from '@/composables/useOAuthPopup'

// A completed connect changes server state that no SPA write touched (the provider redirected the popup
// to the backend callback), so the GET cache must not keep the pre-connect answer: runOAuthPopup clears
// it before asking the server below and again when the flow ends, whatever the outcome.

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

// Resolves true when connected; rejects with an Error whose message can be shown to the person.
// Call it BEFORE any await in the click handler: the popup opens synchronously (see useOAuthPopup.js).
export async function connectOAuth(api, providerSlug, opts = {}) {
  const result = await runOAuthPopup(
    async () => {
      try {
        const response = await api.startConnection(providerSlug, opts)
        return response.data?.redirect_url
      } catch (error) {
        throw new Error(error?.response?.data?.error || 'Failed to start connection')
      }
    },
    {
      messageTypes: ['oauth-connection-result'],
      verify: () => isConnected(api, providerSlug),
    },
  )
  if (result.ok) return true
  throw new Error(result.error || 'Connection failed')
}
