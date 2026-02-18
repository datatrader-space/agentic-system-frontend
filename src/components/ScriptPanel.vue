<template>
    <div class="script-panel">
        <!-- Header -->
        <div class="sp-header">
            <div class="sp-header-left">
                <svg class="sp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <span class="sp-title">Script Execution</span>
                <span v-if="script.phase !== 'idle'" class="sp-phase-badge" :class="`sp-phase-${script.phase}`">
                    {{ phaseLabel }}
                </span>
            </div>
            <button class="sp-close-btn" @click="$emit('close')" title="Close">&times;</button>
        </div>

        <!-- Idle: Prompt to generate -->
        <div v-if="script.phase === 'idle'" class="sp-section sp-generate">
            <p class="sp-hint">Describe a task and the agent will generate a Python script to accomplish it.</p>
            <div class="sp-input-row">
                <textarea
                    v-model="requestText"
                    class="sp-textarea"
                    placeholder="e.g., Fetch all products from Shopify, paginate through all pages, and save as JSON..."
                    rows="3"
                    @keydown.ctrl.enter="onGenerate"
                ></textarea>
                <button class="sp-btn sp-btn-primary" :disabled="!requestText.trim()" @click="onGenerate">
                    ⚡ Generate Script
                </button>
            </div>
        </div>

        <!-- Generating: Spinner -->
        <div v-else-if="script.isGenerating" class="sp-section sp-center">
            <div class="sp-spinner"></div>
            <p class="sp-status-text">Generating script...</p>
        </div>

        <!-- Review: Show script for approval/edit -->
        <div v-else-if="script.isReviewing" class="sp-section">
            <!-- Explanation -->
            <div v-if="script.explanation" class="sp-explanation">
                <strong>Plan:</strong> {{ script.explanation }}
            </div>
            <div class="sp-meta-row">
                <span v-if="script.estimatedRuntime" class="sp-meta">⏱ ~{{ script.estimatedRuntime }}s</span>
                <span v-if="script.requiredServices.length" class="sp-meta">
                    🔗 {{ script.requiredServices.join(', ') }}
                </span>
                <span v-if="script.generationTokens" class="sp-meta">
                    📊 {{ script.generationTokens }} tokens
                </span>
            </div>

            <!-- Script editor -->
            <div class="sp-code-block">
                <div class="sp-code-header">
                    <span>Generated Script</span>
                    <label class="sp-edit-toggle">
                        <input type="checkbox" v-model="editing" />
                        <span>Edit</span>
                    </label>
                </div>
                <textarea
                    v-if="editing"
                    v-model="localScript"
                    class="sp-code-editor"
                    spellcheck="false"
                ></textarea>
                <pre v-else class="sp-code"><code>{{ script.scriptToRun }}</code></pre>
            </div>

            <!-- Action buttons -->
            <div class="sp-action-row">
                <button class="sp-btn sp-btn-secondary" @click="script.resetExecution()">← Back</button>
                <button class="sp-btn sp-btn-primary" @click="onApprove">
                    ▶ {{ editing ? 'Run Edited Script' : 'Approve & Run' }}
                </button>
            </div>
        </div>

        <!-- Executing: Live stdout stream -->
        <div v-else-if="script.isExecuting" class="sp-section">
            <!-- Progress bar -->
            <div v-if="script.progressPercent > 0" class="sp-progress">
                <div class="sp-progress-bar" :style="{ width: script.progressPercent + '%' }"></div>
                <span class="sp-progress-label">{{ script.progressPercent }}%</span>
            </div>

            <!-- Live output -->
            <div class="sp-terminal" ref="terminalRef">
                <div v-for="(line, i) in script.stdoutLines" :key="'o' + i" class="sp-term-line">{{ line }}</div>
                <div v-for="(line, i) in script.stderrLines" :key="'e' + i" class="sp-term-line sp-term-err">{{ line
                    }}</div>
                <div class="sp-term-cursor">▌</div>
            </div>

            <div class="sp-action-row">
                <button class="sp-btn sp-btn-danger" @click="script.cancel()">⏹ Cancel</button>
            </div>
        </div>

        <!-- Completed / Failed -->
        <div v-else-if="script.isComplete || script.isFailed" class="sp-section">
            <!-- Status banner -->
            <div class="sp-result-banner" :class="script.isComplete ? 'sp-result-ok' : 'sp-result-err'">
                <span v-if="script.isComplete">✅ Completed in {{ (script.durationMs / 1000).toFixed(1) }}s</span>
                <span v-else>❌ {{ script.wasCancelled ? 'Cancelled' : 'Failed' }}: {{ script.error }}</span>
            </div>

            <!-- Terminal output (collapsed) -->
            <details class="sp-details" :open="script.isFailed">
                <summary>Console Output ({{ script.stdoutLines.length + script.stderrLines.length }} lines)</summary>
                <div class="sp-terminal sp-terminal-static">
                    <div v-for="(line, i) in script.stdoutLines" :key="'o' + i" class="sp-term-line">{{ line }}</div>
                    <div v-for="(line, i) in script.stderrLines" :key="'e' + i" class="sp-term-line sp-term-err">{{ line
                        }}</div>
                </div>
            </details>

            <!-- Results viewer -->
            <details v-if="script.resultJson" class="sp-details" open>
                <summary>Results (JSON)</summary>
                <pre class="sp-json-viewer"><code>{{ JSON.stringify(script.resultJson, null, 2) }}</code></pre>
            </details>

            <!-- Actions -->
            <div class="sp-action-row">
                <button class="sp-btn sp-btn-secondary" @click="script.resetExecution()">New Script</button>
                <button class="sp-btn sp-btn-primary" @click="script.rerun()">🔄 Re-run</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, defineProps, defineEmits } from 'vue';
import { useScriptExecution } from '../composables/useScriptExecution';

const props = defineProps({
    repositoryId: { type: [String, Number], required: true },
    agentId: { type: [String, Number], default: null },
    conversationId: { type: [String, Number], default: null },
});

defineEmits(['close']);

// reactive() auto-unwraps nested refs so template comparisons like
// script.phase === 'idle' work correctly (without .value)
const script = reactive(useScriptExecution());
const requestText = ref('');
const editing = ref(false);
const localScript = ref('');
const terminalRef = ref(null);

// Connect on mount
script.connect(props.repositoryId);

// Set agent when agentId changes
watch(() => props.agentId, (id) => {
    if (id) script.setAgent(id);
}, { immediate: true });

// Sync edit
watch(() => script.generatedScript, (val) => {
    localScript.value = val;
});

// Auto-scroll terminal
watch(() => script.stdoutLines.length, async () => {
    await nextTick();
    if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
    }
});

function onGenerate() {
    if (!requestText.value.trim()) return;
    script.generate(requestText.value.trim(), props.conversationId);
}

function onApprove() {
    if (editing.value && localScript.value !== script.generatedScript) {
        script.edit(localScript.value);
        script.runEdited();
    } else {
        script.approve();
    }
}

const phaseLabels = {
    generating: 'Generating...',
    review: 'Review',
    executing: 'Running...',
    completed: 'Done',
    failed: 'Failed',
};

import { computed } from 'vue';
const phaseLabel = computed(() => phaseLabels[script.phase] || script.phase);
</script>

<style scoped>
.script-panel {
    display: flex;
    flex-direction: column;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
    color: #e5e7eb;
    max-height: 600px;
}

/* Header */
.sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    border-bottom: 1px solid #3730a3;
}

.sp-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.sp-icon {
    width: 18px;
    height: 18px;
    color: #a5b4fc;
}

.sp-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e7ff;
}

.sp-phase-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
}

.sp-phase-generating { background: #1e3a5f; color: #60a5fa; }
.sp-phase-review { background: #422006; color: #fbbf24; }
.sp-phase-executing { background: #064e3b; color: #34d399; }
.sp-phase-completed { background: #064e3b; color: #6ee7b7; }
.sp-phase-failed { background: #450a0a; color: #fca5a5; }

.sp-close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
}

.sp-close-btn:hover { color: #f3f4f6; }

/* Sections */
.sp-section {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}

.sp-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 120px;
}

.sp-hint {
    font-size: 13px;
    color: #9ca3af;
    margin-bottom: 12px;
}

/* Input */
.sp-input-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.sp-textarea {
    width: 100%;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    color: #e5e7eb;
    padding: 10px 12px;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    outline: none;
}

.sp-textarea:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* Buttons */
.sp-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
}

.sp-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.sp-btn-primary {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
}

.sp-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
}

.sp-btn-secondary {
    background: #374151;
    color: #d1d5db;
}

.sp-btn-secondary:hover { background: #4b5563; }

.sp-btn-danger {
    background: #991b1b;
    color: #fecaca;
}

.sp-btn-danger:hover { background: #7f1d1d; }

.sp-action-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
}

/* Explanation / Meta */
.sp-explanation {
    font-size: 13px;
    color: #d1d5db;
    background: #1f2937;
    border-left: 3px solid #6366f1;
    padding: 10px 14px;
    border-radius: 0 8px 8px 0;
    margin-bottom: 12px;
}

.sp-meta-row {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
}

.sp-meta {
    font-size: 12px;
    color: #9ca3af;
}

/* Code block */
.sp-code-block {
    border: 1px solid #374151;
    border-radius: 8px;
    overflow: hidden;
}

.sp-code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #1f2937;
    font-size: 12px;
    color: #9ca3af;
    border-bottom: 1px solid #374151;
}

.sp-edit-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
    color: #a5b4fc;
}

.sp-edit-toggle input { accent-color: #6366f1; }

.sp-code {
    margin: 0;
    padding: 12px;
    background: #0d1117;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    color: #c9d1d9;
}

.sp-code-editor {
    width: 100%;
    min-height: 200px;
    max-height: 400px;
    background: #0d1117;
    color: #c9d1d9;
    border: none;
    padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
}

/* Terminal */
.sp-terminal {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    max-height: 300px;
    overflow-y: auto;
}

.sp-terminal-static { max-height: 200px; }

.sp-term-line { color: #adbac7; white-space: pre-wrap; word-break: break-all; }
.sp-term-err { color: #f47067; }

.sp-term-cursor {
    display: inline-block;
    color: #6366f1;
    animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

/* Progress */
.sp-progress {
    position: relative;
    height: 6px;
    background: #1f2937;
    border-radius: 3px;
    margin-bottom: 12px;
    overflow: hidden;
}

.sp-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.sp-progress-label {
    position: absolute;
    right: 0;
    top: -18px;
    font-size: 11px;
    color: #a5b4fc;
}

/* Result banner */
.sp-result-banner {
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
}

.sp-result-ok {
    background: #064e3b;
    color: #6ee7b7;
    border: 1px solid #065f46;
}

.sp-result-err {
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid #7f1d1d;
}

/* Details/Collapsible */
.sp-details {
    margin-bottom: 12px;
}

.sp-details summary {
    cursor: pointer;
    font-size: 12px;
    color: #9ca3af;
    padding: 6px 0;
    font-weight: 500;
}

.sp-details summary:hover { color: #d1d5db; }

.sp-json-viewer {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #7ee787;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    margin: 0;
}

/* Spinner */
.sp-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #374151;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.sp-status-text {
    font-size: 13px;
    color: #9ca3af;
}

/* Generate section */
.sp-generate .sp-btn-primary {
    align-self: flex-end;
}
</style>
