<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content edit-service-modal">
      <!-- Header -->
      <div class="modal-header">
        <h2>✏️ Edit Service Configuration</h2>
        <button class="close-button" @click="$emit('close')">✕</button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <!-- Service Name -->
          <div class="form-group">
            <label for="name">Service Name</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              class="form-input"
              required
              placeholder="e.g., SessionBot API"
            />
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="formData.description"
              class="form-textarea"
              rows="3"
              placeholder="What does this service do?"
            ></textarea>
          </div>

          <!-- Base URL -->
          <div class="form-group">
            <label for="baseUrl">Base URL</label>
            <input
              id="baseUrl"
              v-model="formData.base_url"
              type="url"
              class="form-input"
              required
              placeholder="https://api.example.com"
            />
            <p class="form-hint">The root URL for all API requests</p>
          </div>

          <!-- Category -->
          <div class="form-group">
            <label for="category">Category</label>
            <select id="category" v-model="formData.category" class="form-select">
              <option value="">Select a category</option>
              <option value="social_media">Social Media</option>
              <option value="project_management">Project Management</option>
              <option value="communication">Communication</option>
              <option value="crm">CRM</option>
              <option value="analytics">Analytics</option>
              <option value="data_enrichment">Data Enrichment</option>
              <option value="automation">Automation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <!-- Icon (emoji picker or text input) -->
          <div class="form-group">
            <label for="icon">Icon (Emoji)</label>
            <input
              id="icon"
              v-model="formData.icon"
              type="text"
              class="form-input"
              maxlength="2"
              placeholder="🌐"
            />
          </div>

          <!-- Authentication Type -->
          <div class="form-group">
            <label for="authType">Authentication Type</label>
            <select id="authType" v-model="formData.auth_type" class="form-select" @change="handleAuthTypeChange">
              <option value="none">No Authentication</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
              <option value="basic">Basic Auth</option>
              <option value="oauth2">OAuth 2.0</option>
            </select>
          </div>

          <!-- Auth Config (conditional fields based on auth type) -->
          <div v-if="formData.auth_type !== 'none'" class="form-group">
            <label>Authentication Configuration</label>
            
            <!-- Bearer Token -->
            <div v-if="formData.auth_type === 'bearer'" class="auth-fields">
              <input
                v-model="formData.auth_config.token"
                type="password"
                class="form-input"
                placeholder="Bearer token"
              />
            </div>

            <!-- API Key -->
            <div v-else-if="formData.auth_type === 'api_key'" class="auth-fields">
              <input
                v-model="formData.auth_config.key"
                type="password"
                class="form-input mb-2"
                placeholder="API Key"
              />
              <input
                v-model="formData.auth_config.header_name"
                type="text"
                class="form-input"
                placeholder="Header name (e.g., X-API-Key)"
              />
            </div>

            <!-- Basic Auth -->
            <div v-else-if="formData.auth_type === 'basic'" class="auth-fields">
              <input
                v-model="formData.auth_config.username"
                type="text"
                class="form-input mb-2"
                placeholder="Username"
              />
              <input
                v-model="formData.auth_config.password"
                type="password"
                class="form-input"
                placeholder="Password"
              />
            </div>

            <!-- OAuth 2.0 -->
            <div v-else-if="formData.auth_type === 'oauth2'" class="auth-fields">
              <input
                v-model="formData.auth_config.client_id"
                type="text"
                class="form-input mb-2"
                placeholder="Client ID"
              />
              <input
                v-model="formData.auth_config.client_secret"
                type="password"
                class="form-input mb-2"
                placeholder="Client Secret"
              />
              <input
                v-model="formData.auth_config.token_url"
                type="url"
                class="form-input"
                placeholder="Token URL"
              />
            </div>
          </div>

          <!-- API Spec URL (optional) -->
          <div class="form-group">
            <label for="apiSpecUrl">API Spec URL (Optional)</label>
            <input
              id="apiSpecUrl"
              v-model="formData.api_spec_url"
              type="url"
              class="form-input"
              placeholder="https://api.example.com/openapi.json"
            />
          </div>

          <!-- API Docs URL (optional) -->
          <div class="form-group">
            <label for="apiDocsUrl">API Documentation URL (Optional)</label>
            <input
              id="apiDocsUrl"
              v-model="formData.api_docs_url"
              type="url"
              class="form-input"
              placeholder="https://docs.example.com"
            />
          </div>

          <!-- Enabled Toggle -->
          <div class="form-group">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="formData.enabled"
                type="checkbox"
                class="form-checkbox"
              />
              <span>Service Enabled</span>
            </label>
            <p class="form-hint">Disabled services won't be available to agents</p>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button type="button" @click="$emit('close')" class="btn-secondary">
          Cancel
        </button>
        <button type="submit" @click="handleSubmit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../../services/api'

const props = defineProps({
  service: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

const saving = ref(false)

// Form data with all editable fields
const formData = reactive({
  name: '',
  description: '',
  base_url: '',
  category: '',
  icon: '',
  auth_type: 'none',
  auth_config: {},
  api_spec_url: '',
  api_docs_url: '',
  enabled: true
})

// Initialize form with service data
onMounted(() => {
  formData.name = props.service.name || ''
  formData.description = props.service.description || ''
  formData.base_url = props.service.base_url || ''
  formData.category = props.service.category || ''
  formData.icon = props.service.icon || '🌐'
  formData.auth_type = props.service.auth_type || 'none'
  formData.auth_config = props.service.auth_config || {}
  formData.api_spec_url = props.service.api_spec_url || ''
  formData.api_docs_url = props.service.api_docs_url || ''
  formData.enabled = props.service.enabled !== false
})

// Handle auth type change - reset auth_config
const handleAuthTypeChange = () => {
  formData.auth_config = {}
}

// Submit form
const handleSubmit = async () => {
  saving.value = true

  try {
    await api.updateService(props.service.id, {
      name: formData.name,
      description: formData.description,
      base_url: formData.base_url,
      category: formData.category,
      icon: formData.icon,
      auth_type: formData.auth_type,
      auth_config: formData.auth_config,
      api_spec_url: formData.api_spec_url,
      api_docs_url: formData.api_docs_url,
      enabled: formData.enabled
    })

    emit('updated')
    emit('close')
  } catch (err) {
    console.error('Failed to update service:', err)
    alert(err.response?.data?.error || 'Failed to update service')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.edit-service-modal {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
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
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 8px;
  line-height: 1;
}

.close-button:hover {
  color: #1f2937;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

/* Form Styles */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mb-2 {
  margin-bottom: 8px;
}

/* Buttons */
.btn-primary {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #f9fafb;
}
</style>
