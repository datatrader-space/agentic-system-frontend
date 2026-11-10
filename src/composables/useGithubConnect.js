// Connect GitHub the way the Connectors page does: the GitHub SERVICE's own sign-in
// (/api/oauth/start/<service id>/), which stores the service's credential. That credential is the one
// record the platform reads for GitHub (repository list, clone, push, pull requests).
//
// Let's Code and a system's page used `connectOAuth(api, 'github')`, the old provider flow: it stored a
// separate connection the GitHub resolver never reads, so after "GitHub connected" the repositories
// still said "Connect GitHub" (live, 2026-11-10, ADM-1202).
import { runOAuthPopup } from '@/composables/useOAuthPopup'

// The GitHub service row from the connectors list. Its id differs per environment, so it is looked up.
export async function findGithubService(api) {
  const { data } = await api.getConnectors('global')
  const rows = Array.isArray(data) ? data : (data?.connectors || data?.results || [])
  const github = rows.filter((c) => c?.kind === 'service' && String(c.slug || '').toLowerCase() === 'github')
  return github.find((c) => c.is_builtin) || github[0] || null
}

const NOT_SET_UP = 'GitHub is not set up on this platform. Ask an administrator to add the GitHub connector.'

// GitHub's own account picker: without it GitHub silently reuses the account signed in on github.com, so
// "Switch account" would reconnect the same one.
function withAccountPicker(url) {
  try {
    const u = new URL(url)
    u.searchParams.set('prompt', 'select_account')
    return u.toString()
  } catch { return url }
}

// Resolves when GitHub is connected; rejects with an Error whose message can be shown to the person.
// `switchAccount` shows GitHub's account picker. Call it BEFORE any await in the click handler: the popup
// opens synchronously (see useOAuthPopup.js).
export async function connectGithubService(api, { switchAccount = false } = {}) {
  let serviceId = null
  const result = await runOAuthPopup(async () => {
    const svc = await findGithubService(api)
    if (!svc) throw new Error(NOT_SET_UP)
    serviceId = svc.id
    let url
    try {
      url = (await api.startOAuth(serviceId)).data?.redirect_url
    } catch (e) {
      const err = e?.response?.data
      throw new Error(err?.detail || err?.error || 'Could not start the GitHub sign-in')
    }
    return url && switchAccount ? withAccountPicker(url) : url
  }, {
    name: 'oauth_popup',
    messageTypes: ['oauth_result'],
    verify: async () => {
      if (!serviceId) return false
      try { return !!(await api.getOAuthStatus(serviceId)).data?.connected } catch { return false }
    },
  })
  if (result.ok) return true
  if (result.status === 'cancelled') throw new Error('GitHub sign-in was cancelled')
  throw new Error(result.error || 'GitHub connection failed')
}

// Disconnects GitHub the way the Connectors page does: the service's credential is removed and revoked on
// GitHub. Rejects with an Error whose message can be shown to the person.
export async function disconnectGithubService(api) {
  const svc = await findGithubService(api)
  if (!svc) throw new Error(NOT_SET_UP)
  try {
    await api.disconnectOAuth(svc.id)
  } catch (e) {
    throw new Error(e?.response?.data?.error || 'Could not disconnect GitHub')
  }
}
