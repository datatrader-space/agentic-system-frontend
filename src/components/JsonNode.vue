<template>
  <div :style="{ paddingLeft: `${level * 20}px` }" class="json-node">
    <!-- Object -->
    <template v-if="isObject">
      <div class="node-line">
        <span v-if="propertyKey" class="property-key">"{{ propertyKey }}"</span>
        <span v-if="propertyKey" class="colon">: </span>
        <button @click="toggle" class="collapse-btn">
          <svg v-if="isExpanded" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4H4z"/>
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4V4z"/>
          </svg>
        </button>
        <span class="bracket">{</span>
        <span v-if="!isExpanded" class="ellipsis">...</span>
        <span class="bracket" v-if="!isExpanded">}</span>
        <span v-if="!isExpanded" class="item-count">{{ Object.keys(data).length }} properties</span>
      </div>
      
      <template v-if="isExpanded">
        <div v-for="(value, key) in data" :key="key">
          <JsonNode 
            :data="value" 
            :property-key="key"
            :path="[...path, key]"
            :level="level + 1"
            :expanded-paths="expandedPaths"
            @toggle="$emit('toggle', $event)"
            @update="$emit('update', $event)"
          />
        </div>
        <div :style="{ paddingLeft: `${level * 20}px` }" class="node-line">
          <span class="bracket">}</span>
        </div>
      </template>
    </template>

    <!-- Array -->
    <template v-else-if="isArray">
      <div class="node-line">
        <span v-if="propertyKey" class="property-key">"{{ propertyKey }}"</span>
        <span v-if="propertyKey" class="colon">: </span>
        <button @click="toggle" class="collapse-btn">
          <svg v-if="isExpanded" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4H4z"/>
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4V4z"/>
          </svg>
        </button>
        <span class="bracket">[</span>
        <span v-if="!isExpanded" class="ellipsis">...</span>
        <span class="bracket" v-if="!isExpanded">]</span>
        <span v-if="!isExpanded" class="item-count">{{ data.length }} items</span>
      </div>
      
      <template v-if="isExpanded">
        <div v-for="(item, index) in data" :key="index">
          <JsonNode 
            :data="item" 
            :property-key="index.toString()"
            :path="[...path, index]"
            :level="level + 1"
            :expanded-paths="expandedPaths"
            @toggle="$emit('toggle', $event)"
            @update="$emit('update', $event)"
          />
        </div>
        <div :style="{ paddingLeft: `${level * 20}px` }" class="node-line">
          <span class="bracket">]</span>
        </div>
      </template>
    </template>

    <!-- Primitive Value -->
    <div v-else class="node-line primitive">
      <span v-if="propertyKey" class="property-key">"{{ propertyKey }}"</span>
      <span v-if="propertyKey" class="colon">: </span>
      <span :class="`value-${valueType}`">{{ formattedValue }}</span>
      <span v-if="!isLastItem" class="comma">,</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: null,
  propertyKey: String,
  path: {
    type: Array,
    default: () => []
  },
  level: {
    type: Number,
    default: 0
  },
  expandedPaths: {
    type: Set,
    required: true
  }
})

const emit = defineEmits(['toggle', 'update'])

const pathKey = computed(() => props.path.join('.'))

const isObject = computed(() => {
  return props.data !== null && typeof props.data === 'object' && !Array.isArray(props.data)
})

const isArray = computed(() => {
  return Array.isArray(props.data)
})

const isExpanded = computed(() => {
  return props.expandedPaths.has(pathKey.value)
})

const valueType = computed(() => {
  if (props.data === null) return 'null'
  if (typeof props.data === 'boolean') return 'boolean'
  if (typeof props.data === 'number') return 'number'
  if (typeof props.data === 'string') return 'string'
  return 'unknown'
})

const formattedValue = computed(() => {
  if (props.data === null) return 'null'
  if (typeof props.data === 'string') return `"${props.data}"`
  return String(props.data)
})

function toggle() {
  emit('toggle', props.path)
}
</script>

<style scoped>
.json-node {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.9375rem;
  line-height: 1.8;
}

.node-line {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.collapse-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: #cccccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: #ffffff;
}

.collapse-btn svg {
  width: 12px;
  height: 12px;
}

.property-key {
  color: #9cdcfe;
}

.colon {
  color: #cccccc;
}

.bracket {
  color: #ffd700;
}

.ellipsis {
  color: #808080;
  margin-left: 0.25rem;
}

.item-count {
  color: #808080;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.value-string {
  color: #ce9178;
}

.value-number {
  color: #b5cea8;
}

.value-boolean {
  color: #569cd6;
}

.value-null {
  color: #569cd6;
}

.primitive {
  padding-left: 16px;
}

.comma {
  color: #cccccc;
}
</style>
