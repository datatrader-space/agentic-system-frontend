<template>
  <div class="agent-builder flex flex-col h-full bg-white w-full">
    <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
      <h2 class="font-bold text-gray-800">Agent Configuration</h2>
      <div class="flex gap-2">
        <button 
            @click="save" 
            :disabled="isSaving"
            class="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
        >
            {{ isSaving ? 'Saving...' : 'Save Agent' }}
        </button>
      </div>
    </div>

    <!-- Tabs Header -->
    <div class="flex border-b border-gray-200 px-4 shrink-0">
        <button 
            v-for="tab in ['General', 'Knowledge', 'Tools']" 
            :key="tab"
            @click="activeTab = tab"
            :class="['px-4 py-3 text-sm font-medium border-b-2 transition-colors', activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700']"
        >
            {{ tab }}
        </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      
      <!-- TAB: GENERAL -->
      <div v-if="activeTab === 'General'" class="space-y-6">
      <div class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
                v-model="internalAgent.name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Django Migration Expert"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
                v-model="internalAgent.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="What does this agent do?"
            ></textarea>
        </div>
      </div>

      <hr />

      <!-- Soul (Prompt) & Model -->
      <div class="space-y-4">
        <div>
             <label class="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
             <select 
                v-model="selectedProviderId"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white mb-2"
             >
                <option :value="null">All Providers</option>
                <option v-for="p in llmProviders" :key="p.id" :value="p.id">
                    {{ p.name }} ({{ p.provider_type }})
                </option>
             </select>

             <label class="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
             <select 
                ref="modelSelect"
                :value="internalAgent.default_model || ''"
                @change="internalAgent.default_model = $event.target.value ? parseInt($event.target.value) : null"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
             >
                <option :value="null">Select a model...</option>
                <option v-for="m in filteredModels" :key="m.id" :value="m.id">
                    {{ m.name }}
                </option>
             </select>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
                <span v-pre class="text-xs font-normal text-gray-500 ml-1">(Use {{tools}} for automatic injection)</span>
            </label>
        <div class="relative">
            <textarea 
                v-model="internalAgent.system_prompt_template"
                rows="8"
                class="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50"
                placeholder="You are a helpful assistant..."
            ></textarea>
        </div>
      </div>
      </div>

      </div>

      <!-- TAB: KNOWLEDGE -->
      <div v-if="activeTab === 'Knowledge'" class="space-y-6">


      <hr />

      <!-- Agent Knowledge Base -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Knowledge Base & Files</label>
        <div class="space-y-3">
             <!-- Upload -->
            <div class="flex gap-2">
                <input 
                    type="file" 
                    ref="fileInput"
                    class="hidden" 
                    @change="handleFileUpload"
                />
                <button 
                    @click="$refs.fileInput.click()"
                    class="flex-1 px-3 py-2 border border-gray-300 border-dashed rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition flex items-center justify-center gap-2"
                    :disabled="uploading"
                >
                    <span v-if="uploading">Uploading...</span>
                    <span v-else>+ Upload Knowledge File</span>
                </button>
            </div>

            <!-- File List -->
            <div class="space-y-2">
                <!-- If no files -->
                <div v-if="(!internalAgent.knowledge_files || internalAgent.knowledge_files.length === 0)" class="text-xs text-gray-400 text-center italic py-2">
                    No files uploaded. Agent relies on prompt only.
                </div>

                <div 
                    v-for="file in internalAgent.knowledge_files" 
                    :key="file.id"
                    class="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-300 transition"
                >
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-medium text-sm text-gray-800 truncate pr-4">{{ file.name }}</div>
                        <button 
                             class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                             title="Remove File"
                             @click.stop="removeFile(file)"
                        >
                            ×
                        </button>
                    </div>

                    <!-- Analysis Preview -->
                    <div 
                        v-if="file.analysis" 
                        @click="viewAnalysis(file)"
                        class="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 line-clamp-3 cursor-pointer hover:bg-indigo-50 transition relative group/analysis"
                    >
                        <span class="font-bold text-indigo-600">AI Analysis:</span> {{ file.analysis }}
                        <div class="absolute inset-x-0 bottom-0 text-center bg-gradient-to-t from-white/90 to-transparent text-[10px] text-indigo-500 font-bold opacity-0 group-hover/analysis:opacity-100">Click to expand</div>
                    </div>
                    <div v-else class="text-xs text-gray-400 italic mt-1">
                        Analysis pending...
                    </div>
                </div>
            </div>
        </div>
      </div>

      <!-- Analysis Modal -->
      <div v-if="showAnalysisModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showAnalysisModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="font-bold text-gray-800 flex items-center gap-2">
                    📄 Analysis: {{ selectedAnalysisFile?.name }}
                </h3>
                <button @click="showAnalysisModal = false" class="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div class="p-6 overflow-y-auto prose prose-sm max-w-none text-gray-800" v-html="formatMarkdown(selectedAnalysisFile?.analysis || '')">
            </div>
            <div class="p-3 border-t border-gray-100 bg-gray-50 flex justify-between">
                <button 
                    @click="reRunAnalysis" 
                    :disabled="isReAnalyzing"
                    class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm flex items-center gap-2"
                >
                    <span v-if="isReAnalyzing" class="animate-spin">↻</span>
                    <span v-else>⚡</span>
                    {{ isReAnalyzing ? 'Analyzing...' : 'Re-Run Analysis' }}
                </button>
                <button @click="showAnalysisModal = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">Close</button>
            </div>
        </div>
      </div>

      </div>

      <!-- TAB: TOOLS -->
      <div v-if="activeTab === 'Tools'" class="space-y-6">

      <!-- Tools -->
      <div>
        <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700">Capabilities (Tools)</label>
             <span class="text-xs text-gray-500">{{ selectedToolsCount }} selected</span>
        </div>

        <!-- Search Box -->
        <div class="mb-3">
            <input
                v-model="toolSearchQuery"
                type="text"
                placeholder="Search tools by name or description..."
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
        </div>

        <div class="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            <div v-if="loadingTools" class="p-4 text-center text-sm text-gray-500">Loading tools...</div>

            <!-- Tools organized by category -->
            <div v-else-if="Object.keys(groupedFilteredTools).length > 0">
                <div v-for="(tools, category) in groupedFilteredTools" :key="category" class="border-b border-gray-100 last:border-b-0">
                    <!-- Category Header -->
                    <div class="bg-gray-50 px-3 py-2 sticky top-0 z-10 border-b border-gray-200">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ category }}</span>
                                <button 
                                    @click.stop="toggleCategory(category)" 
                                    class="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition"
                                >
                                    {{ areAllSelected(category) ? 'Deselect All' : 'Select All' }}
                                </button>
                            </div>
                            <span class="text-xs text-gray-500">{{ tools.length }} tools</span>
                        </div>
                    </div>

                    <!-- Tools in this category -->
                    <div class="divide-y divide-gray-100">
                        <div
                            v-for="tool in tools"
                            :key="tool.id"
                            class="flex items-start p-3 hover:bg-gray-50 cursor-pointer transition"
                            @click="toggleTool(tool.id)"
                        >
                            <div class="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    :checked="internalAgent.tool_ids.includes(tool.id)"
                                    class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                            </div>
                            <div class="ml-3 text-sm flex-1">
                                <label class="font-medium text-gray-700 cursor-pointer block">{{ tool.name }}</label>
                                <p class="text-gray-500 text-xs mt-0.5">{{ tool.description }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- No results -->
            <div v-else class="p-4 text-center text-sm text-gray-500">
                No tools found matching "{{ toolSearchQuery }}"
            </div>
        </div>
      </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import api from '../services/api';

const props = defineProps({
    agent: {
        type: Object,
        required: true
    },
    isSaving: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:agent', 'save']);

// Local copy for editing
const internalAgent = ref({
    default_model: null,  // Ensure this property exists for Vue reactivity
    ...props.agent
});
const availableTools = ref([]);
const llmProviders = ref([]);
const llmModels = ref([]);
const selectedProviderId = ref(null);
const loadingTools = ref(false);
const isUpdatingFromProp = ref(false);
const uploading = ref(false);
const isReAnalyzing = ref(false);
const fileInput = ref(null);
const modelSelect = ref(null);
const showAnalysisModal = ref(false);
const selectedAnalysisFile = ref(null);
const toolSearchQuery = ref('');
const activeTab = ref('General');

const scopes = [
    { value: 'system', label: 'Full System' },
    { value: 'repository', label: 'Repository' },
    { value: 'none', label: 'None' }
];

const getScopeDescription = (scope) => {
    const map = {
        'system': 'Agent can access documentation and code across the entire system.',
        'repository': 'Agent is restricted to the specific repository it is launched in.',
        'none': 'No RAG access. Pure logic and external tools only.'
    };
    return map[scope] || '';
};

const selectedToolsCount = computed(() => {
    return internalAgent.value.tool_ids ? internalAgent.value.tool_ids.length : 0;
});

// Filter and group tools by category
const groupedFilteredTools = computed(() => {
    // Filter tools based on search query
    const query = toolSearchQuery.value.toLowerCase().trim();
    const filtered = query
        ? availableTools.value.filter(tool =>
            tool.name.toLowerCase().includes(query) ||
            (tool.description && tool.description.toLowerCase().includes(query))
        )
        : availableTools.value;

    // Group by category
    const grouped = {};
    filtered.forEach(tool => {
        const category = tool.category || 'other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(tool);
    });

    // Sort categories alphabetically
    const sortedGrouped = {};
    Object.keys(grouped).sort().forEach(key => {
        sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
});

const filteredModels = computed(() => {
    if (!selectedProviderId.value) return llmModels.value;
    return llmModels.value.filter(m => m.provider === selectedProviderId.value);
});

const fetchTools = async () => {
    try {
        loadingTools.value = true;
        // Fetch ALL pages of ToolDefinitions from our API
        let allTools = [];
        let nextUrl = '/tools/definitions/';

        while (nextUrl) {
            const response = await api.get(nextUrl);
            const data = response.data;

            // Add results from this page
            if (data.results) {
                allTools = allTools.concat(data.results);
            } else {
                // Fallback for non-paginated response
                allTools = data;
                break;
            }

            // Get next page URL (extract path from full URL and remove /api prefix)
            if (data.next) {
                const url = new URL(data.next);
                let path = url.pathname + url.search;
                // Remove /api prefix since api.get() adds it automatically
                if (path.startsWith('/api/')) {
                    path = path.substring(4);
                }
                nextUrl = path;
            } else {
                nextUrl = null;
            }
        }

        availableTools.value = allTools;
        console.log(`Loaded ${allTools.length} tools total`);
    } catch (e) {
        console.error("Failed to fetch tools", e);
    } finally {
        loadingTools.value = false;
    }
};

const fetchProviders = async () => {
    try {
        const res = await api.getLlmProviders();
        llmProviders.value = res.data.results || res.data;
    } catch (e) {
        console.error("Failed to fetch providers", e);
    }
};

const fetchModels = async () => {
    try {
        console.log('Fetching LLM models...');
        const res = await api.getLlmModels();
        llmModels.value = res.data.results || res.data;
        
        // Initial setup of selectedProviderId if model is already selected
        if (internalAgent.value.default_model) {
            const model = llmModels.value.find(m => m.id === internalAgent.value.default_model);
            if (model) {
                selectedProviderId.value = model.provider;
            }
        }
    } catch (e) {
        console.error("Failed to fetch models", e);
    }
};

const toggleTool = (toolId) => {
    if (!internalAgent.value.tool_ids) {
        internalAgent.value.tool_ids = [];
    }
    
    const index = internalAgent.value.tool_ids.indexOf(toolId);
    if (index === -1) {
        internalAgent.value.tool_ids.push(toolId);
    } else {
        internalAgent.value.tool_ids.splice(index, 1);
    }
};

const areAllSelected = (categoryName) => {
    // If we're filtering, we only care about visible tools in this category
    const tools = groupedFilteredTools.value[categoryName] || [];
    if (tools.length === 0) return false;
    // Check if ALL visible tools in this category are selected
    if (!internalAgent.value.tool_ids) return false;
    return tools.every(t => internalAgent.value.tool_ids.includes(t.id));
};

const toggleCategory = (categoryName) => {
    if (!internalAgent.value.tool_ids) {
        internalAgent.value.tool_ids = [];
    }

    const tools = groupedFilteredTools.value[categoryName] || [];
    const allSelected = areAllSelected(categoryName);
    
    if (allSelected) {
        // Deselect all visible tools in this category
        tools.forEach(t => {
            const idx = internalAgent.value.tool_ids.indexOf(t.id);
            if (idx !== -1) internalAgent.value.tool_ids.splice(idx, 1);
        });
    } else {
        // Select all visible tools in this category
        tools.forEach(t => {
            if (!internalAgent.value.tool_ids.includes(t.id)) {
                internalAgent.value.tool_ids.push(t.id);
            }
        });
    }
};

const save = () => {
    // Read the model selection directly from internalAgent which is now v-model bound
    const modelId = internalAgent.value.default_model;
    
    // Create the payload with the current form values
    const agentData = {
        ...internalAgent.value,
        default_model: modelId
    };
    
    console.log('Saving agent with default_model:', modelId);
    emit('save', agentData);
};

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!internalAgent.value.id) {
        alert("Please save the agent first to upload files.");
        return;
    }

    try {
        uploading.value = true;
        const res = await api.uploadAgentFile(internalAgent.value.id, file);
        
        // Add to list
        if (!internalAgent.value.knowledge_files) {
            internalAgent.value.knowledge_files = [];
        }
        internalAgent.value.knowledge_files.unshift(res.data);
        
        // Clear input
        if (fileInput.value) fileInput.value.value = '';
    } catch (e) {
        alert("Upload failed: " + (e.response?.data?.error || e.message));
    } finally {
        uploading.value = false;
    }
};

const viewAnalysis = (file) => {
    selectedAnalysisFile.value = file;
    showAnalysisModal.value = true;
};

const formatMarkdown = (text) => {
    if (!text) return '';
    return marked(text);
};

const removeFile = async (file) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    try {
        await api.deleteGenericFile(file.id);
        // Update local list
        internalAgent.value.knowledge_files = internalAgent.value.knowledge_files.filter(f => f.id !== file.id);
    } catch (e) {
        alert("Failed to delete file: " + (e.response?.data?.error || e.message));
    }
};

const reRunAnalysis = async () => {
    if (!selectedAnalysisFile.value) return;
    
    isReAnalyzing.value = true;
    try {
        const res = await api.analyzeContextFile(selectedAnalysisFile.value.id);
        
        // Update modal state (which points to file obj reference? wait selectedAnalysisFile is ref)
        // If selectedAnalysisFile is the same object ref as in the list, updating it updates the list.
        selectedAnalysisFile.value.analysis = res.data.analysis;
        
        // Ensure reactivity if ref changed
        const idx = internalAgent.value.knowledge_files.findIndex(f => f.id === selectedAnalysisFile.value.id);
        if (idx !== -1) {
            internalAgent.value.knowledge_files[idx].analysis = res.data.analysis;
        }
    } catch (e) {
        alert("Analysis failed: " + e.message);
    } finally {
        isReAnalyzing.value = false;
    }
};

// Sync prop changes to internal
watch(() => props.agent, (newVal) => {
    isUpdatingFromProp.value = true;
    internalAgent.value = { 
        default_model: null,  // Ensure reactivity
        ...newVal 
    };
    // Ensure array exists
    if (!internalAgent.value.tool_ids) internalAgent.value.tool_ids = [];
    
    // Release lock after update propagates
    setTimeout(() => { isUpdatingFromProp.value = false; }, 0);
}, { deep: true });

// Sync internal changes to parent
watch(internalAgent, (newVal) => {
    if (isUpdatingFromProp.value) return;
    emit('update:agent', newVal);
}, { deep: true });

// Debug: Watch default_model specifically
watch(() => internalAgent.value.default_model, (newVal, oldVal) => {
    console.log('🔍 default_model changed from', oldVal, 'to', newVal);
}, { immediate: true });

onMounted(() => {
    fetchTools();
    fetchProviders();
    fetchModels();
});
</script>
