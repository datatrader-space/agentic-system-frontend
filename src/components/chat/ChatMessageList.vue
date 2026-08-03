<template>
  <div ref="scrollEl" class="msg-list">
    <div class="msg-list-inner" role="log" aria-live="polite" aria-label="Conversation">
      <template v-for="m in chat.messages" :key="m.id">
        <ChatMessage
          :message="m"
          @retry="chat.retryLast()"
          @regenerate="chat.regenerate(m.id)"
          @edit="chat.editAndResend(m.id, $event)"
          @feedback="(value, detail) => chat.setFeedback(m.id, value, detail)"
        />
        <!-- Inline live plan artifact — the ONLY plan UI in chat. Rendered at its durable anchor,
             keyed by plan_id, in exact chronological place. Updates in place from pushed plan_event
             frames; no polling, no detached card. -->
        <template v-if="m.planArtifacts && m.planArtifacts.length">
          <div v-for="a in m.planArtifacts" :key="a.plan_id" class="msg-plan">
            <InlinePlanArtifact :run-id="a.run_id" :plan-id="a.plan_id" />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessage from './ChatMessage.vue'
import InlinePlanArtifact from '../plan/InlinePlanArtifact.vue'

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
/* Plan card aligned to the same centered content column as the message bubbles. It flows with the
   conversation (in chronological order) — no sticky/pinned behaviour. */
.msg-plan { max-width: 760px; margin: 0 auto 22px; }
</style>
