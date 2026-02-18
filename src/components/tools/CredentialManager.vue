<template>
  <div class="credential-manager h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900">Credential Manager</h2>
        <button
          @click="openAddModal"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Credential
        </button>
      </div>
    </div>

    <!-- Credentials Table -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading credentials...</p>
        </div>
      </div>

      <div v-else-if="credentials.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <div class="text-5xl mb-3">🔑</div>
        <p class="text-lg font-medium">No credentials configured</p>
        <p class="text-sm mt-1">Add credentials to enable authenticated tool access</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="credential in credentials"
            :key="credential.id"
            class="hover:bg-gray-50"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ credential.credential_name }}
              <span v-if="credential.is_default" class="ml-1 text-xs text-yellow-600">★ Default</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ credential.service_name }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span
                :class="[
                  'px-2 py-1 rounded text-xs font-medium',
                  credential.scope_type === 'builtin_tool'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                ]"
              >
                {{ credential.scope_type === 'builtin_tool' ? 'Built-in' : credential.auth_type }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                :class="[
                  'px-2 py-1 text-xs font-semibold rounded-full',
                  credential.is_valid
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-600'
                ]"
              >
                {{ credential.is_valid ? 'Valid' : 'Invalid' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ credential.last_used_at ? formatDate(credential.last_used_at) : 'Never' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
              <button
                v-if="credential.scope_type === 'service'"
                @click="testCredential(credential)"
                class="text-blue-600 hover:text-blue-800 font-medium"
              >
                Test
              </button>
              <button
                @click="deleteCredential(credential)"
                class="text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Credential Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4">Add Credential</h3>

        <!-- Scope Type Tabs -->
        <div class="flex gap-2 mb-5">
          <button
            @click="form.scopeType = 'builtin_tool'"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              form.scopeType === 'builtin_tool'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            🔧 Built-in Tool
          </button>
          <button
            @click="form.scopeType = 'service'"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              form.scopeType === 'service'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            🌐 Service
          </button>
        </div>

        <!-- Built-in Tool Form -->
        <div v-if="form.scopeType === 'builtin_tool'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            v-model="form.builtinTool"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select a provider...</option>
            <option
              v-for="scope in builtinScopes"
              :key="scope.slug"
              :value="scope.slug"
            >
              {{ scope.name }} — {{ scope.description }}
            </option>
          </select>

          <!-- Dynamic credential fields based on selected provider -->
          <div v-if="selectedScope">
            <label class="block text-sm font-medium text-gray-700 mb-1">Credential Name</label>
            <input
              v-model="form.credentialName"
              type="text"
              :placeholder="selectedScope.name + ' API Key'"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />

            <div
              v-for="field in selectedScope.credential_fields"
              :key="field.name"
              class="mb-4"
            >
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ field.label }}
                <span v-if="field.required" class="text-red-500">*</span>
              </label>
              <textarea
                v-if="field.type === 'textarea'"
                v-model="form.credentials[field.name]"
                :placeholder="field.placeholder || 'Enter ' + field.label.toLowerCase()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-xs"
                rows="8"
              />
              <input
                v-else
                v-model="form.credentials[field.name]"
                :type="field.type === 'string' ? 'text' : 'password'"
                :placeholder="field.placeholder || 'Enter ' + field.label.toLowerCase()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <!-- Service Credential Form -->
        <div v-if="form.scopeType === 'service'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Service</label>
          <select
            v-model="form.serviceId"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a service...</option>
            <option v-for="svc in services" :key="svc.id" :value="svc.id">
              {{ svc.name }}
            </option>
          </select>

          <label class="block text-sm font-medium text-gray-700 mb-1">Credential Name</label>
          <input
            v-model="form.credentialName"
            type="text"
            placeholder="My API Key"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <label class="block text-sm font-medium text-gray-700 mb-1">Auth Type</label>
          <select
            v-model="form.credentials.auth_type"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="api_key">API Key</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
          </select>

          <div v-if="form.credentials.auth_type === 'api_key'">
            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              v-model="form.credentials.api_key"
              type="password"
              placeholder="sk-..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <label class="block text-sm font-medium text-gray-700 mb-1">Header Name</label>
            <input
              v-model="form.credentials.header_name"
              type="text"
              placeholder="X-API-Key (optional)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div v-else-if="form.credentials.auth_type === 'bearer'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Token</label>
            <input
              v-model="form.credentials.token"
              type="password"
              placeholder="Bearer token..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div v-else-if="form.credentials.auth_type === 'basic'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              v-model="form.credentials.username"
              type="text"
              placeholder="Username"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <label class="block text-sm font-medium text-gray-700 mb-1">Password / API Token</label>
            <input
              v-model="form.credentials.password"
              type="password"
              placeholder="Password or API token"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <label class="block text-sm font-medium text-gray-700 mb-1">Base URL Override (optional)</label>
          <input
            v-model="form.baseUrlOverride"
            type="text"
            placeholder="https://yourteam.atlassian.net"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Error -->
        <div v-if="formError" class="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {{ formError }}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 mt-2">
          <button
            @click="showAddModal = false"
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            @click="submitCredential"
            :disabled="submitting"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {{ submitting ? 'Saving...' : 'Save Credential' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { credentialsApi } from '../../services/toolsApi'
import axios from 'axios'

export default {
  name: 'CredentialManager',
  props: {
    agentProfile: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const credentials = ref([])
    const loading = ref(true)
    const showAddModal = ref(false)
    const submitting = ref(false)
    const formError = ref('')
    const builtinScopes = ref([])
    const services = ref([])

    const form = ref({
      scopeType: 'builtin_tool',
      builtinTool: '',
      serviceId: '',
      credentialName: '',
      baseUrlOverride: '',
      credentials: {}
    })

    const selectedScope = computed(() => {
      if (!form.value.builtinTool) return null
      return builtinScopes.value.find(s => s.slug === form.value.builtinTool)
    })

    const resetForm = () => {
      form.value = {
        scopeType: 'builtin_tool',
        builtinTool: '',
        serviceId: '',
        credentialName: '',
        baseUrlOverride: '',
        credentials: {}
      }
      formError.value = ''
    }

    const openAddModal = () => {
      resetForm()
      showAddModal.value = true
    }

    const agentId = computed(() => props.agentProfile?.id)

    const loadCredentials = async () => {
      if (!agentId.value) return
      try {
        loading.value = true
        const response = await credentialsApi.list(agentId.value)
        credentials.value = response.data?.credentials || []
      } catch (error) {
        console.error('Failed to load credentials:', error)
      } finally {
        loading.value = false
      }
    }

    const loadBuiltinScopes = async () => {
      try {
        const response = await credentialsApi.getBuiltinScopes()
        builtinScopes.value = response.data?.scopes || []
      } catch (error) {
        console.error('Failed to load builtin scopes:', error)
      }
    }

    const loadServices = async () => {
      try {
        const response = await axios.get('/api/services/')
        services.value = response.data?.services || response.data || []
      } catch (error) {
        console.error('Failed to load services:', error)
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString()
    }

    const submitCredential = async () => {
      formError.value = ''

      if (!form.value.credentialName) {
        formError.value = 'Credential name is required'
        return
      }

      let payload = {}

      if (form.value.scopeType === 'builtin_tool') {
        if (!form.value.builtinTool) {
          formError.value = 'Please select a provider'
          return
        }
        // Validate required fields dynamically from scope definition
        if (selectedScope.value) {
          const requiredFields = selectedScope.value.credential_fields.filter(f => f.required)
          for (const field of requiredFields) {
            if (!form.value.credentials[field.name]) {
              formError.value = `${field.label} is required`
              return
            }
          }
        }
        payload = {
          builtin_tool: form.value.builtinTool,
          credential_name: form.value.credentialName,
          credentials: form.value.credentials
        }
      } else {
        if (!form.value.serviceId) {
          formError.value = 'Please select a service'
          return
        }
        payload = {
          service_id: form.value.serviceId,
          credential_name: form.value.credentialName,
          credentials: form.value.credentials,
          base_url_override: form.value.baseUrlOverride || undefined
        }
      }

      try {
        submitting.value = true
        await credentialsApi.create(agentId.value, payload)
        showAddModal.value = false
        await loadCredentials()
      } catch (error) {
        formError.value = error.response?.data?.error || error.message || 'Failed to create credential'
      } finally {
        submitting.value = false
      }
    }

    const testCredential = async (credential) => {
      try {
        const response = await credentialsApi.test(agentId.value, credential.id)
        const data = response.data
        alert(data.success ? 'Credential test successful!' : `Test failed: ${data.message || data.error}`)
        await loadCredentials()
      } catch (error) {
        alert('Credential test failed: ' + (error.response?.data?.error || error.message))
      }
    }

    const deleteCredential = async (credential) => {
      if (confirm(`Delete credential "${credential.credential_name}"?`)) {
        try {
          await credentialsApi.delete(agentId.value, credential.id)
          await loadCredentials()
        } catch (error) {
          alert('Failed to delete: ' + (error.response?.data?.error || error.message))
        }
      }
    }

    onMounted(() => {
      loadCredentials()
      loadBuiltinScopes()
      loadServices()
    })

    return {
      credentials,
      loading,
      showAddModal,
      submitting,
      formError,
      builtinScopes,
      services,
      form,
      selectedScope,
      openAddModal,
      formatDate,
      submitCredential,
      testCredential,
      deleteCredential
    }
  }
}
</script>
