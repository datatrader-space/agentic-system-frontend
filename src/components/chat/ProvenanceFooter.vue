<template>
  <!-- Always-on provenance line (answer-basis-provenance). The label is authored server-side:
       "Sources: Knowledge Base · N references" / "Sources: Tool/API result" /
       "Sources: Conflicting Knowledge Base references" / "Source: No external source used". -->
  <div v-if="basis && basis.label" class="provenance" :class="toneClass" :title="title">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ico">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>{{ basis.label }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ basis: { type: Object, default: null } })
const toneClass = computed(() => {
  const b = props.basis?.answer_basis
  if (b === 'conflicting_sources') return 'tone-warn'
  if (props.basis?.sources_used) return 'tone-sourced'
  return 'tone-none'
})
const title = computed(() => {
  switch (props.basis?.answer_basis) {
    case 'knowledge_base': return 'Answer grounded in your knowledge base'
    case 'tool_result': return 'Answer used a live tool / API result'
    case 'conflicting_sources': return 'Knowledge base sources disagreed — both are shown'
    case 'conversation_context': return 'Answer used this conversation’s context'
    default: return 'Answered without an external source'
  }
})
</script>

<style scoped>
.provenance {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px; font-size: 12px; font-weight: 500;
}
.provenance .ico { width: 13px; height: 13px; flex-shrink: 0; }
.tone-sourced { color: #4f46e5; }   /* KB / tool — grounded */
.tone-warn { color: #b45309; }      /* conflicting sources */
.tone-none { color: #94a3b8; }      /* no external source */
</style>
