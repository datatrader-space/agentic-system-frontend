<template>
  <!-- Product-wide AI assistant: one FAB + one chat widget, mounted once in AppShell. -->
  <HelpAssistantWidget ref="widget" v-model:open="state.open" :current-page="currentPage" />
  <button class="gha-fab" :class="{ open: state.open }"
          :aria-label="state.open ? 'Close AI Assistant' : 'Ask the AI Assistant'"
          @click="toggle">
    <Icon :icon="state.open ? 'lucide:x' : 'lucide:message-circle'" />
  </button>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import HelpAssistantWidget from './HelpAssistantWidget.vue'
import { useHelpAssistant } from '../../composables/useHelpAssistant'

const route = useRoute()
const { state, close } = useHelpAssistant()
const widget = ref(null)

// A stable surface label for assistant logging/retrieval context.
const currentPage = computed(() => route.name?.toString() || route.path || 'app')

function toggle() { state.open ? close() : (state.open = true) }

// Any page can call openAssistant(q): bumping the nonce both opens the panel and (when a
// question is seeded) asks it imperatively — even if the panel was already open.
watch(() => state.nonce, async () => {
  state.open = true
  if (state.question) {
    await nextTick()
    widget.value?.ask(state.question)
    state.question = ''
  }
})
</script>

<style scoped>
.gha-fab {
  position: fixed; right: 30px; bottom: 28px; z-index: 95;
  display: grid; width: 56px; height: 56px; place-items: center;
  border: 0; border-radius: 999px; cursor: pointer;
  background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff;
  box-shadow: 0 18px 35px rgba(37, 99, 235, .28);
  transition: transform .15s ease, box-shadow .15s ease;
}
.gha-fab:hover { transform: translateY(-2px); box-shadow: 0 22px 40px rgba(37, 99, 235, .34); }
.gha-fab.open { background: #475569; box-shadow: 0 14px 28px rgba(15, 23, 42, .25); }
.gha-fab svg { width: 25px; height: 25px; }
@media (max-width: 520px) { .gha-fab { right: 16px; bottom: 18px; } }
</style>
