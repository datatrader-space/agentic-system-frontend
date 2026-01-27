<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="$router.push('/services')"
              class="text-gray-500 hover:text-gray-700"
            >
              ← Back to Services
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-white rounded-lg shadow-lg">
        <ServiceRegistrationWizard @registered="handleRegistered" />
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import ServiceRegistrationWizard from '../components/services/ServiceRegistrationModal.vue'

export default {
  name: 'ServiceRegistration',
  components: {
    ServiceRegistrationWizard
  },
  setup() {
    const router = useRouter()

    const handleRegistered = () => {
      router.push('/services')
    }

    return {
      handleRegistered
    }
  }
}
</script>
