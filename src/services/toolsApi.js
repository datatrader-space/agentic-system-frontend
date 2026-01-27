/**
 * Tools API Service
 * 
 * Handles all API calls for tool management, execution history, credentials, and metrics.
 */

import axios from 'axios'

const API_BASE = '/api/tools'
const CREDENTIALS_BASE = '/api/credentials'

export const toolsApi = {
    // ============================================================================
    // Tool Catalog
    // ============================================================================

    /**
     * Get all tools from catalog with metadata
     */
    getCatalog: () => axios.get(`${API_BASE}/catalog/`),

    /**
     * Get detailed schema for a specific tool
     */
    getToolSchema: (toolName) => axios.get(`${API_BASE}/${toolName}/schema/`),

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

        return axios.post(`${API_BASE}/execute/`, payload)
    },

    // ============================================================================
    // Execution History
    // ============================================================================

    /**
     * Get paginated execution history with filters
     * @param {Object} filters - { page, page_size, tool_name, status, start_date, end_date, trace_id }
     */
    getHistory: (filters = {}) =>
        axios.get(`${API_BASE}/history/`, { params: filters }),

    /**
     * Get detailed information about a specific execution
     */
    getExecution: (logId) =>
        axios.get(`${API_BASE}/execution/${logId}/`),

    /**
     * Replay a previous tool execution (staff only)
     * @param {number} logId - Execution log ID
     * @param {boolean} force - Override safety checks
     */
    replayExecution: (logId, force = false) =>
        axios.post(`${API_BASE}/replay/${logId}/`, { force }),

    // ============================================================================
    // Metrics & Observability
    // ============================================================================

    /**
     * Get aggregated metrics for tool usage
     * @param {string} timeRange - '1h', '24h', '7d', '30d'
     */
    getMetrics: (timeRange = '24h') =>
        axios.get(`${API_BASE}/metrics/`, { params: { time_range: timeRange } }),

    /**
     * Get system health status
     */
    getHealth: () =>
        axios.get(`${API_BASE}/health/`),

    // ============================================================================
    // Circuit Breaker
    // ============================================================================

    /**
     * Get circuit breaker status for all services
     */
    getCircuitBreakerStatus: () =>
        axios.get(`${API_BASE}/circuit-breaker/status/`),

    /**
     * Reset a circuit breaker (admin only)
     */
    resetCircuitBreaker: (actionId) =>
        axios.post(`${API_BASE}/circuit-breaker/${actionId}/reset/`),
}

export const credentialsApi = {
    // ============================================================================
    // Credential Management
    // ============================================================================

    /**
     * List all credentials for the current user
     */
    list: () =>
        axios.get(`${CREDENTIALS_BASE}/`),

    /**
     * Create a new credential
     * @param {Object} data - { name, agent_profile_id, credential_type, plaintext_value, metadata }
     */
    create: (data) =>
        axios.post(`${CREDENTIALS_BASE}/`, data),

    /**
     * Get credential details
     */
    get: (id) =>
        axios.get(`${CREDENTIALS_BASE}/${id}/`),

    /**
     * Update credential
     * @param {Object} data - { name, metadata }
     */
    update: (id, data) =>
        axios.patch(`${CREDENTIALS_BASE}/${id}/`, data),

    /**
     * Delete credential
     */
    delete: (id) =>
        axios.delete(`${CREDENTIALS_BASE}/${id}/`),

    /**
     * Test credential (verify it can be decrypted)
     */
    test: (id) =>
        axios.post(`${CREDENTIALS_BASE}/${id}/test/`),
}

export default {
    tools: toolsApi,
    credentials: credentialsApi
}
