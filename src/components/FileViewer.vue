<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="close">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-50 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <h3 class="font-bold text-gray-800 flex items-center gap-2">
                <span class="text-xl">📄</span>
                {{ currentPath || 'View File' }}
            </h3>
            <button @click="close" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto bg-[#1e1e1e] relative">
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
            
            <pre v-else class="p-4 font-mono text-sm text-gray-200 leading-relaxed whitespace-pre font-ligatures-contextual"><code>{{ content }}</code></pre>
        </div>
        
        <!-- Footer -->
        <div class="p-3 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
            <span>{{ content?.length || 0 }} chars</span>
            <span>Read-only</span>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '../services/api';

const props = defineProps({
    systemId: {
        type: String, // Or Number
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

const open = async (path) => {
    isOpen.value = true;
    currentPath.value = path;
    content.value = '';
    error.value = '';
    loading.value = true;
    
    try {
        if (!props.systemId || !props.repoId) {
            // Check if we can use a generic agent file endpoint?
            // For now, throw descriptive error
            throw new Error("Cannot view files: No active repository context.");
        }
        
        const res = await api.getFileContent(props.systemId, props.repoId, path);
        content.value = res.data.content || res.data;
        
    } catch (e) {
        console.error("Failed to load file:", e);
        error.value = e.response?.data?.error || e.message || "Failed to load file content";
    } finally {
        loading.value = false;
    }
};

const close = () => {
    isOpen.value = false;
};

defineExpose({ open, close });
</script>

<style scoped>
/* Optional: Add prismjs/highlight.js styles here if we integrate it later */
</style>
