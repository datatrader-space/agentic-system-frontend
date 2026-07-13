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
      <!-- Plan lives INLINE in the conversation (Claude-style), aligned to the same 760px content
           column. While the run is active it PINS just above the composer so it stays visible and its
           steps tick in place instead of drifting down and hiding as new step-messages arrive; once
           the turn finishes it settles back into the normal scroll flow. -->
      <UnifiedPlanTimeline :conversation-id="chat.conversationId"
        class="msg-plan" :class="{ 'msg-plan--live': chat.isStreaming }" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessage from './ChatMessage.vue'
import UnifiedPlanTimeline from '../plan/UnifiedPlanTimeline.vue'

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
/* Plan card aligned to the same centered content column as the message bubbles. */
.msg-plan { max-width: 760px; margin: 0 auto 22px; }
/* While a run streams, pin the plan just above the composer so it stays visible and ticks in place
   instead of scrolling off. It un-pins (normal flow) once the turn ends. Capped so a long plan
   scrolls internally rather than covering the whole thread. */
.msg-plan--live {
  position: sticky;
  bottom: 8px;
  z-index: 2;
  max-height: 45vh;
  overflow-y: auto;
}
</style>
