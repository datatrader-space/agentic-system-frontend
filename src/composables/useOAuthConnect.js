// Reusable OAuth "connect with your account" popup flow.
//
// Extracted from the original Connections.vue handler so the new Connectors page
// drives the exact same provider OAuth flow. Opens the provider authorize URL in a
// popup, then resolves when the callback posts back `oauth-connection-result`
// (or rejects if the popup is blocked / closed / times out).
//
// Usage:
//   import { connectOAuth } from '@/composables/useOAuthConnect'
//   await connectOAuth(api, providerSlug, { owner: 'org', scopes: 'a,b' })

export function connectOAuth(api, providerSlug, opts = {}) {
  return new Promise((resolve, reject) => {
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
          if (settled) return
          settled = true
          window.removeEventListener('message', onMessage)
          clearInterval(popupPoll)
          clearTimeout(timeout)
        }

        const onMessage = (event) => {
          if (event.data?.type === 'oauth-connection-result') {
            if (event.data.status === 'success') {
              cleanup()
              resolve(true)
            } else {
              cleanup()
              reject(new Error(event.data.error || 'Connection failed'))
            }
          }
        }
        window.addEventListener('message', onMessage)

        const popupPoll = setInterval(() => {
          if (popup.closed) {
            const wasSettled = settled
            cleanup()
            if (!wasSettled) reject(new Error('Connection window was closed'))
          }
        }, 500)

        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error('Connection timed out'))
        }, 120000)
      })
      .catch((error) => {
        reject(new Error(error.response?.data?.error || 'Failed to start connection'))
      })
  })
}
