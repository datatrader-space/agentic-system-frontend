// The plan the agent gave for review in plan mode (agentic-docs/PLAN_REVIEW_LIKE_CLAUDE_PLAN.md).
//
// Like Claude Code's plan mode and Claude's artifacts / ChatGPT's canvas: the run pauses on one short card in the
// conversation, and the plan itself (the Markdown file the agent wrote) is read BESIDE the chat, rendered. This store
// holds that plan for the side panel (the chat's Plan tab, or Let's Code's editor preview) and remembers the person's
// answer for the one-line note the card leaves behind. After the answer the plan's progress is the task list's alone.
import { defineStore } from 'pinia'

export const usePlanReviewStore = defineStore('planReview', {
  state: () => ({
    // { requestId, runId, conversationId, path, content, steps: [description], answer: '' } or null.
    review: null,
    // The side panel shows the plan.
    open: false,
  }),
  getters: {
    // The plan of THIS conversation, or null: a plan never shows in another chat.
    forConversation: (s) => (conversationId) => (s.review && conversationId != null
      && String(s.review.conversationId) === String(conversationId) ? s.review : null),
  },
  actions: {
    // A plan_approval card arrived (or was loaded). A new plan (a new request) replaces the last one, its answer
    // cleared; the same request again changes nothing. `openPanel`: open the side panel with it.
    show(request, conversationId, { openPanel = false } = {}) {
      const payload = (request && request.payload) || {}
      const requestId = request && request.request_id
      if (!requestId) return
      if (!this.review || this.review.requestId !== requestId) {
        const file = payload.plan_file || {}
        this.review = {
          requestId,
          // The run that gave the plan: an older plan frame of the same run is not a second card (useChatStore).
          runId: String(payload.run_id || ''),
          conversationId: conversationId == null ? null : String(conversationId),
          path: String(file.path || ''),
          content: String(file.content || ''),
          steps: (Array.isArray(payload.steps) ? payload.steps : [])
            .map((s) => String((s && s.description) || '').trim()).filter(Boolean),
          answer: '',
        }
        if (openPanel) this.open = true
      }
    },
    // The person answered this plan's card: the card becomes one line saying so.
    answered(requestId, answer) {
      if (this.review && this.review.requestId === requestId) this.review = { ...this.review, answer: String(answer || '') }
    },
    openPanel() { if (this.review) this.open = true },
    closePanel() { this.open = false },
    clear() { this.review = null; this.open = false },
  },
})
