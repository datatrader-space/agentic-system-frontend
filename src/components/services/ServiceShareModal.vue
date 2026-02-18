<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content share-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="text-2xl">🔗</div>
          <div>
            <h2>Share Service</h2>
            <p class="text-gray-500 text-sm">{{ service.name }}</p>
          </div>
        </div>
        <button class="close-button" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Share Form -->
        <div class="section">
          <h3>👤 Share with User</h3>
          <div class="share-form">
            <div class="form-row">
              <input
                v-model="shareUsername"
                type="text"
                placeholder="Enter username or email"
                class="share-input"
                @keyup.enter="handleShare"
              />
              <select v-model="sharePermission" class="permission-select">
                <option value="use">Use Only</option>
                <option value="manage">Manage</option>
                <option value="admin">Full Admin</option>
              </select>
              <button
                @click="handleShare"
                class="share-button"
                :disabled="!shareUsername.trim() || sharing"
              >
                {{ sharing ? 'Sharing...' : 'Share' }}
              </button>
            </div>
            <p class="form-help">
              <strong>Use Only</strong> — can use tools, cannot modify.
              <strong>Manage</strong> — can toggle actions.
              <strong>Admin</strong> — full config access except delete.
            </p>
            <div v-if="shareError" class="error-msg">{{ shareError }}</div>
            <div v-if="shareSuccess" class="success-msg">{{ shareSuccess }}</div>
          </div>
        </div>

        <!-- Current Shares -->
        <div class="section">
          <h3>👥 Current Shares</h3>
          <div v-if="loadingShares" class="loading-state">
            <div class="spinner-sm"></div>
            <span>Loading shares...</span>
          </div>
          <div v-else-if="shares.length === 0" class="empty-state">
            <p>This service hasn't been shared with anyone yet.</p>
          </div>
          <div v-else class="shares-list">
            <div v-for="share in shares" :key="share.id" class="share-item">
              <div class="share-info">
                <div class="share-user">
                  <span class="user-avatar">{{ share.shared_with_username.charAt(0).toUpperCase() }}</span>
                  <div>
                    <div class="font-medium">{{ share.shared_with_username }}</div>
                    <div class="text-xs text-gray-500">
                      Shared by {{ share.shared_by_username }} · {{ formatDate(share.created_at) }}
                    </div>
                  </div>
                </div>
                <div class="share-meta">
                  <span class="permission-badge" :class="'perm-' + share.permission">
                    {{ formatPermission(share.permission) }}
                  </span>
                  <span v-if="share.expires_at" class="text-xs text-gray-500">
                    Expires {{ formatDate(share.expires_at) }}
                  </span>
                </div>
              </div>
              <button
                @click="handleRevoke(share)"
                class="revoke-button"
                :disabled="revoking === share.id"
              >
                {{ revoking === share.id ? '...' : 'Revoke' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div></div>
        <button @click="$emit('close')" class="btn-secondary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const props = defineProps({
  service: { type: Object, required: true }
})

const emit = defineEmits(['close', 'updated'])

// Share form state
const shareUsername = ref('')
const sharePermission = ref('use')
const sharing = ref(false)
const shareError = ref('')
const shareSuccess = ref('')

// Shares list state
const shares = ref([])
const loadingShares = ref(true)
const revoking = ref(null)

const loadShares = async () => {
  loadingShares.value = true
  try {
    const response = await api.listShares(props.service.id)
    shares.value = response.data.shares || []
  } catch (err) {
    console.error('Failed to load shares:', err)
  } finally {
    loadingShares.value = false
  }
}

const handleShare = async () => {
  if (!shareUsername.value.trim()) return
  sharing.value = true
  shareError.value = ''
  shareSuccess.value = ''

  try {
    await api.shareService(props.service.id, {
      username: shareUsername.value.trim(),
      permission: sharePermission.value
    })
    shareSuccess.value = `Shared with ${shareUsername.value.trim()}`
    shareUsername.value = ''
    await loadShares()
    emit('updated')
  } catch (err) {
    shareError.value = err.response?.data?.error || 'Failed to share service'
  } finally {
    sharing.value = false
  }
}

const handleRevoke = async (share) => {
  if (!confirm(`Revoke access for ${share.shared_with_username}?`)) return
  revoking.value = share.id
  try {
    await api.revokeShare(props.service.id, share.id)
    await loadShares()
    emit('updated')
  } catch (err) {
    alert('Failed to revoke: ' + (err.response?.data?.error || err.message))
  } finally {
    revoking.value = null
  }
}

const formatPermission = (perm) => {
  const labels = { 'use': '👁 Use', 'manage': '⚙️ Manage', 'admin': '👑 Admin' }
  return labels[perm] || perm
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

onMounted(() => loadShares())
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.share-modal {
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 { margin: 0; font-size: 20px; font-weight: 600; }

.close-button {
  background: none; border: none;
  font-size: 20px; cursor: pointer;
  color: #6b7280; padding: 8px; line-height: 1;
}
.close-button:hover { color: #1f2937; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.section { margin-bottom: 24px; }
.section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1f2937;
}

/* Share Form */
.share-form { display: flex; flex-direction: column; gap: 8px; }
.form-row { display: flex; gap: 8px; }
.share-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}
.share-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
.permission-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 130px;
}
.share-button {
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}
.share-button:hover { background: #2563eb; }
.share-button:disabled { background: #93c5fd; cursor: not-allowed; }
.form-help { font-size: 12px; color: #6b7280; line-height: 1.5; }
.error-msg { color: #dc2626; font-size: 13px; padding: 6px 10px; background: #fef2f2; border-radius: 6px; }
.success-msg { color: #16a34a; font-size: 13px; padding: 6px 10px; background: #f0fdf4; border-radius: 6px; }

/* Shares List */
.shares-list { display: flex; flex-direction: column; gap: 8px; }
.share-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.share-info { display: flex; flex-direction: column; gap: 6px; }
.share-user { display: flex; align-items: center; gap: 10px; }
.user-avatar {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.share-meta { display: flex; align-items: center; gap: 8px; margin-left: 42px; }
.permission-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
.perm-use { background: #e0f2fe; color: #0369a1; }
.perm-manage { background: #fef3c7; color: #92400e; }
.perm-admin { background: #fce7f3; color: #9d174d; }
.revoke-button {
  padding: 6px 14px;
  background: transparent;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}
.revoke-button:hover { background: #fef2f2; }
.revoke-button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Utility */
.loading-state, .empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: #6b7280;
  font-size: 14px;
}
.empty-state { justify-content: center; }
.spinner-sm {
  width: 16px; height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.btn-secondary {
  padding: 8px 16px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
.btn-secondary:hover { background: #e5e7eb; }
</style>
