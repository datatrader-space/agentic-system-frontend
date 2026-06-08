<template>
  <aside class="sidebar" :class="{ collapsed }" aria-label="Sidebar">
    <!-- Brand + workspace -->
    <div class="sidebar-top">
      <router-link to="/dashboard" class="brand" :title="collapsed ? 'Agentic v2' : ''">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span v-if="!collapsed" class="brand-text">Agentic<span class="brand-v">v2</span></span>
      </router-link>

      <div v-if="!collapsed" class="ws-switcher-wrap">
        <WorkspaceSwitcher />
      </div>
    </div>

    <!-- New Chat -->
    <button class="new-chat" :class="{ collapsed }" :title="collapsed ? 'New Chat (Ctrl/Cmd+K)' : ''" aria-label="New chat" @click="newChat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 5v14m-7-7h14" stroke-linecap="round" />
      </svg>
      <span v-if="!collapsed">New Chat</span>
    </button>

    <!-- Search chats -->
    <button class="search-chats" :class="{ collapsed }" :title="collapsed ? 'Search chats' : ''" aria-label="Search chats" @click="searchOpen = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" stroke-linecap="round" /></svg>
      <span v-if="!collapsed">Search chats</span>
    </button>

    <!-- Scrollable nav + history -->
    <div class="sidebar-scroll">
      <nav class="nav-group" aria-label="Primary">
        <SidebarNavItem
          v-for="(item, i) in primaryNav"
          :key="item.to"
          v-bind="item"
          :index="i"
          :collapsed="collapsed"
        />
      </nav>

      <!-- Recent chats — global across agents: preview line + agent · time,
           capped per group with a per-group "Show more". -->
      <div v-if="!collapsed && chat.allSessions.length" class="history">
        <div
          v-for="grp in groupedSessions"
          :key="grp.label"
          class="history-group"
        >
          <div class="history-label">{{ grp.label }}</div>
          <router-link
            v-for="s in visibleItems(grp)"
            :key="s.id"
            :to="`/dashboard/chat/${s.id}`"
            class="history-item"
            :class="{ active: String(route.params.sessionId) === String(s.id) }"
            @click="layout.closeMobileNav()"
          >
            <span class="history-text">
              <span class="history-title">{{ previewOf(s) }}</span>
              <span class="history-meta">{{ agentOf(s) }} · {{ relTime(s) }}</span>
            </span>
          </router-link>
          <button
            v-if="grp.items.length > (expanded[grp.label] ? grp.items.length : PAGE)"
            class="history-more"
            @click="expanded[grp.label] = true"
          >
            Load more ({{ grp.items.length - PAGE }})
          </button>
        </div>
      </div>
    </div>

    <!-- Search modal -->
    <ChatSearchModal v-model="searchOpen" />

    <!-- Footer: user + collapse toggle -->
    <div class="sidebar-footer">
      <div class="user" :class="{ collapsed }">
        <div class="avatar">{{ initials }}</div>
        <div v-if="!collapsed" class="user-info">
          <span class="user-name">{{ currentUser?.username || 'Account' }}</span>
          <span class="user-plan">{{ currentUser?.github_username ? 'Pro Plan' : 'Free Plan' }}</span>
        </div>
        <button v-if="!collapsed" class="logout-btn" title="Sign out" aria-label="Sign out" @click="logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <button v-if="showCollapseToggle" class="collapse-toggle" :title="collapsed ? 'Expand (Ctrl/Cmd+B)' : 'Collapse (Ctrl/Cmd+B)'" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="layout.toggleSidebar()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" :style="{ transform: collapsed ? 'rotate(180deg)' : '' }">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-if="!collapsed">Collapse</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import SidebarNavItem from './SidebarNavItem.vue'
import WorkspaceSwitcher from '../layout/WorkspaceSwitcher.vue'
import ChatSearchModal from './ChatSearchModal.vue'
import { previewOf, agentOf, relTime, groupSessions } from '../../composables/useChatHistory'

const props = defineProps({
  // When true (inside the mobile drawer) the sidebar is always expanded and
  // hides the desktop collapse toggle.
  forceExpanded: { type: Boolean, default: false },
})

const layout = useLayoutStore()
const chat = useChatStore()
const route = useRoute()
const router = useRouter()

const currentUser = inject('currentUser', ref(null))
const logout = inject('logout', () => {})

const collapsed = computed(() => !props.forceExpanded && layout.sidebarCollapsed)
const showCollapseToggle = computed(() => !props.forceExpanded)

const initials = computed(() => {
  const name = currentUser.value?.username
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
})

// Nav items — each `to` points at a working route (existing top-level routes
// stay alive through Phase 5; dashboard children render inside this shell).
const primaryNav = [
  { to: '/dashboard/systems', label: 'Systems', icon: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'] },
  { to: '/dashboard/agents', match: '/dashboard/agents', label: 'Agents', icon: ['M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93', 'M12 18a8 8 0 0 1-8-8', 'M20 10a8 8 0 0 1-8 8', 'M12 11.5a1.5 1.5 0 1 0 0 .01'] },
  { to: '/dashboard/tools', label: 'Tools', icon: ['M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z'] },
  { to: '/dashboard/services', label: 'Services', icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9'] },
  { to: '/dashboard/mcp', label: 'MCP', icon: ['M18.36 6.64a9 9 0 1 1-12.73 0', 'M12 2v10'] },
  { to: '/dashboard/workspaces', label: 'Workspaces', icon: ['M2 7l10-5 10 5-10 5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'] },
  { to: '/dashboard/activity', label: 'Activity', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  { to: '/dashboard/llm-context', label: 'LLM Context', icon: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M4 12h16'] },
  { to: '/dashboard/settings/general', match: '/dashboard/settings', label: 'Settings', icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82'] },
]

// Global recent chats (across agents), grouped Today / Yesterday / Previous 7 Days / Older.
const groupedSessions = computed(() => groupSessions(chat.allSessions))

// Per-group cap with a "Load more" expander.
const PAGE = 5
const expanded = reactive({})
const visibleItems = (grp) => (expanded[grp.label] ? grp.items : grp.items.slice(0, PAGE))

// Chat search popup
const searchOpen = ref(false)

onMounted(() => {
  chat.loadAgents()
  chat.loadAllSessions()
})

const newChat = () => {
  layout.closeMobileNav()
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 256px;
  height: 100%;
  font-family: var(--vm-font-sans);
  background: var(--vm-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--vm-line);
  box-shadow: var(--vm-shadow-m);
  transition: width 0.2s var(--vm-ease2);
}
.sidebar.collapsed {
  width: 76px;
}

/* Top */
.sidebar-top {
  padding: 18px 14px 8px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  text-decoration: none;
}
.brand-mark {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-v);
  animation: vmPop .7s var(--vm-ease) both;
}
.brand-mark svg { width: 21px; height: 21px; }
.brand-text {
  font-family: var(--vm-font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -.02em;
  color: var(--vm-ink);
}
.brand-v {
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--vm-g-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  vertical-align: super;
  margin-left: 1px;
}
.ws-switcher-wrap {
  margin-top: 14px;
}

/* New Chat */
.new-chat {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 10px 14px 12px;
  padding: 13px 14px;
  font-family: var(--vm-font-sans);
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  background: var(--vm-g-cool);
  border: none;
  border-radius: 15px;
  cursor: pointer;
  box-shadow: var(--vm-glow-v);
  transition: transform 0.2s var(--vm-ease);
}
.new-chat:hover { transform: translateY(-2px) scale(1.02); }
.new-chat:active { transform: scale(0.97); }
.new-chat::after {
  content: "";
  position: absolute;
  top: 0;
  left: -120%;
  width: 60%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .5), transparent);
  transform: skewX(-20deg);
  animation: vmShine 4s ease-in-out infinite;
}
.new-chat svg { width: 17px; height: 17px; }
.new-chat.collapsed { margin: 10px 12px 12px; padding: 13px 0; }

/* Search chats */
.search-chats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 14px 10px;
  padding: 9px 13px;
  font-family: var(--vm-font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  background: var(--vm-glass-strong);
  border: 1px solid var(--vm-line);
  border-radius: 12px;
  cursor: pointer;
  transition: background .15s var(--vm-ease2), color .15s, border-color .15s;
}
.search-chats:hover { color: var(--vm-violet-d); border-color: transparent; background: var(--vm-violet-soft); }
.search-chats svg { width: 16px; height: 16px; }
.search-chats.collapsed { justify-content: center; margin: 0 12px 10px; padding: 9px 0; }

/* Scroll area */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}
.sidebar-scroll::-webkit-scrollbar { width: 0; }
.nav-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* History */
.history { margin-top: 18px; }
.history-group { margin-bottom: 10px; }
.history-label {
  padding: 6px 12px 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vm-ink-faint);
}
.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 11px;
  color: var(--vm-ink-soft);
  text-decoration: none;
  transition: background 0.18s var(--vm-ease2), color 0.18s, transform 0.18s var(--vm-ease2);
}
.history-item:hover { background: var(--vm-glass-strong); transform: translateX(2px); }
.history-item.active { background: var(--vm-violet-soft); }
.history-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.history-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-item.active .history-title { color: var(--vm-violet-d); }
.history-meta {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--vm-ink-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}
.history-more {
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  margin-top: 2px;
  border: none;
  background: transparent;
  color: var(--vm-violet-d);
  font: 600 0.75rem var(--vm-font-sans);
  cursor: pointer;
  border-radius: 9px;
}
.history-more:hover { background: var(--vm-violet-soft); }

/* Footer */
.sidebar-footer {
  border-top: 1px solid var(--vm-line);
  padding: 10px 12px;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 12px;
}
.user.collapsed { justify-content: center; }
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: var(--vm-g-brand);
  border-radius: 50%;
}
.user-info { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
.user-name { font-size: 0.8125rem; font-weight: 700; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-plan { font-size: 0.6875rem; color: var(--vm-ink-faint); }
.logout-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 9px;
  color: var(--vm-ink-faint); cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { background: rgba(239, 68, 68, .1); color: var(--vm-danger); }
.logout-btn svg { width: 16px; height: 16px; }

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-faint);
  background: transparent;
  border: none;
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.collapse-toggle:hover { background: var(--vm-glass-strong); color: var(--vm-ink-soft); }
.collapse-toggle svg { width: 16px; height: 16px; transition: transform 0.2s; }
.sidebar.collapsed .collapse-toggle { justify-content: center; }
</style>
