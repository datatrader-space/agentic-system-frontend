<template>
  <div class="drafts-page">
    <div class="page-header">
      <div>
        <h1>Draft Services</h1>
        <p class="subtitle">Resume or delete your saved service registrations</p>
      </div>
      <router-link to="/services/wizard" class="btn-new">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        New Service
      </router-link>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading drafts...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && drafts.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z"/>
      </svg>
      <h2>No draft services yet</h2>
      <p>Start creating a new service to save drafts</p>
      <router-link to="/services/wizard" class="btn-primary">
        Create Service
      </router-link>
    </div>

    <!-- Drafts List -->
    <div v-else class="drafts-grid">
      <div 
        v-for="draft in drafts" 
        :key="draft.id"
        class="draft-card"
      >
        <div class="draft-header">
          <div class="draft-icon">📝</div>
          <div class="draft-status">
            <span :class="['status-badge', draft.status]">
              {{ draft.status }}
            </span>
          </div>
        </div>

        <div class="draft-body">
          <h3>{{ draft.name || 'Untitled Service' }}</h3>
          <p class="draft-description">{{ draft.description || 'No description' }}</p>
          
          <div class="draft-meta">
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Step {{ draft.last_saved_step }}/5
            </div>
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              {{ formatDate(draft.updated_at) }}
            </div>
          </div>

          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: (draft.last_saved_step / 5 * 100) + '%' }"
            ></div>
          </div>
        </div>

        <div class="draft-actions">
          <button @click="resumeDraft(draft.id)" class="btn-resume">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Continue
          </button>
          <button @click="deleteDraft(draft.id)" class="btn-delete">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const loading = ref(true)
const drafts = ref([])

onMounted(async () => {
  await loadDrafts()
})

async function loadDrafts() {
  loading.value = true
  try {
    const response = await api.listDrafts()
    drafts.value = response.data.drafts
  } catch (error) {
    console.error('Failed to load drafts:', error)
  } finally {
    loading.value = false
  }
}

function resumeDraft(draftId) {
  router.push(`/services/wizard?draft=${draftId}`)
}

async function deleteDraft(draftId) {
  if (!confirm('Delete this draft? This cannot be undone.')) return
  
  try {
    await api.deleteService(draftId)
    await loadDrafts()
  } catch (error) {
    console.error('Failed to delete draft:', error)
    alert('Failed to delete draft')
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}
</script>

<style scoped>
.drafts-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #1e293b;
}

.subtitle {
  margin: 0;
  color: #64748b;
  font-size: 1rem;
}

.btn-new {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-new:hover {
  background: #7c3aed;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);
}

.btn-new svg {
  width: 20px;
  height: 20px;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 4px solid #f1f5f9;
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-state svg {
  width: 80px;
  height: 80px;
  color: #cbd5e1;
  margin-bottom: 1.5rem;
}

.empty-state h2 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
  font-size: 1.5rem;
}

.empty-state p {
  margin: 0 0 2rem 0;
  color: #64748b;
}

.btn-primary {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: #8b5cf6;
  color: white;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #7c3aed;
  transform: translateY(-1px);
}

/* Drafts Grid */
.drafts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.draft-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.draft-card:hover {
  border-color: #8b5cf6;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
  transform: translateY(-2px);
}

.draft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.draft-icon {
  font-size: 2rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.draft {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.complete {
  background: #dbeafe;
  color: #1e40af;
}

.draft-body {
  padding: 1.25rem;
}

.draft-body h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  color: #1e293b;
}

.draft-description {
  margin: 0 0 1rem 0;
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.draft-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #64748b;
  font-size: 0.875rem;
}

.meta-item svg {
  width: 16px;
  height: 16px;
  color: #94a3b8;
}

.progress-bar {
  height: 4px;
  background: #f1f5f9;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
  transition: width 0.3s;
}

.draft-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #f1f5f9;
}

.btn-resume,
.btn-delete {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-resume {
  background: #8b5cf6;
  color: white;
}

.btn-resume:hover {
  background: #7c3aed;
}

.btn-delete {
  background: #fef2f2;
  color: #dc2626;
}

.btn-delete:hover {
  background: #fee2e2;
}

.btn-resume svg,
.btn-delete svg {
  width: 16px;
  height: 16px;
}
</style>
