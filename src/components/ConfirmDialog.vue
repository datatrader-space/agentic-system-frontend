<!--
  Global confirm dialog host. Mounted ONCE in app.vue. Reads the shared
  confirmState singleton from useConfirm.js and resolves the pending promise
  when the user chooses. Replaces every native window.confirm() in the app.
-->
<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="state.open"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @keydown.esc.prevent="cancel"
      >
        <!-- backdrop -->
        <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-[1px]" @click="cancel"></div>

        <!-- dialog -->
        <div
          ref="panel"
          class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          role="alertdialog"
          aria-modal="true"
          :aria-label="state.title"
          tabindex="-1"
        >
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div
                class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                :class="state.danger ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'"
              >
                <svg v-if="state.danger" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-semibold text-gray-900">{{ state.title }}</h3>
                <p v-if="state.message" class="mt-1.5 text-sm text-gray-600 whitespace-pre-wrap break-words">{{ state.message }}</p>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button
              @click="cancel"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              {{ state.cancelText }}
            </button>
            <button
              ref="confirmBtn"
              @click="ok"
              class="px-4 py-2 text-sm font-semibold text-white rounded-lg"
              :class="state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
import { confirmState, _settleConfirm } from '../composables/useConfirm'

const state = confirmState
const panel = ref(null)
const confirmBtn = ref(null)

function ok() { _settleConfirm(true) }
function cancel() { _settleConfirm(false) }

function onKey(e) {
  if (!state.open) return
  if (e.key === 'Escape') { e.preventDefault(); cancel() }
  else if (e.key === 'Enter') { e.preventDefault(); ok() }
}

// Focus the confirm button when the dialog opens (keyboard + a11y).
watch(() => state.open, async (open) => {
  if (open) {
    await nextTick()
    if (confirmBtn.value) confirmBtn.value.focus()
  }
})

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.15s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>
