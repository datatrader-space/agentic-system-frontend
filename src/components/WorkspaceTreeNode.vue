<template>
    <div>
        <template v-for="entry in entries" :key="entry.path">
            <!-- Directory -->
            <div v-if="entry.is_dir">
                <div class="w-full flex items-center gap-1 px-3 py-1.5 rounded hover:bg-gray-50 text-sm text-gray-700 group">
                    <!-- Checkbox for multi-select -->
                    <input v-if="selectionMode" type="checkbox" 
                        :checked="selectedPaths.has(entry.path)"
                        @change="$emit('toggle-select', entry.path)"
                        class="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                        @click.stop />
                    <button @click="$emit('toggle-dir', entry.path)" class="flex items-center gap-2 flex-1 min-w-0">
                        <svg class="w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0"
                            :class="{ 'rotate-90': expandedDirs[entry.path] }" fill="none" stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <span class="text-yellow-500 flex-shrink-0">📁</span>
                        <span class="font-medium flex-1 text-left truncate">{{ entry.name }}</span>
                    </button>
                    <span role="button" @click.stop="$emit('delete', entry)"
                        class="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                        title="Delete folder">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </span>
                </div>
                <!-- Children (recursive) -->
                <div v-if="expandedDirs[entry.path]" class="ml-5 border-l border-gray-100 pl-1">
                    <WorkspaceTreeNode :entries="entry.children || []" :expandedDirs="expandedDirs"
                        :previewPath="previewPath" :getFileIcon="getFileIcon" :formatSize="formatSize"
                        :selectionMode="selectionMode" :selectedPaths="selectedPaths"
                        @toggle-dir="$emit('toggle-dir', $event)" @read-file="$emit('read-file', $event)"
                        @delete="$emit('delete', $event)" @toggle-select="$emit('toggle-select', $event)" />
                </div>
            </div>

            <!-- File -->
            <div v-else class="w-full flex items-center gap-1 px-3 py-1.5 rounded text-sm group"
                :class="previewPath === entry.path ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'">
                <!-- Checkbox for multi-select -->
                <input v-if="selectionMode" type="checkbox"
                    :checked="selectedPaths.has(entry.path)"
                    @change="$emit('toggle-select', entry.path)"
                    class="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                    @click.stop />
                <button @click="$emit('read-file', entry)" class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="flex-shrink-0">{{ getFileIcon(entry.name) }}</span>
                    <span class="flex-1 text-left truncate">{{ entry.name }}</span>
                </button>
                <span class="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap" :title="formatTimestamp(entry.modified)">
                    {{ formatSize(entry.size) }}
                    <span v-if="entry.modified" class="ml-1.5 text-gray-300">{{ timeAgo(entry.modified) }}</span>
                </span>
                <span role="button" @click.stop="$emit('delete', entry)"
                    class="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                    title="Delete">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </span>
            </div>
        </template>
    </div>
</template>

<script setup>
defineOptions({ name: 'WorkspaceTreeNode' })

defineProps({
    entries: { type: Array, required: true },
    expandedDirs: { type: Object, required: true },
    previewPath: { type: String, default: null },
    getFileIcon: { type: Function, required: true },
    formatSize: { type: Function, required: true },
    selectionMode: { type: Boolean, default: false },
    selectedPaths: { type: Set, default: () => new Set() },
})

defineEmits(['toggle-dir', 'read-file', 'delete', 'toggle-select'])

const timeAgo = (ts) => {
    if (!ts) return '';
    const date = new Date(ts * 1000);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatTimestamp = (ts) => {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleString();
};
</script>
