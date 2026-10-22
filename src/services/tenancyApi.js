// src/services/tenancyApi.js
/**
 * Tenancy API — All calls to /api/v2/
 * Handles orgs, workspaces, members, teams, and workspace-scoped resources.
 */
//
// Goes through the shared client in api.js (page-speed plan Phase 5 item 7), so tenancy calls get the same
// timeout, CSRF and X-Workspace-ID headers, session-expiry (401) redirect, GET dedup/cache and
// cache invalidation on writes as every other call. It used to be a second axios instance with none of
// the last three: a tenancy write left cached org/workspace reads stale.
import api from './api'

const V2 = '/v2'
const tenancyApi = {
    get: (url, config) => api.get(V2 + url, config),
    post: (url, data, config) => api.post(V2 + url, data, config),
    put: (url, data, config) => api.put(V2 + url, data, config),
    patch: (url, data, config) => api.patch(V2 + url, data, config),
    delete: (url, config) => api.delete(V2 + url, config),
}

export default {
    // ── Organisations ──────────────────────────────────────────────────────────
    getMyOrgs: () => tenancyApi.get('/orgs/'),
    getOrg: (slug) => tenancyApi.get(`/orgs/${slug}/`),
    createOrg: (data) => tenancyApi.post('/orgs/', data),
    updateOrg: (slug, data) => tenancyApi.patch(`/orgs/${slug}/`, data),
    deleteOrg: (slug) => tenancyApi.delete(`/orgs/${slug}/`),

    // ── Workspaces ─────────────────────────────────────────────────────────────
    // All workspaces the current user belongs to, across every org (flat array).
    getAllWorkspaces: () => tenancyApi.get('/workspaces/'),
    getWorkspaces: (orgSlug) => tenancyApi.get(`/orgs/${orgSlug}/workspaces/`),
    getWorkspace: (wsId) => tenancyApi.get(`/workspaces/${wsId}/`),
    createWorkspace: (orgSlug, data) => tenancyApi.post(`/orgs/${orgSlug}/workspaces/`, data),
    updateWorkspace: (wsId, data) => tenancyApi.patch(`/workspaces/${wsId}/`, data),
    deleteWorkspace: (wsId) => tenancyApi.delete(`/workspaces/${wsId}/`),

    // ── Org Dashboard aggregates ───────────────────────────────────────────────
    getOrgOverview: (orgSlug) => tenancyApi.get(`/orgs/${orgSlug}/overview/`),
    getOrgActivity: (orgSlug, params = {}) => tenancyApi.get(`/orgs/${orgSlug}/activity/`, { params }),

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
