<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="close">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-50 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <h3 class="font-bold text-gray-800 flex items-center gap-2 min-w-0">
                <span class="text-xl">{{ fileIcon }}</span>
                <span class="truncate">{{ currentPath || 'View File' }}</span>
            </h3>
            <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Download button -->
                <button v-if="!loading && !error" @click="downloadFile" 
                    class="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition flex items-center gap-1.5"
                    :disabled="downloading">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {{ downloading ? 'Downloading...' : 'Download' }}
                </button>
                <button @click="close" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto relative" :class="isMedia ? 'bg-gray-900 flex items-center justify-center' : 'bg-[#1e1e1e]'">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-gray-400">
                <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            
            <div v-else-if="error" class="p-8 text-center text-red-400">
                <div class="text-2xl mb-2">⚠️</div>
                 {{ error }}
            </div>
            
            <!-- Image preview -->
            <img v-else-if="isImage" :src="mediaUrl" :alt="currentPath" 
                class="max-w-full max-h-full object-contain" />
            
            <!-- Video preview -->
            <video v-else-if="isVideo" :src="mediaUrl" controls autoplay
                class="max-w-full max-h-full" />
            
            <!-- Text/code content -->
            <pre v-else class="p-4 font-mono text-sm text-gray-200 leading-relaxed whitespace-pre font-ligatures-contextual"><code>{{ content }}</code></pre>
        </div>
        
        <!-- Footer -->
        <div class="p-3 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
            <span v-if="isMedia">{{ currentPath?.split('/').pop() }}</span>
            <span v-else>{{ content?.length || 0 }} chars</span>
            <span v-if="fileModified" :title="fileModified">{{ timeAgo(fileModified) }}</span>
            <span v-else>Read-only</span>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import api from '../services/api';

const props = defineProps({
    agentId: {
        type: [String, Number],
        default: null
    },
    systemId: {
        type: String,
        default: null
    },
    repoId: {
        type: String,
        default: null
    }
});

const isOpen = ref(false);
const currentPath = ref('');
const content = ref('');
const loading = ref(false);
const error = ref('');
const downloading = ref(false);
const mediaUrl = ref('');
const fileModified = ref(null);

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mov', 'avi'];

const fileExt = computed(() => {
    const name = currentPath.value || '';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
});

const isImage = computed(() => IMAGE_EXTS.includes(fileExt.value));
const isVideo = computed(() => VIDEO_EXTS.includes(fileExt.value));
const isMedia = computed(() => isImage.value || isVideo.value);

const fileIcon = computed(() => {
    if (isImage.value) return '🖼️';
    if (isVideo.value) return '🎬';
    const ext = fileExt.value;
    if (['py'].includes(ext)) return '🐍';
    if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return '📜';
    if (['json'].includes(ext)) return '{}';
    if (['md', 'txt'].includes(ext)) return '📝';
    if (['html', 'css'].includes(ext)) return '🌐';
    return '📄';
});

const timeAgo = (ts) => {
    if (!ts) return '';
    const date = new Date(ts * 1000); // Unix timestamp
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
};

const activeAgentId = ref(null);

const resolvedAgentId = () => activeAgentId.value || props.agentId;

const open = async (pathOrEntry, agentId = null) => {
    const entry = typeof pathOrEntry === 'string' ? { path: pathOrEntry } : pathOrEntry;
    if (agentId) activeAgentId.value = agentId;
    isOpen.value = true;
    currentPath.value = entry.path || entry;
    content.value = '';
    error.value = '';
    mediaUrl.value = '';
    loading.value = true;
    fileModified.value = entry.modified || null;
    
    const aid = resolvedAgentId();
    try {
        if (isMedia.value && aid) {
            // For media files, get a blob URL via download endpoint
            const res = await api.downloadWorkspaceFile(aid, currentPath.value);
            mediaUrl.value = URL.createObjectURL(res.data);
        } else if (aid) {
            // Agent workspace text file
            const res = await api.readWorkspaceFile(aid, currentPath.value);
            content.value = res.data.content || res.data;
        } else if (props.systemId && props.repoId) {
            // Legacy repo file viewer
            const res = await api.getFileContent(props.systemId, props.repoId, currentPath.value);
            content.value = res.data.content || res.data;
        } else {
            throw new Error("Cannot view files: No active context.");
        }
    } catch (e) {
        console.error("Failed to load file:", e);
        error.value = e.response?.data?.error || e.message || "Failed to load file content";
    } finally {
        loading.value = false;
    }
};

const downloadFile = async () => {
    const aid = resolvedAgentId();
    if (!aid) return;
    downloading.value = true;
    try {
        const res = await api.downloadWorkspaceFile(aid, currentPath.value);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentPath.value.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed:", e);
    } finally {
        downloading.value = false;
    }
};

const close = () => {
    if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
    isOpen.value = false;
};

defineExpose({ open, close });
</script>
