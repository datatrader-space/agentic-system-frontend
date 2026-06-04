<template>
  <Transition name="drawer">
    <div v-if="layout.mobileNavOpen" class="drawer-overlay" role="dialog" aria-modal="true" aria-label="Navigation" @click.self="layout.closeMobileNav()">
      <div class="drawer-panel">
        <button class="drawer-close" title="Close" aria-label="Close navigation" @click="layout.closeMobileNav()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" /></svg>
        </button>
        <LeftSidebar :force-expanded="true" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useLayoutStore } from '../../stores/useLayoutStore'
import LeftSidebar from './LeftSidebar.vue'

const layout = useLayoutStore()
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}
.drawer-panel {
  position: relative;
  width: 280px;
  max-width: 85vw;
  height: 100%;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
}
.drawer-close {
  position: absolute;
  top: 14px;
  right: -44px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: #ffffff;
  border: none;
  border-radius: 9px;
  color: #475569;
  cursor: pointer;
}
.drawer-close svg { width: 18px; height: 18px; }

.drawer-enter-active,
.drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel { transition: transform 0.25s ease; }
.drawer-enter-from,
.drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel { transform: translateX(-100%); }
</style>
