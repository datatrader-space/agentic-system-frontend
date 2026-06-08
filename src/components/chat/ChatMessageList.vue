<template>
  <div ref="scrollEl" class="msg-list">
    <div class="msg-list-inner" role="log" aria-live="polite" aria-label="Conversation">
      <ChatMessage
        v-for="m in chat.messages"
        :key="m.id"
        :message="m"
        @retry="chat.retryLast()"
        @regenerate="chat.regenerate(m.id)"
        @edit="chat.editAndResend(m.id, $event)"
        @feedback="chat.setFeedback(m.id, $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessage from './ChatMessage.vue'

const chat = useChatStore()
const scrollEl = ref(null)

const scrollToBottom = () => {
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

// Track the streaming tail length so we follow tokens as they arrive.
const lastLen = computed(() => {
  const m = chat.messages[chat.messages.length - 1]
  return m ? (m.content || '').length : 0
})

watch(
  () => [chat.messages.length, lastLen.value],
  () => nextTick(scrollToBottom)
)

onMounted(() => nextTick(scrollToBottom))
</script>

<style scoped>
.msg-list {
  height: 100%;
  overflow-y: auto;
}
.msg-list-inner {
  padding: 28px 16px 16px;
}
</style>
