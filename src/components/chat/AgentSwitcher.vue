<template>
  <div ref="rootEl" class="as-wrap">
    <!-- Trigger: the agent chip, now a control. Keeps the star/bot mark and colour it had as a label so
         the composer reads the same until you click it. -->
    <button type="button" class="as-chip" :class="{ super: isShared, open }" data-test="agent-switcher"
            :title="current ? (current.description || current.name) : 'Choose an agent'"
            aria-haspopup="listbox" :aria-expanded="open" @click.stop="toggle">
      <svg v-if="isShared" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.9 7 17.5l1.2-5.6L4 8l5.6-.6L12 2z"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V5M9 5h6M9 13h.01M15 13h.01"/></svg>
      <span class="as-name">{{ current ? current.name : 'Choose an agent' }}</span>
      <svg class="as-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <div v-if="open" class="as-menu" role="listbox" @click.stop>
      <div class="as-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input ref="searchEl" v-model="query" type="text" placeholder="Search agents…"
               aria-label="Search agents" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
               @keydown.enter.prevent="choose(flat[cursor])" @keydown.esc.stop="close" />
      </div>

      <div class="as-list">
        <p v-if="chat.agentsLoading && !flat.length" class="as-note">Loading agents…</p>
        <p v-else-if="!flat.length" class="as-note">No agent matches “{{ query }}”.</p>

        <template v-for="group in groups" :key="group.key">
          <template v-if="group.items.length">
            <p class="as-group">{{ group.label }}</p>
            <button v-for="a in group.items" :key="a.id" type="button" role="option" class="as-item"
                    :class="{ on: isCurrent(a), cursor: flat[cursor] && flat[cursor].id === a.id }"
                    :aria-selected="isCurrent(a)" @click="choose(a)" @mouseenter="cursor = indexOf(a)">
              <span class="as-ic" :class="{ super: a.is_platform_super_agent }">
                <svg v-if="a.is_platform_super_agent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.9 7 17.5l1.2-5.6L4 8l5.6-.6L12 2z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V5M9 5h6M9 13h.01M15 13h.01"/></svg>
              </span>
              <span class="as-body">
                <span class="as-item-name">{{ a.name }}</span>
                <span v-if="a.description" class="as-desc">{{ a.description }}</span>
              </span>
              <svg v-if="isCurrent(a)" class="as-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
          </template>
        </template>
      </div>

      <!-- Switching an agent mid-thread starts a FRESH chat with it: a conversation belongs to the agent
           that ran it (its history and artifacts are agent-scoped), so the existing thread is left intact
           rather than re-pointed. Say so before the click, not after. -->
      <p v-if="startsNewChat" class="as-foot">Picking another agent starts a new chat.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'

const chat = useChatStore()
const route = useRoute()
const router = useRouter()

const open = ref(false)
const query = ref('')
const cursor = ref(0)
const rootEl = ref(null)
const searchEl = ref(null)

const current = computed(() => chat.currentAgent)
const isShared = computed(() => !!chat.isSharedAgent)
// A thread with messages is already owned by its agent — picking another one opens a new chat instead.
const startsNewChat = computed(() => !!chat.conversationId || chat.messages.length > 0)

const isCurrent = (a) => String(a.id) === String(chat.selectedAgentId)

const matches = (a) => {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return `${a.name || ''} ${a.description || ''}`.toLowerCase().includes(q)
}

// Grouped so the default is visibly the default: the Super Agent is what a naked New Chat runs, and
// burying it alphabetically among a user's own agents would make it look like just another row.
const groups = computed(() => {
  const all = (chat.agents || []).filter(matches)
  return [
    { key: 'super', label: 'Default', items: all.filter((a) => a.is_platform_super_agent) },
    { key: 'mine', label: 'Your agents',
      items: all.filter((a) => !a.is_platform_super_agent && !a.is_builtin_agent) },
    { key: 'builtin', label: 'Built-in', items: all.filter((a) => a.is_builtin_agent && !a.is_platform_super_agent) },
  ]
})
const flat = computed(() => groups.value.flatMap((g) => g.items))
const indexOf = (a) => flat.value.findIndex((x) => String(x.id) === String(a.id))

function move(delta) {
  if (!flat.value.length) return
  cursor.value = (cursor.value + delta + flat.value.length) % flat.value.length
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  query.value = ''
  // Load on OPEN, not on mount: the picker is rarely opened, and the built-ins request would otherwise
  // sit on the chat-open critical path for a control most turns never touch.
  chat.loadChattableAgents()
  await nextTick()
  cursor.value = Math.max(0, flat.value.findIndex((a) => isCurrent(a)))
  if (searchEl.value) searchEl.value.focus()
}
function close() { open.value = false }

function choose(agent) {
  if (!agent) return
  close()
  if (isCurrent(agent)) return
  if (startsNewChat.value) {
    // ?agent=<id> is the platform's existing "open a chat with THIS agent" convention (the Agents
    // library card's Chat button uses the same one), so this path stays identical everywhere.
    router.push({ path: '/dashboard/chat/new', query: { agent: agent.id } })
    return
  }
  chat.setAgent(String(agent.id))
  // Reflect it in the URL so a refresh (or a shared link to the empty screen) keeps the choice.
  if (route.path === '/dashboard/chat/new' && String(route.query.agent || '') !== String(agent.id)) {
    router.replace({ path: route.path, query: { ...route.query, agent: agent.id } })
  }
}

function onDocClick(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) close()
}
function onEsc(e) { if (e.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onEsc)
})
</script>

<style scoped>
.as-wrap { position: relative; display: inline-flex; }
.as-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 220px;
  border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff);
  border-radius: 9999px; padding: 5px 10px 5px 9px; font-size: 12.5px; font-weight: 700;
  color: var(--vm-ink-soft, #475569); cursor: pointer; transition: border-color .15s, color .15s;
}
.as-chip:hover, .as-chip.open { border-color: #c7d2fe; color: var(--vm-violet-d, #4f46e5); }
.as-chip.super { color: var(--vm-violet-d, #4f46e5); }
.as-chip svg { width: 14px; height: 14px; flex-shrink: 0; }
.as-caret { width: 13px; height: 13px; opacity: .7; }
.as-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.as-menu {
  position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 50;
  width: 320px; max-width: min(320px, calc(100vw - 32px));
  background: var(--vm-surface, #fff); border: 1px solid var(--vm-line-2, #e5e7eb);
  border-radius: 14px; box-shadow: 0 14px 40px rgba(15, 23, 42, .16); overflow: hidden;
}
.as-search { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--vm-line-2, #eef0f4); }
.as-search svg { width: 15px; height: 15px; color: var(--vm-ink-dim, #94a3b8); flex-shrink: 0; }
.as-search input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; color: inherit; }
.as-list { max-height: 320px; overflow-y: auto; padding: 6px; }
.as-note { margin: 0; padding: 22px 12px; text-align: center; font-size: 12.5px; color: var(--vm-ink-dim, #94a3b8); }
.as-group { margin: 6px 8px 3px; font-size: 10.5px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; color: var(--vm-ink-dim, #94a3b8); }
.as-item {
  display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 8px;
  border: none; background: transparent; border-radius: 9px; text-align: left; cursor: pointer; color: inherit;
}
.as-item.cursor { background: var(--vm-surface-2, #f1f5f9); }
.as-item.on { background: var(--vm-violet-soft, #eef2ff); }
.as-ic { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); flex-shrink: 0; }
.as-ic.super { background: #eef2ff; color: var(--vm-violet-d, #4f46e5); }
.as-ic svg { width: 14px; height: 14px; }
.as-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
.as-item-name { font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as-desc { font-size: 11px; color: var(--vm-ink-dim, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as-tick { width: 15px; height: 15px; color: var(--vm-violet-d, #4f46e5); flex-shrink: 0; }
.as-foot { margin: 0; padding: 8px 12px; border-top: 1px solid var(--vm-line-2, #eef0f4); font-size: 11px; color: var(--vm-ink-dim, #94a3b8); }
</style>
