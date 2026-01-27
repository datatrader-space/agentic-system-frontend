<template>
  <div class="credential-manager h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900">Credential Manager</h2>
        <button
          @click="showAddModal = true"
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
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
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
              {{ credential.name }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {{ credential.credential_type }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ credential.service_name || 'All Services' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                :class="[
                  'px-2 py-1 text-xs font-semibold rounded-full',
                  credential.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                ]"
              >
                {{ credential.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ credential.last_used_at ? formatDate(credential.last_used_at) : 'Never' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
              <button
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

    <!-- Add Credential Modal (placeholder) -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 class="text-xl font-bold mb-4">Add Credential</h3>
        <p class="text-gray-600 mb-4">Credential form coming soon...</p>
        <button
          @click="showAddModal = false"
          class="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { credentialsApi } from '../../services/toolsApi'

export default {
  name: 'CredentialManager',
  props: {
    agentProfile: {
      type: Object,
      required: true
    }
  },
  setup() {
    const credentials = ref([])
    const loading = ref(true)
    const showAddModal = ref(false)

    const loadCredentials = async () => {
      try {
        loading.value = true
        const response = await credentialsApi.list()
        credentials.value = response.data || []
      } catch (error) {
        console.error('Failed to load credentials:', error)
      } finally {
        loading.value = false
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString()
    }

    const testCredential = async (credential) => {
      try {
        await credentialsApi.test(credential.id)
        alert('Credential test successful!')
      } catch (error) {
        alert('Credential test failed: ' + error.message)
      }
    }

    const deleteCredential = async (credential) => {
      if (confirm(`Delete credential "${credential.name}"?`)) {
        try {
          await credentialsApi.delete(credential.id)
          loadCredentials()
        } catch (error) {
          alert('Failed to delete: ' + error.message)
        }
      }
    }

    onMounted(() => {
      loadCredentials()
    })

    return {
      credentials,
      loading,
      showAddModal,
      formatDate,
      testCredential,
      deleteCredential
    }
  }
}
</script>
