<!--
  ReasoningPanel — the model's private reasoning, surfaced cleanly and COLLAPSED by default,
  separate from the action/tool timeline (ActivityStream). Keeps the answer pure (answer +
  evidence + uncertainty + next steps) while the "why" is one click away.

  Reads the thinking-phase steps from an `activity` (label = the model's narration phrase,
  thinkingText = streamed extended-thinking when enabled). Renders nothing when there's no
  reasoning to show.
-->
<template>
  <details v-if="items.length" class="reasoning mt-1.5 group">
    <summary class="reasoning-summary">
      <svg class="w-3.5 h-3.5 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 1 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/>
      </svg>
      <span>💭 Reasoning</span>
      <span class="count">· {{ items.length }} step{{ items.length === 1 ? '' : 's' }}</span>
    </summary>
    <ol class="reasoning-list">
      <li v-for="(it, i) in items" :key="i">
        <span class="phrase">{{ it.label || 'Thinking' }}</span>
        <div v-if="it.text" class="thought">{{ it.text }}</div>
      </li>
    </ol>
  </details>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ activity: { type: Object, default: null } })

// One entry per reasoning ("thinking") step — its phrase label + any streamed thinking text.
const items = computed(() => {
  const a = props.activity
  if (!a || !Array.isArray(a.steps)) return []
  return a.steps
    .filter((s) => s.phase === 'thinking' && (s.label || s.thinkingText))
    .map((s) => ({ label: s.label, text: (s.thinkingText || '').trim() }))
})
</script>

<style scoped>
.reasoning { border: 1px solid #eef2f7; border-radius: 10px; background: #fbfbfe; }
.reasoning-summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; font-size: 12px; color: #64748b; user-select: none;
}
.reasoning-summary::-webkit-details-marker { display: none; }
.reasoning-summary:hover { color: #475569; }
.reasoning-summary .count { color: #94a3b8; }
.reasoning-list { margin: 0; padding: 2px 12px 8px 30px; }
.reasoning-list li { font-size: 12.5px; color: #475569; margin: 4px 0; line-height: 1.45; }
.reasoning-list .phrase { font-weight: 500; }
.reasoning-list .thought {
  margin-top: 2px; font-size: 12px; color: #64748b; font-style: italic;
  white-space: pre-wrap; word-break: break-word;
}
</style>
