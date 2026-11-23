<script setup>
// The card a tool shows beside the editor's rail (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.4): a small picture of the
// tool at work, its name, its key, two lines of what it does, and "Learn more" to its Help Center article. The editor
// opens it after 400 ms of hover or on keyboard focus and closes it on Esc and on leave; it is never shown on touch.
// ``anchor``: the rail button's box on screen ({top, left, right, bottom, width, height}); the card sits to its left
// (the rail is at the canvas's right edge), else to its right, always inside the window.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ExternalLink } from 'lucide-vue-next';
import ToolArt from './ToolArt.vue';
import { helpArticle } from '../editorTools.js';

const props = defineProps({
  id: { type: String, default: 'tool-card' },
  entry: { type: Object, required: true },
  anchor: { type: Object, required: true },
  unavailable: { type: String, default: '' },
});
const emit = defineEmits(['enter', 'leave']);
const card = ref(null);
const size = ref({ w: 280, h: 280 });
const GAP = 12, EDGE = 8;
function measure() { const r = card.value?.getBoundingClientRect(); if (r && r.width) size.value = { w: r.width, h: r.height }; }
onMounted(() => nextTick(measure));
watch(() => props.entry.id, () => nextTick(measure));
const place = computed(() => {
  const width = globalThis.innerWidth || 1280, height = globalThis.innerHeight || 800;
  const a = props.anchor;
  let left = a.left - GAP - size.value.w;
  if (left < EDGE) left = Math.min(a.right + GAP, width - size.value.w - EDGE);
  const top = Math.max(EDGE, Math.min(a.top + a.height / 2 - size.value.h / 2, height - size.value.h - EDGE));
  return { left: `${Math.round(Math.max(EDGE, left))}px`, top: `${Math.round(top)}px` };
});
const link = computed(() => helpArticle(props.entry.slug));
</script>

<template>
  <div :id="id" ref="card" class="tool-card" :style="place" @pointerenter="emit('enter')" @pointerleave="emit('leave')">
    <ToolArt :id="entry.id"/>
    <div class="tool-card-head">
      <strong>{{ entry.name }}</strong>
      <span v-if="entry.keys.length" class="tool-card-keys"><kbd v-for="k in entry.keys" :key="k">{{ k }}</kbd></span>
    </div>
    <p v-for="(line,i) in entry.lines" :key="i">{{ line }}</p>
    <p v-if="unavailable" class="tool-card-off">{{ unavailable }}</p>
    <a v-if="link" class="tool-card-link" :href="link" target="_blank" rel="noopener" tabindex="-1">Learn more <ExternalLink :size="13" aria-hidden="true"/></a>
  </div>
</template>

<style scoped>
.tool-card { position: fixed; z-index: 60; width: 280px; padding: 10px 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 14px 34px #0f172a26, 0 2px 6px #0f172a12; color: #0f172a; font-size: 12.5px; line-height: 1.5; text-align: left; }
.tool-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 2px 4px; }
.tool-card-head strong { font-size: 14px; font-weight: 600; }
.tool-card-keys { display: inline-flex; gap: 4px; }
.tool-card-keys kbd { min-width: 22px; padding: 1px 6px; border: 1px solid #cbd5e1; border-bottom-width: 2px; border-radius: 6px; background: #f8fafc;
  color: #334155; font: 600 11px/18px var(--aadml-font, inherit); text-align: center; }
.tool-card p { margin: 0 2px 2px; color: #475569; }
.tool-card .tool-card-off { margin-top: 6px; color: #b54708; }
.tool-card-link { display: inline-flex; align-items: center; gap: 4px; margin: 8px 2px 0; color: #1d4ed8; font-weight: 600; text-decoration: none; }
.tool-card-link:hover { text-decoration: underline; }
@media (prefers-reduced-motion: no-preference) { .tool-card { animation: tool-card-in .14s ease-out; } }
@keyframes tool-card-in { from { opacity: 0; transform: translateX(4px); } to { opacity: 1; transform: none; } }
</style>
