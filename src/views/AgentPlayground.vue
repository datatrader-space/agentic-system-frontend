<template>
  <div class="agent-playground h-screen flex flex-col bg-gray-100">
    
    <!-- Top Bar: Agent Info -->
    <div class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div class="flex items-center gap-4">
            <button @click="$router.push('/agents')" class="text-gray-500 hover:text-gray-700">
                ← Back
            </button>
            <div class="h-6 w-px bg-gray-200"></div>
            <h1 class="text-lg font-bold text-gray-800">
                {{ agent.id ? agent.name || 'Edit Agent' : 'New Agent' }}
            </h1>
        </div>
        
        <!-- Right: Actions -->
        <div class="flex items-center gap-3">
             <button 
                @click="showBuilder = !showBuilder"
                class="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5 bg-white transition flex items-center gap-2"
             >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configure Agent
             </button>
        </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex h-0">
        
        <!-- Left: Builder (MODAL OVERLAY) -->
        <div v-if="showBuilder" class="fixed inset-0 z-40 bg-black/50 flex justify-end" @click.self="showBuilder = false">
             <div class="h-full w-[500px] bg-white shadow-2xl animate-in slide-in-from-right duration-200">
                <AgentBuilder 
                    v-if="agent"
                    v-model:agent="agent"
                    :isSaving="saving"
                    @save="saveAgent"
                />
             </div>
        </div>

        <!-- Prompt Builder Modal -->
        <PromptBuilder ref="promptBuilder" @insert="insertPrompt" />
        
        <!-- File Viewer Modal -->
        <FileViewer ref="fileViewer" :systemId="selectedContext.system" :repoId="selectedContext.repo || '0'" />

        <!-- Right: Preview / Chat -->
        <div class="flex-1 flex flex-col bg-white relative">
            <div class="p-2 border-b border-gray-100 bg-gray-50 flex justify-center gap-4 text-xs font-mono">
                <button 
                    @click="activeTab = 'chat'"
                    :class="activeTab === 'chat' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'"
                >
                    PREVIEW SESSION
                </button>
                <button 
                    @click="activeTab = 'knowledge'"
                    :class="activeTab === 'knowledge' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'"
                >
                    KNOWLEDGE CONTEXT
                </button>
                <button 
                    @click="activeTab = 'trace'"
                    :class="activeTab === 'trace' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'"
                >
                    TRACE
                </button>
            </div>
            
            <!-- Trace Tab -->
            <div v-if="activeTab === 'trace'" class="flex-1 overflow-hidden flex flex-col items-center justify-center">
                 <SessionTrace v-if="activeSessionId" :session-id="activeSessionId" class="w-full h-full" />
                 <div v-else class="text-gray-400">
                    <div class="text-4xl mb-2 text-center">🔍</div>
                    <p>Start a session to view trace details.</p>
                 </div>
            </div>
            
            
            <!-- Chat Interface (Always Active) -->
            <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col overflow-hidden w-full">
                <!-- Feed -->
                <div class="flex-1 overflow-y-auto p-4 pb-32 bg-gray-50" ref="feed">
                    <div v-if="chatEvents.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-4xl mb-2">✨</div>
                        <p>Agent {{ agent.name }} is ready.</p>
                    </div>

                    <div v-for="event in chatEvents" :key="event.id" class="mb-4 w-full">
                        <!-- User -->
                        <div v-if="event.type === 'user'" class="max-w-[85%] ml-auto">
                            <div class="bg-blue-600 text-white p-3 rounded-xl rounded-br-sm shadow-sm">
                                {{ event.content }}
                            </div>
                            <!-- Action Buttons for User Messages -->
                            <div class="flex gap-2 mt-2 mr-2 justify-end">
                                <button 
                                    @click="retryUserMessage(event)"
                                    class="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                    title="Retry this message"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                                <button 
                                    @click="editUserMessage(event)"
                                    class="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                    title="Edit message"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Assistant -->
                        <div v-if="event.type === 'assistant'" class="max-w-[85%] mr-auto group">
                            <div class="bg-gradient-to-br from-white to-gray-50 border border-gray-200 p-4 rounded-xl rounded-bl-sm shadow-sm hover:shadow-md transition-shadow duration-200">
                                <!-- Streaming Indicator -->
                                <div v-if="isProcessing && chatEvents[chatEvents.length - 1].id === event.id" class="flex items-center gap-2 text-xs text-blue-600 mb-2 font-medium">
                                    <svg class="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                        <circle cx="10" cy="10" r="3"/>
                                    </svg>
                                    <span>Generating...</span>
                                </div>
                                
                                <!-- Content with better typography -->
                                <div class="prose prose-sm prose-slate max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-a:text-blue-600 leading-relaxed" 
                                     v-html="formatMarkdown(event.content)">
                                </div>
                            </div>
                            <!-- Copy Button Only for Assistant -->
                            <div class="flex gap-2 mt-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    @click="copyToClipboard(event.content)"
                                    class="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                    title="Copy response"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Tool Call -->
                        <div v-if="event.type === 'tool_call'" class="border-l-4 border-amber-500 bg-amber-50 p-2 my-2 rounded text-sm group">
                            <div class="font-bold text-amber-800 flex items-center justify-between">
                                <span class="flex items-center gap-2">🛠️ Using Tool: {{ event.data.tool }}</span>
                                
                                <!-- File Viewer Action -->
                                <button 
                                    v-if="getFileFromTool(event.data.tool, event.data.params)"
                                    @click="openFileViewer(getFileFromTool(event.data.tool, event.data.params))"
                                    class="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded transition opacity-0 group-hover:opacity-100 flex items-center gap-1"
                                >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View File
                                </button>
                            </div>
                            <div class="font-mono text-xs mt-1 bg-amber-100/50 p-1 rounded whitespace-pre-wrap">{{ event.data.params }}</div>
                        </div>

                        <!-- Tool Result -->
                        <div v-if="event.type === 'tool_result'" class="border-l-4 border-purple-500 bg-purple-50 p-2 my-2 rounded text-sm">
                            <div class="font-bold text-purple-800">
                                📄 Tool Result: {{ event.data.tool_name }}
                            </div>
                            <div class="font-mono text-xs mt-1 bg-white p-1 rounded max-h-40 overflow-y-auto">{{ formatToolResult(event.data.result) }}</div>
                        </div>

                        <!-- Thought -->
                        <div v-if="event.type === 'thought'" class="border-l-4 border-purple-400 bg-purple-50/50 p-3 my-2 rounded text-xs text-purple-800">
                            💭 {{ event.content }}
                        </div>

                        <!-- Error -->
                        <div v-if="event.type === 'error'" class="border-l-4 border-red-500 bg-red-50 p-3 my-2 rounded text-red-700 text-sm flex items-center gap-2">
                            <span>❌</span> {{ event.data.message }}
                        </div>
                    </div>
                </div>

                <!-- Input (GPT-Style Centered) -->
                <div class="absolute bottom-0 left-0 right-0 p-6">
                    <div class="max-w-3xl mx-auto">
                        <!-- Input Container -->
                        <div class="bg-white border border-gray-300 rounded-3xl shadow-lg p-3 flex items-center gap-3">
                            <!-- Prompt Builder Button -->
                            <button 
                                class="p-2 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0 text-indigo-600"
                                title="Build Prompt with AI"
                                @click="openPromptBuilder"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </button>

                            <!-- Plus Button -->
                            <button 
                                class="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                title="Attach files"
                            >
                                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            
                            <!-- Input -->
                            <input
                                v-model="userMessage"
                                type="text"
                                placeholder="Message agent..."
                                class="flex-1 px-2 py-2 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400"
                                @keydown.enter.prevent="sendMessage"
                                :disabled="isProcessing"
                            />
                            
                            <!-- Right Actions -->
                            <div class="flex items-center gap-2 flex-shrink-0">
                                <!-- Microphone -->
                                <button 
                                    v-if="!userMessage.trim()"
                                    class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Voice input"
                                >
                                    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                                
                                <!-- Stop Button (when processing) -->
                                <button
                                    v-if="isProcessing"
                                    @click="stopExecution"
                                    class="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                                    title="Stop"
                                >
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="6" width="12" height="12" />
                                    </svg>
                                </button>
                                
                                <!-- Send Button (circular with arrow) -->
                                <button
                                    v-else
                                    @click="sendMessage"
                                    :disabled="!userMessage.trim()"
                                    :class="[
                                        'p-2.5 rounded-full transition-colors',
                                        userMessage.trim() 
                                            ? 'bg-gray-800 hover:bg-gray-900 text-white' 
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    ]"
                                    title="Send message"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Disclaimer Text -->
                        <p class="text-xs text-gray-500 text-center mt-2">
                            Agent can make mistakes. Verify important information.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Knowledge Interface -->
            <div v-if="activeTab === 'knowledge'" class="flex-1 flex overflow-hidden">
                <!-- Doc List -->
                <div class="w-1/3 border-r border-gray-200 overflow-y-auto bg-gray-50">
                    <div v-if="loadingDocs" class="p-4 text-center text-gray-500 text-sm">Loading docs...</div>
                    <div v-else-if="knowledgeDocs.length === 0" class="p-4 text-center text-gray-500 text-sm">
                        No knowledge documents found for this repository.
                    </div>
                    <div v-else>
                        <div 
                            v-for="doc in knowledgeDocs" 
                            :key="doc.spec_id"
                            @click="selectDoc(doc)"
                            :class="['p-3 border-b border-gray-100 cursor-pointer hover:bg-white transition', selectedDoc?.spec_id === doc.spec_id ? 'bg-white border-l-4 border-l-blue-500' : '']"
                        >
                            <div class="text-sm font-bold text-gray-700 truncate">{{ doc.title || doc.spec_id }}</div>
                            <div class="text-xs text-gray-500">{{ doc.kind }}</div>
                        </div>
                    </div>
                </div>

                <!-- Doc View & Analysis -->
                <div class="flex-1 overflow-y-auto p-6">
                    <div v-if="!selectedDoc" class="flex items-center justify-center h-full text-gray-400">
                        <p>Select a document to view analysis.</p>
                    </div>
                    <div v-else class="space-y-6">
                        <!-- AI Analysis -->
                         <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                            <h3 class="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                                🤖 AI Analysis
                                <span v-if="analyzingDoc" class="text-xs font-normal text-indigo-500">(Generating...)</span>
                            </h3>
                            <div v-if="analyzingDoc" class="animate-pulse space-y-2">
                                <div class="h-4 bg-indigo-100 rounded w-3/4"></div>
                                <div class="h-4 bg-indigo-100 rounded w-1/2"></div>
                            </div>
                            <div v-else-if="docAnalysis">
                                <div class="prose prose-sm text-indigo-900 max-h-96 overflow-y-auto mb-4" v-html="formatMarkdown(docAnalysis)"></div>
                                <div class="flex gap-2">
                                     <button @click="startChatWithContext" class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition">
                                         💬 Chat with Context
                                     </button>
                                     <button @click="analyzeCurrentDoc" class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200 transition">
                                         ↻ Re-Analyze
                                     </button>
                                </div>
                            </div>
                            <div v-else class="flex flex-col items-center gap-2 p-4 text-center">
                                <span class="text-sm text-gray-500 italic">No analysis generated yet.</span>
                                <button @click="analyzeCurrentDoc" class="px-4 py-2 bg-indigo-600 text-white rounded shadow text-sm hover:bg-indigo-700 transition">
                                    ⚡ Run AI Analysis
                                </button>
                            </div>
                        </div>

                        <!-- Raw Content -->
                        <div>
                             <h3 class="text-sm font-bold text-gray-800 mb-2">Original Content</h3>
                             <div class="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                                {{ selectedDoc.content }}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import api from '../services/api';
import AgentBuilder from '../components/AgentBuilder.vue';
import SessionTrace from '../components/SessionTrace.vue';
import PromptBuilder from '../components/PromptBuilder.vue';
import FileViewer from '../components/FileViewer.vue';

const route = useRoute();
const router = useRouter();

const agent = ref({
    name: 'New Agent',
    description: '',
    system_prompt_template: 'You are a helpful AI assistant enabled with tools.',
    knowledge_scope: 'system',
    tool_ids: [],
    temperature: 0.7
});

const saving = ref(false);
const systems = ref([]);
const repositories = ref([]);
// New: LLM Models
const llmModels = ref([]);
const selectedContext = ref({ system: null, repo: null, model: null });
const activeSessionId = ref(null); // This is actually conversation_id in the new backend logic
const chatEvents = ref([]);
const userMessage = ref('');
const isProcessing = ref(false);
const activeTab = ref('chat');
const showBuilder = ref(false); // Default to false (modal hidden)
const knowledgeDocs = ref([]);
const loadingDocs = ref(false);
const selectedDoc = ref(null);
const analyzingDoc = ref(false);
const docAnalysis = ref('');
const feed = ref(null); // Fix: Add ref for scroll container
const promptBuilder = ref(null);
const fileViewer = ref(null);

const openPromptBuilder = () => {
    promptBuilder.value?.open();
};

const insertPrompt = (text) => {
    userMessage.value = text;
};

const getFileFromTool = (toolName, params) => {
    if (!['WRITE_FILE', 'READ_FILE', 'APPEND_FILE'].includes(toolName)) return null;
    try {
        const p = typeof params === 'string' ? JSON.parse(params) : params;
        return p.file || p.path || p.target_file || p.source_file;
    } catch (e) {
        return null;
    }
};

const openFileViewer = (path) => {
    fileViewer.value?.open(path);
};

const fetchContextData = async () => {
    try {
        const [sysRes, modelRes] = await Promise.all([
            api.getSystems(),
            api.getLlmModels()
        ]);
        systems.value = sysRes.data.results || sysRes.data;
        llmModels.value = modelRes.data.results || modelRes.data;
    } catch (e) {
        console.error("Context load failed", e);
    }
};

// Consolidated repository logic
const fetchRepositories = async (systemId) => {
    if (!systemId) {
        repositories.value = [];
        return;
    }
    try {
        const res = await api.getRepositories(systemId);
        repositories.value = res.data.results || res.data;
    } catch (e) {
        console.error("Failed to load repositories", e);
    }
};

watch(() => selectedContext.value.system, (newSysId) => {
    // Only reset if we are NOT in the middle of a restore (heuristic: if repo is verified?)
    // Actually, just let it reset, then fetchLastConversation re-sets it.
    // However, Vue watcher runs synchronously. 
    // If I set system, this runs: sets repo=null.
    // Then I set repo=saved.
    // It works fine.
    if (repositories.value.length > 0 && repositories.value[0].system !== newSysId) {
         selectedContext.value.repo = null;
    }
    fetchRepositories(newSysId);
    knowledgeDocs.value = [];
    selectedDoc.value = null;
});

const fetchLastConversation = async () => {
    if (!agent.value.id) return;
    try {
        const res = await api.getConversations({
            agent_profile_id: agent.value.id,
            ordering: '-updated_at',
            limit: 1
        });
        
        if (res.data.results && res.data.results.length > 0) {
            let lastConv = res.data.results[0];
            
            // If list view didn't include messages, fetch full details
            if (!lastConv.messages || lastConv.messages.length === 0) {
                try {
                    const detailRes = await api.getConversation(lastConv.id);
                    lastConv = detailRes.data;
                    console.log("Fetched detailed conversation:", lastConv);
                } catch (err) {
                    console.error("Failed to fetch conversation details", err);
                }
            }

            activeSessionId.value = lastConv.id;
            
            // Restore context
            if (lastConv.system) {
                // Set system. Watcher will trigger and clear repo.
                selectedContext.value.system = lastConv.system;
                
                // Fetch repos explicitly to ensure data availability for UI
                await fetchRepositories(lastConv.system);
                
                // Restore repo (overriding validation/watcher clear)
                selectedContext.value.repo = lastConv.repository;
            }
            selectedContext.value.model = lastConv.llm_model;
            
            // Restore chat history
            if (lastConv.messages) {
                 chatEvents.value = lastConv.messages.map(msg => ({
                     id: msg.id,
                     type: msg.role === 'user' ? 'user' : 'assistant', 
                     content: msg.content,
                     data: msg
                 }));
                 
                 // Aggressive scroll to bottom with multiple attempts
                 const scrollToEnd = () => {
                     if (feed.value) {
                         feed.value.scrollTop = feed.value.scrollHeight;
                     }
                 };
                 
                 // Immediate attempt
                 nextTick(scrollToEnd);
                 
                 // Fallback attempts with increasing delays
                 setTimeout(scrollToEnd, 100);
                 setTimeout(scrollToEnd, 300);
                 setTimeout(scrollToEnd, 500);
            }
            
            // Reconnect WS
            const repoId = lastConv.repository || '0';
            connectWebSocket(repoId);
        }
    } catch (e) {
        console.error("Failed to fetch last conversation", e);
    }
};

onMounted(async () => {
    const id = route.params.id;
    if (id !== 'new') {
        agent.value.id = id; // Set ID early
        await fetchAgent(id);
        await fetchContextData();
        await fetchLastConversation();
        
        // Auto-init chat session if none exists
        if (!activeSessionId.value && agent.value.id) {
            await initChatSession();
        }
    } else {
        await fetchContextData();
    }
});

const initChatSession = async () => {
    try {
        const res = await api.startAgentChat(agent.value.id, null); // No repository needed
        activeSessionId.value = res.data.conversation_id;
        // Use repository ID 0 for agent-only chat (no repo required)
        connectWebSocket(0);
    } catch (e) {
        console.error('Failed to initialize chat:', e);
    }
};

const loadKnowledge = async () => {
    activeTab.value = 'knowledge';
    
    // Combine Repo Knowledge + Agent Knowledge
    const docs = [];
    
    // 1. Agent Knowledge
    if (agent.value.knowledge_files) {
        docs.push(...agent.value.knowledge_files.map(f => ({
            ...f,
            kind: 'agent_file',
            spec_id: f.id, // Use ID as spec_id
            title: f.name || `File ${f.id}`,
            content: null, // Should fetch if needed, but ContextFile has file url
            analyzed: !!f.analysis,
            analysis: f.analysis
        })));
    }
    
    // 2. Repo Knowledge (if configured)
    if (selectedContext.value.system && selectedContext.value.repo) {
         try {
            loadingDocs.value = true;
            const res = await api.getKnowledgeDocs(selectedContext.value.system, selectedContext.value.repo);
            if (res.data.docs) {
                docs.push(...res.data.docs);
            }
        } catch (e) {
            console.error("Failed to load repo docs", e);
        } finally {
            loadingDocs.value = false;
        }
    }
    
    knowledgeDocs.value = docs;
};

const selectDoc = async (doc) => {
    selectedDoc.value = doc;
    
    // If analysis exists locally, show it
    if (doc.analysis) {
        docAnalysis.value = doc.analysis;
        return;
    }
    
    // Otherwise clear and wait for user to Analyze
    docAnalysis.value = '';
};

const analyzeCurrentDoc = async () => {
    if (!selectedDoc.value) return;
    
    analyzingDoc.value = true;
    docAnalysis.value = '';
    
    try {
        let analysis = '';
        
        if (selectedDoc.value.kind === 'agent_file') {
             // Agent Context File
             const res = await api.analyzeContextFile(selectedDoc.value.spec_id);
             // API returns { status: 'analyzed', analysis: '...' }
             analysis = res.data.analysis;
             
             // Update local state
             selectedDoc.value.analysis = analysis;
             selectedDoc.value.analyzed = true;
             
        } else {
            // Repository Knowledge
            const res = await api.analyzeKnowledgeDoc(
                selectedContext.value.system,
                selectedContext.value.repo,
                selectedDoc.value.kind,
                selectedDoc.value.spec_id
            );
            analysis = res.data.summary;
        }
        
        docAnalysis.value = analysis;
        
    } catch (e) {
        console.error("Analysis failed", e);
        docAnalysis.value = "Failed to generate analysis: " + e.message;
    } finally {
        analyzingDoc.value = false;
    }
};

const startChatWithContext = () => {
    activeTab.value = 'chat';
    // Optional: Pre-fill message or context system prompt
    if (selectedDoc.value) {
        userMessage.value = `Let's discuss the document: ${selectedDoc.value.title}`;
    }
};

const fetchAgent = async (id) => {
    try {
        const res = await api.get(`/agents/${id}/`);
        // Ensure tool_ids maps to tools objects if API returns expanded objects
        // The serializer expects tool_ids for write, but read might separate them
        const data = res.data;
        if (!data.tool_ids && data.tools) {
            data.tool_ids = data.tools.map(t => t.id);
        }
        agent.value = data;
    } catch (e) {
        console.error("Agent load failed", e);
    }
};

const saveAgent = async (agentData) => {
    try {
        saving.value = true;
        const dataToSave = agentData || agent.value;
        let res;
        if (dataToSave.id) {
            res = await api.patch(`/agents/${dataToSave.id}/`, dataToSave);
        } else {
            res = await api.post('/agents/', dataToSave);
            // Redirect to edit mode to prevent duplicate creates
            router.replace(`/agents/${res.data.id}`);
        }
        agent.value = res.data;
        // Fix up tool ids again if needed
        if (!agent.value.tool_ids && agent.value.tools) {
            agent.value.tool_ids = agent.value.tools.map(t => t.id);
        }
        return agent.value;
    } catch (e) {
        alert("Failed to save agent: " + (e.response?.data?.error || e.message));
        return null;
    } finally {
        saving.value = false;
    }
};

const formatMarkdown = (text) => marked(text || '');
const formatToolResult = (result) => {
    if (typeof result === 'object') return JSON.stringify(result, null, 2);
    return result;
};

// WebSo
const ws = ref(null);
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const reconnectDelay = computed(() => Math.min(1000 * Math.pow(2, reconnectAttempts.value), 5000)); // Exponential backoff: 1s, 2s, 4s, max 5s

const connectWebSocket = (repoId) => {
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    const wsUrl = `ws://${host}/ws/chat/repository/${repoId || '0'}/`;

    // Check if already connected to the same URL
    if (ws.value && ws.value.url === wsUrl && ws.value.readyState === WebSocket.OPEN) {
        console.log('[Playground] Already connected to:', wsUrl);
        return;
    }

    // Close existing connection
    if (ws.value) {
        console.log('[Playground] Closing previous WS connection');
        ws.value.close();
    }

    console.log('[Playground] Connecting WS:', wsUrl);
    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
        console.log('[Playground] WS Connected');
        reconnectAttempts.value = 0; // Reset on successful connection
    };

    ws.value.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[WS Message]', data.type, data);

        if (data.type === 'assistant_message_chunk') {
            // Streaming: append chunk to last assistant message or create new one
            if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
                chatEvents.value[chatEvents.value.length - 1].content += data.chunk;
            } else {
                chatEvents.value.push({
                    id: Date.now(),
                    type: 'assistant',
                    content: data.chunk,
                    data
                });
            }
            scrollToBottom();
        } else if (data.type === 'assistant_message_complete') {
            // Finalize the assistant message
            if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
                chatEvents.value[chatEvents.value.length - 1].content = data.full_message;
            }
            isProcessing.value = false;
            scrollToBottom();
        } else if (data.type === 'chat_response') {
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.message,
                data
            });
            isProcessing.value = false;
        } else if (data.type === 'error') {
            chatEvents.value.push({
                id: Date.now(),
                type: 'error',
                content: data.error,
                data
            });
            isProcessing.value = false;
        } else if (data.type === 'stop_acknowledged') {
            console.log('[STOP] Acknowledged by backend:', data.message);
        } else if (data.type === 'tool_call') {
            // Tool call event
            chatEvents.value.push({
                id: Date.now(),
                type: 'tool_call',
                content: null,
                data: {
                    tool: data.tool,
                    params: data.params
                }
            });
            scrollToBottom();
        } else if (data.type === 'tool_result') {
            // Tool result event
            chatEvents.value.push({
                id: Date.now(),
                type: 'tool_result',
                content: null,
                data: {
                    tool_name: data.tool_name,
                    result: data.result,
                    success: data.success
                }
            });
            scrollToBottom();
        } else if (['agent_start', 'thought', 'completion'].includes(data.type)) {
            chatEvents.value.push({
                id: Date.now(),
                type: data.type,
                content: data.message || data.content,
                data
            });

            if (data.type === 'completion') {
                isProcessing.value = false;
            }
        }
    };

    ws.value.onerror = (error) => {
        console.error('[Playground] WS Error', error);
    };

    ws.value.onclose = (event) => {
        console.log('[Playground] WS Closed', event.code);
        
        // Attempt reconnection with backoff if not manually closed
        if (event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
            reconnectAttempts.value++;
            const delay = reconnectDelay.value;
            console.log(`[Playground] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})...`);
            
            setTimeout(() => {
                connectWebSocket(repoId);
            }, delay);
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
            console.error('[Playground] Max reconnection attempts reached');
            chatEvents.value.push({
                id: Date.now(),
                type: 'error',
                content: 'Connection lost. Please refresh the page to reconnect.',
                data: { error: 'Max reconnection attempts reached' }
            });
        }
    };
};

const handleChatEvent = (data) => {
    // Legacy handler - may still be used by some message types
    if (data.type === 'assistant_message_chunk') {
        if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
            chatEvents.value[chatEvents.value.length - 1].content += data.chunk;
        } else {
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.chunk
            });
        }
        isProcessing.value = true; // Still streaming
    } else if (data.type === 'assistant_message_complete') {
        isProcessing.value = false;
        // Ensure full message
        if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
            chatEvents.value[chatEvents.value.length - 1].content = data.full_message;
        }
    } else if (data.type === 'tool_call' || data.type === 'agent_tool_call') {
         chatEvents.value.push({
            id: Date.now(),
            type: 'tool_call',
            data: { tool: data.tool, params: data.tool_input || data.params }
        });
        isProcessing.value = true;
    } else if (data.type === 'agent_step' || data.type === 'agent_step_start') {
        if (data.thought) {
             chatEvents.value.push({
                id: Date.now(),
                type: 'thought',
                data: { content: data.thought }
            });
        }
    } else if (data.type === 'tool_result' || data.type === 'agent_tool_result') {
        chatEvents.value.push({
            id: Date.now(),
            type: 'tool_result',
            data: { tool_name: data.tool_name, result: data.result }
        });
    } else if (data.type === 'error' || data.type === 'agent_error') {
        isProcessing.value = false;
         chatEvents.value.push({
            id: Date.now(),
            type: 'error',
            data: { message: data.error || data.message }
        });
    }

    scrollToBottom();
};

const sendMessage = () => {
    if (!userMessage.value.trim()) return;
    
    const content = userMessage.value;
    userMessage.value = '';
    isProcessing.value = true;
    
    // Add user message to UI
    chatEvents.value.push({
        id: Date.now(),
        type: 'user',
        content: content
    });
    scrollToBottom(true);
    
    // Send to WS
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
            type: 'chat_message',
            message: content,
            conversation_id: activeSessionId.value // Must match the one created by start_chat
        }));
    } else {
        alert("Connection lost. Please restart session.");
        isProcessing.value = false;
    }
};

const stopExecution = () => {
    console.log('[STOP] Button clicked');
    console.log('[STOP] WS state:', ws.value?.readyState, 'OPEN=', WebSocket.OPEN);
    console.log('[STOP] activeSessionId:', activeSessionId.value);
    
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        console.error('[STOP] WebSocket not connected!');
        return;
    }
    
    // Include conversation_id for proper backend handling
    const stopMessage = {
        type: 'stop_execution',
        conversation_id: activeSessionId.value
    };
    
    console.log('[STOP] Sending message:', stopMessage);
    ws.value.send(JSON.stringify(stopMessage));
    
    isProcessing.value = false; // Immediately stop UI processing state
    console.log('[STOP] Request sent successfully');
};

const retryLast = () => {
    const lastUserEvent = chatEvents.value.slice().reverse().find(e => e.type === 'user');
    if (lastUserEvent) {
        userMessage.value = lastUserEvent.content;
        sendMessage();
    }
};

const scrollToBottom = async (force = false) => {
    await nextTick();
    if (!feed.value) return;
    
    const container = feed.value;
    const threshold = 100; // pixels
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    if (force || isNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
};

// Message Action Functions
const copyToClipboard = async (text) => {
    try {
        // Strip HTML tags for clean copy
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const cleanText = tempDiv.textContent || tempDiv.innerText || '';
        
        await navigator.clipboard.writeText(cleanText);
        console.log('Copied to clipboard');
        // Could add a toast notification here
    } catch (err) {
        console.error('Failed to copy:', err);
    }
};

const retryUserMessage = (userEvent) => {
    // Retry the user's own message
    userMessage.value = userEvent.content;
    sendMessage();
};

const editUserMessage = (userEvent) => {
    // Prefill input for editing
    userMessage.value = userEvent.content;
};

const retryMessage = (assistantEvent) => {
    // Find the user message that triggered this response
    const assistantIndex = chatEvents.value.findIndex(e => e.id === assistantEvent.id);
    if (assistantIndex > 0) {
        const previousUserMsg = chatEvents.value.slice(0, assistantIndex).reverse().find(e => e.type === 'user');
        if (previousUserMsg) {
            userMessage.value = previousUserMsg.content;
            sendMessage();
        }
    }
};

const correctResponse = (event) => {
    // Placeholder for future feedback/correction feature
    console.log('Correct response clicked for:', event);
    alert('Feedback feature coming soon! This will allow you to suggest corrections to improve the agent.');
};

// Fix: Watch chatEvents to auto-scroll
watch(
    () => chatEvents.value.length,  // Watch length instead of deep
    () => {
        // Use requestAnimationFrame for immediate scroll after render
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {  // Double RAF for reliability
                if (feed.value) {
                    feed.value.scrollTop = feed.value.scrollHeight;
                }
            });
        });
    }
);

const runAgent = async () => {
    if (agent.value.knowledge_scope === 'system' && !selectedContext.value.system) {
        alert("Please select a System Context for this agent.");
        return;
    }
    
    // Repository is now optional (Free Agent mode)
    const repoId = selectedContext.value.repo;

    try {
        // Save first (auto-save behavior)
        if (!agent.value.id) {
            const saved = await saveAgent();
            if (!saved) return;
        } else {
            // Also save updates before run
            await saveAgent();
        }
        
        // Start Chat
        const res = await api.post(`/agents/${agent.value.id}/chat/`, {
            system_id: selectedContext.value.system,
            repository_id: repoId,
            llm_model_id: selectedContext.value.model
        });
        
        // Use conversation_id as the session ID
        activeSessionId.value = res.data.conversation_id || res.data.profile_id;
        chatEvents.value = []; // Clear previous events
        
        // Connect WS
        // If no repo, we need a way to chat. 
        // Currently WebSocket is /ws/chat/repository/:id/
        // We need a fallback or a generic chat WS for agents.
        // For now, if no repo, we might need to use a dummy ID or a new endpoint.
        // Let's assume backend handles '0' or 'none' or we need to update consumer routing.
        // Implementation Plan said: "If no repository is selected, ensure the consumer still functions (might need to relax get_repository logic)."
        // Let's use a special "agent" chat endpoint or assume repoId=0 works if backend logic allows.
        // Given current backend routing, let's use a dummy ID '0' and ensure backend handles it, 
        // OR better: use `ws/chat/agent/:conversation_id/` if possible?
        // The current consumers.py uses RepositoryChatConsumer mounted at /ws/chat/repository/<repo_id>/
        // We probably need to update routing.py or client side to use a "global" repo or system chat.
        // Let's use the repoId if exists, otherwise '0'.
        connectWebSocket(repoId || '0');
        
    } catch (e) {
        console.error(e);
        alert("Run failed: " + e.message);
    }
};

onBeforeUnmount(() => {
    if (ws) ws.close();
});

onMounted(() => {
    fetchContextData();
    if (route.params.id && route.params.id !== 'new') {
        fetchAgent(route.params.id);
    }
});
</script>
