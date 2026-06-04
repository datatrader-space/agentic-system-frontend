// src/services/tenancyApi.js
/**
 * Tenancy API — All calls to /api/v2/
 * Handles orgs, workspaces, members, teams, and workspace-scoped resources.
 */
import axios from 'axios'

function getCookie(name) {
    let value = null
    if (document.cookie && document.cookie !== '') {
        document.cookie.split(';').forEach((c) => {
            const cookie = c.trim()
            if (cookie.startsWith(name + '=')) {
                value = decodeURIComponent(cookie.substring(name.length + 1))
            }
        })
    }
    return value
}

const tenancyApi = axios.create({
    baseURL: '/api/v2',
    timeout: 30000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

tenancyApi.interceptors.request.use((config) => {
    const csrf = getCookie('csrftoken')
    if (csrf) config.headers['X-CSRFToken'] = csrf

    const wsId = localStorage.getItem('activeWorkspaceId')
    if (wsId) config.headers['X-Workspace-ID'] = wsId

    return config
})

tenancyApi.interceptors.response.use(
    (r) => r,
    (err) => {
        console.error('[tenancyApi]', err?.response?.status, err?.response?.data || err.message)
        return Promise.reject(err)
    }
)

export default {
    // ── Organisations ──────────────────────────────────────────────────────────
    getMyOrgs: () => tenancyApi.get('/orgs/'),
    getOrg: (slug) => tenancyApi.get(`/orgs/${slug}/`),
    createOrg: (data) => tenancyApi.post('/orgs/', data),
    updateOrg: (slug, data) => tenancyApi.patch(`/orgs/${slug}/`, data),
    deleteOrg: (slug) => tenancyApi.delete(`/orgs/${slug}/`),

    // ── Workspaces ─────────────────────────────────────────────────────────────
    getWorkspaces: (orgSlug) => tenancyApi.get(`/orgs/${orgSlug}/workspaces/`),
    getWorkspace: (wsId) => tenancyApi.get(`/workspaces/${wsId}/`),
    createWorkspace: (orgSlug, data) => tenancyApi.post(`/orgs/${orgSlug}/workspaces/`, data),
    updateWorkspace: (wsId, data) => tenancyApi.patch(`/workspaces/${wsId}/`, data),
    deleteWorkspace: (wsId) => tenancyApi.delete(`/workspaces/${wsId}/`),

    // ── Org Members ────────────────────────────────────────────────────────────
    getOrgMembers: (orgSlug) => tenancyApi.get(`/orgs/${orgSlug}/members/`),
    inviteOrgMember: (orgSlug, data) => tenancyApi.post(`/orgs/${orgSlug}/members/`, data),
    updateOrgMemberRole: (orgSlug, userId, d) => tenancyApi.patch(`/orgs/${orgSlug}/members/${userId}/`, d),
    removeOrgMember: (orgSlug, userId) => tenancyApi.delete(`/orgs/${orgSlug}/members/${userId}/`),

    // ── Workspace Members ──────────────────────────────────────────────────────
    getWSMembers: (wsId) => tenancyApi.get(`/workspaces/${wsId}/members/`),
    addWSMember: (wsId, data) => tenancyApi.post(`/workspaces/${wsId}/members/`, data),
    updateWSMember: (wsId, uid, d) => tenancyApi.patch(`/workspaces/${wsId}/members/${uid}/`, d),
    removeWSMember: (wsId, uid) => tenancyApi.delete(`/workspaces/${wsId}/members/${uid}/`),

    // ── Teams ──────────────────────────────────────────────────────────────────
    getTeams: (wsId) => tenancyApi.get(`/workspaces/${wsId}/teams/`),
    createTeam: (wsId, data) => tenancyApi.post(`/workspaces/${wsId}/teams/`, data),

    // ── Workspace Resources (bridge reads) ─────────────────────────────────────
    getWSAgents: (wsId) => tenancyApi.get(`/workspaces/${wsId}/agents/`),
    getWSServices: (wsId) => tenancyApi.get(`/workspaces/${wsId}/services/`),
    getWSMCP: (wsId) => tenancyApi.get(`/workspaces/${wsId}/mcp/`),
    getWSActivity: (wsId, params) => tenancyApi.get(`/workspaces/${wsId}/activity/`, { params }),

    // ── Workspace Resource Linking (CRUD via org/ws slug) ────────────────────
    listWSAgents: (orgSlug, wsSlug, params = {}) =>
        tenancyApi.get(`/orgs/${orgSlug}/workspaces/${wsSlug}/agents/`, { params }),
    linkWSAgent: (orgSlug, wsSlug, data) =>
        tenancyApi.post(`/orgs/${orgSlug}/workspaces/${wsSlug}/agents/`, data),
    unlinkWSAgent: (orgSlug, wsSlug, bridgePk) =>
        tenancyApi.delete(`/orgs/${orgSlug}/workspaces/${wsSlug}/agents/${bridgePk}/`),

    listWSServices: (orgSlug, wsSlug) =>
        tenancyApi.get(`/orgs/${orgSlug}/workspaces/${wsSlug}/services/`),
    linkWSService: (orgSlug, wsSlug, data) =>
        tenancyApi.post(`/orgs/${orgSlug}/workspaces/${wsSlug}/services/`, data),
    unlinkWSService: (orgSlug, wsSlug, bridgePk) =>
        tenancyApi.delete(`/orgs/${orgSlug}/workspaces/${wsSlug}/services/${bridgePk}/`),

    listWSMCP: (orgSlug, wsSlug) =>
        tenancyApi.get(`/orgs/${orgSlug}/workspaces/${wsSlug}/mcp/`),
    linkWSMCP: (orgSlug, wsSlug, data) =>
        tenancyApi.post(`/orgs/${orgSlug}/workspaces/${wsSlug}/mcp/`, data),
    unlinkWSMCP: (orgSlug, wsSlug, bridgePk) =>
        tenancyApi.delete(`/orgs/${orgSlug}/workspaces/${wsSlug}/mcp/${bridgePk}/`),

    listWSSystems: (orgSlug, wsSlug) =>
        tenancyApi.get(`/orgs/${orgSlug}/workspaces/${wsSlug}/systems/`),
    linkWSSystem: (orgSlug, wsSlug, data) =>
        tenancyApi.post(`/orgs/${orgSlug}/workspaces/${wsSlug}/systems/`, data),
    unlinkWSSystem: (orgSlug, wsSlug, bridgePk) =>
        tenancyApi.delete(`/orgs/${orgSlug}/workspaces/${wsSlug}/systems/${bridgePk}/`),

    // ── Default Workspace ──────────────────────────────────────────────────────
    getMyDefaultWorkspace: () => tenancyApi.get('/workspaces/my-default/'),
    setDefaultWorkspace: (wsId) => tenancyApi.post(`/workspaces/${wsId}/set-default/`),

    // ── Invitations ──────────────────────────────────────────────────────────────
    getInviteByToken: (token) => tenancyApi.get(`/invites/${token}/`),
    acceptInvite: (token) => tenancyApi.post(`/invites/${token}/accept/`),
    declineInvite: (token) => tenancyApi.post(`/invites/${token}/decline/`),
    getOrgInvites: (slug, params) => tenancyApi.get(`/orgs/${slug}/invites/`, { params }),
    resendInvite: (slug, id) => tenancyApi.post(`/orgs/${slug}/invites/${id}/`),
    cancelInvite: (slug, id) => tenancyApi.delete(`/orgs/${slug}/invites/${id}/`),

}
