<template>
  <div class="sources">
    <button class="sources-toggle" @click="open = !open">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ico">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ citations.length }} source{{ citations.length === 1 ? '' : 's' }}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chev" :class="{ open }">
        <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <ul v-if="open" class="sources-list">
      <li v-for="c in citations" :key="c.n" class="src">
        <span class="src-n">[{{ c.n }}]</span>
        <component :is="c.url ? 'a' : 'span'" :href="c.url || undefined" target="_blank" rel="noopener" class="src-title">
          {{ c.title || 'source' }}
        </component>
        <span v-if="c.section" class="src-meta">· {{ c.section }}</span>
        <span v-if="c.date" class="src-meta">· {{ c.date }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ citations: { type: Array, default: () => [] } })
const open = ref(false)
</script>

<style scoped>
.sources { margin-top: 8px; }
.sources-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
  color: #64748b; background: none; border: none; cursor: pointer; padding: 2px 0; }
.sources-toggle:hover { color: #4f46e5; }
.ico { width: 13px; height: 13px; } .chev { width: 13px; height: 13px; transition: transform .15s; }
.chev.open { transform: rotate(180deg); }
.sources-list { list-style: none; margin: 6px 0 0; padding: 8px 10px; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px; }
.src { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; padding: 3px 0; flex-wrap: wrap; }
.src-n { font-weight: 700; color: #4f46e5; }
.src-title { color: #334155; font-weight: 500; text-decoration: none; }
a.src-title:hover { color: #4f46e5; text-decoration: underline; }
.src-meta { color: #94a3b8; font-size: 11.5px; }
</style>
