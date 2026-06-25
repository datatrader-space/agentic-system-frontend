<template>
  <div class="app-shell">
    <!-- Global animated color-mesh canvas (Vibrant Light Mesh) -->
    <MeshBackground />

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
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
          </span>
          <span class="bar-title">Agentic<span class="bar-v">v2</span></span>
        </div>
        <button class="bar-btn" title="Search (Ctrl/Cmd+K)" aria-label="Open command palette" @click="paletteOpen = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" stroke-linecap="round" /></svg>
        </button>
      </div>

      <main class="center-main">
        <router-view v-slot="{ Component }">
          <transition name="vm-page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Command palette (Cmd/Ctrl+K) -->
    <CommandPalette v-model="paletteOpen" />

    <!-- First-run onboarding: welcome modal + feature spotlight tour -->
    <FeatureTour />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import LeftSidebar from './LeftSidebar.vue'
import MobileSidebarDrawer from './MobileSidebarDrawer.vue'
import MeshBackground from './MeshBackground.vue'
import CommandPalette from './CommandPalette.vue'
import FeatureTour from '../onboarding/FeatureTour.vue'

const layout = useLayoutStore()
const chat = useChatStore()
const route = useRoute()
const router = useRouter()

// Command palette (Cmd/Ctrl+K) — power-up #2
const paletteOpen = ref(false)

// Close transient overlays whenever the route changes.
watch(() => route.fullPath, () => layout.closeAllOverlays())

// Global keyboard shortcuts:
//   Cmd/Ctrl+B  toggle left sidebar
//   Cmd/Ctrl+J  toggle right context panel
//   Cmd/Ctrl+K  open command palette (fuzzy nav + actions)
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
    paletteOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.app-shell {
  position: relative;
  z-index: 1;            /* sit above the fixed MeshBackground (z-0) */
  display: flex;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: transparent; /* let the animated mesh show through */
  font-family: var(--vm-font-sans);
}

/* Center column — min-width:0 is critical to prevent horizontal overflow.
   position/z-index lift it above the decorative MeshBackground (z-index:-1). */
.center-col {
  position: relative;
  z-index: 1;
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
  height: 58px;
  padding: 0 12px;
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--vm-line);
  flex-shrink: 0;
}
@media (min-width: 1280px) {
  .compact-bar { display: none; }
}
.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line);
  border-radius: 12px;
  color: var(--vm-ink-soft);
  cursor: pointer;
  transition: transform 0.15s var(--vm-ease), box-shadow 0.15s;
}
.bar-btn:hover { transform: translateY(-1px); box-shadow: var(--vm-shadow-s); color: var(--vm-ink); }
.bar-btn svg { width: 18px; height: 18px; }
/* The hamburger is only needed below lg (sidebar is inline at lg) */
.nav-toggle { display: flex; }
@media (min-width: 1024px) {
  .nav-toggle { display: none; }
}
.bar-brand { display: flex; align-items: center; gap: 9px; }
.bar-mark { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--vm-g-brand); box-shadow: var(--vm-glow-v); }
.bar-mark svg { width: 17px; height: 17px; }
.bar-title { font-family: var(--vm-font-display); font-size: 1.0625rem; font-weight: 700; letter-spacing: -.02em; color: var(--vm-ink); }
.bar-v { font-size: 0.6rem; font-weight: 700; background: var(--vm-g-brand); -webkit-background-clip: text; background-clip: text; color: transparent; vertical-align: super; margin-left: 1px; }

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
