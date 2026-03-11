<template>
  <div v-if="showFilter" class="owner-filter flex items-center gap-2">
    <label class="text-sm font-medium text-gray-600 whitespace-nowrap">Owner:</label>
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button
        @click="select('')"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
          modelValue === ''
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        ]"
      >
        All
      </button>
      <button
        @click="select('me')"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
          modelValue === 'me'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        ]"
      >
        Mine
      </button>
      <select
        v-if="otherMembers.length > 0"
        :value="isSpecificMember ? modelValue : ''"
        @change="select($event.target.value)"
        class="px-2 py-1.5 text-xs font-medium rounded-md bg-transparent border-none
               text-gray-500 hover:text-gray-700 cursor-pointer focus:ring-0 focus:outline-none"
        :class="{ 'bg-white shadow-sm !text-indigo-700': isSpecificMember }"
      >
        <option value="" disabled>Member…</option>
        <option
          v-for="m in otherMembers"
          :key="m.user"
          :value="String(m.user)"
        >
          {{ m.username || m.email }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useWorkspace } from '../../composables/useWorkspace'
import tenancyApi from '../../services/tenancyApi'
import api from '../../services/api'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const { activeOrg } = useWorkspace()
const members = ref([])
const currentUserId = ref(null)
const myRole = ref(null)

// Show filter for everyone so they can toggle All/Mine
const showFilter = computed(() => true)

// Other members to show in dropdown (excluding self)
const otherMembers = computed(() => {
  if (!currentUserId.value) return members.value
  return members.value.filter(m => m.user !== currentUserId.value)
})

const isSpecificMember = computed(() => {
  return props.modelValue !== '' && props.modelValue !== 'me'
})

function select(val) {
  emit('update:modelValue', val)
}

async function loadMembers() {
  if (!activeOrg.value?.slug) return
  try {
    // Load current user ID if not yet known
    if (!currentUserId.value) {
      const meRes = await api.getCurrentUser()
      currentUserId.value = meRes.data?.user?.id ?? meRes.data?.id ?? null
    }
    
    // Only fetch other members if we are an owner or admin (or we don't know yet)
    // Actually, getOrgMembers requires owner/admin. Let's try it, and if it fails (403), we just catch it.
    const r = await tenancyApi.getOrgMembers(activeOrg.value.slug)
    const allMembers = r.data?.results ?? r.data ?? []
    members.value = allMembers
    
    const me = allMembers.find(m => m.user === currentUserId.value)
    myRole.value = me?.role ?? null
  } catch (e) {
    // 403 Forbidden is expected for normal members
    if (e.response && e.response.status !== 403) {
      console.error('Failed to load org members for filter', e)
    }
  }
}

onMounted(() => loadMembers())
watch(() => activeOrg.value?.slug, () => {
  // Reset filter when org changes
  emit('update:modelValue', '')
  loadMembers()
})
</script>
