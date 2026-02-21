/**
 * useScriptExecution composable
 *
 * Manages the script execution WebSocket lifecycle:
 *   connect → generate → approve/edit → stream stdout → complete
 *
 * Usage in any Vue component:
 *   const { connect, generate, approve, cancel, ... } = useScriptExecution();
 */

import { ref, computed, onBeforeUnmount } from 'vue';

export function useScriptExecution() {
    // ── State ──
    const ws = ref(null);
    const connected = ref(false);
    const agentId = ref(null);
    const _pendingAgentId = ref(null); // Buffer for setAgent before WS is open

    // Script lifecycle
    const phase = ref('idle'); // idle | generating | review | executing | completed | failed
    const executionId = ref(null);
    const generatedScript = ref('');
    const explanation = ref('');
    const editedScript = ref('');
    const estimatedRuntime = ref(0);
    const requiredServices = ref([]);
    const generationTokens = ref(0);

    // Execution output
    const stdoutLines = ref([]);
    const stderrLines = ref([]);
    const progress = ref(null); // { current, total, ... }
    const resultJson = ref(null);
    const resultFilePath = ref('');
    const durationMs = ref(0);
    const exitCode = ref(null);
    const error = ref('');
    const wasCancelled = ref(false);

    // Computed
    const isConnected = computed(() => connected.value);
    const isGenerating = computed(() => phase.value === 'generating');
    const isReviewing = computed(() => phase.value === 'review');
    const isExecuting = computed(() => phase.value === 'executing');
    const isComplete = computed(() => phase.value === 'completed');
    const isFailed = computed(() => phase.value === 'failed');
    const canRun = computed(() => ['review', 'completed', 'failed'].includes(phase.value));
    const scriptToRun = computed(() => editedScript.value || generatedScript.value);
    const progressPercent = computed(() => {
        if (!progress.value) return 0;
        const { current, total } = progress.value;
        if (!total || !current) return 0;
        return Math.round((current / total) * 100);
    });

    // ── WebSocket Connection ──

    function connect(repositoryId) {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            return;
        }

        const host = window.location.host;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${host}/ws/script/${repositoryId}/`;

        ws.value = new WebSocket(url);

        ws.value.onopen = () => {
            connected.value = true;
            console.log('[Script WS] Connected');
            // Flush any buffered setAgent call
            if (_pendingAgentId.value) {
                send('set_agent', { agent_id: _pendingAgentId.value });
                agentId.value = _pendingAgentId.value;
                _pendingAgentId.value = null;
            }
        };

        ws.value.onclose = () => {
            connected.value = false;
            console.log('[Script WS] Disconnected');
        };

        ws.value.onerror = (e) => {
            console.error('[Script WS] Error:', e);
        };

        ws.value.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };
    }

    function disconnect() {
        if (ws.value) {
            ws.value.close();
            ws.value = null;
            connected.value = false;
        }
    }

    function send(type, data = {}) {
        if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
            console.warn('[Script WS] Not connected, buffering', type);
            return false;
        }
        ws.value.send(JSON.stringify({ type, data }));
        return true;
    }

    // ── Actions ──

    function setAgent(id) {
        agentId.value = id;
        // If WS not open yet, buffer it for onopen
        if (!send('set_agent', { agent_id: id })) {
            _pendingAgentId.value = id;
        }
    }

    function generate(request, conversationId = null) {
        resetExecution();
        phase.value = 'generating';
        send('generate_script', { request, conversation_id: conversationId });
    }

    function approve() {
        if (!executionId.value) return;
        phase.value = 'executing';
        stdoutLines.value = [];
        stderrLines.value = [];
        send('approve_script', { execution_id: executionId.value });
    }

    function edit(script) {
        editedScript.value = script;
    }

    function runEdited() {
        if (!executionId.value || !editedScript.value) return;
        phase.value = 'executing';
        stdoutLines.value = [];
        stderrLines.value = [];
        send('edit_script', {
            execution_id: executionId.value,
            script: editedScript.value,
        });
    }

    function cancel() {
        send('cancel_execution', {});
    }

    function rerun() {
        if (!executionId.value) return;
        phase.value = 'executing';
        stdoutLines.value = [];
        stderrLines.value = [];
        send('rerun_script', { execution_id: executionId.value });
    }

    // ── Message Handling ──

    function handleMessage(data) {
        console.log('[Script WS]', data.type, data.data);

        switch (data.type) {
            case 'agent_set':
                agentId.value = data.data?.agent_id;
                break;

            case 'script_generating':
                phase.value = 'generating';
                break;

            case 'script_generated':
                phase.value = 'review';
                executionId.value = data.data.execution_id;
                generatedScript.value = data.data.script;
                editedScript.value = '';
                explanation.value = data.data.explanation || '';
                estimatedRuntime.value = data.data.estimated_runtime_seconds || 0;
                requiredServices.value = data.data.required_services || [];
                generationTokens.value = data.data.generation_tokens || 0;
                break;

            case 'script_executing':
                phase.value = 'executing';
                executionId.value = data.data.execution_id;
                break;

            case 'script_stdout':
                stdoutLines.value.push(data.data.line);
                break;

            case 'script_stderr':
                stderrLines.value.push(data.data.line);
                break;

            case 'script_progress':
                progress.value = data.data;
                break;

            case 'script_completed':
                phase.value = 'completed';
                resultJson.value = data.data.result_json;
                resultFilePath.value = data.data.result_file_path || '';
                durationMs.value = data.data.duration_ms || 0;
                break;

            case 'script_failed':
                phase.value = 'failed';
                error.value = data.data.error || 'Script failed';
                exitCode.value = data.data.exit_code;
                durationMs.value = data.data.duration_ms || 0;
                wasCancelled.value = data.data.was_cancelled || false;
                break;

            case 'script_cancelled':
                phase.value = 'failed';
                wasCancelled.value = true;
                error.value = 'Execution cancelled';
                break;

            case 'error':
                error.value = data.data?.message || 'Unknown error';
                if (phase.value === 'generating') {
                    phase.value = 'failed';
                }
                break;
        }
    }

    function resetExecution() {
        executionId.value = null;
        generatedScript.value = '';
        editedScript.value = '';
        explanation.value = '';
        estimatedRuntime.value = 0;
        requiredServices.value = [];
        generationTokens.value = 0;
        stdoutLines.value = [];
        stderrLines.value = [];
        progress.value = null;
        resultJson.value = null;
        resultFilePath.value = '';
        durationMs.value = 0;
        exitCode.value = null;
        error.value = '';
        wasCancelled.value = false;
        phase.value = 'idle';
    }

    // Cleanup on unmount
    onBeforeUnmount(() => {
        disconnect();
    });

    return {
        // Connection
        connect,
        disconnect,
        setAgent,
        isConnected,

        // Actions
        generate,
        approve,
        edit,
        runEdited,
        cancel,
        rerun,
        resetExecution,

        // State
        phase,
        executionId,
        generatedScript,
        editedScript,
        explanation,
        estimatedRuntime,
        requiredServices,
        generationTokens,
        scriptToRun,

        // Execution Output
        stdoutLines,
        stderrLines,
        progress,
        progressPercent,
        resultJson,
        resultFilePath,
        durationMs,
        exitCode,
        error,
        wasCancelled,

        // Computed Helpers
        isGenerating,
        isReviewing,
        isExecuting,
        isComplete,
        isFailed,
        canRun,
    };
}
