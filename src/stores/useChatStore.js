// Pinia store — real chat thread + session history (Phase 2 backend wiring).
//
// Flow: pick an Agent Profile → first message starts a conversation
// (POST /agents/<id>/chat/) → live tokens stream over the chat WebSocket
// (ChatConnection). History loads via GET /conversations/.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { ChatConnection } from '../services/chatService'
import { useCanvasStore } from './useCanvasStore'
import { useArtifactsStore } from './useArtifactsStore'
import { usePlanStore } from './usePlanStore'
import { useAgentTimeline, isRichEvent } from '../composables/useAgentTimeline'
import { ensureNotifyPermission, notifyRunFinished } from '../composables/useRunNotifications'
import { stripThinkBlocks, ThinkStreamFilter } from '../utils/thinkFilter'
import { resumeStatusLine } from '../utils/resumeStatus'

// One shared live timeline for the currently-streaming assistant message (only one streams at a time).
// Reset per turn, snapshotted onto the message on completion — the SAME reducer the Emulator uses, so
// New Chat shows the identical friendly, param-free activity (Searching → Generating) instead of raw tool I/O.
const _tl = useAgentTimeline()
const _think = new ThinkStreamFilter()

let _seq = 0
const nid = () => `m${++_seq}`

// §4b: streaming-content events stamped with the server's per-turn (turn_id, message_id). Used by the
// stale/interrupted-stream guard in _onEvent to ignore events from a superseded turn.
const STREAM_ID_TYPES = new Set([
  'assistant_message_chunk', 'assistant_message_complete', 'tool_result', 'tool_call',
])

// Frames a headless Work-mode iteration forwards through the shared `user_<id>` group. Must match
// `_WORK_STREAM_TYPES` in agent/headless_consumer.py — each one names its conversation so _onEvent can
// drop anything meant for a different tab.
const WORK_FORWARDED_TYPES = new Set([
  'assistant_message_chunk', 'assistant_message_complete', 'reasoning_delta', 'reasoning_done',
  'tool_call', 'tool_result', 'tool_blocked', 'work_segment', 'work_goal', 'error',
  // The activity timeline (useAgentTimeline's RICH_EVENT_TYPES) plus the live token counter. Without
  // these a later iteration rendered no timeline at all and fell back to the bare plan-progress line,
  // so the same run showed two different interfaces depending on which iteration you were watching.
  'agent_status', 'agent_step_started', 'agent_step_completed', 'agent_step_failed',
  'source_citation', 'agent_turn_summary', 'token_usage',
])

function pickArray(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.results)) return d.results
  return []
}

// One page of chat history. Deliberately small: the drawer opens on the recent page and pulls older
// ones on demand, so a user with hundreds of chats doesn't pay for all of them to open a chat.
const HISTORY_PAGE_SIZE = 25

// DRF PageNumberPagination reports the full total in `count`. An unpaginated (bare-array) response
// has no total — fall back to what we hold, which reads as "nothing more to load".
function countOf(d, loaded) {
  return d && typeof d.count === 'number' ? d.count : loaded
}

// Append a page, dropping ids we already hold. A conversation bumped to the top by new activity
// between two page fetches would otherwise arrive twice and duplicate a row.
function mergeById(current, incoming) {
  const seen = new Set(current.map((s) => String(s.id)))
  return current.concat(incoming.filter((s) => !seen.has(String(s.id))))
}

//: Where the user's Chat/Work PIN is remembered. Versioned on purpose — see the read below: the
//: unversioned key held a default, not a decision, and treating the two alike suppressed Work mode
//: for everyone who had ever used the old switch.
const TURN_MODE_KEY = 'aadml.turnMode.v2'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isStreaming: false,
    conversationId: null,
    repoId: 0,

    // Create-Image mode (per-turn signal, sticky in the composer). When on, the backend runs the agent as
    // a focused image generation/editing assistant (image toolset + guided pipeline prompt). Sent as
    // `image_mode` on each WS message while on. Requires the agent to have an image model (composer blocks
    // the toggle otherwise).
    imageMode: false,
    // AUTO IS THE DEFAULT, AND AUTO IS NOT A THIRD BEHAVIOUR — it is the absence of an override.
    //
    // The backend has always decided this: `_freeze_work_goal` opens a Work goal when the Brain's
    // single semantic call proposes one, and the composer's control only OVERRIDES that decision in
    // one direction or the other. This store defaulted to 'chat' and sent nothing for it, so the
    // default silently meant auto while the switch drew "Chat" as a deliberate choice -- and picking
    // Chat explicitly was indistinguishable from not choosing, which made the suppression branch in
    // `_freeze_work_goal` unreachable from the UI. Someone who said "just answer me" could still be
    // handed an hours-long run. Naming the default is what makes the other two mean something.
    turnMode: (() => {
      try {
        // THE LEGACY KEY IS NOT A CHOICE, AND READING IT AS ONE BROKE AUTO FOR EVERY EXISTING USER.
        //
        // Before Auto existed this store defaulted `turnMode` to 'chat' and PERSISTED it on every
        // setTurnMode call -- but the send site only ever transmitted 'work', so a stored 'chat' meant
        // "send nothing", which is precisely what Auto means today. Once 'chat' became a real override
        // that value turned into a pin nobody had set: production logged "the user chose 'chat' for
        // this turn" on EVERY turn, and `_freeze_work_goal` returned before the Brain's proposal was
        // ever looked at. A wall-detection task that should have opened a work goal never got the
        // chance, and the switch looked correct the whole time.
        //
        // A new key is the fix rather than a migration guess: a value written under `.v2` can only
        // have come from a deliberate click on this control. The old key is dropped so it cannot be
        // re-read by any later version either.
        try { localStorage.removeItem('aadml.turnMode') } catch (_e) { /* private mode */ }
        const v = localStorage.getItem(TURN_MODE_KEY)
        return (v === 'work' || v === 'chat') ? v : 'auto'
      } catch (_e) { return 'auto' }
    })(),
    // Per-turn REASONING EFFORT ('' = no choice, use the agent's own setting). How hard the model should
    // think about THIS message — the backend allow-lists the value and maps 'off' to no reasoning at all.
    // Sticky across turns so a user who wants deep thinking does not re-pick it every message.
    reasoningEffort: '',

    // Share sheet (ShareModal). `shareAnchorId` is a message's DB pk when the sheet was opened from a
    // specific message — the snapshot is then cut at that message ("share up to here").
    shareOpen: false,
    shareAnchorId: null,

    // Human-in-the-loop approval queue (tools the backend gated for approval + the max-steps
    // pause-and-ask). Rendered by HITLModal.
    hitlRequests: [],
    // True while ≥1 approval card is pending. Keeps the turn "active" (not "Done") so the card + Stop
    // stay visible even if the task/CRS path emitted a premature completion for the step-0 text.
    awaitingApproval: false,
    // True while a multi-step TASK/CRS run is in progress. Such a run streams an assistant_message_complete
    // after EVERY ReAct step, so the turn must NOT end on those — only on the run's terminal
    // agent_session_complete / agent_event session_complete.
    _taskRunActive: false,

    // ── Work mode: a run that keeps going in bounded ITERATIONS ────────────────────────────────────
    // A Work run is N separate dispatches. Iteration 1 executes on this socket; every later one is a
    // Celery task resuming the same durable plan, and each ends with its OWN assistant_message_complete.
    // With no other signal the turn ended on the first of those: the stop button vanished, the timeline
    // said done, and the run carried on working for another ten minutes (production conv 1529, three
    // iterations). `_workRunActive` keeps the RUN busy across those boundaries while each iteration
    // still closes its own bubble, so the answers stay separate and the composer stays honest.
    //
    // It is deliberately NOT reset in _beginAssistant: a later iteration's first chunk opens a new
    // bubble, and clearing the flag there would undo the announcement that had just arrived. It belongs
    // to the run, so it is cleared when the run closes (work_goal) or when the user starts a new one.
    workIteration: null,     // { segment, max } while a Work run is in flight, else null
    workGoal: null,          // { state, segments, max, findings } once the run's goal closes
    _workRunActive: false,

    // Once-guard: event_ids of plan DECISION events (approved / changes_requested / cancelled) already
    // bridged to a resume. The canonical outbox may re-deliver a plan_event (sweeper / reconnect), so
    // this prevents an approved run from being re-sent (and re-executed) more than once.
    _resolvedDecisionEventIds: new Set(),

    // Legacy native plan-mode WS approval signal (vestigial). The unified plan UI now handles
    // approval via the run-coordinator API (UnifiedPlanCard); this field feeds the low-level WS
    // resume mechanic only and is removed when that loop is internalized into the coordinator.
    pendingPlan: null,
    // Full-document cost gate (manual / plan-review): a complete-mode KB scope overflowed the model
    // window. Holds { conversationId, question, cost, actions } while the user decides; cleared on resolve.
    fullDocCostGate: null,

    // Staged attachments (images/files) to send with the next message. Each:
    // { file: File, name, isImage, url }. Uploaded to the conversation on send; the backend
    // auto-attaches recent images to the vision model.
    pendingAttachments: [],

    // Agent selection
    agents: [],
    selectedAgentId: null,
    agentsLoaded: false,
    agentsLoading: false,
    // In-flight /agents/ request shared by EVERY concurrent loadAgents() caller. The old dedup was a
    // bare `if (agentsLoading) return` — the second caller resolved IMMEDIATELY against a possibly
    // still-empty `agents`, which is exactly the race that made New Chat mount with no agents.
    _agentsPromise: null,
    _chattablePromise: null,        // single-flight for loadChattableAgents()

    // Chat history for the CURRENTLY selected agent (history drawer default scope).
    // Paginated: the drawer opens on the most recent page and pulls older ones on demand.
    sessions: [],
    sessionsLoading: false,      // first page (drives skeletons)
    sessionsLoadingMore: false,  // subsequent pages (drives the Load-more button)
    sessionsPage: 0,             // highest page loaded
    sessionsTotal: 0,            // server-reported total, for "N older"
    _sessionsAgentId: null,      // agent the cached `sessions` list belongs to — cache key
    _sessionsAt: 0,              // last successful fetch (ms) — TTL cache

    // Global chat history across ALL agents (search modal + the drawer's "All agents" scope)
    allSessions: [],
    allSessionsLoading: false,
    allSessionsLoadingMore: false,
    allSessionsPage: 0,
    allSessionsTotal: 0,
    _allSessionsAt: 0,   // last successful fetch (ms) — drives the TTL cache below

    loadingHistory: false,
    // Message windowing: the conversation endpoint returns the most recent page; these drive the
    // "Load earlier messages" affordance at the top of the thread.
    messagesHasMore: false,
    messagesTotal: 0,
    loadingOlder: false,
    error: '',

    _conn: null,
    _assistantId: null,
    // setInterval handle for the resumed-turn progress poll (see _startProgressPolling).
    _progressTimer: null,
    //: When a frame last arrived from the server, and the watchdog that notices when they stop.
    //: A socket can die WITHOUT onClose/onError — a server restart whose FIN never reaches the browser,
    //: or a half-open connection — and then nothing on this page ever learns the turn finished.
    _lastFrameAt: 0,
    _deafTimer: null,
  }),
  getters: {
    isEmpty: (s) => s.messages.length === 0,
    // WHAT THE LAST TURN ACTUALLY RAN AS — 'work', 'chat', or '' when nothing has run yet or the
    // thread predates the server stamp. Reported by the backend after the Brain's proposal and any
    // user override have both been applied, so it is the outcome, never the intent: with the switch on
    // Auto the intent is deliberately "no opinion", and only this can say what came of it.
    lastResolvedMode: (s) => {
      for (let i = s.messages.length - 1; i >= 0; i -= 1) {
        const m = s.messages[i]
        if (m && m.role === 'assistant' && m.turnModeResolved) return m.turnModeResolved
      }
      return ''
    },
    // Inline plan artifact: true when the loaded history carries durable plan anchors. Drives the
    // active-plan chip near the composer (the plan card itself always renders inline at its anchor).
    hasDurablePlanAnchors: (s) =>
      s.messages.some((m) => Array.isArray(m.planArtifacts) && m.planArtifacts.length > 0),
    // True once we know the user has zero agents — drives the "create an agent first"
    // empty state and the disabled composer on the welcome screen.
    needsAgent: (s) => s.agentsLoaded && s.agents.length === 0,
    currentAgent: (s) =>
      s.agents.find((a) => String(a.id) === String(s.selectedAgentId)) || null,
    // SHARED system-owned agents (built-ins incl. the Platform Super Agent): the chat shows a fixed
    // agent identity + a MODEL picker (each user runs them on their own provider) instead of the
    // per-agent mode pill (their run mode is admin-set globally).
    isSharedAgent() {
      const a = this.currentAgent
      return !!(a && (a.is_platform_super_agent || a.is_builtin_agent))
    },
    // History pagination: is there an older page left to pull? Compared against the server's total
    // rather than a `next` URL so it stays right even when rows are appended locally.
    hasMoreSessions: (s) => s.sessions.length < s.sessionsTotal,
    hasMoreAllSessions: (s) => s.allSessions.length < s.allSessionsTotal,
    // Running session totals (this chat). Prefer a turn's EXACT completed usage; while a turn is
    // still streaming, fall back to the live timeline token counter so the footer ticks up mid-run
    // and finalises exactly. Turns with neither contribute 0; auto-resets when messages clear.
    sessionTokens: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.total_tokens)
           || (m.status === 'streaming' && _tl.tokens.value && _tl.tokens.value.total) || 0), 0),
    sessionCost: (s) => s.messages.reduce((a, m) =>
      a + ((m.usage && m.usage.cost_usd)
           || (m.status === 'streaming' && _tl.tokens.value && _tl.tokens.value.cost) || 0), 0),

    //: True while the RUN is working, which is not the same as "this bubble is streaming". A Work run
    //: keeps going across iteration boundaries, and between them nothing is streaming at all — the
    //: previous iteration has closed its bubble and the next has not opened one, while the backend is
    //: running the objective judge and dispatching the next segment. That gap is what the user saw as
    //: "the stop button disappears, then it takes a breath and comes back working". The composer reads
    //: this so the run reads as busy for as long as it actually is.
    isBusy: (s) => s.isStreaming || s._workRunActive,
    //: "Iteration 2 of 12" while a Work run is in flight, else ''. The user could not tell which
    //: iteration was running or which had finished; nothing in any frame carried the number.
    workIterationLabel: (s) => (s.workIteration
      ? `Iteration ${s.workIteration.segment}${s.workIteration.max ? ` of ${s.workIteration.max}` : ''}`
      : ''),
    //: Message id → the iteration that STARTS at it, for the dividers that group a long run. Only where
    //: the number actually changes, so a run's iterations read as sections rather than every bubble
    //: carrying a badge. Empty for ordinary chat, which is the overwhelming majority of threads.
    iterationBoundaries: (s) => {
      const out = new Map()
      let last = null
      for (const m of s.messages) {
        const seg = m && m.workIteration && Number(m.workIteration.segment)
        if (seg && seg !== last) {
          out.set(m.id, m.workIteration)
          last = seg
        }
      }
      return out
    },

    // ── Live activity timeline (the currently-streaming message) — the SOLE activity renderer
    // (AgentActivityTimeline): friendly, param-free steps (Searching → Generating), reasoning, tokens. ──
    richActive: () => _tl.hasActivity(),
    //: True while this conversation's plan still has steps to go. The timeline header reads it so a
    //: turn in progress cannot be labelled "Done"; nothing about the turn's lifecycle depends on it.
    //: Computed here rather than delegating to the action so it tracks the plan store reactively —
    //: a getter that calls an action is recomputed on the wrong dependencies, which for a live progress
    //: readout means a header that stops updating halfway through.
    planRunning: (s) => {
      try {
        const p = usePlanStore().progressForConversation(s.conversationId)
        return !!(p && p.total > 0 && p.done < p.total)
      } catch (e) {
        return false
      }
    },
    liveStatus: () => _tl.currentStatus.value,
    liveSteps: () => _tl.steps.value,
    liveSources: () => _tl.sources.value,
    liveSummary: () => _tl.summary.value,
    liveComplete: () => _tl.isComplete.value,
    liveHasFailures: () => _tl.hasFailures.value,
    liveReasoning: () => _tl.reasoning.value,
  },
  actions: {
    // ---- Agents + history ----
    // Load the agent library. Concurrent callers (LeftSidebar / ChatWelcome / ChatWorkspace all mount
    // together) share ONE in-flight request via `_agentsPromise` and every one of them resolves only
    // once `agents` is actually populated — so callers can safely act on the list right after awaiting.
    //
    // force=true (after creating / editing / deleting an agent) bypasses the "already loaded"
    // short-circuit; it still joins any in-flight load rather than firing a second request.
    //
    // NOTE: this no longer chains loadSessions(). History is the selected AGENT's concern and is
    // triggered by setAgent(); chaining it here made the agent list artificially serial behind a
    // second round trip on every chat mount.
    async loadAgents(force = false) {
      if (this._agentsPromise) return this._agentsPromise
      if (this.agentsLoaded && !force) return
      this.agentsLoading = true
      this._agentsPromise = this._fetchAgents().finally(() => {
        this._agentsPromise = null
        this.agentsLoading = false
      })
      return this._agentsPromise
    },

    async _fetchAgents() {
      try {
        const res = await api.getAgents()
        // The library list NEVER contains shared system-owned agents (built-ins / the Platform Super
        // Agent) — they're fetched by id (ensureSuperAgent / _selectAgentById). Preserve any already
        // cached across reloads, or a forced refresh would wipe the active chat's agent.
        const shared = this.agents.filter((a) => a.is_platform_super_agent || a.is_builtin_agent)
        this.agents = pickArray(res.data)
        for (const s of shared) {
          if (!this.agents.some((a) => String(a.id) === String(s.id))) this.agents.push(s)
        }
        if (!this.selectedAgentId && this.agents.length) {
          this.selectedAgentId = String(this.agents[0].id)
        }
        this.agentsLoaded = true
      } catch {
        this.error = 'Failed to load agents'
      }
    },

    // Refresh the agent list after a create/edit/delete so pickers (New Chat / sidebar) update without a
    // page refresh. Thin wrapper over loadAgents(force=true) for explicit, greppable call sites.
    async refreshAgents() {
      return this.loadAgents(true)
    },

    // Everything the user can actually START A CHAT WITH: their own agents (the library list), the
    // built-ins they are scoped to run, and the Platform Super Agent. The last two are absent from
    // /agents/ by design, so the in-chat agent picker has to merge them in explicitly.
    //
    // They are merged INTO `agents` rather than kept in a parallel list because _fetchAgents already
    // preserves shared rows across a refresh — one list means a later refreshAgents() can't silently
    // drop the built-ins out from under an open picker.
    async loadChattableAgents() {
      if (this._chattablePromise) return this._chattablePromise
      this._chattablePromise = (async () => {
        await Promise.all([
          this.loadAgents(),
          this.ensureSuperAgent().catch(() => null),
          (async () => {
            try {
              const { data } = await api.listBuiltinAgents()
              const rows = Array.isArray(data) ? data : (data && data.agents) || []
              for (const b of rows) {
                if (!b || b.id == null) continue
                if (this.agents.some((a) => String(a.id) === String(b.id))) continue
                this.agents.push({ ...b, is_builtin_agent: true })
              }
            } catch (e) { /* built-ins are optional — the picker still lists own agents */ }
          })(),
        ])
      })().finally(() => { this._chattablePromise = null })
      return this._chattablePromise
    },

    // The ONE shared Platform Super Agent — the DEFAULT agent for a naked New Chat (no ?agent=…).
    // Lazily fetched (the endpoint also provisions it server-side) and cached in the agents list so
    // currentAgent/mode/model wiring all resolve normally. Returns the agent or null.
    async ensureSuperAgent() {
      let sa = this.agents.find((a) => a.is_platform_super_agent)
      if (sa) return sa
      try {
        // SLIM card: chat only needs identity + run mode + image model. The full payload (capability
        // inventory / tool catalog / model options) belongs to the Super Agent page, not to opening a chat.
        const { data } = await api.getSuperAgentCard()
        if (data && data.id) {
          sa = data
          if (!this.agents.some((a) => String(a.id) === String(data.id))) this.agents.push(data)
          return sa
        }
      } catch { /* no super agent available (e.g. backend down) — caller falls back */ }
      return null
    },

    setAgent(id) {
      this.selectedAgentId = String(id)
      // History is NOT prefetched here. `sessions` has exactly one consumer — ChatHistoryDrawer —
      // which is closed by default and fetches on open (with its own 60s per-agent cache). Warming it
      // on every agent selection put a /conversations/ round trip on the chat-open critical path for
      // a panel the user usually never opens.
      this.prewarmAgent()   // warm the newly-selected agent during the idle window before the 1st message
    },

    // Recent chats for the CURRENTLY selected agent — the default (and only sensible) scope for the
    // in-chat history drawer: a conversation belongs to the agent that ran it, so showing another
    // agent's chats there is both confusing and a cross-agent context leak. Server-side filtered by
    // agent_profile_id (never client-side over a global page, which would silently drop this agent's
    // older chats behind other agents' newer ones).
    //
    // PAGE 1 ONLY. Opening a chat must not drag the user's entire archive over the wire — the drawer
    // shows the recent page and pulls older ones through loadMoreSessions() on demand.
    //
    // Cached per agent id for 60s. Switching agents clears the list FIRST so the drawer can never
    // render the previous agent's rows while the new list is in flight, and a late response for a
    // superseded agent is discarded.
    async loadSessions(force = false) {
      const agentId = this.selectedAgentId
      if (!agentId) {
        this.sessions = []
        this.sessionsPage = 0
        this.sessionsTotal = 0
        this._sessionsAgentId = null
        return
      }
      const sameAgent = String(this._sessionsAgentId) === String(agentId)
      if (this.sessionsLoading && sameAgent) return
      if (!force && sameAgent && (Date.now() - this._sessionsAt) < 60000) return
      if (!sameAgent) { this.sessions = []; this.sessionsPage = 0; this.sessionsTotal = 0 }
      this.sessionsLoading = true
      try {
        const res = await api.getConversations({
          agent_profile_id: agentId,
          ordering: '-updated_at',
          page: 1,
          page_size: HISTORY_PAGE_SIZE,   // PageNumberPagination: `page_size` (max 100), NOT `limit`.
        })
        if (String(this.selectedAgentId) !== String(agentId)) return   // agent switched mid-flight
        this.sessions = pickArray(res.data)
        this.sessionsPage = 1
        this.sessionsTotal = countOf(res.data, this.sessions.length)
        this._sessionsAgentId = String(agentId)
        this._sessionsAt = Date.now()
      } catch {
        /* non-fatal */
      } finally {
        this.sessionsLoading = false
      }
    },

    // Append the next older page for the current agent. Kept separate from loadSessions so a
    // "load more" can never be mistaken for a refresh (which would collapse the list back to page 1).
    async loadMoreSessions() {
      const agentId = this.selectedAgentId
      if (!agentId || this.sessionsLoading || this.sessionsLoadingMore) return
      if (!this.hasMoreSessions) return
      const next = this.sessionsPage + 1
      this.sessionsLoadingMore = true
      try {
        const res = await api.getConversations({
          agent_profile_id: agentId,
          ordering: '-updated_at',
          page: next,
          page_size: HISTORY_PAGE_SIZE,
        })
        if (String(this.selectedAgentId) !== String(agentId)) return   // agent switched mid-flight
        this.sessions = mergeById(this.sessions, pickArray(res.data))
        this.sessionsPage = next
        this.sessionsTotal = countOf(res.data, this.sessions.length)
      } catch {
        /* non-fatal — the button stays available for a retry */
      } finally {
        this.sessionsLoadingMore = false
      }
    },

    // Global recent chats across every agent — powers the ⌘K search modal and the history drawer's
    // explicit "All agents" scope. Never the default in-chat view (see loadSessions). Also page 1
    // only; loadMoreAllSessions() walks back through older pages.
    // Cached for 60s: re-opening the search modal or re-mounting the sidebar reuses the
    // list instead of refetching. Pass force=true after a mutation (e.g. a new chat).
    async loadAllSessions(force = false) {
      if (this.allSessionsLoading) return
      if (!force && this.allSessions.length && (Date.now() - this._allSessionsAt) < 60000) return
      this.allSessionsLoading = true
      try {
        const res = await api.getConversations({
          ordering: '-updated_at', page: 1, page_size: HISTORY_PAGE_SIZE,
        })
        this.allSessions = pickArray(res.data)
        this.allSessionsPage = 1
        this.allSessionsTotal = countOf(res.data, this.allSessions.length)
        this._allSessionsAt = Date.now()
      } catch {
        /* non-fatal */
      } finally {
        this.allSessionsLoading = false
      }
    },

    async loadMoreAllSessions() {
      if (this.allSessionsLoading || this.allSessionsLoadingMore || !this.hasMoreAllSessions) return
      const next = this.allSessionsPage + 1
      this.allSessionsLoadingMore = true
      try {
        const res = await api.getConversations({
          ordering: '-updated_at', page: next, page_size: HISTORY_PAGE_SIZE,
        })
        this.allSessions = mergeById(this.allSessions, pickArray(res.data))
        this.allSessionsPage = next
        this.allSessionsTotal = countOf(res.data, this.allSessions.length)
      } catch {
        /* non-fatal */
      } finally {
        this.allSessionsLoadingMore = false
      }
    },

    // ---- Conversation lifecycle ----
    reset() {
      // "New chat" stays on the SAME repo endpoint — keep the socket, just clear state and detach the
      // conversation (the first message creates a new one and conversation_created sets the id).
      this._clearTurnState()
      this.messages = []
      this.conversationId = null
      this.error = ''
      this.messagesHasMore = false
      this.messagesTotal = 0
      this.pendingPlan = null
      this.fullDocCostGate = null
      this._clearAttachments()
      this._conn?.setConversation(null)
    },

    _clearAttachments() {
      for (const a of this.pendingAttachments) {
        if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } }
      }
      this.pendingAttachments = []
    },

    // ONE mapping from a server message row to the client message shape. Shared by the initial
    // conversation load and by loadOlderMessages() so a prepended page restores attachments, thumbs,
    // plan anchors, timeline and provenance EXACTLY like the first page does.
    _mapServerMessage(m, conversationId) {
      const info = m.model_info || {}
      return {
        id: nid(),
        // The DATABASE pk, kept alongside the client-side id. Message actions that hit the
        // backend (thumbs feedback) address this, not the local `id`.
        serverId: m.id ?? null,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: stripThinkBlocks(m.content || ''),
        status: 'done',
        error: '',
        toolCalls: [],
        // The caller's own thumb, restored from the server so it survives a reload.
        feedback: m.feedback || null,
        // Content that came from ANOTHER user's account (a forked shared conversation). Renders
        // through the untrusted markdown path — raw HTML escaped, script URLs stripped — because
        // the normal path deliberately lets HTML through for agent-generated media.
        untrusted: !!info.untrusted_content,
        // Long-answer stub: the stored content is a bounded stub; the full answer
        // is rehydrated on demand from the long-answer endpoint (see ChatMessage.vue).
        isLongResponse: !!info.is_long_response,
        longAnswerRef: info.long_answer_ref || '',
        // Restore per-turn metadata persisted in model_info so a refresh keeps the token/cost
        // footer + stop badge (otherwise only the bare text survives reload).
        usage: info.usage || null,
        stopReason: info.stop_reason || '',
        confidence: info.confidence || '',
        trace: info.trace || [],
        // Timeline replay: restore the masked snapshot so a reopened chat shows the friendly
        // Searching → Generating activity timeline (with reasoning) as it was.
        timeline: info.timeline || null,
        // Provenance replay (decision #4): the answer_basis envelope carries the label + the
        // cited-or-top-4 sources, so a reopened chat shows the SAME footer + clickable panel.
        answerBasis: info.answer_basis || null,
        citations: (info.answer_basis && info.answer_basis.citations) || [],
        // Work mode: which iteration produced this answer, so a reopened thread keeps its iteration
        // sections. The live tagging happens client-side from `work_segment`; without this the
        // grouping would disappear on the reload the user does precisely to look back over the run.
        workIteration: info.work_iteration || null,
        // WHICH RUN PRODUCED THIS MESSAGE, and what the turn actually ran as — stamped by the server
        // on every writer (agent/services/turn_metadata.py). This is the durable answer to "is this
        // message already drawn on a run's rail?"; before it existed the client asked the CONVERSATION
        // instead, and that question stays true forever once a thread has run Work even once.
        runId: info.run_id || '',
        turnModeResolved: info.turn_mode_resolved || '',
        // WHO WROTE A USER-ROLE MESSAGE. A work run's continuation segments are persisted as
        // role='user' rows because the runtime reads the conversation back as turns — but the user
        // never typed them, and drawing them as their own blue bubble is what made conv 1561 read as
        // if the operator kept shouting "DO THE NEXT PIECE OF WORK". Absent == authored by the user.
        authoredBy: info.authored_by || 'user',
        // Inline plan artifact: durable anchor(s) linking this message to its plan(s). Present only
        // when the backend flag is on; drives inline-by-plan_id rendering (no runtime anchor).
        planArtifacts: pickArray(m.plan_artifacts),
        // User-uploaded attachments bound to this message (turn-level binding) — served /media/ URLs so
        // the thumbnail survives refresh (the live send-time blob URL is ephemeral).
        attachments: pickArray(m.attachments),
        conversationId: String(conversationId),
      }
    },

    // Prepend the next OLDER page of this conversation. Cursor-based (`before` = the oldest server id
    // we hold) so a message arriving mid-scroll can't shift a page boundary and duplicate/skip rows.
    async loadOlderMessages() {
      const id = this.conversationId
      if (!id || this.loadingOlder || !this.messagesHasMore) return
      // The cursor must be a SERVER id; a locally-created (still-streaming) row has none.
      const oldest = this.messages.find((m) => m.serverId)
      if (!oldest) return
      this.loadingOlder = true
      try {
        const res = await api.getConversationMessages(id, { before: oldest.serverId, limit: 50 })
        if (String(this.conversationId) !== String(id)) return   // switched conversation mid-flight
        const data = res.data || {}
        const older = pickArray(data.results).map((m) => this._mapServerMessage(m, id))
        this.messages = older.concat(this.messages)
        this.messagesHasMore = !!data.has_more
        // Newly-prepended rows may carry their own plan anchors — hydrate so their inline cards render.
        this._hydratePlanAnchors(id)
      } catch {
        /* non-fatal — the button stays available for a retry */
      } finally {
        this.loadingOlder = false
      }
    },

    async openConversation(id) {
      if (!id) {
        this.reset()
        return
      }
      // Already pointed at this conversation with a live socket or loaded history → no-op. This also
      // covers the case where ensureConversation() just created the id (to ingest a link before the
      // first message) and the URL replace re-entered here — we must NOT re-clear staged attachments.
      if (String(this.conversationId) === String(id) && (this.messages.length || this._conn)) return
      this._clearTurnState()   // switch conversation: clear UI state but KEEP the shared socket
      this.conversationId = String(id)
      this.messages = []
      this.messagesHasMore = false   // recomputed from this conversation's response below
      this.messagesTotal = 0
      this.pendingPlan = null
      this._clearAttachments()
      this.loadingHistory = true
      this.error = ''
      try {
        const res = await api.getConversation(id)
        const data = res.data || {}
        this.messages = pickArray(data.messages).map((m) => this._mapServerMessage(m, id))
        // Message windowing: the server returns the most recent page (see ChatConversationSerializer)
        // and reports whether older ones exist. loadOlderMessages() walks backwards from the oldest
        // row we hold. Older servers send neither field — then there is nothing more to fetch.
        this.messagesHasMore = !!data.has_more_messages
        this.messagesTotal = data.message_count || this.messages.length
        // Hydrate + reconcile any plans anchored in the loaded history so the inline cards render on
        // open (durable-anchor path). No-op when the feature is off (no plan_artifacts present).
        this._hydratePlanAnchors(id)
        this.repoId = data.repository?.id || data.repository_id || 0
        // Backend serializes agent_profile as a bare PK (integer), with the human name
        // exposed separately as agent_profile_name — so read the id directly (older code
        // expected a nested object, which left selectedAgentId unset and hid the mode pill).
        const agentPk = (data.agent_profile && data.agent_profile.id) || data.agent_profile
        if (agentPk) this.selectedAgentId = String(agentPk)
        this._connect()
      } catch {
        this.error = 'Failed to load conversation'
      } finally {
        this.loadingHistory = false
      }
    },

    // ── Attachments (images/files) staged for the next message ──
    addAttachments(files) {
      for (const file of Array.from(files || [])) {
        if (!file) continue
        const isImage = /^image\//.test(file.type)
        // Blob URL for EVERY attachment (not just images) so the message bubble can open a
        // preview/download window for the exact bytes the user attached — images render inline, docs open
        // in a new tab. Persisted across the send (the bubble keeps it); revoked on removeAttachment.
        this.pendingAttachments.push({
          file, name: file.name, isImage, mime: file.type || '',
          url: URL.createObjectURL(file),
        })
      }
    },
    // Attach EXISTING media (from the Media gallery) to the next message. These already have a stable
    // attachment_id, so they bind to the message by id on send — NO re-upload. Shape mirrors a staged
    // attachment but carries `attachment_id` and no `file`. De-duped by attachment_id.
    addExistingMedia(items) {
      for (const m of Array.from(items || [])) {
        if (!m || !m.attachment_id) continue
        if (this.pendingAttachments.some((a) => a.attachment_id === m.attachment_id)) continue
        this.pendingAttachments.push({
          attachment_id: m.attachment_id,
          name: m.filename || 'media',
          isImage: m.type === 'image',
          mime: m.mime_type || '',
          url: m.url || '',        // served URL — the bubble preview + gallery thumbnail
          existing: true,          // marks "no upload needed" for _uploadAttachments
        })
      }
    },
    removeAttachment(i) {
      const a = this.pendingAttachments[i]
      // Only revoke blob URLs we created (uploads); gallery items use a served URL — don't revoke it.
      if (a && a.url && !a.existing && a.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(a.url) } catch { /* ignore */ }
      }
      this.pendingAttachments.splice(i, 1)
    },

    // Create (or return) the conversation for the selected agent WITHOUT sending a message. Used so the
    // composer "+" menu can ingest a link/file into a conversation-scoped DocumentSource on a brand-new
    // chat — ChatGPT-style, the chat quietly starts the moment you attach something. Returns the
    // conversation id, or null if it couldn't start (no agent / API error).
    async ensureConversation() {
      if (this.conversationId) return this.conversationId
      if (!this.selectedAgentId) {
        this.error = 'Select an agent to start chatting.'
        notify.warning('Select an agent to start chatting.')
        return null
      }
      try {
        const res = await api.startAgentChat(this.selectedAgentId)
        const d = res.data || {}
        this.conversationId = String(d.conversation_id ?? d.profile_id ?? '')
        this.repoId = d.repository_id || 0
        if (!this.conversationId) throw new Error('no conversation id')
        this._connect()
        this.loadSessions(true)      // force-refresh this agent's history so the new chat shows up
        this.loadAllSessions(true)   // force-refresh the global recent-chats list + search
        return this.conversationId
      } catch {
        this.error = 'Failed to start chat.'
        return null
      }
    },

    // Canvas signalling for the WS message: `canvas_mode` auto-exposes the design tools for the turn,
    // and `canvas_selection` targets a specific element. For web_builder we send the STABLE element id
    // (not outerHTML) so the backend's builder tools can edit that exact entity (Phase 3B A13/A14);
    // static keeps sending the captured element markup.
    // Chat / Work — the user's explicit choice, persisted per conversation so switching tabs or
    // reloading does not silently drop them back into Chat mid-task.
    setTurnMode(mode) {
      this.turnMode = (mode === 'work' || mode === 'chat') ? mode : 'auto'
      try { localStorage.setItem(TURN_MODE_KEY, this.turnMode) } catch (_e) { /* private mode */ }
    },

    _canvasSendOpts() {
      let canvas
      try { canvas = useCanvasStore() } catch (_e) { return {} }
      const opts = {}
      if (canvas.mode) opts.canvasMode = true
      const sel = canvas.selectedElement
      if (sel) {
        opts.canvasSelection = canvas.provider === 'web_builder'
          ? { provider: 'web_builder', element_id: sel.element_id, route: canvas.route, page_id: canvas.pageId }
          : sel
      }
      return opts
    },

    // Upload staged attachments to the current conversation and return their stable attachment_ids (in
    // order) plus the doc entries that still need ingest-waiting. Shared by the normal + steering send
    // paths so BOTH reliably echo attachment_ids back to the backend (the binding key). Awaited fully
    // before the WS message is sent, so a message never races ahead of its uploads.
    async _uploadAttachments(atts) {
      const attachmentIds = []
      const docs = []
      for (const a of atts) {
        // Gallery-selected EXISTING media already have an attachment_id — bind by id, no upload.
        if (a.existing && a.attachment_id) {
          attachmentIds.push(a.attachment_id)
          continue
        }
        try {
          const res = await api.uploadConversationFile(this.conversationId, a.file)
          const attId = res?.data?.attachment_id
          const fileId = res?.data?.id
          if (attId) attachmentIds.push(attId)
          if (!a.isImage && fileId != null) docs.push({ id: fileId, name: a.name })
        } catch {
          this.error = 'Failed to upload an attachment.'
        }
      }
      if (atts.length && attachmentIds.length === 0) {
        // Uploads ran but no ids came back — the backend safety net (turn-scoped binding) still covers
        // this, but log it so a real regression is visible rather than silent.
        console.warn('[chat] attachments uploaded but no attachment_id returned — relying on backend fallback')
      }
      return { attachmentIds, docs }
    },

    async sendMessage(text) {
      const content = (text || '').trim()
      const atts = this.pendingAttachments.slice()
      if (!content && atts.length === 0) return
      // Ask for browser-notification permission on this user gesture (once). Lets us notify the user when
      // the run finishes if they've stepped away to another window/tab. No-op if already asked/decided.
      ensureNotifyPermission()

      // Mid-run STEERING: the agent is already running. Don't start a second turn and don't drop the
      // message — send it as a steering message. The backend queues it and the running agent observes it
      // between steps. If the user ATTACHED files, upload them first and send their attachment_ids so the
      // reference is bound to this steering message too (previously attachments were silently dropped here,
      // which is one way the "agent can't see the uploaded image" race happened).
      if (this.isStreaming) {
        if ((!content && atts.length === 0) || !this.conversationId || !this._conn) return
        this.messages.push({
          id: nid(), role: 'user', content, status: 'done', queued: true,
          attachments: atts.map((a) => ({ name: a.name, isImage: a.isImage, url: a.url, mime: a.mime })),
        })
        this.pendingAttachments = []
        const { attachmentIds: steerIds } = await this._uploadAttachments(atts)
        this._conn.sendMessage(content, this.selectedAgentId, null, {
          ...this._canvasSendOpts(),
          turnMode: this.turnMode === 'auto' ? undefined : this.turnMode,
          imageMode: this.imageMode || undefined,
          reasoningEffort: this.reasoningEffort || undefined,
          attachmentIds: steerIds,
          clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })
        return
      }

      // No agents at all → don't silently swallow the message. Tell the user what to do.
      if (this.needsAgent) {
        this.error = 'Create an agent before sending a message.'
        notify.warning('Create an agent before you can chat — no agents exist yet.')
        return
      }

      // Start a conversation on the first message (or reuse one already created — e.g. by
      // ensureConversation() when the user added a link before typing).
      if (!this.conversationId) {
        const cid = await this.ensureConversation()
        if (!cid) return
      } else if (!this._conn) {
        this._connect()
      }

      // Show the user turn (with attachment previews) and the assistant placeholder up-front.
      this.messages.push({
        id: nid(), role: 'user', content, status: 'done',
        attachments: atts.map((a) => ({ name: a.name, isImage: a.isImage, url: a.url, mime: a.mime })),
      })
      this.pendingAttachments = [] // claimed by this turn; the message bubble keeps the preview urls
      // A NEW USER TURN CLEARS THE PREVIOUS RUN'S WORK STATE. This is the right home for it rather than
      // `_beginAssistant`, which also fires when a LATER iteration of a still-running Work run opens its
      // bubble — clearing it there would undo the announcement that had just arrived and end the turn
      // at the first iteration boundary, which is the bug this whole path exists to fix.
      this._workRunActive = false
      this.workIteration = null
      this.workGoal = null
      this._beginAssistant()

      // Upload attachments to the conversation BEFORE sending the text — the backend auto-attaches
      // recent images (within one message) to the vision model, so they must exist first. Non-image
      // documents become conversation-scoped RAG sources (MarkItDown): converted once, then searchable.
      //
      // ChatGPT-style: when a document is attached WITH the question, HOLD the turn until the doc has
      // finished converting/indexing so the agent has the content on its FIRST answer (no "your file is
      // still being processed" reply). We show a "Reading your document…" state on the assistant bubble
      // instead of a toast, and the composer stays disabled (isStreaming) meanwhile. Images need only the
      // upload (auto-attached to vision), so they don't gate the send.
      // Collected in upload order so the backend binds them to THIS message with the correct ordinal
      // (turn-level attachment binding). We echo back the stable `attachment_id` (uuid), not the DB pk.
      let attachmentIds = []
      if (atts.length) {
        const assistantMsg = this._cur()
        const uploaded = await this._uploadAttachments(atts)
        attachmentIds = uploaded.attachmentIds
        const docs = uploaded.docs
        if (docs.length && assistantMsg) {
          assistantMsg.prepStatus = docs.length > 1
            ? `Reading your ${docs.length} documents…`
            : `Reading ${docs[0].name}…`
          for (const d of docs) {
            const st = await this._awaitAttachmentIngest(d.id)
            if (st === 'failed') notify.error(`Could not process ${d.name}.`)
            // 'timeout' → fall through and send anyway; the backend gives the honest "still processing"
            // answer and a safety-wait covers the last-mile race.
          }
          assistantMsg.prepStatus = ''
        }
      }

      // Bind attachments to THIS exact message via explicit ids (+ a client message id for idempotency),
      // instead of the backend guessing "newest upload in the conversation".
      this._conn?.sendMessage(content, this.selectedAgentId, null, {
        ...this._canvasSendOpts(),
        // 'auto' sends NOTHING, which is what lets the Brain decide. 'chat' is now sent, so choosing
        // it actually suppresses a Work goal instead of reading as "no preference".
        turnMode: this.turnMode === 'auto' ? undefined : this.turnMode,
        imageMode: this.imageMode || undefined,
          reasoningEffort: this.reasoningEffort || undefined,
        attachmentIds,
        clientMessageId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
    },

    // Await a just-uploaded document through the MarkItDown pipeline. Resolves 'ready' | 'failed' |
    // 'timeout'. WS push is primary for index status, but polling is the reliable gate the composer
    // awaits before firing the turn. Bounded (~60s) so a stuck conversion can never hang the send.
    async _awaitAttachmentIngest(fileId) {
      for (let i = 0; i < 40; i++) {
        let d
        try { d = (await api.getAgentFileStatus(fileId)).data } catch { d = null }
        const st = d?.index_status
        if (st === 'ready') return 'ready'
        if (st === 'failed') return 'failed'
        await new Promise((r) => setTimeout(r, 1500))
      }
      return 'timeout'
    },

    stop() {
      this._conn?.stop()
      // STOP HAS TO REACH THE WORK THAT IS ACTUALLY RUNNING.
      //
      // `_conn.stop()` cancels a turn on THIS SOCKET. A Work run's first iteration is such a turn, and
      // every later one is a Celery task with no socket at all — so once the run moved on, the button
      // was visible, enabled, and did nothing. Reported live: "I'm clicking on stop button nothing
      // happening" on iteration 2 of 12.
      //
      // That gap is mine: binding the composer to `isBusy` is what kept the button up across the
      // boundary, which was right, but a control that is shown must act.
      //
      // Routed through the goal action the backend already advertises (`work_goal.available_actions`),
      // the same one the goal row's Pause button uses — not a second cancellation path with its own
      // idea of what stopping means.
      this._stopWorkRun()
      // Clear any pending approval so _endAssistant is allowed to finalize (Stop must always end the
      // turn, even mid-approval). The backend's stop_execution also cancels the server-side HITL wait.
      this.hitlRequests = []
      this.awaitingApproval = false
      this._endAssistant()
    },

    // Halt the run itself when a Work goal is still in flight. Best-effort and never throws into
    // `stop()`: failing to reach the run must not also prevent the local turn from ending.
    _stopWorkRun() {
      try {
        const plan = usePlanStore()
        const runs = plan.runsForConversation(this.conversationId) || []
        for (let i = runs.length - 1; i >= 0; i -= 1) {
          const g = runs[i] && runs[i].work_goal
          if (!g || g.state !== 'ACTIVE') continue
          // `pause` when the backend offers it — it is reversible and preserves the work. `clear`
          // only if that is all it will accept; anything else and we would be inventing an action the
          // runtime might refuse, which is the drift `goalAction`'s own comment warns about.
          const offered = g.available_actions || []
          const action = offered.includes('pause') ? 'pause'
            : (offered.includes('clear') ? 'clear' : null)
          if (!action) break
          this._workRunActive = false      // the run is stopping; do not keep the composer busy
          this.workIteration = null
          plan.goalAction(runs[i].run_id, action)
          break
        }
      } catch (_e) { /* the socket stop above still stands */ }
    },

    // ── HITL approval responses (sent over the same WS the backend awaits on) ──
    respondHitl({ request_id, response_value, feedback }) {
      this._conn?.sendHitlResponse(request_id, response_value, feedback)
      // Optimistically clear; the hitl_response_ack will also clear it.
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== request_id)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    dismissHitl(requestId) {
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    // ── Manual Mode plan approval (v3 Layer 2) ──
    approvePlan() {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('approve')
    },
    rejectPlan() {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('reject')
    },
    // Request changes: hand the feedback to the agent, which re-plans and asks again.
    revisePlan(feedback) {
      this.pendingPlan = null
      this._conn?.sendPlanDecision('revise', feedback)
    },
    // Resume after the server approves the plan: re-run the last user instruction (now unblocked).
    _resumeAfterPlan() {
      const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(lastUser.content, this.selectedAgentId)
    },
    // Resume after a revision request: the feedback IS the next instruction (shown as a user turn),
    // and the agent re-plans from it.
    _resumeAfterRevise(feedback) {
      const text = (feedback || '').trim()
      if (!text) return
      if (!this._conn && this.conversationId) this._connect()
      this.messages.push({ id: nid(), role: 'user', content: text, status: 'done' })
      this._beginAssistant()
      this._conn?.sendMessage(text, this.selectedAgentId)
    },

    skipHitl(requestId) {
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
      if (this.hitlRequests.length === 0) this.awaitingApproval = false
    },

    // ── Full-document cost gate resolution ──
    // Re-send the original question carrying the user's decision. approve → the backend reads the whole
    // document; reject → targeted top-k on the original question; focus → targeted on the focused question.
    // (focus is shown as its own user turn so the thread reflects what was actually asked.)
    resolveFullDocCost(decision, focusQuery = '') {
      const gate = this.fullDocCostGate
      this.fullDocCostGate = null
      if (!gate) return
      if (!this._conn && this.conversationId) this._connect()
      const _dec = (decision || '').toLowerCase()
      const focus = (focusQuery || '').trim()
      if (_dec === 'focus' && focus) {
        this.messages.push({ id: nid(), role: 'user', content: focus, status: 'done' })
      }
      const outgoing = (_dec === 'focus' && focus) ? focus : (gate.question || '')
      this._beginAssistant()
      this._conn?.sendMessage(outgoing, this.selectedAgentId, null, {
        ragCostDecision: { decision: _dec, focus_query: focus || undefined },
      })
    },

    retryLast() {
      if (this.isStreaming) return
      const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      const last = this.messages[this.messages.length - 1]
      if (last && last.role === 'assistant') this.messages.pop()
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(lastUser.content, this.selectedAgentId)
    },

    // Regenerate the answer for a given message: re-run the user turn that produced it (drop
    // everything after that user message, then re-send it).
    regenerate(messageId) {
      if (this.isStreaming) return
      const idx = this.messages.findIndex((m) => m.id === messageId)
      if (idx < 0) return
      let userIdx = idx
      if (this.messages[idx].role !== 'user') {
        userIdx = -1
        for (let i = idx; i >= 0; i--) { if (this.messages[i].role === 'user') { userIdx = i; break } }
      }
      const userMsg = this.messages[userIdx]
      if (!userMsg || userMsg.role !== 'user') return
      // ARTC: the answer being regenerated is an implicit negative — record it (best-effort).
      try {
        if (this.conversationId) api.submitTrainingFeedback({
          conversation_id: this.conversationId, label_type: 'regenerate',
        })
      } catch (_) { /* never block regeneration */ }
      this.messages = this.messages.slice(0, userIdx + 1)   // keep the user turn, drop the rest
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(userMsg.content, this.selectedAgentId)
    },

    // Edit a user message and re-submit: replace its text, drop everything after it, re-send.
    editAndResend(messageId, newText) {
      const text = (newText || '').trim()
      if (!text || this.isStreaming) return
      const idx = this.messages.findIndex((m) => m.id === messageId)
      if (idx < 0 || this.messages[idx].role !== 'user') return
      this.messages[idx].content = text
      // ARTC: an edit-and-resend signals the prior turn was unsatisfactory — record it (best-effort).
      try {
        if (this.conversationId) api.submitTrainingFeedback({
          conversation_id: this.conversationId, label_type: 'user_edit',
        })
      } catch (_) { /* never block resend */ }
      this.messages = this.messages.slice(0, idx + 1)
      if (!this._conn && this.conversationId) this._connect()
      this._beginAssistant()
      this._conn?.sendMessage(text, this.selectedAgentId)
    },

    // ── Share sheet ──
    // `anchorMessageId` is a message's DB pk; passing it shares the thread only up to that message.
    openShare(anchorMessageId = null) {
      if (!this.conversationId) {
        notify.info('Send a message first — there is nothing to share yet.')
        return
      }
      this.shareAnchorId = anchorMessageId || null
      this.shareOpen = true
    },
    closeShare() {
      this.shareOpen = false
      this.shareAnchorId = null
    },

    // Thumbs up/down on an assistant message (toggles). PERSISTED: the thumb is written against the
    // message's database row, so it survives a reload and is queryable server-side. The optimistic
    // update is reverted if the write fails — a thumb that silently didn't save is worse than none.
    //
    // `reasons`/`comment` come from the thumbs-down detail sheet; they're where the usable signal is.
    async setFeedback(messageId, value, { reasons = [], comment = '' } = {}) {
      const m = this.messages.find((x) => x.id === messageId)
      if (!m) return
      const previous = m.feedback || null
      const next = previous === value && !reasons.length && !comment ? null : value
      m.feedback = next
      if (!m.serverId) {
        // No DB row yet (the save event hasn't landed, or this is a legacy in-memory bubble). Keep the
        // optimistic UI, but say plainly that it isn't stored rather than pretending it was.
        notify.info('Feedback noted for this session — reopen the chat to rate the saved message.')
        return
      }
      try {
        await api.setMessageFeedback(m.serverId, { value: next, reasons, comment })
      } catch (e) {
        m.feedback = previous
        notify.error('Could not save your feedback. Please try again.')
      }
    },

    // ---- Connection + streaming internals ----
    _connectionHandlers() {
      return {
        onEvent: (msg) => this._onEvent(msg),
        onOpen: () => {
          // Reconnected after a mid-turn drop. The backend keeps the turn alive and PERSISTS its answer
          // (turn lifetime is decoupled from the socket), so recover by reloading history. Trigger whenever
          // a turn was in flight — NOT only when _recovering was set: a backgrounded tab throttles the
          // keepalive ping and the socket can drop without onClose flagging _recovering, yet the turn still
          // completes server-side. Without this, the answer only appears after a manual refresh.
          if (this._recovering || this.isStreaming || this._taskRunActive) this._recoverAfterReconnect()
        },
        onError: (em) => {
          if (!this.isStreaming) return
          // Only a TERMINAL give-up (reconnect attempts exhausted) is a real error. Transient
          // blips just mean "reconnecting" — don't scare the user or kill the turn.
          if (em && /please refresh/i.test(em)) this._errAssistant(em)
          else this._enterReconnecting()
        },
        onClose: () => {
          // Abnormal drop mid-stream. Do NOT finalize as interrupted — the backend turn survives.
          // Show "Reconnecting…"; ChatConnection auto-reconnects and onOpen recovers the result.
          if (this.isStreaming) this._enterReconnecting()
        },
      }
    },

    // Industry practice: ONE stable socket per endpoint (repoId), decoupled from conversation/route
    // changes. The conversation_id travels per-message, so switching conversations must NOT churn the
    // socket — we reuse the live one and just point it at the new conversation. Only a different repo
    // endpoint (or no socket yet) creates a connection.
    _connect() {
      const repo = this.repoId || 0
      if (this._conn && this._conn.repoId === repo) {
        this._conn.setConversation(this.conversationId)
        this._conn.connect(repo)   // idempotent: no-op if already OPEN/CONNECTING, reconnects if dead
        this._conn.prewarm(this.selectedAgentId)
        return
      }
      this._teardown(false)        // repo changed (or first connect) -> (re)create
      this._conn = new ChatConnection(this.conversationId, this._connectionHandlers())
      this._conn.connect(repo)
      this._conn.prewarm(this.selectedAgentId)
    },

    // Open the chat socket EARLY (when the chat page loads / an agent is selected) and pre-build the
    // selected agent's server-side runtime, so the FIRST message reuses the runner instead of paying
    // the ~6.6s cold build. Without this the socket only opens lazily on first send (no idle window).
    prewarmAgent() {
      if (!this.selectedAgentId) return
      this._connect()
    },

    // Clear the per-turn UI/streaming state WITHOUT touching the socket (used when switching
    // conversations — the socket is shared and must stay alive).
    _clearTurnState() {
      this._stopDeafWatchdog()
      // A turn was in flight and this view is walking away from it (conversation switch, chat closed).
      // The backend run SURVIVES — so the timeline must stop claiming to be live without claiming to
      // have finished. Conversation 1432 is what the old behaviour looked like: "Done · 12 steps" over
      // a run that was still executing, and no answer under it.
      if (this.isStreaming) {
        try { _tl.detach() } catch (e) { /* a cosmetic state must never break a conversation switch */ }
      }
      this.isStreaming = false
      this._assistantId = null
      this._recovering = false
    },

    // Full teardown — ONLY for logout / app unmount. Closes the socket for good (no reconnect).
    disconnect() {
      this._teardown(true)
    },

    // Mid-turn socket drop: enter a soft "reconnecting" state instead of erroring. Idempotent.
    _enterReconnecting() {
      if (this._recovering) return
      this._recovering = true
      const m = this._cur()
      if (m) m.reconnecting = true
    },

    // Socket came back after a drop: the turn likely finished on the backend while we were away.
    // Reload history (polling briefly in case it's still finishing), then swap in the saved answer.
    // ── resumed-turn progress polling ──────────────────────────────────────────────────────────────
    // A turn running on ANOTHER worker (signal, schedule, webhook — exactly the runs a user leaves and
    // comes back to) relays no tokens to this socket by design: chat streaming stays off Redis for perf.
    // Without this the status line freezes at whatever it said on reconnect, which is the "is it working
    // or is it stuck?" state the snapshot was added to eliminate. Cheap: one tiny frame every 8s, only
    // while a resumed turn is actually on screen.
    _startProgressPolling() {
      this._stopProgressPolling()
      this._progressTimer = setInterval(() => {
        if (!this.isStreaming || !this.conversationId) { this._stopProgressPolling(); return }
        try { this._conn?.sendIfOpen({ type: 'turn_progress', conversation_id: this.conversationId }) }
        catch { /* socket down; the reconnect path takes over */ }
      }, 8000)
    },

    //: Longest silence a HEALTHY turn can produce. A single high-detail vision call runs 45-53s in
    //: production (conversation 1466: 52.6s then 44.8s) and emits nothing while it does, so the
    //: threshold has to clear that comfortably or the watchdog fires on working turns.
    //:
    //: Two minutes of complete silence means one of two things, and the response to both is the same:
    //: this page has gone deaf, or the turn is genuinely stalled. Re-reading history answers it either
    //: way, and costs one cheap request.
    _DEAF_AFTER_MS: 120000,

    // NOTHING HAS ARRIVED FOR TOO LONG — go and look instead of waiting for a frame that may never come.
    //
    // REPORTED REPEATEDLY, most recently conversation 1466: the answer was saved at 10:04:21 and the tab
    // still read "Working" at 10:07:03, nearly three minutes later. A manual refresh showed it
    // immediately, because the answer had been in the database the whole time. The socket had died
    // without a close event — seven deploys in one afternoon, each restarting the server under an open
    // tab — and `onOpen`/`onClose`/`onError` are the ONLY things that trigger recovery today. A socket
    // that dies quietly fires none of them.
    //
    // Deliberately reuses `_recoverAfterReconnect`: it already polls history, settles on the saved
    // answer and gives up cleanly. This adds the one thing missing — noticing.
    _startDeafWatchdog() {
      this._stopDeafWatchdog()
      this._lastFrameAt = Date.now()
      this._deafTimer = setInterval(() => {
        if (!this.isStreaming) { this._stopDeafWatchdog(); return }
        if (Date.now() - (this._lastFrameAt || 0) < this._DEAF_AFTER_MS) return
        this._stopDeafWatchdog()
        try { this._recoverAfterReconnect() } catch (e) { /* never let a watchdog break a turn */ }
      }, 20000)
    },

    _stopDeafWatchdog() {
      if (this._deafTimer) { clearInterval(this._deafTimer); this._deafTimer = null }
    },

    _stopProgressPolling() {
      if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null }
    },

    async _recoverAfterReconnect() {
      this._stopProgressPolling()
      this._recovering = false
      const m = this._cur()
      if (m) m.reconnecting = false
      // Poll for the backend to persist the turn's final answer, then swap in the server's truth.
      //
      // NINETY SECONDS, AND THAT NUMBER IS MEASURED. This was ~30s (12 x 2500ms), and the answer does
      // not always arrive inside it: a run is marked `completed` BEFORE its answer is saved, and the gap
      // across twelve consecutive production runs was
      //
      //     conv 1451  +40.1s      conv 1460  +28.9s
      //     conv 1454  +16.3s      conv 1459   +7.5s      (the rest ~0s)
      //
      // So the window expired, `_endAssistant` cleared the spinner, and the answer showed up only when
      // the user refreshed the page by hand — reported exactly that way. 40s observed, 90s allowed: the
      // loop still ends, it simply stops giving up before the work does.
      //
      // The underlying oddity is the run going terminal ahead of its own answer; widening here does not
      // fix that, it stops this client being misled by it.
      for (let i = 0; i < 36; i++) {
        const landed = await this._refreshHistory()
        if (landed) { this.isStreaming = false; this._taskRunActive = false; this._assistantId = null; return }
        if (!this.isStreaming) return
        await new Promise((r) => setTimeout(r, 2500))
      }
      // Waited ~90s and the turn never landed — clear the spinner without a scary error.
      this._endAssistant()
    },

    // Re-fetch conversation messages from the server. Returns true once the turn that was running during
    // the drop has been persisted. Detection: the NEWEST saved message is an assistant with content — the
    // backend saves the user message at turn start, so a mid-flight turn ends in a 'user' row until done.
    // (The old assistant-COUNT delta was broken: the optimistic streaming bubble is already counted, so a
    // completed turn never increased the count → recovery gave up and the answer only showed on refresh.)
    async _refreshHistory() {
      try {
        const res = await api.getConversation(this.conversationId)
        const rows = pickArray((res.data || {}).messages)
        if (!rows.length) return false
        const last = rows[rows.length - 1]
        const landed = last && last.role === 'assistant' && (last.content || '').trim().length > 0
        if (!landed) return false
        // KEEP EACH MESSAGE'S IDENTITY ACROSS A REFRESH. Every row used to get a fresh id, so Vue
        // unmounted and remounted the whole thread — the Work rail vanished and came back (prod conv
        // 1578, 33.6s → 34.3s) and any open disclosure closed. The k-th assistant row is the k-th
        // assistant message already on screen (and the same for what the user typed); machine-written
        // continuation rows were never on screen, so they alone get new ids. What only the live
        // stream knew (the run a message belongs to, its plan anchor) is kept when the server row
        // does not carry it yet.
        const _onScreen = { assistant: [], user: [] }
        for (const x of this.messages) {
          if (x.role === 'assistant') _onScreen.assistant.push(x)
          else if (x.authoredBy !== 'system') _onScreen.user.push(x)
        }
        // Matched by server id, then by identical text, and by position only when both sides hold the
        // same number of that role's messages — a thread showing only its latest page, or a bubble the
        // server has not saved yet, must never inherit another message's run.
        const _isScaffold = (m) => m.role !== 'assistant' && m.model_info && m.model_info.authored_by === 'system'
        const _roleOf = (m) => (m.role === 'assistant' ? 'assistant' : 'user')
        const _rowCount = { assistant: 0, user: 0 }
        for (const r of rows) if (!_isScaffold(r)) _rowCount[_roleOf(r)]++
        const _cursor = { assistant: 0, user: 0 }
        const _used = new Set()
        const _prevFor = (m) => {
          if (_isScaffold(m)) return null
          const role = _roleOf(m)
          const pool = _onScreen[role]
          const pos = _cursor[role]++
          let hit = m.id != null
            ? pool.find((x) => !_used.has(x) && x.serverId != null && String(x.serverId) === String(m.id)) : null
          if (!hit && String(m.content || '').trim()) {
            hit = pool.find((x) => !_used.has(x) && x.serverId == null && x.content === m.content)
          }
          if (!hit && _rowCount[role] === pool.length && pool[pos] && !_used.has(pool[pos])) hit = pool[pos]
          if (hit) _used.add(hit)
          return hit || null
        }
        this.messages = rows.map((m) => ({ _prev: _prevFor(m), m })).map(({ _prev, m }) => ({
          id: _prev ? _prev.id : nid(),
          serverId: m.id != null ? m.id : (_prev ? _prev.serverId : null),
          feedback: _prev ? _prev.feedback : null,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          status: 'done',
          error: '',
          toolCalls: [],
          isLongResponse: !!(m.model_info && m.model_info.is_long_response),
          longAnswerRef: (m.model_info && m.model_info.long_answer_ref) || '',
          usage: (m.model_info && m.model_info.usage) || (_prev && _prev.usage) || null,
          stopReason: (m.model_info && m.model_info.stop_reason) || '',
          confidence: (m.model_info && m.model_info.confidence) || '',
          trace: (m.model_info && m.model_info.trace) || [],
          // Timeline replay: restore the pinned activity-timeline snapshot (steps + reasoning) so the
          // "Done · N steps" accordion and reasoning survive a reconnect/refresh (same as the main loader).
          // The pinned live timeline until the server copy lands: it is saved AFTER the answer, so a
          // refresh in between dropped a finished iteration's activity off the rail (prod conv 1586,
          // "Got ready" vanished for 14s between segments).
          timeline: (m.model_info && m.model_info.timeline) || (_prev && _prev.timeline) || null,
          // Same durable run link as the main loader — a reconnect must not lose it, or a reconnected
          // thread would start drawing Work answers twice.
          runId: (m.model_info && m.model_info.run_id) || (_prev && _prev.runId) || '',
          turnModeResolved: (m.model_info && m.model_info.turn_mode_resolved)
            || (_prev && _prev.turnModeResolved) || '',
          // Same continuation marker as the main loader — a reconnect must not resurrect the
          // machine-authored prompts as user bubbles.
          authoredBy: (m.model_info && m.model_info.authored_by) || 'user',
          workIteration: (m.model_info && m.model_info.work_iteration) || (_prev && _prev.workIteration) || null,
          planArtifacts: pickArray(m.plan_artifacts).length ? pickArray(m.plan_artifacts)
            : ((_prev && _prev.planArtifacts) || []),
          citations: (m.model_info && m.model_info.answer_basis && m.model_info.answer_basis.citations)
            || (_prev && _prev.citations) || [],
          // User-uploaded attachments bound to this message (served URLs; survive refresh).
          attachments: pickArray(m.attachments),
          conversationId: String(this.conversationId),
        }))
        this._hydratePlanAnchors(this.conversationId)
        return true
      } catch {
        return false
      }
    },

    // Inline plan artifact: hydrate snapshots for plans anchored in the loaded history so their inline
    // cards render on open. If no anchor is present but an assistant turn exists, attempt ONE lazy
    // reconcile (idempotent) to upgrade a legacy plan, then reload history to pick up its anchor.
    // Gated + safe: a complete no-op when the feature is off.
    _hydratePlanAnchors(cid) {
      if (cid == null) return
      try {
        const plan = usePlanStore()
        const runIds = new Set()
        for (const m of this.messages) {
          for (const a of (m.planArtifacts || [])) if (a && a.run_id) runIds.add(a.run_id)
          // A Work run whose plan never got a durable anchor (a small, tracking-only plan) is named only by
          // its messages' `run_id` stamp. Without reading it, a reload dropped that run's whole rail and its
          // answers fell back to bubbles (prod conv 1608, turn 2).
          if (m.role === 'assistant' && m.runId && m.turnModeResolved === 'work') runIds.add(m.runId)
        }
        if (runIds.size) { for (const rid of runIds) plan.hydrateRun(rid); return }
        if (!this.messages.some((m) => m.role === 'assistant')) return   // no plan possible
        plan.reconcileConversation(cid).then((r) => {
          if (r && r.created > 0 && String(cid) === String(this.conversationId)) {
            this._reloadHistoryForAnchors(cid)
          }
        })
      } catch (_e) { /* plan store optional */ }
    },

    // After a lazy reconcile attaches anchors, re-map plan_artifacts onto the in-memory messages (by
    // assistant order — message order is stable) and hydrate the newly-anchored runs.
    async _reloadHistoryForAnchors(cid) {
      try {
        const res = await api.getConversation(cid)
        if (String(cid) !== String(this.conversationId)) return
        const assistantRows = pickArray((res.data || {}).messages).filter((m) => m.role === 'assistant')
        let ai = 0
        for (const m of this.messages) {
          if (m.role !== 'assistant') continue
          const src = assistantRows[ai++]
          if (src && Array.isArray(src.plan_artifacts) && src.plan_artifacts.length) {
            m.planArtifacts = src.plan_artifacts
          }
        }
        const plan = usePlanStore()
        for (const m of this.messages) {
          for (const a of (m.planArtifacts || [])) if (a && a.run_id) plan.hydrateRun(a.run_id)
        }
      } catch (_e) { /* noop */ }
    },

    _teardown(clearStreaming = true) {
      this._stopProgressPolling()   // the socket is going away; an interval outliving it leaks
      if (this._conn) {
        this._conn.close()
        this._conn = null
      }
      if (clearStreaming) {
        this.isStreaming = false
        this._assistantId = null
      }
    },

    _beginAssistant() {
      this._recovering = false   // fresh turn must never inherit a stale "reconnecting" state
      this._stopProgressPolling()   // nor a poll left over from a previous turn's resume
      this._taskRunActive = false   // a new turn hasn't entered a multi-step task run yet
      this.messages.push({
        id: nid(),
        serverId: null, // DB pk — arrives on `message_saved`, after the answer is persisted
        feedback: null, // thumbs up/down; needs serverId before it can be sent
        role: 'assistant',
        content: '',
        status: 'streaming',
        error: '',
        toolCalls: [],
        planArtifacts: [], // inline plan anchors attached live from plan_event (durable-anchor path)
        citations: [], // P6: KB sources for the "Sources" panel (set on assistant_message_complete)
        answerBasis: null, // provenance envelope (label + cited-or-top4) set on assistant_message_complete
        timeline: null, // activity-timeline snapshot, pinned on completion (friendly, param-free)
        _serverMid: null, // §4b: server's per-turn message_id, adopted from the first stamped event
      })
      this._assistantId = this.messages[this.messages.length - 1].id
      this.isStreaming = true
      this._startDeafWatchdog()
      _think.reset()
      _tl.reset()   // fresh live activity timeline for this turn
    },

    // STAMP THE PLAN STEP THAT OWNS A LIVE ACTIVITY, at the only moment it is knowable.
    //
    // An activity row ("Running a script", "Looking at the image") carries `step_id` =
    // `step_<tool_call_id>` -- its OWN id, with no reference to the plan step it belongs to. The rail
    // therefore had nowhere to nest it. The rows carry no timestamp, so bucketing them against the plan's
    // step boundaries afterwards would be guesswork; live, the snapshot's `current_step_id` IS the answer.
    //
    // Only from a run still in flight. A new run's first activity arrives before its own plan exists,
    // and the conversation's latest snapshot is then the PREVIOUS run, whose `current_step_id` would
    // file this run's preparation under a step of a run that already finished.
    // RE-READ THE RUN AT EVERY SEGMENT BOUNDARY. The rail is drawn from pushed plan snapshots, and a push
    // that never arrives leaves it frozen: prod conv 1608 showed "1 goal check, still running" (event 12)
    // for a run the server had finished — ACHIEVED after three attempts (event 21). A segment starting and
    // the goal closing are the two moments the rail must be current, so they fetch the truth instead of
    // trusting that every push landed. Best-effort; the store applies a snapshot only if it is newer.
    _refreshWorkRun() {
      try {
        const cid = this.conversationId
        if (cid == null) return
        const plan = usePlanStore()
        const runs = plan.runsForConversation(cid) || []
        const latest = runs[runs.length - 1]
        if (latest && latest.run_id) plan.hydrateRun(latest.run_id)
        else plan.hydrateConversation(cid)
      } catch { /* a refresh must never break the stream */ }
    },

    _stampPlanStep(msg) {
      // The server names the step when it knows it (each call of a parallel round is attributed to its
      // own step); the snapshot's single `current_step_id` is only the fallback for frames that do not.
      if (msg && msg.plan_step_id) return
      try {
        const _runs = usePlanStore().runsForConversation(this.conversationId) || []
        const _live = _runs[_runs.length - 1]
        const _over = ['completed', 'failed', 'cancelled', 'insufficient_evidence']
          .includes(String((_live && _live.run_status) || ''))
        if (_live && !_over && _live.current_step_id) msg.plan_step_id = _live.current_step_id
      } catch { /* a nesting hint must never break the stream */ }
    },

    _cur() {
      return this.messages.find((m) => m.id === this._assistantId)
    },

    // The bubble this turn was writing into, even after `_endAssistant` released it.
    //
    // `_cur()` answers "which message is LIVE", which becomes undefined the moment a turn ends. A
    // terminal frame that arrives after that still belongs to the message the turn produced, and
    // dropping its text is how an answer ends up visible only after a page reload.
    _lastAssistantOfTurn() {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const m = this.messages[i]
        if (m.role === 'assistant' && !m.error) return m
      }
      return null
    },

    // Is a PLAN still being worked through for this conversation?
    //
    // PRESENTATION ONLY — read by the timeline header, never by the turn lifecycle. An earlier version
    // of this used the same predicate to SKIP `_endAssistant`, and that was the wrong layer: for the
    // ordinary chat path `chat_response` IS the terminal event, so blocking on it left a turn whose
    // answer had already arrived with nothing to finalize it. The answer was in the database and the
    // screen showed nothing. Delaying a turn's end to fix a label trades a wrong word for a hung UI.
    //
    // What it is for: conversation 1446 showed "Done · 12 steps" directly above "Active plan 0/10",
    // then went back to 2/10 with the spinner running. The turn had not ended; only the header said so.
    // A plan with steps remaining is the plainest evidence that work continues, so the header asks this
    // and nothing else changes.
    _planStillRunning() {
      try {
        const p = usePlanStore().progressForConversation(this.conversationId)
        return !!(p && p.total > 0 && p.done < p.total)
      } catch (e) {
        // A guard that throws must not be able to strand a turn as permanently unfinished.
        return false
      }
    },

    _endAssistant() {
      this._stopDeafWatchdog()
      // While a human approval is pending, DON'T finalize the turn. The task/CRS path can emit a
      // premature "complete" for the step-0 text while the agent is actually blocked on an approval
      // card; finalizing here would show "Done", hide the Stop button, and orphan the pending card.
      // The REAL completion (after the human responds, once hitlRequests is empty) ends the turn.
      if (this.hitlRequests.length > 0) return
      this._stopProgressPolling()
      const m = this._cur()
      if (m) {
        const safeTail = _think.flush()
        if (safeTail) m.content += safeTail
        _tl.finalize()
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()   // pin the activity timeline onto this message
        if (m.status === 'streaming') m.status = 'done'
        // Run finished — notify the browser/OS if the user stepped away (suppressed when actively viewing
        // this chat). Clicking the notification focuses the tab and lands on this agent chat.
        try {
          notifyRunFinished({
            agentName: (this.currentAgent && this.currentAgent.name) || '',
            snippet: m.content, conversationId: this.conversationId,
          })
        } catch { /* best-effort — never block the turn */ }
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
      // SETTLING ON AN EMPTY BUBBLE IS NEVER RIGHT. A finished turn produced something; if this one has
      // nothing, we stopped listening before the backend finished saving — the recovery poll gave up,
      // or a socket died quietly and the answer landed while nobody was watching.
      //
      // MEASURED, conversation 1466: the answer was saved at 10:04:21 and the tab still showed an empty
      // turn at 10:07:03. A manual refresh produced it instantly, because it had been in the database
      // the whole time. One more fetch, once, on the only path that can leave a turn blank.
      if (m && !(m.content || '').trim() && !m.error) {
        Promise.resolve().then(() => this._refreshHistory()).catch(() => {})
      }
    },

    _persistTurnMeta(m) {
      // Snapshot the finished activity timeline back to the server so the "Done · N steps · …"
      // accordion + reasoning survive a page refresh (usage/stop are already persisted server-side).
      // Best-effort: the row was just saved by the turn, so the backend attaches this to it.
      try {
        if (!m || !m.timeline || !this.conversationId || !this._conn) return
        const timeline = JSON.parse(JSON.stringify(m.timeline))
        this._conn.send({ type: 'persist_turn_meta', conversation_id: this.conversationId, timeline })
      } catch { /* best-effort — never block the turn */ }
    },

    _errAssistant(err, retryable = true) {
      this._stopDeafWatchdog()
      const m = this._cur()
      if (m) {
        m.status = 'error'
        m.error = err || 'Something went wrong.'
        m.retryable = retryable
        // interrupt (not finish): the live timeline collapses to "Interrupted", not "Done".
        _tl.interrupt(m.error)
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
    },

    _onEvent(msg) {
      this._lastFrameAt = Date.now()
      const t = msg?.type
      if (t === 'ping') return   // server keepalive heartbeat — nothing to render
      // WORK-MODE ITERATIONS ARRIVE OVER THE USER GROUP, WHICH CARRIES EVERY OPEN TAB.
      //
      // Iteration 1 of a Work run executes on this socket; every later iteration runs in a Celery
      // worker with no socket of its own and is forwarded through `user_<id>`. That group is shared by
      // all of this user's conversations, so a forwarded frame names the conversation it belongs to and
      // anything addressed elsewhere is dropped here — otherwise one conversation's tokens would be
      // appended to another's thread.
      //
      // Scoped to the types that can actually be forwarded: `run_finished` also carries a
      // conversation_id and is deliberately cross-conversation (it fires the browser notification while
      // the user is looking at a different chat), so a blanket guard would silence it.
      if (msg?.conversation_id != null && this.conversationId != null &&
          WORK_FORWARDED_TYPES.has(t) && String(msg.conversation_id) !== String(this.conversationId)) {
        return
      }
      // Inline plan artifact (INLINE_PLAN_ARTIFACT_PLAN.md): a pushed, exact-version plan snapshot.
      // Owned entirely by the plan store — it carries no chat content/usage. Scope to THIS window's
      // conversation (the frame is broadcast to the user group with conversation_id inside). The store
      // applies by (version, sequence) and dedups by event_id; this handler never derives state.
      if (t === 'plan_event') {
        const pcid = msg.conversation_id
        if (pcid == null || this.conversationId == null || String(pcid) === String(this.conversationId)) {
          try {
            usePlanStore().applyPlanEvent(msg)
            // A SECOND WITNESS THAT THE RUN IS OVER. The composer stays busy until `work_goal`, and a
            // run that ended where nothing sent it left the Stop button up indefinitely (prod conv
            // 1578). The plan snapshot carries the goal's persisted state, so a closed goal there
            // releases the turn even if the closing frame never reached this tab.
            if (this._workRunActive) {
              const _rid = msg.run_id || (msg.plan_view && msg.plan_view.run_id)
              const _runs = usePlanStore().runsForConversation(this.conversationId) || []
              const _latest = _runs[_runs.length - 1]
              // Only the conversation's LATEST run may release it: a late snapshot of an earlier,
              // finished run must not end the one running now.
              const _snap = _rid && _latest && String(_latest.run_id) === String(_rid) ? _latest : null
              const _gs = _snap && _snap.work_goal && String(_snap.work_goal.state || '')
              if (['ACHIEVED', 'EXHAUSTED', 'PAUSED', 'ABANDONED'].includes(_gs)) {
                this._workRunActive = false
                this.workIteration = null
              }
            }
            // Live anchor: attach this plan to the current assistant turn so its inline card renders
            // immediately (before the durable anchor is persisted + reloaded on next open). This matches
            // the eventual server anchor (same turn's assistant message).
            const cur = this._cur() || this.messages.filter((x) => x.role === 'assistant').slice(-1)[0]
            const pid = msg.plan_id || (msg.plan_view && msg.plan_view.plan_id)
            const rid = msg.run_id || (msg.plan_view && msg.plan_view.run_id)
            // ONE PLAN, ONE ANCHOR, ACROSS THE WHOLE THREAD.
            //
            // THE DUPLICATE PLAN CARD. This guard used to read `cur.planArtifacts` -- the CURRENT
            // message's own list -- so it could only ever notice a plan anchored twice to the SAME
            // message. A Work run sends a plan_event per segment and each segment produces a new
            // assistant message, so on segment 2 `cur` is a different message, its list is empty, and
            // the same plan_id is anchored again. The card is then rendered once per anchor: the same
            // plan drawn twice, which is exactly what was reported in conv 1542.
            //
            // It could not be found in the run or plan data because it is not there -- the run has one
            // plan and one card's worth of state. The duplication is created here, on the client, by
            // scoping a uniqueness check to a message when the thing being made unique belongs to the
            // conversation.
            if (cur && pid && rid) {
              // WHICH RUN PRODUCED THIS MESSAGE. Stamped on EVERY message the plan events reach, not
              // only the one that wins the anchor below: a Work run sends a plan_event per segment and
              // each segment has its own assistant message, but only the first is anchored. Without
              // this, segments 2..N had no way to tell they belonged to a Work run, and the renderer
              // fell back to asking the CONVERSATION -- a question whose answer is true forever once
              // asked, which is what leaked Work-mode suppression into ordinary chat turns.
              cur.runId = rid
              if (!Array.isArray(cur.planArtifacts)) cur.planArtifacts = []
              const anchoredAlready = this.messages.some(
                (m) => Array.isArray(m.planArtifacts) && m.planArtifacts.some((a) => a.plan_id === pid))
              if (!anchoredAlready) {
                cur.planArtifacts.push({ plan_id: pid, run_id: rid, ordinal: cur.planArtifacts.length })
              }
            }
            // ── Bridge a human plan DECISION to the run's resume plumbing ──────────────────────────
            // The inline card's decision is a REST call that only RECORDS the decision + pushes this
            // outbox event; nothing else re-invokes the agent (that's why "Approve"/"Send changes" did
            // nothing). Wire the canonical change_type to the same resume the legacy WS path used:
            //   approved          → re-send the original instruction; the run executes the approved plan
            //   changes_requested → re-send the feedback as the next instruction; the agent re-plans
            //   cancelled (reject)→ end the turn
            // Guarded once-per-event_id: the canonical outbox may re-deliver a plan_event (sweeper /
            // reconnect), so an approved run can never be re-sent (and re-executed) twice. We do NOT gate
            // on isStreaming/_taskRunActive here — a plan pause returns WITHOUT session_complete, so those
            // flags can still read "active" for the just-paused turn; the event_id guard is what keeps
            // this idempotent. _taskRunActive is cleared before re-sending so the new turn starts clean.
            const ct = msg.change_type
            const eid = msg.event_id
            if ((ct === 'approved' || ct === 'changes_requested' || ct === 'cancelled')
                && (!eid || !this._resolvedDecisionEventIds.has(eid))) {
              if (eid) this._resolvedDecisionEventIds.add(eid)
              this.pendingPlan = null
              this._taskRunActive = false
              if (ct === 'approved') this._resumeAfterPlan()
              else if (ct === 'changes_requested') this._resumeAfterRevise(msg.feedback)
              else this._endAssistant()
            }
          } catch (_e) { /* plan store optional */ }
        }
        return
      }
      // Canvas + Live Preview events (static + web_builder providers) are owned by the canvas store —
      // it reacts to canvas_session_started / preview_ready / preview_updated / preview_failed / etc.
      // handleEvent() returns true when it consumed the event, so we don't also run it through the chat
      // switch below (these carry no chat content/usage).
      try { if (useCanvasStore().handleEvent(msg)) return } catch (_e) { /* canvas store optional */ }
      // Artifacts: the runtime announces every durable file it produced (script source + output, canvas
      // revision, generated media, promoted tool output) from ONE promotion chokepoint. Append it live so
      // the panel is correct mid-turn instead of after a refetch. Carries no chat content/usage.
      if (t === 'artifact_created') {
        try { useArtifactsStore().onArtifactCreated(msg.artifact) } catch (_e) { /* store optional */ }
        return
      }
      // Rich streaming: friendly, param-free activity (Searching → Generating). Feed the shared
      // timeline reducer and stop — these 6 events carry no content/usage to process further.
      if (isRichEvent(msg)) {
        // Which plan step owns this activity — see `_stampPlanStep`.
        this._stampPlanStep(msg)
        _tl.ingest(msg)
        const _rm = this._cur()
        if (_rm && _rm.prepStatus) _rm.prepStatus = ''   // live timeline now drives the status line
        // Live events are reaching us, so this turn is owned by THIS worker and the snapshot poll is
        // redundant — the timeline is strictly fresher than anything a poll could return.
        this._stopProgressPolling()
        return
      }
      const m = this._cur()
      // §4b stale/interrupted-stream guard (defense-in-depth — the backend also drops these
      // server-side). A streamed event carries the server's per-turn message_id; the first one we
      // see binds the bubble, and any later event from a DIFFERENT (superseded) turn is ignored so it
      // can't overwrite the live answer, leak tool-call JSON, or pollute the activity timeline.
      if (m && msg && msg.message_id != null && STREAM_ID_TYPES.has(t)) {
        if (m._serverMid == null) m._serverMid = msg.message_id
        else if (m._serverMid !== msg.message_id) return
      }
      // Feed the live activity timeline (Thinking → tools → Generating → Done). Rich events already
      // returned above; this also folds in reasoning + token metering (no-op for other event types).
      // Reasoning is stamped with its plan step too, so a Work run shows each thought inside the step
      // that was running when the model had it.
      if (t === 'reasoning_delta') this._stampPlanStep(msg)
      if (m && t !== 'error') _tl.ingest(msg)
      switch (t) {
        case 'message_saved': {
          // The answer has been persisted; adopt its DB pk so the thumbs buttons have something to
          // address. Emitted after `assistant_message_complete`, so the bubble may already be 'done' —
          // bind to the last assistant message rather than only to a still-streaming one.
          const target = m || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (target && msg.message_id != null) target.serverId = msg.message_id
          break
        }
        case 'turn_resumed': {
          // We reconnected (e.g. after a refresh) to a turn STILL RUNNING on the server. Open a fresh
          // streaming assistant bubble so the live tokens land, and show WHERE the run actually is —
          // step, running tool and elapsed time — instead of a bare "still working…", which a user
          // cannot tell apart from a hung run.
          if (!this.isStreaming) this._beginAssistant()
          const rm = this._cur()
          if (rm) { rm.reconnecting = false; rm.prepStatus = resumeStatusLine(msg.progress, msg.status) }
          // A turn owned by ANOTHER worker (the usual shape for a signal / schedule / webhook run) never
          // streams a token to this socket, so the line just set would sit frozen until the run ends.
          // Poll the snapshot so it keeps moving; a same-worker turn cancels this on its first live event.
          this._startProgressPolling()
          break
        }
        case 'turn_progress': {
          // Answer to the poll above. Only meaningful while a resumed turn is still on screen.
          const pm = this._cur()
          if (!msg.progress || !Object.keys(msg.progress).length) {
            // The turn ended between polls. Stop polling and let the history refetch land the answer.
            this._stopProgressPolling()
            if (this.isStreaming) this._recoverAfterReconnect()
          } else if (pm && pm.status === 'streaming') {
            pm.prepStatus = resumeStatusLine(msg.progress)
          }
          break
        }
        case 'turn_not_running': {
          // Nothing in flight. But the turn may have FINISHED during the reload gap — only the user row is
          // persisted mid-run, so the loaded history can end at the user's message. If so, re-fetch once to
          // pull in the completed answer (no-op when there's nothing new).
          this._stopProgressPolling()
          const last = this.messages[this.messages.length - 1]
          if (last && last.role === 'user') this._refreshHistory()
          // Nothing is running server-side, so a spinner left over from before the drop is a lie. Settle
          // it against the server's history rather than spinning until the 30s give-up.
          if (this.isStreaming || this._recovering) this._recoverAfterReconnect()
          break
        }
        case 'run_finished': {
          // Cross-tab / cross-worker completion push (over the user_<id> group). Fire the browser
          // notification (deduped with the in-chat completion by the OS tag; suppressed when actively
          // viewing this chat). And if this is THIS conversation and we're still mid-resume — e.g. a
          // cross-worker reconnect where tokens streamed on the owner worker, not here — pull the finished
          // answer from history and clear the streaming state.
          try {
            notifyRunFinished({
              agentName: msg.agent_name, snippet: msg.snippet, conversationId: msg.conversation_id,
            })
          } catch { /* best-effort */ }
          if (String(msg.conversation_id || '') === String(this.conversationId || '')
              && (this.isStreaming || this._recovering)) {
            this._refreshHistory().then((landed) => {
              if (landed) {
                this.isStreaming = false; this._assistantId = null
                this._recovering = false; this._taskRunActive = false
              }
            })
          }
          break
        }
        case 'assistant_message_chunk':
          // A multi-step run can invoke the model repeatedly. Its earlier prose is an in-progress draft,
          // not another answer. The backend marks the first visible chunk of each invocation so the UI
          // keeps one clean, current draft instead of accumulating repetitive paragraphs.
          if (m && msg.replace) {
            m.content = ''
            _think.reset()
          }
          if (m) m.content += _think.feed(msg.chunk || '')
          break
        case 'assistant_message_complete': {
          // The backend sends the CLEANED prose here (tool-call JSON stripped). Always
          // replace the live-streamed text with it so any raw JSON that streamed
          // token-by-token is corrected to clean prose. Tool calls still render as
          // cards via the tool_call/tool_result events + activity timeline.
          //
          // RESOLVED EVEN AFTER THE BUBBLE HAS ENDED, and that is the whole fix.
          //
          // `AssistantMessageComplete` is emitted from EIGHT places in the runtime — the finalize node,
          // the stopped-turn node, the planning gate, the assistance path, execute_tools and three
          // points in graph_runtime — so a turn that crosses two of them sends this frame twice. The
          // first call runs `_endAssistant()`, which sets `_assistantId = null`; `_cur()` then returns
          // undefined and the SECOND frame — the one carrying the real answer — was written into
          // nothing. The reply appeared only on a manual refresh, read back from the database.
          //
          // MEASURED, production conv 1524: a repair loop rendered twice over six model rounds and the
          // thread showed intermediate text until the user reloaded the page. `_endAssistant` already
          // records this symptom from conv 1466 ("the answer was saved at 10:04:21 and the tab still
          // showed an empty turn at 10:07:03") and mitigates it — but only when the bubble is EMPTY, and
          // here the first frame had left stale text in it, so that rescue never fired.
          //
          // The LAST frame is the authoritative one: every emitter sends the answer as it stands at that
          // moment, and the finalize node is the one that runs last. So a later frame must overwrite,
          // which is what this does. It does not change WHEN the turn ends — `_endAssistant` is
          // idempotent and the composer unlocks exactly as before.
          const target = m || this._lastAssistantOfTurn()
          if (target && msg.full_message != null) {
            target.content = stripThinkBlocks(msg.full_message)
            _think.reset()
          }
          if (target && msg.usage) target.usage = msg.usage // per-response token counts
          if (target && msg.stop_reason) { target.stopReason = msg.stop_reason; target.confidence = msg.confidence }
          if (target && Array.isArray(msg.citations)) target.citations = msg.citations // P6: KB sources
          if (target && msg.answer_basis) target.answerBasis = msg.answer_basis
          // TASK/CRS runs stream an assistant_message_complete after EVERY ReAct step (agent_runner
          // _ask_llm), not just the last one — the run keeps going (planning → 13 steps → tools). Those
          // are INTERMEDIATE: update the bubble text but DON'T end the turn, or the UI shows "Done" while
          // the agent is still working. The turn ends only on the real completion signal
          // (agent_session_complete / agent_event session_complete). For the normal chat path (no task
          // run active) this remains the terminal event.
          if (this._taskRunActive) break
          this._endAssistant()
          this._persistTurnMeta(target)   // snapshot the finished timeline so it survives a refresh
          break
        }
        case 'chat_response':
        case 'assistant':
        case 'assistant_message': {
          const c = msg.content || msg.message || msg.full_message
          if (m && c) {
            m.content = stripThinkBlocks(c)
            _think.reset()
          }
          this._endAssistant()
          break
        }
        case 'tool_call':
          if (m) m.toolCalls.push({ name: msg.tool || msg.tool_name || 'tool', status: 'running' })
          break
        case 'tool_result': {
          if (m) {
            const name = msg.tool_name || msg.tool
            const tc =
              m.toolCalls.find((x) => x.name === name) ||
              m.toolCalls[m.toolCalls.length - 1]
            if (tc) {
              tc.status = msg.success === false ? 'error' : 'done'
              // Surface the backend's user-facing failure text. Without this the card shows a bare
              // "Tool failed" and the actionable message ("the image provider is rate-limiting this
              // account — try again in a minute") is discarded, so the user has nothing to act on.
              if (msg.success === false) {
                tc.error = msg.error || ''
                tc.failureKind = msg.failure_kind || ''
              }
            }
            // Live media render (delivery-path-independent): the runner emits generated images as
            // tool_result.media_artifacts. The body only renders images from message.content markdown,
            // so append each image URL here — this makes it show LIVE the moment it's generated, on EVERY
            // completion path (direct_answer / has_generated_media / fast_path), not just one branch. The
            // !includes(url) guard keeps it idempotent with the persisted markdown, so a refresh (which
            // loads the same embedded markdown) never double-renders it.
            // A WORK run shows each call's media inside the step that produced it (the timeline row carries
            // it), and the final answer embeds them all at the end. Appending here as well drew the images
            // into an early "answer" on the rail while the steps were still running.
            const _onRail = m.turnModeResolved === 'work' || !!m.workIteration
            for (const a of (_onRail ? [] : (msg.media_artifacts || []))) {
              // Prefer the ABSOLUTE url (the TASK/runner path adds abs_url); only append absolute URLs so a
              // relative /media/ path (which 404s on the SPA origin) is never injected. The chat path lacks
              // abs_url and renders media through its own final-answer embed, so it's simply skipped here.
              const url = a && (a.abs_url || a.url || a.file_url)
              if (!url || !/^https?:\/\//.test(url) || (m.content || '').includes(url)) continue
              const md = a.type === 'video' ? url : `![image](${url})`
              m.content = (m.content ? m.content.replace(/\s+$/, '') + '\n\n' : '') + md
            }
          }
          break
        }
        // ── Human-in-the-loop: the backend gated a tool for approval ──────────────
        case 'hitl_request': {
          // Scope to THIS window's conversation. HITL requests are broadcast to the user-level group,
          // so every open chat window/tab receives them; only show the card in the window whose
          // conversation triggered the turn (fall back to showing it when no id is present).
          // Strict per-conversation scoping: if the card names a conversation, show it ONLY in the window
          // viewing that conversation — drop it in every other chat / agent / surface (e.g. the Kurumera
          // integration and the Aadml dashboard are separate windows; a card must not leak across them). A
          // legacy card with no conversation_id still falls through (never silently hide a real approval).
          const _hcid = String(msg.conversation_id || msg.payload?.conversation_id || '')
          if (_hcid && _hcid !== String(this.conversationId || '')) break
          // Avoid duplicates if the event is re-delivered.
          if (!this.hitlRequests.some((r) => r.request_id === msg.request_id)) {
            this.hitlRequests.push({
              request_id: msg.request_id,
              interaction_type: msg.interaction_type,
              response_type: msg.response_type,
              summary: msg.summary,
              services: msg.services || [],
              payload: msg.payload || {},
              options: msg.options || [],
              urgency: msg.urgency || 'medium',
              timeout_at: msg.timeout_at || null,
            })
          }
          // Keep the turn ALIVE while this approval is pending. The task/CRS path can emit a premature
          // "complete" for the step-0 text BEFORE this card arrives — which already flipped the turn to
          // "Done" and hid the Stop control. Re-open the streaming turn (re-binding the assistant
          // bubble if it was finalized) so the timeline shows "awaiting approval" and the card + Stop
          // stay visible until the human responds.
          this.awaitingApproval = true
          this.isStreaming = true
          this._startDeafWatchdog()
          {
            const cur = this._cur()
              || this.messages.filter((x) => x.role === 'assistant').slice(-1)[0]
            if (cur) {
              if (this._assistantId == null) this._assistantId = cur.id
              if (cur.status === 'done') cur.status = 'streaming'
            }
          }
          break
        }
        case 'hitl_response_ack':
        case 'hitl_resolved':
          // hitl_response_ack = THIS socket answered; hitl_resolved = broadcast so EVERY window clears the
          // card once it's answered anywhere (no stale card lingering on another window/surface).
          this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== msg.request_id)
          if (this.hitlRequests.length === 0) this.awaitingApproval = false
          break
        // ── Mid-run steering: a message the user sent while the agent was working ──
        case 'message_queued':
          // ack that the backend queued the steering message (the optimistic bubble already shows it).
          break
        case 'steering_applied': {
          // the running agent picked up a queued message — drop the "queued" flag on that bubble.
          const qm = [...this.messages].reverse().find(
            (m) => m.role === 'user' && m.queued && (m.content || '') === (msg.message || ''))
          if (qm) qm.queued = false
          break
        }
        // ── Work mode: a run that keeps going in bounded ITERATIONS ──────────────────────────────
        // Each iteration is a separate dispatch and ends with its own assistant_message_complete, so
        // the bubble still closes per iteration (the answers stay separate, which is what the user
        // wants to read). What must NOT end is the RUN: these two frames are the only thing that says
        // where an iteration boundary is, because the backend does not know whether work continues
        // until AFTER the finalize node has already spoken.
        case 'work_segment': {
          this._refreshWorkRun()
          this._workRunActive = true
          this.workGoal = null
          this.workIteration = { segment: Number(msg.segment) || 1, max: Number(msg.max) || 0 }
          // A LATER ITERATION GETS ITS OWN MESSAGE. Iterations after the first run in a worker and
          // reach this tab over the user group, after the previous iteration's bubble has already
          // closed — so there was no live message, every chunk was dropped, and the iteration's
          // `assistant_message_complete` fell back to the LAST assistant message and overwrote the
          // previous iteration's answer with its own (prod conv 1578: attempt 1's answer vanished and
          // attempt 2's took its place). Opening the message here is what keeps the two apart.
          let _wm = this._cur()
          const _seg = this.workIteration.segment
          const _prevSeg = _wm && _wm.workIteration && Number(_wm.workIteration.segment)
          if (!_wm || (_prevSeg && _prevSeg !== _seg && String(_wm.content || '').trim())) {
            const _prior = [...this.messages].reverse().find((x) => x.role === 'assistant' && x.runId)
            if (_wm) this._endAssistant()
            this._beginAssistant()
            _wm = this._cur()
            if (_wm && _prior) _wm.runId = _prior.runId
          }
          // Tag the bubble this iteration is about to fill. `turnModeResolved` too: the server stamps
          // it only when the message is saved, and until then the message could not tell it belonged
          // on the rail — so it rendered as an ordinary chat turn first and then jumped.
          if (_wm) {
            _wm.workIteration = { ...this.workIteration }
            _wm.turnModeResolved = 'work'
          }
          break
        }
        case 'work_goal': {
          // THE CLOSING HALF, AND IT IS NOT OPTIONAL: the composer stays busy from work_segment until
          // this arrives, so a run that never sends it would lock the composer. The backend emits it on
          // every ending — achieved, exhausted, unverifiable and the error paths.
          this._refreshWorkRun()
          this._workRunActive = false
          this.workIteration = null
          this.workGoal = {
            state: String(msg.state || ''), segments: Number(msg.segments) || 0,
            max: Number(msg.max) || 0, findings: Array.isArray(msg.findings) ? msg.findings : [],
          }
          const _wg = this._cur()
          if (_wg) this._endAssistant()      // idempotent; the last iteration may already have closed
          break
        }
        // ── Task/CRS run lifecycle: a multi-step run (plan → tools) streams an assistant_message_complete
        //    PER step; the turn must end only on the run's terminal event, not the first step. ──
        case 'agent_planning':
          this._taskRunActive = true   // a multi-step task run is in progress
          break
        case 'agent_plan_generated':
          // A `display_only` plan comes from the native chat path purely to render the plan in the
          // timeline — it is NOT a multi-step TASK run and this turn ends on assistant_message_complete
          // (no agent_session_complete follows). Flipping _taskRunActive here would suppress that end
          // signal and lock the composer in steering mode forever. Only real task runs (no display_only)
          // set the flag.
          if (!msg.display_only) this._taskRunActive = true
          // The inline plan card is anchored durably via the message's plan_artifacts (persisted +
          // pushed via plan_event), not a runtime anchor id — nothing to set here.
          break
        case 'agent_session_complete':
        case 'agent_session_stopped':
        case 'agent_session_error': {
          this._taskRunActive = false
          const _tm = this._cur()   // capture before _endAssistant nulls _assistantId
          this._endAssistant()
          if (_tm) this._persistTurnMeta(_tm)   // persist the TASK timeline so "Done · N steps" survives refresh
          break
        }
        case 'agent_event': {
          const aev = msg.event || msg.data?.event
          if (aev === 'session_start') this._taskRunActive = true
          else if (aev === 'session_complete' || aev === 'session_error') {
            this._taskRunActive = false
            const _tm2 = this._cur()
            this._endAssistant()
            if (_tm2) this._persistTurnMeta(_tm2)   // persist the TASK timeline (steps) on the run's terminal event
          }
          break
        }
        // ── v3 Plan Gate (Manual Mode): a plan is ready and awaits a human. The timeline label is
        // already shown via the catch-all ingest above; surface the approval card with the content.
        case 'plan_approval_required':
          this.pendingPlan = msg.plan || {}
          break
        // Human approved server-side → resume by re-sending the original instruction (it now
        // executes because the plan is approved). Rejection just clears the card + ends the turn.
        case 'plan_approved':
          this.pendingPlan = null
          this._resumeAfterPlan()
          break
        case 'plan_rejected':
          this.pendingPlan = null
          this._endAssistant()
          break
        // Human requested changes → the feedback becomes the next instruction; the agent re-plans.
        case 'plan_revise':
          this.pendingPlan = null
          this._resumeAfterRevise(msg.feedback)
          break
        // ── Full-document cost gate (manual / plan-review): a complete-mode KB scope overflowed the model
        //    window. The backend already streamed the explanatory note (assistant_message_complete) and
        //    ended the turn; surface the cost card so the user can approve / reject / ask something focused.
        case 'full_doc_cost_approval': {
          const _fcid = msg.conversation_id
          if (_fcid && this.conversationId && String(_fcid) !== String(this.conversationId)) break
          this.fullDocCostGate = {
            conversationId: _fcid || this.conversationId,
            question: msg.question || '',
            reason: msg.reason || 'context_overflow',
            cost: msg.cost || {},
            actions: msg.actions || [],
          }
          break
        }
        case 'agent_session_complete':
          this._endAssistant()
          break
        case 'stop_acknowledged':
          this._endAssistant()
          break
        case 'error': {
          const em = msg.error || msg.message || ''
          // Benign control-message rejections (e.g. "Unknown message type: ...")
          // must not fail the turn — the actual chat_message still streams/saves.
          if (/unknown message type/i.test(em)) break
          // `retryable: false` means the server knows retrying cannot succeed (a model the account
          // cannot reach, rejected credentials). Carried onto the message so the bubble can withhold
          // the Retry button rather than inviting a re-run that fails identically.
          this._errAssistant(em, msg.retryable !== false)
          break
        }
        default:
          // agent_typing / thought / planning / step — ignored for now
          break
      }
    },
  },
})
