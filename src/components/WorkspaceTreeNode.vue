<template>
    <div>
        <template v-for="entry in entries" :key="entry.path">
            <!-- Directory -->
            <div v-if="entry.is_dir">
                <button @click="$emit('toggle-dir', entry.path)"
                    class="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50 text-sm text-gray-700 group">
                    <svg class="w-3.5 h-3.5 text-gray-400 transition-transform"
                        :class="{ 'rotate-90': expandedDirs[entry.path] }" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <span class="text-yellow-500">📁</span>
                    <span class="font-medium flex-1 text-left">{{ entry.name }}</span>
                    <span role="button" @click.stop="$emit('delete', entry)"
                        class="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition cursor-pointer"
                        title="Delete folder">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </span>
                </button>
                <!-- Children (recursive) -->
                <div v-if="expandedDirs[entry.path]" class="ml-5 border-l border-gray-100 pl-1">
                    <WorkspaceTreeNode :entries="entry.children || []" :expandedDirs="expandedDirs"
                        :previewPath="previewPath" :getFileIcon="getFileIcon" :formatSize="formatSize"
                        @toggle-dir="$emit('toggle-dir', $event)" @read-file="$emit('read-file', $event)"
                        @delete="$emit('delete', $event)" />
                </div>
            </div>

            <!-- File -->
            <button v-else @click="$emit('read-file', entry)"
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm group"
                :class="previewPath === entry.path ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'">
                <span>{{ getFileIcon(entry.name) }}</span>
                <span class="flex-1 text-left truncate">{{ entry.name }}</span>
                <span class="text-xs text-gray-400">{{ formatSize(entry.size) }}</span>
                <span role="button" @click.stop="$emit('delete', entry)"
                    class="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition cursor-pointer"
                    title="Delete">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </span>
            </button>
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
})

defineEmits(['toggle-dir', 'read-file', 'delete'])
</script>
