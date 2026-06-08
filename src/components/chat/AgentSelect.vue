<!--
  AgentSelect — a searchable agent picker (combobox) for the chat composer. Shows the active agent as
  a pill; clicking opens an upward popover with a search box and a type-to-filter list (autocomplete).
  At most ~5 rows are visible at once (the rest scroll). Keyboard: ↑/↓ to move, Enter to pick, Esc to
  close. Emits `select` with the chosen agent. Pure/props-driven so it's reusable + testable.
-->
<template>
  <div class="asel">
    <button type="button" class="asel-btn" @click="toggle" :title="currentName" :disabled="!agents.length">
      <svg class="asel-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h0M16 16h0"/></svg>
      <span class="asel-label">{{ currentName }}</span>
      <svg class="asel-caret" :class="{ open }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
    </button>

    <div v-if="open" class="asel-menu" @click.stop>
      <div class="asel-search-wrap">
        <svg class="asel-search-ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M19 19l-5-5" stroke-linecap="round"/></svg>
        <input ref="searchEl" v-model="q" class="asel-search" type="text" placeholder="Search agents…"
               @keydown="onKey" @click.stop />
      </div>
      <div class="asel-list">
        <button v-for="(a, i) in filtered" :key="a.id" type="button" class="asel-item"
                :class="{ active: String(a.id) === String(selectedId), hi: i === hi }"
                @mouseenter="hi = i" @click="pick(a)">
          <span class="asel-item-name">{{ a.name }}</span>
          <svg v-if="String(a.id) === String(selectedId)" class="asel-check" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
        </button>
        <div v-if="!filtered.length" class="asel-empty">No agents match “{{ q }}”</div>
      </div>
    </div>
    <div v-if="open" class="asel-backdrop" @click="open = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'

const props = defineProps({
  agents: { type: Array, default: () => [] },
  selectedId: { type: [Number, String], default: null },
})
const emit = defineEmits(['select'])

const open = ref(false)
const q = ref('')
const hi = ref(0)
const searchEl = ref(null)

const currentName = computed(() => {
  const a = props.agents.find((x) => String(x.id) === String(props.selectedId))
  return a ? a.name : (props.agents.length ? 'Select agent' : 'No agents')
})

// Type-to-filter (autocomplete). Empty query → all agents.
const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const list = props.agents
  if (!needle) return list
  return list.filter((a) => String(a.name || '').toLowerCase().includes(needle))
})

watch(filtered, () => { hi.value = 0 })  // keep the highlight in range as results change

async function toggle() {
  if (!props.agents.length) return
  open.value = !open.value
  if (open.value) {
    q.value = ''
    hi.value = Math.max(0, props.agents.findIndex((a) => String(a.id) === String(props.selectedId)))
    await nextTick()
    searchEl.value?.focus()
  }
}

function pick(a) {
  emit('select', a)
  open.value = false
}

function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); hi.value = Math.min(hi.value + 1, filtered.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hi.value = Math.max(hi.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); const a = filtered.value[hi.value]; if (a) pick(a) }
  else if (e.key === 'Escape') { e.preventDefault(); open.value = false }
}
</script>

<style scoped>
.asel { position: relative; display: inline-block; }
.asel-btn {
  display: inline-flex; align-items: center; gap: 6px; max-width: 200px; padding: 3px 9px; border-radius: 9999px;
  border: 1px solid #e5e7eb; background: #fff; font-size: 0.72rem; font-weight: 600; color: #374151; cursor: pointer;
}
.asel-btn:hover:not(:disabled) { background: #f9fafb; }
.asel-btn:disabled { opacity: .55; cursor: default; }
.asel-ic { width: 13px; height: 13px; color: #6366f1; flex-shrink: 0; }
.asel-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asel-caret { width: 13px; height: 13px; color: #9ca3af; transition: transform .15s; flex-shrink: 0; }
.asel-caret.open { transform: rotate(180deg); }

.asel-backdrop { position: fixed; inset: 0; z-index: 40; }
.asel-menu {
  position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 50; width: 240px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 6px;
}
.asel-search-wrap { position: relative; margin-bottom: 4px; }
.asel-search-ic { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: #9ca3af; }
.asel-search {
  width: 100%; padding: 7px 8px 7px 28px; font-size: 0.78rem; color: #1f2937;
  border: 1px solid #e5e7eb; border-radius: 8px; outline: none; background: #f9fafb;
}
.asel-search:focus { border-color: #818cf8; background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
/* ~5 rows visible (each ≈34px), the rest scroll */
.asel-list { max-height: 170px; overflow-y: auto; }
.asel-item {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px;
  border: 0; background: transparent; border-radius: 8px; text-align: left; cursor: pointer; font-size: 0.8rem; color: #1f2937;
}
.asel-item.hi { background: #f3f4f6; }
.asel-item.active { color: #4338ca; font-weight: 600; }
.asel-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asel-check { width: 15px; height: 15px; color: #6366f1; flex-shrink: 0; }
.asel-empty { padding: 10px 8px; font-size: 0.75rem; color: #9ca3af; text-align: center; }
</style>
