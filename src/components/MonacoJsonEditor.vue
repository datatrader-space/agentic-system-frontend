<template>
  <div class="monaco-style-editor">
    <div class="editor-toolbar">
      <span class="editor-label">{{ label }}</span>
      <div class="toolbar-actions">
        <button @click="toggleExpand" class="toolbar-btn" title="Expand/Collapse All">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l-5 5h3v10H7l5 5 5-5h-3V7h3l-5-5z"/>
          </svg>
          {{ allExpanded ? 'Collapse All' : 'Expand All' }}
        </button>
        <button @click="formatCode" class="toolbar-btn" title="Format">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Format
        </button>
      </div>
    </div>
    
    <div class="editor-container">
      <div class="line-numbers">
        <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
      </div>
      
      <div class="editor-content" ref="editorContent">
        <JsonNode 
          :data="parsedData" 
          :path="[]" 
          :level="0"
          :expanded-paths="expandedPaths"
          @toggle="togglePath"
          @update="handleUpdate"
        />
      </div>
    </div>
    
    <div class="editor-footer">
      <div v-if="error" class="error-message">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        {{ error }}
      </div>
      <div v-else class="valid-message">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
        Valid JSON • {{ objectCount }} objects • {{ arrayCount }} arrays
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import JsonNode from './JsonNode.vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: 'JSON Editor'
  }
})

const emit = defineEmits(['update:modelValue'])

const parsedData = ref({})
const error = ref(null)
const expandedPaths = ref(new Set())
const allExpanded = ref(true)

// Parse JSON
watch(() => props.modelValue, (newVal) => {
  try {
    parsedData.value = JSON.parse(newVal)
    error.value = null
    // Auto-expand first level
    if (expandedPaths.value.size === 0) {
      expandAll()
    }
  } catch (e) {
    error.value = e.message
  }
}, { immediate: true })

const lineCount = computed(() => {
  return props.modelValue.split('\n').length
})

const objectCount = computed(() => {
  return (props.modelValue.match(/\{/g) || []).length
})

const arrayCount = computed(() => {
  return (props.modelValue.match(/\[/g) || []).length
})

function togglePath(path) {
  const pathKey = path.join('.')
  if (expandedPaths.value.has(pathKey)) {
    expandedPaths.value.delete(pathKey)
  } else {
    expandedPaths.value.add(pathKey)
  }
}

function expandAll() {
  const paths = new Set()
  function traverse(obj, currentPath = []) {
    if (obj && typeof obj === 'object') {
      paths.add(currentPath.join('.'))
      for (const key in obj) {
        traverse(obj[key], [...currentPath, key])
      }
    }
  }
  traverse(parsedData.value)
  expandedPaths.value = paths
  allExpanded.value = true
}

function collapseAll() {
  expandedPaths.value = new Set()
  allExpanded.value = false
}

function toggleExpand() {
  if (allExpanded.value) {
    collapseAll()
  } else {
    expandAll()
  }
}

function formatCode() {
  try {
    const parsed = JSON.parse(props.modelValue)
    emit('update:modelValue', JSON.stringify(parsed, null, 2))
  } catch (e) {
    error.value = 'Cannot format invalid JSON'
  }
}

function handleUpdate(path, value) {
  const updated = JSON.parse(props.modelValue)
  let current = updated
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]]
  }
  current[path[path.length - 1]] = value
  emit('update:modelValue', JSON.stringify(updated, null, 2))
}
</script>

<style scoped>
.monaco-style-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.editor-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cccccc;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  color: #cccccc;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #505050;
  border-color: #007acc;
}

.toolbar-btn svg {
  width: 14px;
  height: 14px;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: auto;
  background: #1e1e1e;
}

.line-numbers {
  padding: 0.5rem 0;
  background: #1e1e1e;
  border-right: 1px solid #3e3e42;
  user-select: none;
  min-width: 50px;
  text-align: right;
}

.line-number {
  padding: 0 0.75rem;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.9375rem;
  line-height: 1.8;
  color: #858585;
}

.editor-content {
  flex: 1;
  padding: 0.5rem 1rem;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.9375rem;
  line-height: 1.8;
  color: #d4d4d4;
}

.editor-footer {
  padding: 0.5rem 1rem;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f48771;
  font-size: 0.8125rem;
}

.error-message svg {
  width: 16px;
  height: 16px;
}

.valid-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #89d185;
  font-size: 0.8125rem;
}

.valid-message svg {
  width: 16px;
  height: 16px;
}
</style>
