// Durable-reconnect plan store (Planning Consolidation Phase 3).
//
// Holds normalized plan-view snapshots keyed by IMMUTABLE run_id (never by conversation alone),
// so one conversation can host multiple concurrent runs. On load/reconnect it hydrates from the
// authoritative snapshot API, then applies only NEWER events, deduplicating by event key and
// refetching the durable snapshot when a sequence gap or revision conflict is detected.
//
// Authority: in legacy/shadow coordinator modes the snapshot IS the authoritative legacy state;
// this store never reconstructs authoritative plan state from stream events alone.

import { defineStore } from 'pinia'
import api from '../services/api'
import { normalizeEvent, dedupKey, toFrontendType } from '../composables/planEvents'

// Module-level debounce timers (non-reactive) for conversation re-hydration.
const _hydrateTimers = {}

export const usePlanStore = defineStore('plan', {
  state: () => ({
    plansByRunId: {},              // run_id -> normalized plan-view snapshot
    activeRunIdsByConversation: {}, // conversation_id -> [run_id]
    latestSequenceByRunId: {},     // run_id -> last applied sequence/revision cursor
    hydrationStatusByRunId: {},    // run_id -> 'idle'|'loading'|'ready'|'stale'|'error'
    seenEventKeysByRunId: {},      // run_id -> Set(dedup_key)  (dedup)
    pendingActionByRunId: {},      // run_id -> bool (in-flight approval; prevents double submit)
  }),

  getters: {
    planFor: (s) => (runId) => s.plansByRunId[runId] || null,
    runsForConversation: (s) => (cid) => (s.activeRunIdsByConversation[String(cid)] || [])
      .map((rid) => s.plansByRunId[rid]).filter(Boolean),
    isHydrating: (s) => (runId) => s.hydrationStatusByRunId[runId] === 'loading',
    isActionPending: (s) => (runId) => !!s.pendingActionByRunId[runId],
  },

  actions: {
    _track(cid, runId) {
      if (cid == null) return
      const key = String(cid)
      const list = this.activeRunIdsByConversation[key] || []
      if (!list.includes(runId)) this.activeRunIdsByConversation[key] = [...list, runId]
    },

    _seen(runId) {
      if (!this.seenEventKeysByRunId[runId]) this.seenEventKeysByRunId[runId] = new Set()
      return this.seenEventKeysByRunId[runId]
    },

    // ── hydration (durable snapshot) ───────────────────────────────────────────────
    async hydrateConversation(conversationId) {
      try {
        const res = await api.get(`/run-coordinator/conversations/${conversationId}/runs/`)
        const runs = res.data?.runs || []
        for (const r of runs) await this.hydrateRun(r.run_id)
        return runs
      } catch (e) {
        return []
      }
    },

    async hydrateRun(runId) {
      this.hydrationStatusByRunId[runId] = 'loading'
      try {
        const res = await api.get(`/run-coordinator/runs/${encodeURIComponent(runId)}/plan/`, { noCache: true })
        const snap = res.data
        this._applySnapshot(snap)
        return snap
      } catch (e) {
        this.hydrationStatusByRunId[runId] = 'error'
        return null
      }
    },

    _applySnapshot(snap) {
      if (!snap || !snap.run_id) return
      const runId = snap.run_id
      this.plansByRunId[runId] = snap
      this.latestSequenceByRunId[runId] = snap.latest_sequence ?? snap.revision ?? 0
      this.hydrationStatusByRunId[runId] = 'ready'
      this._track(snap.conversation_id, runId)
    },

    // ── event application (replay only newer, dedup, gap → refetch) ─────────────────
    // Returns 'applied' | 'duplicate' | 'gap' | 'ignored'. On 'gap' it triggers a refetch.
    applyEvent(rawEvent, runId = null) {
      const evt = normalizeEvent(rawEvent, runId)
      if (!evt || !evt.run_id) return 'ignored'
      const rid = evt.run_id
      const seen = this._seen(rid)
      const key = evt.dedup_key || dedupKey(evt)
      if (seen.has(key)) return 'duplicate'

      const cursor = this.latestSequenceByRunId[rid] ?? 0
      const seq = evt.sequence_number
      // Sequence-gap detection: a jump beyond cursor+1 means we missed events → rehydrate.
      if (seq != null && seq > cursor + 1 && this.hydrationStatusByRunId[rid] === 'ready') {
        this.hydrationStatusByRunId[rid] = 'stale'
        this.hydrateRun(rid)
        return 'gap'
      }
      // Older/equal events are ignored (snapshot already reflects them).
      if (seq != null && seq <= cursor) { seen.add(key); return 'duplicate' }

      seen.add(key)
      this._reduce(rid, evt)
      if (seq != null) this.latestSequenceByRunId[rid] = seq
      return 'applied'
    },

    // Minimal optimistic reducer for live UX. The durable snapshot remains the source of truth;
    // a subsequent hydrate reconciles. Never invents authoritative state from events alone.
    _reduce(runId, evt) {
      const plan = this.plansByRunId[runId]
      if (!plan) return
      const p = { ...plan }
      switch (evt.event_type) {
        case 'plan_approval_required': p.plan_status = 'pending_approval'; p.approval_status = 'pending'; break
        case 'plan_approved': p.plan_status = 'executing'; p.approval_status = 'approved'; p.execution_allowed = true; p.available_actions = []; break
        case 'plan_changes_requested': p.plan_status = 'changes_requested'; p.approval_status = 'changes_requested'; break
        case 'plan_rejected': p.plan_status = 'rejected'; p.approval_status = 'rejected'; p.available_actions = []; break
        case 'plan_step_started': this._setStep(p, evt.step_id, 'started'); break
        case 'plan_step_completed': this._setStep(p, evt.step_id, 'completed'); break
        case 'plan_step_failed': this._setStep(p, evt.step_id, 'failed', evt.payload?.reason); break
        case 'run_paused': p.plan_status = 'paused'; break
        case 'run_resumed': p.plan_status = 'executing'; break
        case 'run_completed': p.plan_status = 'completed'; break
        case 'run_failed': p.plan_status = 'failed'; break
        case 'run_cancelled': p.plan_status = 'cancelled'; break
        default: break
      }
      this.plansByRunId[runId] = p
    },

    _setStep(plan, stepId, status, failure) {
      if (!stepId || !Array.isArray(plan.steps)) return
      plan.steps = plan.steps.map((s) => (s.step_id === stepId
        ? { ...s, status, failure_summary: failure || s.failure_summary } : s))
      plan.completed_step_count = plan.steps.filter((s) => s.status === 'completed').length
      const next = plan.steps.find((s) => s.status !== 'completed' && s.status !== 'skipped')
      plan.current_step_id = next ? next.step_id : null
    },

    // ── WS event entry point (from the chat store's event router) ──────────────────
    // Applies the event when it carries a run_id; otherwise (legacy events without run_id) the
    // durable snapshot stays authoritative and we debounce-refetch the conversation's runs.
    ingestWsEvent(msg, conversationId) {
      if (!toFrontendType(msg?.type || msg?.event || msg?.event_type)) return 'ignored'
      if (msg?.run_id) return this.applyEvent(msg, msg.run_id)
      if (conversationId != null) this._scheduleHydrate(conversationId)
      return 'hydrate_scheduled'
    },

    _scheduleHydrate(conversationId, delay = 400) {
      const key = String(conversationId)
      if (_hydrateTimers[key]) clearTimeout(_hydrateTimers[key])
      _hydrateTimers[key] = setTimeout(() => {
        delete _hydrateTimers[key]
        this.hydrateConversation(conversationId)
      }, delay)
    },

    // ── approval actions (delegate to backend; conflict → refresh snapshot) ─────────
    async decide(runId, decision, { comment = '' } = {}) {
      if (this.pendingActionByRunId[runId]) return { ok: false, status: 'busy' }
      const plan = this.plansByRunId[runId]
      this.pendingActionByRunId[runId] = true
      try {
        const res = await api.post(`/run-coordinator/runs/${encodeURIComponent(runId)}/decision/`, {
          decision,
          expected_revision: plan?.revision,
          plan_version_id: plan?.plan_version_id,
          idempotency_key: `${runId}:${decision}:${plan?.revision}`,
          comment,
        })
        if (res.data?.plan_view) this._applySnapshot(res.data.plan_view)
        return res.data
      } catch (e) {
        // 409 conflict → refresh the durable snapshot rather than silently applying
        if (e?.response?.status === 409 && e.response.data?.plan_view) {
          this._applySnapshot(e.response.data.plan_view)
        } else {
          await this.hydrateRun(runId)
        }
        return { ok: false, status: e?.response?.status === 409 ? 'conflict' : 'error',
          conflict: e?.response?.status === 409, detail: e?.response?.data?.detail || 'request failed' }
      } finally {
        this.pendingActionByRunId[runId] = false
      }
    },

    reset() {
      this.plansByRunId = {}
      this.activeRunIdsByConversation = {}
      this.latestSequenceByRunId = {}
      this.hydrationStatusByRunId = {}
      this.seenEventKeysByRunId = {}
      this.pendingActionByRunId = {}
    },
  },
})
