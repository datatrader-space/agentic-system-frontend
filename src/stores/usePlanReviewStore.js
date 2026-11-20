// The plan the agent gave for review in plan mode (agentic-docs/PLAN_REVIEW_LIKE_CLAUDE_PLAN.md).
//
// As in ChatGPT and Claude, the plan is a message in the chat: the agent's short overview and the plan file it wrote,
// drawn as a file card (`model_info.plan_file`, the live `plan_ready` frame). The person reads the file BESIDE the
// chat, rendered (the chat's Plan tab, or Let's Code's editor preview), and answers with their next message. This store
// holds the plan shown there.
import { defineStore } from 'pinia'

export const usePlanReviewStore = defineStore('planReview', {
  state: () => ({
    // { key, runId, conversationId, path, content } or null.
    review: null,
    // The side panel shows the plan.
    open: false,
    // The person asked to see it (the file card), rather than it opening by itself: a surface whose plan shares one
    // pane with the chat (Let's Code) brings it to the front only then, so the chat stays in view.
    focus: false,
  }),
  getters: {
    // The plan of THIS conversation, or null: a plan never shows in another chat.
    forConversation: (s) => (conversationId) => (s.review && conversationId != null
      && String(s.review.conversationId) === String(conversationId) ? s.review : null),
  },
  actions: {
    // A plan file to show (a message's `plan_file`). Another plan replaces the last one; the same plan again changes
    // nothing. `openPanel`: open the side panel with it (it opened by itself).
    show(planFile, conversationId, { openPanel = false } = {}) {
      const file = planFile || {}
      const path = String(file.path || '')
      if (!path) return
      const key = String(file.plan_version_id || '') + ':' + path
      if (!this.review || this.review.key !== key) {
        this.review = {
          key,
          // The run that gave the plan: the run's older plan frame for it is not a second plan (useChatStore).
          runId: String(file.run_id || ''),
          conversationId: conversationId == null ? null : String(conversationId),
          path,
          content: String(file.content || ''),
        }
      }
      if (openPanel) { this.open = true; this.focus = false }
    },
    openPanel() { if (this.review) { this.open = true; this.focus = true } },
    closePanel() { this.open = false; this.focus = false },
    clear() { this.review = null; this.open = false; this.focus = false },
  },
})
