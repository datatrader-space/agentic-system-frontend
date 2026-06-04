<template>
  <div class="app-shell">
    <!-- Left sidebar — inline on desktop (≥1024px) -->
    <LeftSidebar class="sidebar-desktop" />

    <!-- Left sidebar — slide-out drawer on mobile/tablet (<1024px) -->
    <MobileSidebarDrawer />

    <!-- Center column -->
    <div class="center-col">
      <!-- Compact top bar — only below xl (<1280px), since the global header is hidden here -->
      <div class="compact-bar">
        <button class="bar-btn nav-toggle" title="Menu" aria-label="Open navigation menu" @click="layout.openMobileNav()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" /></svg>
        </button>
        <div class="bar-brand">
          <span class="bar-mark">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="8" stroke="url(#bar-g)" stroke-width="2.5" /><path d="M10 16l4 4 8-8" stroke="url(#bar-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /><defs><linearGradient id="bar-g" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#6366f1" /><stop offset="1" stop-color="#d946ef" /></linearGradient></defs></svg>
          </span>
          <span class="bar-title">Agentic <span class="bar-v">v2</span></span>
        </div>
        <button class="bar-btn ctx-toggle" title="Context (Ctrl/Cmd+J)" aria-label="Toggle context panel" @click="layout.toggleMobileRight()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
        </button>
      </div>

      <main class="center-main">
        <router-view />
      </main>
    </div>

    <!-- Right panel — inline on xl (≥1280px) -->
    <RightContextPanel v-if="layout.rightPanelOpen" class="right-desktop" />
    <!-- Reopen tab when the right panel is collapsed (xl only) -->
    <button v-else class="reopen-right" title="Show context (Ctrl/Cmd+J)" aria-label="Show context panel" @click="layout.toggleRightPanel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>

    <!-- Right panel — overlay sheet below xl (<1280px) -->
    <Transition name="sheet">
      <div v-if="layout.mobileRightOpen" class="right-overlay" @click.self="layout.closeMobileRight()">
        <RightContextPanel class="right-sheet" :overlay="true" @close="layout.closeMobileRight()" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import LeftSidebar from './LeftSidebar.vue'
import RightContextPanel from './RightContextPanel.vue'
import MobileSidebarDrawer from './MobileSidebarDrawer.vue'

const layout = useLayoutStore()
const chat = useChatStore()
const route = useRoute()
const router = useRouter()

// Close transient overlays whenever the route changes.
watch(() => route.fullPath, () => layout.closeAllOverlays())

// Global keyboard shortcuts:
//   Cmd/Ctrl+B  toggle left sidebar
//   Cmd/Ctrl+J  toggle right context panel
//   Cmd/Ctrl+K  new chat
//   Escape      close mobile overlays
const onKey = (e) => {
  if (e.key === 'Escape') {
    layout.closeAllOverlays()
    return
  }
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  const k = e.key.toLowerCase()
  if (k === 'b') {
    e.preventDefault()
    layout.toggleSidebar()
  } else if (k === 'j') {
    e.preventDefault()
    if (window.innerWidth >= 1280) layout.toggleRightPanel()
    else layout.toggleMobileRight()
  } else if (k === 'k') {
    e.preventDefault()
    chat.reset()
    if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: #f6f7f9;
}

/* Center column — min-width:0 is critical to prevent horizontal overflow */
.center-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.center-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Sidebar visibility by breakpoint */
.sidebar-desktop { display: none; flex-shrink: 0; }
@media (min-width: 1024px) {
  .sidebar-desktop { display: flex; }
}

/* Right panel inline only on xl */
.right-desktop { display: none; flex-shrink: 0; }
@media (min-width: 1280px) {
  .right-desktop { display: flex; }
}

/* Compact top bar — shown below xl only */
.compact-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 56px;
  padding: 0 12px;
  background: #ffffff;
  border-bottom: 1px solid #e7eaf0;
  flex-shrink: 0;
}
@media (min-width: 1280px) {
  .compact-bar { display: none; }
}
.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: transparent;
  border: 1px solid #e7eaf0;
  border-radius: 9px;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}
.bar-btn:hover { background: #f1f5f9; }
.bar-btn svg { width: 18px; height: 18px; }
/* The hamburger is only needed below lg (sidebar is inline at lg) */
.nav-toggle { display: flex; }
@media (min-width: 1024px) {
  .nav-toggle { display: none; }
}
.bar-brand { display: flex; align-items: center; gap: 8px; }
.bar-mark { width: 26px; height: 26px; }
.bar-mark svg { width: 100%; height: 100%; }
.bar-title { font-size: 0.9375rem; font-weight: 700; color: #0f172a; }
.bar-v { font-size: 0.65rem; font-weight: 600; color: #8b5cf6; vertical-align: super; }

/* Collapsed right-panel reopen tab (xl only) */
.reopen-right {
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  flex-shrink: 0;
  background: #ffffff;
  border: none;
  border-left: 1px solid #e7eaf0;
  color: #64748b;
  cursor: pointer;
}
.reopen-right:hover { background: #f1f5f9; color: #0f172a; }
.reopen-right svg { width: 18px; height: 18px; }
@media (min-width: 1280px) {
  .reopen-right { display: flex; }
}

/* Right panel overlay sheet (<xl) */
.right-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}
.right-sheet {
  width: 340px;
  max-width: 90vw;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}
@media (min-width: 1280px) {
  .right-overlay { display: none; }
}

.sheet-enter-active,
.sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .right-sheet,
.sheet-leave-active .right-sheet { transition: transform 0.25s ease; }
.sheet-enter-from,
.sheet-leave-to { opacity: 0; }
.sheet-enter-from .right-sheet,
.sheet-leave-to .right-sheet { transform: translateX(100%); }
</style>
