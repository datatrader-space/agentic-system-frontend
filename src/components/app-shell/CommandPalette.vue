<template>
  <Transition name="cmdk">
    <div v-if="modelValue" class="cmdk-overlay" @click.self="close" @keydown.esc.prevent="close">
      <div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <!-- search -->
        <div class="cmdk-search">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" stroke-linecap="round" /></svg>
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            placeholder="Search pages and actions…"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="run(filtered[active])"
          />
          <kbd>esc</kbd>
        </div>

        <!-- results -->
        <div class="cmdk-list vm-scroll">
          <template v-if="filtered.length">
            <button
              v-for="(item, i) in filtered"
              :key="item.id"
              class="cmdk-item"
              :class="{ on: i === active }"
              @mouseenter="active = i"
              @click="run(item)"
            >
              <span class="cmdk-ico" :style="{ background: item.grad || 'var(--vm-g-brand)' }">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path v-for="(d, di) in item.icon" :key="di" :d="d" />
                </svg>
              </span>
              <span class="cmdk-label">{{ item.label }}</span>
              <span class="cmdk-kind">{{ item.kind }}</span>
            </button>
          </template>
          <div v-else class="cmdk-empty">No matches for “{{ query }}”.</div>
        </div>

        <div class="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span class="brandline">Agentic · ⌘K</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const chat = useChatStore()
const inputEl = ref(null)
const query = ref('')
const active = ref(0)

const G = {
  brand: 'linear-gradient(120deg,#7C3AED,#EC4899)',
  cool: 'linear-gradient(120deg,#7C3AED,#0EA5E9)',
  warm: 'linear-gradient(120deg,#F59E0B,#EC4899)',
  teal: 'linear-gradient(120deg,#14B8A6,#0EA5E9)',
}

// Actions first, then every nav destination (mirrors the sidebar).
const commands = [
  { id: 'new-chat', label: 'New Chat', kind: 'Action', grad: G.cool, icon: ['M12 5v14m-7-7h14'], run: () => { chat.reset(); go('/dashboard/chat/new') } },
  { id: 'create-agent', label: 'Create Agent', kind: 'Action', grad: G.brand, icon: ['M12 5v14m-7-7h14'], run: () => go('/dashboard/agents/new') },
  { id: 'go-systems', label: 'Systems', kind: 'Go to', grad: G.cool, icon: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'], run: () => go('/dashboard/systems') },
  { id: 'go-agents', label: 'Agents', kind: 'Go to', grad: G.brand, icon: ['M12 2a4 4 0 0 1 4 4', 'M12 18a8 8 0 0 1-8-8', 'M20 10a8 8 0 0 1-8 8'], run: () => go('/dashboard/agents') },
  { id: 'go-tools', label: 'Tools', kind: 'Go to', grad: G.teal, icon: ['M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z'], run: () => go('/dashboard/tools') },
  { id: 'go-services', label: 'Services', kind: 'Go to', grad: G.warm, icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82', 'M4.6 9a1.65 1.65 0 0 0-.33-1.82'], run: () => go('/dashboard/services') },
  { id: 'go-mcp', label: 'MCP Servers', kind: 'Go to', grad: G.cool, icon: ['M18.36 6.64a9 9 0 1 1-12.73 0', 'M12 2v10'], run: () => go('/dashboard/mcp') },
  { id: 'go-workspaces', label: 'Workspaces', kind: 'Go to', grad: G.warm, icon: ['M2 7l10-5 10 5-10 5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'], run: () => go('/dashboard/workspaces') },
  { id: 'go-activity', label: 'Activity', kind: 'Go to', grad: G.brand, icon: ['M22 12h-4l-3 9L9 3l-3 9H2'], run: () => go('/dashboard/activity') },
  { id: 'go-llm', label: 'LLM Context', kind: 'Go to', grad: G.cool, icon: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M4 12h16'], run: () => go('/dashboard/llm-context') },
  { id: 'go-settings', label: 'Settings', kind: 'Go to', grad: G.brand, icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82', 'M4.6 9a1.65 1.65 0 0 0-.33-1.82'], run: () => go('/dashboard/settings/general') },
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => (c.label + ' ' + c.kind).toLowerCase().includes(q))
})

watch(() => props.modelValue, (open) => {
  if (open) {
    query.value = ''
    active.value = 0
    nextTick(() => inputEl.value && inputEl.value.focus())
  }
})
watch(filtered, () => { active.value = 0 })

function move(delta) {
  const n = filtered.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
}
function go(path) {
  if (router.currentRoute.value.path !== path) router.push(path)
  close()
}
function run(item) {
  if (item && typeof item.run === 'function') item.run()
}
function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.cmdk-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
  background: rgba(25, 20, 39, .28);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.cmdk {
  width: min(620px, 92vw);
  font-family: var(--vm-font-sans);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: var(--vm-r-l);
  box-shadow: var(--vm-shadow-l);
  overflow: hidden;
}
.cmdk-search {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--vm-line);
}
.cmdk-search .ic { width: 19px; height: 19px; color: var(--vm-ink-faint); flex: 0 0 auto; }
.cmdk-search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font: 500 16px var(--vm-font-sans);
  color: var(--vm-ink);
}
.cmdk-search input::placeholder { color: var(--vm-ink-faint); }
kbd {
  font: 600 10px var(--vm-font-sans);
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  padding: 2px 6px;
}
.cmdk-list { max-height: 46vh; overflow-y: auto; padding: 8px; }
.cmdk-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 13px;
  cursor: pointer;
  text-align: left;
  transition: background .12s var(--vm-ease2);
}
.cmdk-item.on { background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.cmdk-ico {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--vm-shadow-s);
}
.cmdk-ico svg { width: 17px; height: 17px; }
.cmdk-label { flex: 1; font-size: 14px; font-weight: 600; color: var(--vm-ink); }
.cmdk-kind { font-size: 11px; font-weight: 700; color: var(--vm-ink-faint); text-transform: uppercase; letter-spacing: .04em; }
.cmdk-empty { padding: 28px; text-align: center; color: var(--vm-ink-faint); font-size: 14px; }
.cmdk-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 11px 18px;
  border-top: 1px solid var(--vm-line);
  font-size: 11px;
  color: var(--vm-ink-faint);
  font-weight: 600;
}
.cmdk-foot .brandline { margin-left: auto; background: var(--vm-g-brand); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: 700; }
.cmdk-foot kbd { margin-right: 3px; }

/* transition */
.cmdk-enter-active, .cmdk-leave-active { transition: opacity .2s var(--vm-ease2); }
.cmdk-enter-active .cmdk, .cmdk-leave-active .cmdk { transition: transform .25s var(--vm-ease), opacity .2s; }
.cmdk-enter-from, .cmdk-leave-to { opacity: 0; }
.cmdk-enter-from .cmdk, .cmdk-leave-to .cmdk { transform: translateY(-12px) scale(.97); opacity: 0; }
</style>
