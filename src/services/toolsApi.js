/**
 * Tools API Service
 * 
 * Handles the API calls for agent and global credentials.
 */

// Every call goes through the shared client in api.js (page-speed plan Phase 5 item 7): the 60s timeout
// (the bare client had none), CSRF, the X-Workspace-ID header, the session-expiry redirect and the GET cache.
import api from './api'

export const credentialsApi = {
    // ============================================================================
    // Credential Management (agent-scoped, workspace-aware)
    // ============================================================================

    /**
     * List credentials for an agent (returns per-user creds in workspace context)
     */
    list: (agentId) =>
        api.get(`/agents/${agentId}/credentials/`),

    /**
     * Create a new credential for an agent
     * @param {number} agentId
     * @param {Object} data - For services: { service_id, credential_name, credentials: {...} }
     *                        For built-in: { builtin_tool, credential_name, credentials: {...} }
     */
    create: (agentId, data) =>
        api.post(`/agents/${agentId}/credentials/create/`, data),

    /**
     * Delete credential
     */
    delete: (agentId, credentialId) =>
        api.delete(`/agents/${agentId}/credentials/${credentialId}/delete/`),

    /**
     * Test credential (verify it works)
     */
    test: (agentId, credentialId) =>
        api.post(`/agents/${agentId}/credentials/${credentialId}/test/`),

    /**
     * Set credential as default for its scope
     */
    setDefault: (agentId, credentialId) =>
        api.post(`/agents/${agentId}/credentials/${credentialId}/set-default/`),

    /**
     * Attach (LINK) a global/reusable credential to this agent — a reference, not a copy.
     */
    assign: (agentId, credentialId) =>
        api.post(`/agents/${agentId}/credentials/${credentialId}/assign/`),

    /**
     * Detach (unlink) a credential from this agent — removes the link only; the credential is untouched.
     */
    detach: (agentId, credentialId) =>
        api.post(`/agents/${agentId}/credentials/${credentialId}/detach/`),

    /**
     * Get available built-in tool credential scopes
     */
    getBuiltinScopes: () =>
        api.get(`/credentials/builtin-scopes/`),

    /**
     * Get workspace routing info for an agent
     */
    getWorkspaceRouting: (agentId) =>
        api.get(`/agents/${agentId}/workspace-routing/`),

    /**
     * Toggle share_credentials for a workspace link
     * @param {number} agentId
     * @param {Object} data - { workspace_id, share_credentials: bool }
     */
    toggleShareCredentials: (agentId, data) =>
        api.patch(`/agents/${agentId}/share-credentials/`, data),

    // ============================================================================
    // Global (user-scoped) Credentials — agent_profile=None
    // ============================================================================

    /**
     * List user's global credentials
     */
    listGlobal: () =>
        api.get(`/credentials/`),

    /**
     * Create a global credential
     */
    createGlobal: (data) =>
        api.post(`/credentials/create/`, data),

    /**
     * Delete a global credential
     */
    deleteGlobal: (credentialId) =>
        api.delete(`/credentials/${credentialId}/delete/`),

    /**
     * Test a global credential
     */
    testGlobal: (credentialId) =>
        api.post(`/credentials/${credentialId}/test/`),

    /**
     * Workspaces the user can share a credential with (create-modal picker)
     */
    listCredentialWorkspaces: () =>
        api.get(`/credentials/workspaces/`),

    /**
     * Delete a workspace-SHARED credential (WorkspaceCredential)
     */
    deleteWorkspaceCredential: (credentialId) =>
        api.delete(`/workspace-credentials/${credentialId}/delete/`),
}
