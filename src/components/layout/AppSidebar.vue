<template>
  <!-- Desktop Sidebar -->
  <aside class="sidebar-rail hidden md:flex flex-col bg-white border-r border-gray-200 h-full relative z-30" style="min-width:60px;width:60px">
    <!-- Logo -->
    <router-link
      to="/dashboard"
      class="flex items-center justify-center h-[60px] hover:bg-gray-100 transition-colors flex-shrink-0 group"
      title="Dashboard"
    >
      <div class="logo-glow-sidebar">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#sb-gradient)" stroke-width="2.5"/>
          <path d="M10 16L14 20L22 12" stroke="url(#sb-gradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="16" cy="8" r="2" fill="url(#sb-gradient)"/>
          <circle cx="8" cy="16" r="2" fill="url(#sb-gradient)"/>
          <circle cx="24" cy="16" r="2" fill="url(#sb-gradient)"/>
          <circle cx="16" cy="24" r="2" fill="url(#sb-gradient)"/>
          <defs>
            <linearGradient id="sb-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366f1"/>
              <stop offset="0.5" stop-color="#8b5cf6"/>
              <stop offset="1" stop-color="#d946ef"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </router-link>

    <!-- Divider -->
    <div class="mx-3 border-t border-gray-200 flex-shrink-0"></div>

    <!-- Nav Items -->
    <nav class="flex-1 flex flex-col gap-0.5 py-3 px-2">
      <SidebarNavItem
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :label="item.label"
        :badge="item.badge"
        :icon="item.icon"
        :active="isActiveRoute(item.to)"
      />
    </nav>

    <!-- Bottom Section -->
    <div class="flex flex-col gap-0.5 py-3 px-2 border-t border-gray-200 flex-shrink-0">
      <!-- User Avatar -->
      <div class="relative" ref="userMenuRef">
        <button
          @click.stop="toggleUserMenu"
          class="sidebar-icon-btn group relative"
          :title="currentUser?.username || 'Account'"
        >
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {{ userInitials }}
          </div>
          <div class="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-slate-900" :class="currentUser?.github_username ? 'bg-green-400' : 'bg-slate-500'"></div>
          <span class="sidebar-tooltip">{{ currentUser?.username || 'Account' }}</span>
        </button>

        <!-- User Popup (opens to the right) -->
        <Transition name="sidebar-popup">
          <div
            v-if="showUserMenu"
            class="absolute bottom-0 left-full ml-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            <!-- Profile Header -->
            <div class="px-4 py-3 bg-gradient-to-br from-indigo-50 to-purple-50 border-b border-gray-100">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {{ userInitials }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 truncate">{{ currentUser?.username }}</p>
                  <p class="text-xs text-gray-500">{{ currentUser?.github_username ? 'Pro User' : 'Free Plan' }}</p>
                </div>
              </div>
            </div>

            <!-- Menu Items -->
            <div class="py-1">
              <router-link
                to="/settings"
                class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                @click="closeUserMenu"
              >
                <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                </svg>
                Profile Settings
              </router-link>
              <router-link
                to="/workspaces"
                class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                @click="closeUserMenu"
              >
                <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>
                </svg>
                Workspaces
              </router-link>
            </div>

            <!-- Divider -->
            <div class="border-t border-gray-100"></div>

            <!-- Logout -->
            <div class="py-1">
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5m0 0l-5-5m5 5H9" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </aside>

  <!-- Mobile Bottom Nav -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex items-center justify-around px-2 py-2">
    <router-link
      v-for="item in mobileNavItems"
      :key="item.to"
      :to="item.to"
      class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
      :class="isActiveRoute(item.to) ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'"
    >
      <component :is="item.iconComponent" class="w-5 h-5" />
      <span class="text-[10px] font-medium">{{ item.shortLabel }}</span>
    </router-link>

    <!-- User button in mobile nav -->
    <button
      @click.stop="toggleUserMenu"
      class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
    >
      <div class="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold">
        {{ userInitials }}
      </div>
      <span class="text-[10px] font-medium">Me</span>
    </button>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, h } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const props = defineProps({
  currentUser: { type: Object, default: null },
  llmHealth: { type: Object, default: null },
  theme: { type: String, default: 'light' }
})
const emit = defineEmits(['logout', 'toggle-theme'])
const route = useRoute()

// ── Icon components (inline render functions, consistent with AppHeader style) ──

const DashboardIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('rect', { x:'3', y:'3', width:'7', height:'7', rx:'1' }),
  h('rect', { x:'14', y:'3', width:'7', height:'7', rx:'1' }),
  h('rect', { x:'3', y:'14', width:'7', height:'7', rx:'1' }),
  h('rect', { x:'14', y:'14', width:'7', height:'7', rx:'1' })
]) }

const AIIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('path', { d:'M12 2a4 4 0 014 4v1h1a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3V9a3 3 0 013-3h1V6a4 4 0 014-4z' }),
  h('circle', { cx:'9', cy:'13', r:'1', fill:'currentColor' }),
  h('circle', { cx:'15', cy:'13', r:'1', fill:'currentColor' }),
  h('path', { d:'M9 17s1 1 3 1 3-1 3-1' })
]) }

const BenchmarkIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('line', { x1:'18', y1:'20', x2:'18', y2:'10' }),
  h('line', { x1:'12', y1:'20', x2:'12', y2:'4' }),
  h('line', { x1:'6', y1:'20', x2:'6', y2:'14' }),
  h('line', { x1:'2', y1:'20', x2:'22', y2:'20' })
]) }

const AgentLibraryIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('path', { d:'M12 2L2 7l10 5 10-5-10-5z' }),
  h('path', { d:'M2 17l10 5 10-5' }),
  h('path', { d:'M2 12l10 5 10-5' })
]) }

const ServicesIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('path', { d:'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' })
]) }

const MCPIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('path', { d:'M18.36 6.64a9 9 0 11-12.73 0' }),
  h('line', { x1:'12', y1:'2', x2:'12', y2:'12' })
]) }

const ConnectionsIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('path', { d:'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71' }),
  h('path', { d:'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' })
]) }

const WorkspacesIcon = { render: () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'2' }, [
  h('rect', { x:'2', y:'3', width:'20', height:'14', rx:'2' }),
  h('path', { d:'M8 21h8m-4-4v4' })
]) }

// ── SidebarNavItem component (local) ──
const SidebarNavItem = {
  props: ['to', 'label', 'badge', 'icon', 'active'],
  emits: [],
  setup(props) {
    return () => h(RouterLink, {
      to: props.to,
      class: [
        'sidebar-icon-btn group relative',
        props.active
          ? 'bg-indigo-50 !text-indigo-600 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-indigo-500 before:rounded-r before:-ml-2'
          : ''
      ]
    }, [
      h(props.icon, { class: 'w-5 h-5 flex-shrink-0' }),
      props.badge ? h('span', {
        class: 'absolute top-1 right-1 min-w-[16px] h-[16px] bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none'
      }, props.badge) : null,
      h('span', { class: 'sidebar-tooltip' }, props.label)
    ])
  }
}

// ── Nav items ──
const navItems = [
  { to: '/dashboard',    label: 'Dashboard',     icon: DashboardIcon },
  { to: '/ai-settings',  label: 'AI Providers',  icon: AIIcon },
  { to: '/ai-dashboard', label: 'AI Dashboard',  icon: BenchmarkIcon },
  { to: '/agents',       label: 'Agent Library', icon: AgentLibraryIcon },
  { to: '/services',     label: 'Services',      icon: ServicesIcon },
  { to: '/mcp',          label: 'MCP',           icon: MCPIcon },
  { to: '/connections',  label: 'Connections',   icon: ConnectionsIcon },
  { to: '/workspaces',   label: 'Workspaces',    icon: WorkspacesIcon, badge: 'New' },
]

const mobileNavItems = [
  { to: '/dashboard',   shortLabel: 'Home',    iconComponent: DashboardIcon },
  { to: '/agents',      shortLabel: 'Agents',  iconComponent: AgentLibraryIcon },
  { to: '/ai-settings', shortLabel: 'AI',      iconComponent: AIIcon },
  { to: '/mcp',         shortLabel: 'MCP',     iconComponent: MCPIcon },
  { to: '/connections', shortLabel: 'Connect', iconComponent: ConnectionsIcon },
]

// ── State ──
const showUserMenu = ref(false)
const userMenuRef = ref(null)

const userInitials = computed(() => {
  if (!props.currentUser?.username) return '?'
  return props.currentUser.username.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const isActiveRoute = (path) => route.path.startsWith(path)

const toggleUserMenu = () => { showUserMenu.value = !showUserMenu.value }
const closeUserMenu = () => { showUserMenu.value = false }

const handleLogout = () => {
  closeUserMenu()
  emit('logout')
}

const handleClickOutside = (e) => {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    closeUserMenu()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<style>
/* Icon button base */
.sidebar-icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;   /* w-10 */
  height: 2.5rem;  /* h-10 */
  border-radius: 0.5rem;
  transition: all 0.15s ease;
  cursor: pointer;
  margin-left: auto;
  margin-right: auto;
  color: #6b7280; /* gray-500 */
}

.sidebar-icon-btn:hover {
  background: #f3f4f6; /* gray-100 */
  color: #111827; /* gray-900 */
}

/* Right-side tooltip */
.sidebar-tooltip {
  pointer-events: none;
  position: absolute;
  left: 100%;
  margin-left: 0.75rem;
  top: 50%;
  transform: translateY(-50%) scale(0.95);
  background: #111827;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

/* Show tooltip on parent hover */
.sidebar-icon-btn:hover .sidebar-tooltip,
.group:hover .sidebar-tooltip {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

/* Popup transition */
.sidebar-popup-enter-active,
.sidebar-popup-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.sidebar-popup-enter-from,
.sidebar-popup-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* Subtle logo glow */
.logo-glow-sidebar {
  transition: transform 0.2s ease;
  filter: drop-shadow(0 0 6px rgba(99,102,241,0.4));
}

.logo-glow-sidebar:hover {
  transform: scale(1.1);
}

/* Hide scrollbar on sidebar nav */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
