<template>
  <!-- The plan under review, read beside the chat (agentic-docs/PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): the Markdown file the
       agent wrote, rendered whole, as Claude's artifacts and ChatGPT's canvas show a document. The person answers it
       with a message in the chat; this pane only shows the plan. -->
  <section class="ppp" aria-labelledby="ppp-title" data-test="plan-preview">
    <header class="ppp-head">
      <Icon icon="lucide:clipboard-list" class="ppp-icon" aria-hidden="true" />
      <div class="ppp-titles">
        <h2 id="ppp-title" class="ppp-title">Plan</h2>
        <p v-if="review && review.path" class="ppp-path" :title="review.path" translate="no">{{ review.path }}</p>
      </div>
    </header>

    <div class="ppp-body" tabindex="0" aria-label="The plan">
      <!-- The plan file's own words, through the app's markdown renderer (untrusted: no raw HTML, safe links). -->
      <div v-if="html" class="ppp-doc md" data-test="ppp-content" v-html="html"></div>
      <p v-else class="ppp-empty">No plan to show yet.</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { renderUntrustedMarkdown } from '@/utils/safeMarkdown'
import { usePlanReviewStore } from '@/stores/usePlanReviewStore'

const props = defineProps({ conversationId: { type: [String, Number], default: null } })
const plans = usePlanReviewStore()
const review = computed(() => plans.forConversation(props.conversationId))
const html = computed(() => (review.value && review.value.content ? renderUntrustedMarkdown(review.value.content) : ''))
</script>

<style scoped>
.ppp { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface); color: var(--vm-ink); }
.ppp-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--vm-line-2); }
.ppp-icon { width: 18px; height: 18px; flex: 0 0 auto; color: var(--vm-violet); }
.ppp-titles { min-width: 0; flex: 1 1 auto; }
.ppp-title { margin: 0; font-size: 15px; font-weight: 650; color: var(--vm-ink); }
.ppp-path { margin: 2px 0 0; font: 12px var(--vm-font-mono); color: var(--vm-ink-soft); overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap; }
.ppp-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 16px 20px 28px; }
.ppp-body:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.ppp-doc { max-width: 72ch; font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; }
.ppp-doc :deep(h1) { font-size: 20px; margin: 4px 0 12px; }
.ppp-doc :deep(h2) { font-size: 17px; margin: 18px 0 8px; }
.ppp-doc :deep(h3) { font-size: 15px; margin: 14px 0 6px; }
.ppp-doc :deep(p) { margin: 0 0 10px; }
.ppp-doc :deep(ul), .ppp-doc :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.ppp-doc :deep(li) { margin: 3px 0; }
.ppp-doc :deep(pre) { overflow: auto; font-size: 13px; padding: 10px 12px; border-radius: 8px; background: var(--vm-surface-soft); }
.ppp-doc :deep(code) { font-size: 13px; }
.ppp-empty { margin: 0; font-size: 14px; color: var(--vm-ink-soft); }
@media (max-width: 640px) { .ppp-body { padding: 14px 16px 24px; } .ppp-doc { font-size: 16px; } }
</style>
