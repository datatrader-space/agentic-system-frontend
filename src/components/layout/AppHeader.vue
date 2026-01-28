<template>
  <header
    v-if="!isLoginPage"
    class="app-header"
    :class="{
      'header-scrolled': isScrolled,
      'header-dark': theme === 'dark'
    }"
  >
    <div class="header-container">
      <div class="header-content">
        <!-- Left Section: Logo + Navigation -->
        <div class="header-left">
          <!-- Logo -->
          <router-link
            :to="currentUser ? '/dashboard' : '/'"
            class="logo-link"
            @click="closeMobileMenu"
          >
            <div class="logo-wrapper">
              <div class="logo-glow"></div>
              <div class="logo-icon">
                <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#logo-gradient)" stroke-width="2.5"/>
                  <path d="M10 16L14 20L22 12" stroke="url(#logo-gradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="16" cy="8" r="2" fill="url(#logo-gradient)"/>
                  <circle cx="8" cy="16" r="2" fill="url(#logo-gradient)"/>
                  <circle cx="24" cy="16" r="2" fill="url(#logo-gradient)"/>
                  <circle cx="16" cy="24" r="2" fill="url(#logo-gradient)"/>
                  <defs>
                    <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#6366f1"/>
                      <stop offset="0.5" stop-color="#8b5cf6"/>
                      <stop offset="1" stop-color="#d946ef"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div class="logo-text">
              <span class="logo-text-main">Agentic</span>
              <span class="logo-text-sub">System</span>
            </div>
          </router-link>

          <!-- Desktop Navigation -->
          <nav class="desktop-nav">
            <!-- Divider -->
            <div class="nav-divider"></div>

            <!-- Public Navigation -->
            <template v-if="!currentUser">
              <router-link
                v-for="link in publicLinks"
                :key="link.to"
                :to="link.to"
                class="nav-link"
                :class="{ 'nav-link-active': isActiveRoute(link.to, link.exact) }"
              >
                <component :is="link.iconComponent" v-if="link.iconComponent" class="nav-link-icon" />
                <span>{{ link.label }}</span>
              </router-link>
            </template>

            <!-- Authenticated Navigation -->
            <template v-else>
              <div class="nav-group">
                <router-link
                  v-for="link in authLinks"
                  :key="link.to"
                  :to="link.to"
                  class="nav-link"
                  :class="{
                    'nav-link-active': isActiveRoute(link.to, link.exact),
                    'nav-link-highlight': link.highlight
                  }"
                >
                  <component :is="link.iconComponent" v-if="link.iconComponent" class="nav-link-icon" />
                  <span>{{ link.label }}</span>
                  <span v-if="link.badge" class="nav-badge">{{ link.badge }}</span>
                </router-link>
              </div>

              <!-- External Admin Link -->
              <a
                href="https://mazily-nippy-dionna.ngrok-free.dev/admin"
                target="_blank"
                rel="noopener noreferrer"
                class="nav-link nav-link-external"
              >
                <svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span>Admin</span>
                <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </template>
          </nav>
        </div>

        <!-- Right Section: Status + Auth -->
        <div class="header-right">
          <!-- Public: Login/Signup -->
          <div v-if="!currentUser" class="auth-buttons">
            <router-link to="/login" class="btn-ghost">
              Sign In
            </router-link>
            <router-link to="/login" class="btn-primary">
              <span>Get Started</span>
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </router-link>
          </div>

          <!-- Theme Toggle (Always visible) -->
          <button
            class="action-btn theme-toggle"
            :title="theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
            @click="$emit('toggle-theme')"
          >
            <!-- Sun Icon (Light Mode) -->
            <svg
              v-if="theme === 'dark'"
              class="theme-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- Moon Icon (Dark Mode) -->
            <svg
              v-else
              class="theme-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          <!-- Authenticated: Status + User -->
          <div v-if="currentUser" class="user-section">
            <!-- Quick Actions -->
            <div class="quick-actions">
              <!-- Search Toggle -->
              <button class="action-btn" title="Search (Ctrl+K)" @click="toggleSearch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <kbd class="action-kbd">K</kbd>
              </button>

              <!-- Status Popover -->
              <div class="status-popover-container" ref="statusRef">
                <button
                  class="action-btn status-btn"
                  :class="{ 'status-btn-active': showStatusPopover }"
                  title="System Status"
                  @click.stop="toggleStatusPopover"
                >
                  <div class="status-indicator-wrapper">
                    <span class="status-pulse" :class="overallStatus"></span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </div>
                </button>

                <!-- Status Dropdown -->
                <Transition name="popover">
                  <div v-if="showStatusPopover" class="status-popover">
                    <div class="popover-header">
                      <span class="popover-title">System Status</span>
                      <span class="status-badge" :class="overallStatus">
                        {{ overallStatusText }}
                      </span>
                    </div>
                    <div class="popover-content">
                      <div class="status-row">
                        <div class="status-info">
                          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2"/>
                            <path d="M8 21h8m-4-4v4"/>
                          </svg>
                          <span>Local LLM</span>
                        </div>
                        <span class="status-chip" :class="llmHealth?.local?.available ? 'online' : 'offline'">
                          {{ llmHealth?.local?.available ? 'Connected' : 'Offline' }}
                        </span>
                      </div>
                      <div class="status-row">
                        <div class="status-info">
                          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242"/>
                            <path d="M12 12v9m-4-4l4 4 4-4"/>
                          </svg>
                          <span>Cloud LLM</span>
                        </div>
                        <span class="status-chip" :class="llmHealth?.cloud?.available ? 'online' : 'offline'">
                          {{ llmHealth?.cloud?.available ? 'Connected' : 'Offline' }}
                        </span>
                      </div>
                      <div class="status-row">
                        <div class="status-info">
                          <svg class="status-icon github" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <span>GitHub</span>
                        </div>
                        <span class="status-chip" :class="currentUser?.github_username ? 'online' : 'offline'">
                          {{ currentUser?.github_username || 'Not Connected' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Separator -->
            <div class="header-separator"></div>

            <!-- User Menu -->
            <div class="user-menu-container" ref="userMenuRef">
              <button
                @click.stop="toggleUserMenu"
                class="user-menu-trigger"
                :class="{ 'user-menu-open': showUserMenu }"
                aria-haspopup="true"
                :aria-expanded="showUserMenu"
              >
                <div class="user-avatar">
                  <span class="avatar-text">{{ userInitials }}</span>
                  <span class="avatar-status" :class="currentUser?.github_username ? 'online' : 'offline'"></span>
                </div>
                <div class="user-info">
                  <span class="user-name">{{ currentUser?.username }}</span>
                  <span class="user-role">{{ currentUser?.github_username ? 'Pro User' : 'Free Plan' }}</span>
                </div>
                <svg class="dropdown-chevron" :class="{ 'rotated': showUserMenu }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- User Dropdown -->
              <Transition name="dropdown">
                <div v-if="showUserMenu" class="user-dropdown">
                  <!-- Profile Header -->
                  <div class="dropdown-profile">
                    <div class="profile-avatar">
                      <span>{{ userInitials }}</span>
                    </div>
                    <div class="profile-info">
                      <span class="profile-name">{{ currentUser?.username }}</span>
                      <span class="profile-email">{{ currentUser?.email || 'No email set' }}</span>
                    </div>
                  </div>

                  <div class="dropdown-divider"></div>

                  <!-- Mobile Status Section -->
                  <div class="mobile-status-section">
                    <div class="dropdown-label">System Status</div>
                    <div class="mobile-status-list">
                      <div class="mobile-status-item">
                        <span class="status-dot" :class="llmHealth?.local?.available ? 'online' : 'offline'"></span>
                        <span>Local LLM</span>
                        <span class="status-text">{{ llmHealth?.local?.available ? 'Online' : 'Offline' }}</span>
                      </div>
                      <div class="mobile-status-item">
                        <span class="status-dot" :class="llmHealth?.cloud?.available ? 'online' : 'offline'"></span>
                        <span>Cloud LLM</span>
                        <span class="status-text">{{ llmHealth?.cloud?.available ? 'Online' : 'Offline' }}</span>
                      </div>
                      <div class="mobile-status-item">
                        <span class="status-dot" :class="currentUser?.github_username ? 'online' : 'offline'"></span>
                        <span>GitHub</span>
                        <span class="status-text">{{ currentUser?.github_username || 'Not linked' }}</span>
                      </div>
                    </div>
                    <div class="dropdown-divider"></div>
                  </div>

                  <!-- Menu Items -->
                  <div class="dropdown-menu">
                    <button
                      v-if="!currentUser?.github_username"
                      @click="connectGitHub"
                      class="dropdown-item"
                    >
                      <svg class="item-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span>Connect GitHub</span>
                      <span class="item-badge">New</span>
                    </button>

                    <div class="dropdown-divider"></div>

                    <button @click="handleLogout" class="dropdown-item dropdown-item-danger">
                      <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Mobile Menu Toggle -->
          <button
            @click="toggleMobileMenu"
            class="mobile-toggle"
            :class="{ 'mobile-toggle-active': showMobileMenu }"
            aria-label="Toggle navigation menu"
            :aria-expanded="showMobileMenu"
          >
            <span class="toggle-line"></span>
            <span class="toggle-line"></span>
            <span class="toggle-line"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    <Transition name="mobile-drawer">
      <div v-if="showMobileMenu" class="mobile-overlay" @click.self="closeMobileMenu">
        <nav class="mobile-drawer">
          <!-- Mobile Header -->
          <div class="mobile-header">
            <div class="mobile-logo">
              <div class="logo-icon-small">
                <svg viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#mobile-gradient)" stroke-width="2.5"/>
                  <path d="M10 16L14 20L22 12" stroke="url(#mobile-gradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <defs>
                    <linearGradient id="mobile-gradient" x1="0" y1="0" x2="32" y2="32">
                      <stop stop-color="#6366f1"/>
                      <stop offset="1" stop-color="#d946ef"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span>Agentic System</span>
            </div>
            <button @click="closeMobileMenu" class="mobile-close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Mobile Nav Content -->
          <div class="mobile-content">
            <!-- Public Links -->
            <template v-if="!currentUser">
              <div class="mobile-nav-section">
                <router-link
                  v-for="link in publicLinks"
                  :key="link.to"
                  :to="link.to"
                  class="mobile-link"
                  :class="{ 'mobile-link-active': isActiveRoute(link.to, link.exact) }"
                  @click="closeMobileMenu"
                >
                  <component :is="link.iconComponent" v-if="link.iconComponent" class="mobile-link-icon" />
                  <span>{{ link.label }}</span>
                </router-link>
              </div>

              <div class="mobile-divider"></div>

              <div class="mobile-auth">
                <router-link to="/login" class="mobile-btn-ghost" @click="closeMobileMenu">
                  Sign In
                </router-link>
                <router-link to="/login" class="mobile-btn-primary" @click="closeMobileMenu">
                  Get Started Free
                </router-link>
              </div>
            </template>

            <!-- Authenticated Links -->
            <template v-else>
              <div class="mobile-nav-section">
                <router-link
                  v-for="link in authLinks"
                  :key="link.to"
                  :to="link.to"
                  class="mobile-link"
                  :class="{ 'mobile-link-active': isActiveRoute(link.to, link.exact) }"
                  @click="closeMobileMenu"
                >
                  <component :is="link.iconComponent" v-if="link.iconComponent" class="mobile-link-icon" />
                  <span>{{ link.label }}</span>
                  <span v-if="link.badge" class="mobile-badge">{{ link.badge }}</span>
                </router-link>

                <a
                  href="https://mazily-nippy-dionna.ngrok-free.dev/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mobile-link"
                  @click="closeMobileMenu"
                >
                  <svg class="mobile-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <span>Admin Panel</span>
                  <svg class="external-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17L17 7M17 7H7M17 7v10"/>
                  </svg>
                </a>
              </div>
            </template>
          </div>

          <!-- Mobile Footer -->
          <div class="mobile-footer" v-if="currentUser">
            <div class="mobile-user">
              <div class="mobile-avatar">{{ userInitials }}</div>
              <div class="mobile-user-info">
                <span class="mobile-user-name">{{ currentUser?.username }}</span>
                <span class="mobile-user-email">{{ currentUser?.email || 'Free Plan' }}</span>
              </div>
            </div>
            <button @click="handleLogout" class="mobile-logout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </nav>
      </div>
    </Transition>

    <!-- Search Modal (placeholder) -->
    <Transition name="modal">
      <div v-if="showSearch" class="search-overlay" @click.self="closeSearch">
        <div class="search-modal">
          <div class="search-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref="searchInput"
              type="text"
              placeholder="Search anything..."
              class="search-input"
              @keydown.escape="closeSearch"
            />
            <kbd class="search-kbd">ESC</kbd>
          </div>
          <div class="search-hints">
            <span>Type to search across projects, docs, and settings</span>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, h } from 'vue'
import { useRoute } from 'vue-router'

// Icon Components (inline SVG as render functions)
const HomeIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' }),
    h('polyline', { points: '9 22 9 12 15 12 15 22' })
  ])
}

const FeaturesIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
  ])
}

const PricingIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('line', { x1: '12', y1: '1', x2: '12', y2: '23' }),
    h('path', { d: 'M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' })
  ])
}

const BlogIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z' }),
    h('path', { d: 'M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z' })
  ])
}

const DashboardIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('rect', { x: '3', y: '3', width: '7', height: '9', rx: '1' }),
    h('rect', { x: '14', y: '3', width: '7', height: '5', rx: '1' }),
    h('rect', { x: '14', y: '12', width: '7', height: '9', rx: '1' }),
    h('rect', { x: '3', y: '16', width: '7', height: '5', rx: '1' })
  ])
}

const AIIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93' }),
    h('path', { d: 'M8.56 6.22A4 4 0 0112 2' }),
    h('path', { d: 'M12 18a8 8 0 01-8-8' }),
    h('path', { d: 'M20 10a8 8 0 01-8 8' }),
    h('circle', { cx: '12', cy: '12', r: '2' })
  ])
}

const BenchmarkIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
    h('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
    h('line', { x1: '6', y1: '20', x2: '6', y2: '14' })
  ])
}

const ToolsIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' })
  ])
}

const ServicesIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('circle', { cx: '12', cy: '12', r: '3' }),
    h('path', { d: 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' })
  ])
}

const MCPIcon = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { d: 'M18.36 6.64a9 9 0 11-12.73 0' }),
    h('line', { x1: '12', y1: '2', x2: '12', y2: '12' })
  ])
}

// Props
const props = defineProps({
  currentUser: {
    type: Object,
    default: null
  },
  llmHealth: {
    type: Object,
    default: null
  },
  theme: {
    type: String,
    default: 'dark'
  }
})

// Emits
const emit = defineEmits(['logout', 'connect-github', 'toggle-theme'])

// Route
const route = useRoute()

// Refs
const userMenuRef = ref(null)
const statusRef = ref(null)
const searchInput = ref(null)
const showUserMenu = ref(false)
const showMobileMenu = ref(false)
const showStatusPopover = ref(false)
const showSearch = ref(false)
const isScrolled = ref(false)

// Computed
const isLoginPage = computed(() => route.path === '/login')

// Public pages with dark theme
const isDarkPage = computed(() => {
  return !!route.meta.public
})

const userInitials = computed(() => {
  if (!props.currentUser?.username) return '?'
  return props.currentUser.username
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const overallStatus = computed(() => {
  const local = props.llmHealth?.local?.available
  const cloud = props.llmHealth?.cloud?.available
  if (local && cloud) return 'online'
  if (local || cloud) return 'partial'
  return 'offline'
})

const overallStatusText = computed(() => {
  const status = overallStatus.value
  if (status === 'online') return 'All Systems Operational'
  if (status === 'partial') return 'Partial Outage'
  return 'Systems Offline'
})

// Navigation Links
const publicLinks = [
  { to: '/', label: 'Home', exact: true, iconComponent: HomeIcon },
  { to: '/features', label: 'Features', exact: true, iconComponent: FeaturesIcon },
  { to: '/pricing', label: 'Pricing', exact: true, iconComponent: PricingIcon },
  { to: '/blog', label: 'Blog', exact: false, iconComponent: BlogIcon }
]

const authLinks = [
  { to: '/dashboard', label: 'Dashboard', exact: true, iconComponent: DashboardIcon },
  { to: '/ai-settings', label: 'AI Providers', exact: true, iconComponent: AIIcon },
  { to: '/benchmarks', label: 'Benchmarks', exact: true, iconComponent: BenchmarkIcon },
  { to: '/tools', label: 'Tools', exact: true, iconComponent: ToolsIcon },
  { to: '/services', label: 'Services', exact: true, iconComponent: ServicesIcon },
  { to: '/mcp', label: 'MCP', exact: true, iconComponent: MCPIcon, highlight: true }
]

// Methods
const isActiveRoute = (path, exact = false) => {
  if (exact) return route.path === path
  return route.path.startsWith(path)
}

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
  showStatusPopover.value = false
}

const toggleStatusPopover = () => {
  showStatusPopover.value = !showStatusPopover.value
  showUserMenu.value = false
}

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value
  document.body.style.overflow = showMobileMenu.value ? 'hidden' : ''
}

const toggleSearch = async () => {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

const closeSearch = () => {
  showSearch.value = false
}

const closeMobileMenu = () => {
  showMobileMenu.value = false
  document.body.style.overflow = ''
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const closeStatusPopover = () => {
  showStatusPopover.value = false
}

const handleLogout = () => {
  closeUserMenu()
  closeMobileMenu()
  emit('logout')
}

const connectGitHub = () => {
  closeUserMenu()
  closeMobileMenu()
  emit('connect-github')
}

// Scroll handler
const handleScroll = () => {
  isScrolled.value = window.scrollY > 10
}

// Click outside handler
const handleClickOutside = (event) => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    closeUserMenu()
  }
  if (statusRef.value && !statusRef.value.contains(event.target)) {
    closeStatusPopover()
  }
}

// Keyboard handler
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    closeUserMenu()
    closeMobileMenu()
    closeStatusPopover()
    closeSearch()
  }
  // Ctrl/Cmd + K for search
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    toggleSearch()
  }
}

// Watch for route changes
watch(() => route.path, () => {
  closeMobileMenu()
  closeUserMenu()
  closeStatusPopover()
})

// Lifecycle
onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeydown)
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ===== CSS Variables ===== */
.app-header {
  --header-height: 64px;
  --header-bg: rgba(255, 255, 255, 0.8);
  --header-bg-solid: #ffffff;
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --primary-light: #eef2ff;
  --accent: #8b5cf6;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-light: #f1f5f9;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 25px -5px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 40px -10px rgb(0 0 0 / 0.15);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}

/* ===== Header Base ===== */
.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: var(--header-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid transparent;
  transition: all var(--transition-normal);
}

.app-header.header-scrolled {
  background: var(--header-bg-solid);
  border-bottom-color: var(--border);
  box-shadow: var(--shadow-sm);
}

/* Dark theme for public pages */
.app-header.header-dark {
  --header-bg: rgba(3, 7, 18, 0.8);
  --header-bg-solid: rgba(3, 7, 18, 0.95);
  --text-primary: #ffffff;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border: rgba(255, 255, 255, 0.1);
  --border-light: rgba(255, 255, 255, 0.05);
}

.app-header.header-dark .logo-text-sub {
  color: #9ca3af;
}

.app-header.header-dark .nav-link {
  color: #d1d5db;
}

.app-header.header-dark .nav-link:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.app-header.header-dark .nav-link-active {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.15);
}

.app-header.header-dark .nav-divider {
  background: rgba(255, 255, 255, 0.1);
}

/* Removed .header-dark specific overrides as we now use CSS variables */

.header-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 20px;
}

@media (min-width: 768px) {
  .header-container { padding: 0 32px; }
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  gap: 24px;
}

/* ===== Logo ===== */
.header-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: transform var(--transition-fast);
}

.logo-link:hover { transform: translateY(-1px); }

.logo-wrapper {
  position: relative;
  width: 36px;
  height: 36px;
}

.logo-glow {
  position: absolute;
  inset: -4px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(217, 70, 239, 0.3));
  border-radius: 12px;
  filter: blur(8px);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.logo-link:hover .logo-glow { opacity: 1; }

.logo-icon {
  position: relative;
  width: 36px;
  height: 36px;
}

.logo-icon svg {
  width: 100%;
  height: 100%;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.logo-text-main {
  font-size: 1.125rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-text-sub {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

/* ===== Desktop Navigation ===== */
.desktop-nav {
  display: none;
  align-items: center;
  gap: 4px;
}

@media (min-width: 1024px) {
  .desktop-nav { display: flex; }
}

.nav-divider {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin-right: 12px;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--border-light);
}

.nav-link-active {
  color: var(--primary);
  background: var(--primary-light);
}

.nav-link-highlight {
  color: var(--accent);
}

.nav-link-highlight.nav-link-active {
  background: #f5f3ff;
}

.nav-link-icon {
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

.nav-link:hover .nav-link-icon,
.nav-link-active .nav-link-icon {
  opacity: 1;
}

.nav-badge {
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: 10px;
}

.nav-link-external { gap: 6px; }

.external-icon {
  width: 14px;
  height: 14px;
  opacity: 0.4;
  transition: opacity var(--transition-fast);
}

.nav-link:hover .external-icon { opacity: 0.7; }

/* ===== Header Right ===== */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Auth Buttons */
.auth-buttons {
  display: none;
  align-items: center;
  gap: 8px;
}

@media (min-width: 640px) {
  .auth-buttons { display: flex; }
}

.btn-ghost {
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.btn-ghost:hover {
  color: var(--text-primary);
  background: var(--border-light);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  text-decoration: none;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.btn-icon {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-fast);
}

.btn-primary:hover .btn-icon {
  transform: translateX(3px);
}

/* ===== User Section ===== */
.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Quick Actions */
.quick-actions {
  display: none;
  align-items: center;
  gap: 4px;
}

@media (min-width: 768px) {
  .quick-actions { display: flex; }
}

.action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-card-solid);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

/* Theme Toggle Specific */
.theme-toggle {
  margin-right: 8px;
}

.theme-icon {
  width: 20px;
  height: 20px;
  animation: scaleIn 0.3s ease-out;
}

.action-kbd {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 1px 4px;
  font-size: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  background: var(--border-light);
  border-radius: 3px;
}

/* Status Button */
.status-btn {
  width: auto;
  padding: 0 12px;
  gap: 8px;
}

.status-indicator-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.status-pulse {
  position: absolute;
  left: -8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pulse.online {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  animation: pulse 2s infinite;
}

.status-pulse.partial {
  background: var(--warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.status-pulse.offline {
  background: var(--text-muted);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Status Popover */
.status-popover-container {
  position: relative;
}

.status-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 300px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--border-light);
}

.popover-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 20px;
}

.status-badge.online {
  color: var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.status-badge.partial {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.status-badge.offline {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.popover-content {
  padding: 12px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.status-row:hover {
  background: var(--border-light);
}

.status-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.status-icon {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
}

.status-icon.github {
  width: 16px;
  height: 16px;
}

.status-chip {
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 6px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip.online {
  color: var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.status-chip.offline {
  color: var(--text-muted);
  background: var(--border-light);
}

/* Header Separator */
.header-separator {
  width: 1px;
  height: 28px;
  background: var(--border);
}

/* ===== User Menu ===== */
.user-menu-container {
  position: relative;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  padding-right: 12px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 50px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-menu-trigger:hover,
.user-menu-trigger.user-menu-open {
  background: var(--border-light);
  border-color: var(--border);
}

.user-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
}

.avatar-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.avatar-status {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--bg-surface);
  border-radius: 50%;
}

.avatar-status.online { background: var(--success); }
.avatar-status.offline { background: var(--text-muted); }

.user-info {
  display: none;
  flex-direction: column;
  text-align: left;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .user-info { display: flex; }
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.dropdown-chevron {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.dropdown-chevron.rotated {
  transform: rotate(180deg);
}

/* User Dropdown */
.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.dropdown-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, var(--primary-light) 0%, #faf5ff 100%);
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: 12px;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-email {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
}

.dropdown-label {
  padding: 12px 16px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.mobile-status-section {
  display: none;
}

@media (max-width: 767px) {
  .mobile-status-section { display: block; }
}

.mobile-status-list {
  padding: 0 12px 12px;
}

.mobile-status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.mobile-status-item .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mobile-status-item .status-dot.online { background: var(--success); }
.mobile-status-item .status-dot.offline { background: var(--text-muted); }

.mobile-status-item .status-text {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dropdown-menu {
  padding: 8px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--border-light);
  color: var(--text-primary);
}

.dropdown-item-danger:hover {
  background: #fef2f2;
  color: var(--danger);
}

.item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.item-badge {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: 10px;
}

/* ===== Mobile Toggle ===== */
.mobile-toggle {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

@media (min-width: 1024px) {
  .mobile-toggle { display: none; }
}

.mobile-toggle:hover {
  background: var(--border-light);
}

.toggle-line {
  width: 18px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 1px;
  transition: all var(--transition-normal);
}

.mobile-toggle-active .toggle-line:first-child {
  transform: translateY(7px) rotate(45deg);
}

.mobile-toggle-active .toggle-line:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}

.mobile-toggle-active .toggle-line:last-child {
  transform: translateY(-7px) rotate(-45deg);
}

/* ===== Mobile Drawer ===== */
.mobile-overlay {
  position: fixed;
  inset: 0;
  top: var(--header-height);
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 999;
}

.mobile-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  max-width: 340px;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.mobile-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.logo-icon-small {
  width: 28px;
  height: 28px;
}

.logo-icon-small svg {
  width: 100%;
  height: 100%;
}

.mobile-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mobile-close:hover {
  background: var(--border-light);
  color: var(--text-primary);
}

.mobile-close svg {
  width: 20px;
  height: 20px;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.mobile-nav-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.mobile-link:hover,
.mobile-link-active {
  background: var(--primary-light);
  color: var(--primary);
}

.mobile-link-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.mobile-link:hover .mobile-link-icon,
.mobile-link-active .mobile-link-icon {
  opacity: 1;
}

.mobile-badge {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: 10px;
}

.external-arrow {
  width: 16px;
  height: 16px;
  margin-left: auto;
  opacity: 0.4;
}

.mobile-divider {
  height: 1px;
  margin: 16px 0;
  background: var(--border);
}

.mobile-auth {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-btn-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.mobile-btn-ghost:hover {
  background: var(--border-light);
  color: var(--text-primary);
}

.mobile-btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.mobile-btn-primary:hover {
  opacity: 0.9;
}

.mobile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--border-light);
}

.mobile-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: 10px;
}

.mobile-user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.mobile-user-email {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.mobile-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--danger);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mobile-logout:hover {
  background: #fef2f2;
}

.mobile-logout svg {
  width: 20px;
  height: 20px;
}

/* ===== Search Modal ===== */
.search-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 120px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
}

.search-modal {
  width: 100%;
  max-width: 580px;
  margin: 0 20px;
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.search-icon {
  width: 22px;
  height: 22px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 1rem;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-kbd {
  padding: 4px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  background: var(--border-light);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.search-hints {
  padding: 16px 20px;
  font-size: 0.8125rem;
  color: var(--text-muted);
  background: var(--border-light);
}

/* ===== Transitions ===== */
.dropdown-enter-active,
.dropdown-leave-active,
.popover-enter-active,
.popover-leave-active {
  transition: all var(--transition-normal);
}

.dropdown-enter-from,
.dropdown-leave-to,
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.mobile-drawer-enter-active,
.mobile-drawer-leave-active {
  transition: all var(--transition-slow);
}

.mobile-drawer-enter-active .mobile-drawer,
.mobile-drawer-leave-active .mobile-drawer {
  transition: transform var(--transition-slow);
}

.mobile-drawer-enter-from,
.mobile-drawer-leave-to {
  opacity: 0;
}

.mobile-drawer-enter-from .mobile-drawer,
.mobile-drawer-leave-to .mobile-drawer {
  transform: translateX(100%);
}

.modal-enter-active,
.modal-leave-active {
  transition: all var(--transition-normal);
}

.modal-enter-active .search-modal,
.modal-leave-active .search-modal {
  transition: all var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .search-modal,
.modal-leave-to .search-modal {
  transform: scale(0.95) translateY(-10px);
}

/* ===== Focus States ===== */
.nav-link:focus-visible,
.btn-ghost:focus-visible,
.btn-primary:focus-visible,
.action-btn:focus-visible,
.user-menu-trigger:focus-visible,
.mobile-toggle:focus-visible,
.dropdown-item:focus-visible,
.mobile-link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ===== Reduced Motion ===== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
