// Pinia store — app-shell layout state (Phase 1 of the v2 upgrade).
// Owns sidebar/right-panel collapse + mobile drawer state. Desktop prefs
// (sidebarCollapsed, rightPanelOpen, activeRightTab) persist to localStorage.
import { defineStore } from 'pinia'

const LS_KEY = 'v2_layout_prefs'

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {}
  } catch {
    return {}
  }
}

const saved = loadPrefs()

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    // Desktop (persisted)
    sidebarCollapsed: saved.sidebarCollapsed ?? false,
    rightPanelOpen: saved.rightPanelOpen ?? true,
    activeRightTab: saved.activeRightTab ?? 'Context',
    // Mobile/tablet (transient overlays)
    mobileNavOpen: false,
    mobileRightOpen: false,
  }),
  actions: {
    _persist() {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            sidebarCollapsed: this.sidebarCollapsed,
            rightPanelOpen: this.rightPanelOpen,
            activeRightTab: this.activeRightTab,
          })
        )
      } catch {
        /* ignore quota / private-mode errors */
      }
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      this._persist()
    },
    toggleRightPanel() {
      this.rightPanelOpen = !this.rightPanelOpen
      this._persist()
    },
    setRightTab(tab) {
      this.activeRightTab = tab
      this._persist()
    },
    openMobileNav() {
      this.mobileNavOpen = true
    },
    closeMobileNav() {
      this.mobileNavOpen = false
    },
    toggleMobileRight() {
      this.mobileRightOpen = !this.mobileRightOpen
    },
    closeMobileRight() {
      this.mobileRightOpen = false
    },
    closeAllOverlays() {
      this.mobileNavOpen = false
      this.mobileRightOpen = false
    },
  },
})
