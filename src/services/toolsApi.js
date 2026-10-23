/**
 * Tools API Service
 * 
 * Handles all API calls for tool management, execution history, credentials, and metrics.
 */

// Every call goes through the shared client in api.js (page-speed plan Phase 5 item 7): the 60s timeout
// (the bare client had none), CSRF, the X-Workspace-ID header, the session-expiry redirect and the GET cache.
import api from './api'

const API_BASE = '/tools'

export const toolsApi = {
    // ============================================================================
    // Tool Catalog
    // ============================================================================

    /**
     * Get all tools from catalog with metadata
     */
    getCatalog: () => api.get(`${API_BASE}/catalog/`),

    /**
     * Get detailed schema for a specific tool
     */
    getToolSchema: (toolName) => api.get(`${API_BASE}/${toolName}/schema/`),

    // ============================================================================
    // Tool Execution
    // ============================================================================

    /**
     * Execute a tool with parameters
     */
    executeTool: (toolName, parameters) => {
        // Extract execution context from parameters
        const { agent_id, repository_id, session_id, ...toolParams } = parameters

        // Build request payload with proper structure
        const payload = {
            tool_name: toolName,
            parameters: toolParams
        }

        // Add optional top-level parameters
        if (agent_id !== undefined) payload.agent_id = agent_id
        if (repository_id !== undefined) payload.repository_id = repository_id
        if (session_id !== undefined) payload.session_id = session_id

        return api.post(`${API_BASE}/execute/`, payload)
    },

    // ============================================================================
    // Execution History
    // ============================================================================

    /**
     * Get paginated execution history with filters
     * @param {Object} filters - { page, page_size, tool_name, status, start_date, end_date, trace_id }
     */
    getHistory: (filters = {}) =>
        api.get(`${API_BASE}/history/`, { params: filters }),

    /**
     * Get detailed information about a specific execution
     */
    getExecution: (logId) =>
        api.get(`${API_BASE}/execution/${logId}/`),

    /**
     * Replay a previous tool execution (staff only)
     * @param {number} logId - Execution log ID
     * @param {boolean} force - Override safety checks
     */
    replayExecution: (logId, force = false) =>
        api.post(`${API_BASE}/replay/${logId}/`, { force }),

    // ============================================================================
    // Metrics & Observability
    // ============================================================================

    /**
     * Get aggregated metrics for tool usage
     * @param {string} timeRange - '1h', '24h', '7d', '30d'
     */
    getMetrics: (timeRange = '24h') =>
        api.get(`${API_BASE}/metrics/`, { params: { time_range: timeRange } }),

    /**
     * Get system health status
     */
    getHealth: () =>
        api.get(`${API_BASE}/health/`),

    // ============================================================================
    // Circuit Breaker
    // ============================================================================

    /**
     * Get circuit breaker status for all services
     */
    getCircuitBreakerStatus: () =>
        api.get(`${API_BASE}/circuit-breaker/status/`),

    /**
     * Reset a circuit breaker (admin only)
     */
    resetCircuitBreaker: (actionId) =>
        api.post(`${API_BASE}/circuit-breaker/${actionId}/reset/`),
}

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

export default {
    tools: toolsApi,
    credentials: credentialsApi
}
