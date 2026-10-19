<script setup>
// One example as a person reads it: the system message, the turns, a preference's two answers or a document's text
// (api/llm.js turnsOf). Text is shown as text, never as HTML.
import { computed } from 'vue';
import { turnsOf } from '../api/llm.js';

const props = defineProps({ content: Object });
const turns = computed(() => turnsOf(props.content));
</script>

<template>
  <ol class="llm-turns">
    <li v-for="(turn, i) in turns" :key="i" :class="['llm-turn', `llm-turn--${turn.role}`]">
      <span class="llm-turn-label">{{ turn.label }}</span>
      <p>{{ turn.text || '(empty)' }}</p>
    </li>
  </ol>
</template>

<style scoped>
.llm-turns{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.llm-turn{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#fff}
.llm-turn p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.5}
.llm-turn-label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#64748b}
.llm-turn--system{background:#f8fafc}
.llm-turn--user{background:#f5f3ff;border-color:#ddd6fe}
.llm-turn--assistant,.llm-turn--chosen{background:#f0fdfa;border-color:#99f6e4}
.llm-turn--rejected{background:#fef2f2;border-color:#fecaca}
.llm-turn--tool{background:#fffbeb;border-color:#fde68a}
.llm-turn--document p{max-height:420px;overflow:auto}
</style>
