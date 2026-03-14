<template>
  <div v-if="!tenancyDisabled" class="ws-switcher" ref="triggerRef">
    <!-- Trigger Button -->
    <button
      class="ws-trigger"
      :class="{ 'ws-trigger--open': isOpen }"
      @click="toggle"
      :title="activeWorkspaceName || 'Workspace'"
    >
      <span class="ws-dot" :style="{ background: wsColor }"></span>
      <span class="ws-name">{{ activeWorkspaceName || 'Workspace' }}</span>
      <svg class="ws-caret" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
      </svg>
    </button>

    <!-- Dropdown (teleported to body to escape header overflow) -->
    <Teleport to="body">
      <transition name="ws-dropdown">
        <div
          v-if="isOpen"
          class="ws-dropdown"
          :style="dropdownStyle"
          ref="dropdownRef"
        >
          <!-- Loading -->
          <div v-if="loading" class="ws-loading">
            <div class="ws-spinner"></div>
            <span>Loading…</span>
          </div>

          <template v-else>
            <!-- No orgs -->
            <div v-if="!myOrgs.length" class="ws-empty">
              <p>You haven't created an organisation yet.</p>
              <button class="ws-create-link" @click="openCreateOrg">
                Create Organisation →
              </button>
            </div>

            <!-- Org groups -->
            <template v-else>
              <!-- Personal Mode escape hatch -->
              <div class="ws-personal-mode">
                <button
                  class="ws-item ws-item--personal"
                  :class="{ 'ws-item--active': !activeWorkspace }"
                  @click="exitWorkspaceMode"
                >
                  <svg class="ws-pm-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                  </svg>
                  <span class="ws-item-name">Personal Mode</span>
                  <svg v-if="!activeWorkspace" class="ws-check" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span v-else class="ws-pm-hint">No scoping</span>
                </button>
              </div>

              <div
                v-for="org in myOrgs"
                :key="org.id"
                class="ws-org-group"
              >
                <div class="ws-org-label">
                  <svg viewBox="0 0 20 20" fill="currentColor" class="ws-org-icon">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
                  </svg>
                  {{ org.name }}
                  <span v-if="org.is_personal" class="ws-personal-badge">Personal</span>
                </div>

                <button
                  v-for="ws in (org.workspaces || [])"
                  :key="ws.id"
                  class="ws-item"
                  :class="{ 'ws-item--active': activeWorkspace?.id === ws.id }"
                  @click="select(ws, org)"
                >
                  <span class="ws-item-dot" :style="{ background: stringToColor(ws.name) }"></span>
                  <span class="ws-item-name">{{ ws.name }}</span>
                  <svg v-if="activeWorkspace?.id === ws.id" class="ws-check" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span v-else class="ws-members-count">
                    {{ ws.member_count ?? '' }}
                    <span v-if="ws.member_count">members</span>
                  </span>
                </button>
              </div>
            </template>

            <!-- Footer Actions -->
            <div class="ws-footer">
              <router-link
                v-if="activeOrg"
                :to="`/org/${activeOrg.slug}/settings`"
                class="ws-footer-link"
                @click="close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
                </svg>
                Organisation Settings
              </router-link>
              <button class="ws-footer-link" @click="openCreateWorkspace">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                New Workspace
              </button>
              <button class="ws-footer-link" @click="openCreateOrg">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-.553.894l-4 2A1 1 0 0111 18V6a1 1 0 00-1-1H4V4z" clip-rule="evenodd"/>
                  <path fill-rule="evenodd" d="M2 7a1 1 0 011-1h4a1 1 0 011 1v10a1 1 0 01-.553.894l-4 2A1 1 0 012 19V7z" clip-rule="evenodd"/>
                </svg>
                New Organisation
              </button>
            </div>
          </template>
        </div>
      </transition>
    </Teleport>

    <!-- Create Workspace Modal (also teleported) -->
    <Teleport to="body">
      <transition name="ws-modal">
        <div v-if="showCreateModal" class="ws-modal-backdrop" @click.self="showCreateModal = false">
          <div class="ws-modal">
            <h3 class="ws-modal-title">New Workspace</h3>
            <div>
              <div class="ws-form-group">
                <label>Name</label>
                <input v-model="newWsName" placeholder="e.g. Engineering" class="ws-input" required />
              </div>
              <div class="ws-form-group">
                <label>Slug</label>
                <input v-model="newWsSlug" placeholder="engineering" class="ws-input" />
              </div>
              <div class="ws-modal-actions">
                <button type="button" class="ws-btn-cancel" @click="showCreateModal = false">Cancel</button>
                <button type="button" class="ws-btn-create" :disabled="creating" @click="createWorkspace">
                  {{ creating ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Create Organisation Modal -->
    <Teleport to="body">
      <transition name="ws-modal">
        <div v-if="showCreateOrgModal" class="ws-modal-backdrop" @click.self="showCreateOrgModal = false">
          <div class="ws-modal">
            <h3 class="ws-modal-title">Create Organisation</h3>
            <div>
              <div class="ws-form-group">
                <label>Organisation Name</label>
                <input v-model="newOrgName" placeholder="e.g. Acme Corp" class="ws-input" @keydown.enter="createOrg" autofocus />
              </div>
              <div class="ws-form-group">
                <label>Slug <span style="color:#6b7280;font-weight:400">(used in URLs)</span></label>
                <input v-model="newOrgSlug" placeholder="acme-corp" class="ws-input" />
              </div>
              <div v-if="createOrgError" class="ws-form-error">{{ createOrgError }}</div>
              <div class="ws-modal-actions">
                <button type="button" class="ws-btn-cancel" @click="showCreateOrgModal = false">Cancel</button>
                <button type="button" class="ws-btn-create" :disabled="creatingOrg || !newOrgName.trim()" @click="createOrg">
                  {{ creatingOrg ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspace } from '../../composables/useWorkspace'
import tenancyApi from '../../services/tenancyApi'

const router = useRouter()
const {
  activeWorkspace, activeOrg, myOrgs, loading, tenancyDisabled,
  switchWorkspace, clearWorkspace, loadMyOrgs,
  activeWorkspaceName,
} = useWorkspace()

const isOpen = ref(false)
const triggerRef = ref(null)
const dropdownRef = ref(null)
const showCreateModal = ref(false)
const newWsName = ref('')
const newWsSlug = ref('')
const creating = ref(false)

// Create Organisation state
const showCreateOrgModal = ref(false)
const newOrgName = ref('')
const newOrgSlug = ref('')
const creatingOrg = ref(false)
const createOrgError = ref('')

// Computed dropdown position (fixed, so it escapes header overflow:hidden)
const dropdownStyle = ref({})

function updateDropdownPos() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: 99999,
  }
}

// Generate consistent color from workspace name
function stringToColor(str) {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
  ]
  let hash = 0
  for (let c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

const wsColor = computed(() =>
  activeWorkspace.value ? stringToColor(activeWorkspace.value.name) : '#8b5cf6'
)

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    updateDropdownPos()
    if (!myOrgs.value.length) loadMyOrgs()
  }
}

function close() { isOpen.value = false }

function select(ws, org) {
  switchWorkspace(ws, org)
  close()
  router.push(`/workspace/${ws.id}`)
}

function exitWorkspaceMode() {
  clearWorkspace()
  close()
  router.push('/')
}

function openCreateWorkspace() {
  close()
  newWsName.value = ''
  newWsSlug.value = ''
  showCreateModal.value = true
}

watch(newWsName, (val) => {
  newWsSlug.value = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
})

async function createWorkspace() {
  if (!newWsName.value) return
  // Use activeOrg, or fall back to first loaded org
  const org = activeOrg.value || myOrgs.value[0]
  if (!org) {
    console.warn('[WorkspaceSwitcher] No org available to create workspace under')
    return
  }
  creating.value = true
  try {
    const res = await tenancyApi.createWorkspace(org.slug, {
      name: newWsName.value,
      slug: newWsSlug.value || newWsName.value.toLowerCase().replace(/\s+/g, '-'),
    })
    await loadMyOrgs()
    switchWorkspace(res.data, org)
    showCreateModal.value = false
  } catch (err) {
    console.error('[WorkspaceSwitcher] Create failed:', err?.response?.data || err)
    alert(err?.response?.data?.detail || err?.response?.data?.name?.[0] || 'Failed to create workspace')
  }
  creating.value = false
}

function openCreateOrg() {
  close()
  newOrgName.value = ''
  newOrgSlug.value = ''
  createOrgError.value = ''
  showCreateOrgModal.value = true
}

watch(newOrgName, (val) => {
  newOrgSlug.value = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
})

async function createOrg() {
  if (!newOrgName.value.trim()) return
  creatingOrg.value = true
  createOrgError.value = ''
  try {
    const res = await tenancyApi.createOrg({
      name: newOrgName.value.trim(),
      slug: newOrgSlug.value || undefined,
    })
    await loadMyOrgs()
    // Auto-select the first workspace in the new org
    const org = res.data
    const firstWs = org.workspaces?.[0]
    if (firstWs) {
      switchWorkspace(firstWs, org)
    }
    showCreateOrgModal.value = false
    router.push(firstWs ? `/workspace/${firstWs.id}` : '/')
  } catch (err) {
    if (err?.response?.status === 409) {
      createOrgError.value = err.response.data?.detail || 'You can only own one organisation at this time.'
    } else {
      createOrgError.value = err?.response?.data?.slug?.[0] || err?.response?.data?.detail || 'Failed to create organisation.'
    }
  }
  creatingOrg.value = false
}

// Close on outside click
function onClickOutside(e) {
  const trigger = triggerRef.value
  const dropdown = dropdownRef.value
  if (!trigger?.contains(e.target) && !dropdown?.contains(e.target)) {
    close()
  }
}

// Reposition on scroll / resize
function onReposition() {
  if (isOpen.value) updateDropdownPos()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', onReposition, { passive: true })
  window.addEventListener('resize', onReposition, { passive: true })
  loadMyOrgs()
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onReposition)
  window.removeEventListener('resize', onReposition)
})
</script>

<style scoped>
/* --- Trigger --- */
.ws-switcher { position: relative; }

.ws-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  max-width: 180px;
}
.ws-trigger:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.15); }
.ws-trigger--open { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.35); color: #a78bfa; }

.ws-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ws-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 130px;
}
.ws-caret {
  width: 14px; height: 14px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.ws-trigger--open .ws-caret { transform: rotate(180deg); }
</style>

<!-- Global styles for teleported dropdown (not scoped) -->
<style>
/* --- Dropdown (teleported, global) --- */
.ws-dropdown {
  width: 260px;
  background: #111827;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1);
  overflow: hidden;
  /* position/top/right set via inline style */
}

.ws-dropdown-enter-active, .ws-dropdown-leave-active {
  transition: all 0.18s ease;
}
.ws-dropdown-enter-from, .ws-dropdown-leave-to {
  opacity: 0; transform: translateY(-6px) scale(0.97);
}

/* --- Loading --- */
.ws-loading {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; color: #9ca3af; font-size: 13px;
}
.ws-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(139,92,246,0.3);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: ws-spin 0.7s linear infinite;
}
@keyframes ws-spin { to { transform: rotate(360deg); } }

/* --- Empty --- */
.ws-empty { padding: 20px 16px; font-size: 13px; color: #9ca3af; }
.ws-create-link { color: #8b5cf6; text-decoration: none; font-weight: 500; }

/* --- Org Group --- */
.ws-org-group { padding: 8px 0; }
.ws-org-group + .ws-org-group { border-top: 1px solid rgba(255,255,255,0.06); }

.ws-org-label {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 16px;
  font-size: 11px; font-weight: 600;
  color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.ws-org-icon { width: 12px; height: 12px; color: #6b7280; }
.ws-personal-badge {
  margin-left: auto;
  background: rgba(139,92,246,0.15);
  color: #a78bfa;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  text-transform: none; letter-spacing: 0;
}

/* --- Workspace Item --- */
.ws-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 8px 16px;
  background: none; border: none;
  color: #d1d5db; font-size: 13.5px;
  cursor: pointer;
  transition: background 0.12s ease;
  text-align: left;
}
.ws-item:hover { background: rgba(255,255,255,0.05); }
.ws-item--active { color: #f9fafb; }

.ws-item-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ws-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-check { width: 14px; height: 14px; color: #8b5cf6; flex-shrink: 0; }
.ws-members-count { font-size: 11px; color: #6b7280; white-space: nowrap; }

/* --- Personal Mode --- */
.ws-personal-mode {
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ws-item--personal {
  gap: 10px;
}
.ws-pm-icon { width: 16px; height: 16px; color: #9ca3af; flex-shrink: 0; }
.ws-item--active .ws-pm-icon { color: #a78bfa; }
.ws-pm-hint { font-size: 11px; color: #6b7280; white-space: nowrap; }

/* --- Footer --- */
.ws-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 6px 0;
}
.ws-footer-link {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 9px 16px;
  background: none; border: none;
  color: #9ca3af; font-size: 13px;
  cursor: pointer; text-decoration: none;
  transition: color 0.12s, background 0.12s;
  text-align: left;
}
.ws-footer-link:hover { color: #e2e8f0; background: rgba(255,255,255,0.04); }
.ws-footer-link svg { width: 14px; height: 14px; flex-shrink: 0; }

/* --- Create Modal --- */
.ws-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 100000;
  display: flex; align-items: center; justify-content: center;
}
.ws-modal {
  background: #111827;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 28px;
  width: 360px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.7);
}
.ws-modal-enter-active, .ws-modal-leave-active { transition: all 0.2s ease; }
.ws-modal-enter-from, .ws-modal-leave-to { opacity: 0; transform: scale(0.94); }

.ws-modal-title { font-size: 17px; font-weight: 600; color: #f9fafb; margin: 0 0 20px; }
.ws-form-group { margin-bottom: 16px; }
.ws-form-group label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 6px; font-weight: 500; }
.ws-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #f9fafb;
  padding: 9px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.ws-input:focus { border-color: #8b5cf6; }
.ws-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
.ws-btn-cancel {
  padding: 8px 16px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #9ca3af; cursor: pointer; font-size: 13.5px;
  transition: all 0.15s;
}
.ws-btn-cancel:hover { color: #e2e8f0; }
.ws-btn-create {
  padding: 8px 20px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none; color: #fff;
  cursor: pointer; font-size: 13.5px; font-weight: 600;
  transition: opacity 0.15s;
}
.ws-btn-create:disabled { opacity: 0.6; cursor: not-allowed; }
.ws-btn-create:not(:disabled):hover { opacity: 0.9; }

.ws-form-error {
  color: #f87171;
  font-size: 12px;
  margin-top: -8px;
  margin-bottom: 8px;
}

button.ws-create-link {
  background: none;
  border: none;
  color: #8b5cf6;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
button.ws-create-link:hover { text-decoration: underline; }
</style>
