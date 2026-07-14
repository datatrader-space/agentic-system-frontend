<template>
  <div ref="scrollEl" class="msg-list">
    <div class="msg-list-inner" role="log" aria-live="polite" aria-label="Conversation">
      <template v-for="m in chat.messages" :key="m.id">
        <ChatMessage
          :message="m"
          @retry="chat.retryLast()"
          @regenerate="chat.regenerate(m.id)"
          @edit="chat.editAndResend(m.id, $event)"
          @feedback="chat.setFeedback(m.id, $event)"
        />
        <!-- Inline plan artifact (durable-anchor path): render the plan card(s) this message introduced,
             keyed by plan_id, in exact chronological place. Active only when the feature is on AND the
             message carries a durable anchor. -->
        <template v-if="useDurable && m.planArtifacts && m.planArtifacts.length">
          <div v-for="a in m.planArtifacts" :key="a.plan_id" class="msg-plan">
            <InlinePlanArtifact :run-id="a.run_id" :plan-id="a.plan_id" />
          </div>
        </template>
        <!-- Legacy path: the detached card anchored via the runtime anchor id (fallback, unchanged). -->
        <div v-else-if="!useDurable && anchorInMessages && String(m.id) === String(anchorId)" class="msg-plan">
          <UnifiedPlanTimeline :conversation-id="chat.conversationId" />
        </div>
      </template>
      <!-- Legacy fallback: no anchored assistant message in view → render the card at the end so it is
           never lost. Not used on the durable-anchor path (anchors are always in the message stream). -->
      <div v-if="!useDurable && !anchorInMessages" class="msg-plan">
        <UnifiedPlanTimeline :conversation-id="chat.conversationId" />
      </div>
      <!-- Compact progress line — surfaces at the bottom each time a step completes (or the plan
           finishes), so you see progress without scrolling. Click to jump to the full card in history. -->
      <button v-if="planProgress && planProgress.done > 0" type="button"
              class="msg-plan-progress" :class="{ done: planProgress.done >= planProgress.total }"
              @click="scrollToPlan">
        <span class="mpp-check" aria-hidden="true">✓</span>
        <span class="mpp-text">{{ progressLabel }}</span>
        <span class="mpp-count">{{ planProgress.done }}/{{ planProgress.total }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import { usePlanStore } from '../../stores/usePlanStore'
import ChatMessage from './ChatMessage.vue'
import UnifiedPlanTimeline from '../plan/UnifiedPlanTimeline.vue'
import InlinePlanArtifact from '../plan/InlinePlanArtifact.vue'

const chat = useChatStore()
const plan = usePlanStore()

// Durable-anchor path (inline plan artifact) vs the legacy detached-card path. Driven by the store
// getter, which is true only when the feature flag is on AND the loaded history carries plan anchors.
const useDurable = computed(() => chat.hasDurablePlanAnchors)
const scrollEl = ref(null)

// Where the plan card renders: right after the assistant message that created it. When that anchor
// isn't among the loaded messages, fall back to rendering the card at the end (exactly one instance).
const anchorId = computed(() => chat.planAnchorMsgId)
const anchorInMessages = computed(() =>
  anchorId.value != null && chat.messages.some((m) => String(m.id) === String(anchorId.value)))

const planProgress = computed(() => plan.progressForConversation(chat.conversationId))
const progressLabel = computed(() => {
  const p = planProgress.value
  if (!p) return ''
  if (p.done >= p.total) return 'Plan complete'
  return p.lastTitle ? `Step done — ${p.lastTitle}` : 'Step done'
})

function scrollToPlan() {
  const el = scrollEl.value && scrollEl.value.querySelector('.msg-plan')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

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

/* Compact progress line that surfaces at the bottom on each step completion. */
.msg-plan-progress {
  display: flex; align-items: center; gap: 8px;
  max-width: 760px; margin: 0 auto 18px; width: 100%;
  padding: 8px 12px; border: 1px solid var(--vm-border, #e5e7eb); border-radius: 10px;
  background: var(--vm-bg-soft, #f8fafc); color: var(--vm-text-2, #374151);
  font-size: 0.82rem; text-align: left; cursor: pointer;
}
.msg-plan-progress:hover { background: var(--vm-bg-hover, #eef2f7); }
.msg-plan-progress .mpp-check { color: #1a7f3c; font-weight: 700; }
.msg-plan-progress.done { border-color: #ABEFC6; background: #E6F7EE; color: #027A48; }
.msg-plan-progress .mpp-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-plan-progress .mpp-count { font-variant-numeric: tabular-nums; font-weight: 600; opacity: 0.8; }
</style>
