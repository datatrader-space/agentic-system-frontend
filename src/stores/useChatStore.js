// Pinia store — real chat thread + session history (Phase 2 backend wiring).
//
// Flow: pick an Agent Profile → first message starts a conversation
// (POST /agents/<id>/chat/) → live tokens stream over the chat WebSocket
// (ChatConnection). History loads via GET /conversations/.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { ChatConnection } from '../services/chatService'
import { willIngestChatAttachment } from '../services/ingestionPolicy'
import { useCanvasStore } from './useCanvasStore'
import { useArtifactsStore } from './useArtifactsStore'
import { usePlanReviewStore } from './usePlanReviewStore'
import { useVideoStore } from './useVideoStore'
import { useAgentTimeline, isRichEvent, compactionStep } from '../composables/useAgentTimeline'
import { shownCost } from '../composables/tokens'
import { ensureNotifyPermission, notifyRunFinished, pageIsFocused } from '../composables/useRunNotifications'
import { stripThinkBlocks, ThinkStreamFilter } from '../utils/thinkFilter'
import { resumeStatusLine } from '../utils/resumeStatus'
import { voiceReplyOf, voiceReplyFromFrame } from '../utils/voiceNotes'
import { hasLiveHitlCard as _hasLiveCard, hitlNothingToAnswer, skipHitlCard, supersedeHitlCard,
  SUPERSEDED_CARD_MS } from '../utils/hitlQueue'

// One shared live timeline for the currently-streaming assistant message (only one streams at a time).
// Reset per turn, snapshotted onto the message on completion — the SAME reducer the Emulator uses, so
// New Chat shows the identical friendly, param-free activity (Searching → Generating) instead of raw tool I/O.
const _tl = useAgentTimeline()
// The page's focus / visibility listeners for `chat_presence` are added once (`_watchPresence`).
let _presenceListening = false
// Cards this page answered, until the server acknowledges: one the run replaced meanwhile comes back as "Replaced".
const _answeredHitl = new Map()
const _think = new ThinkStreamFilter()

let _seq = 0
const nid = () => `m${++_seq}`

// §4b: streaming-content events stamped with the server's per-turn (turn_id, message_id). Used by the
// stale/interrupted-stream guard in _onEvent to ignore events from a superseded turn.
const STREAM_ID_TYPES = new Set([
  'assistant_message_chunk', 'assistant_message_complete', 'tool_result', 'tool_call',
])

// Frames another process forwards through the shared `user_<id>` group (`work_stream`: a chat turn whose socket
// dropped while the person reconnected on another worker). Must match `_WORK_STREAM_TYPES` in
// agent/headless_consumer.py — each one names its conversation so _onEvent can drop anything meant for a different tab.
const WORK_FORWARDED_TYPES = new Set([
  'assistant_message_chunk', 'assistant_message_complete', 'reasoning_delta', 'reasoning_done',
  'tool_call', 'tool_result', 'tool_blocked', 'error',
  // The activity timeline (useAgentTimeline's RICH_EVENT_TYPES) plus the live token counter.
  'agent_status', 'agent_step_started', 'agent_step_completed', 'agent_step_failed',
  'source_citation', 'agent_turn_summary', 'token_usage',
  // The composer's context ring and the "earlier work summarized" row (agent/runtime/run_compaction.py), and a
  // "Compact now" the server could not do (said in words).
  'context_usage', 'run_compacted', 'compaction_failed',
])

// Frames only a turn that is STILL RUNNING sends. One of these arriving is proof the turn is alive,
// which a keepalive `ping` is not (the socket pings whether or not anything is running), and neither is
// a frame that ends a turn.
const TURN_ALIVE_TYPES = new Set([
  'assistant_message_chunk', 'reasoning_delta', 'reasoning_done', 'tool_call', 'tool_result',
  'tool_blocked', 'agent_status', 'agent_step_started', 'agent_step_completed',
  'agent_step_failed', 'source_citation', 'token_usage', 'todo_update',
])

// The frames the run's event stream joins into one row per round (agent/runtime/durable_events.py,
// COALESCED_TEXT_FIELD): the text and the reasoning as they are typed.
const STREAMED_DELTAS = new Set(['assistant_message_chunk', 'reasoning_delta'])

//: What the page sends after "Approve & run" (see `_resumeAfterPlan`).
export const PLAN_APPROVED_CONTINUE = 'Approved. Carry out the approved plan, from its first step that is not done.'
//: A second resume for the same approval inside this window is not sent (the server would refuse it).
const PLAN_RESUME_DEDUPE_MS = 15000

function pickArray(d) {
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.results)) return d.results
  return []
}

// The memories an answer REALLY saved ("Saved to memory", backend ADM-1264 M3): the saved row's list and the live
// `memory_saved` frames, one chip per memory id. The row is the ground truth of a save — it comes from the
// ledger, never from what the model said — so nothing saved means no chips and no row.
export function mergeSavedMemories(held, incoming) {
  const out = [...pickArray(held)]
  const ids = new Set(out.map((c) => c && c.id))
  for (const c of pickArray(incoming)) {
    if (!c || c.id == null || ids.has(c.id)) continue
    ids.add(c.id)
    out.push(c)
  }
  return out
}

// One page of chat history. Deliberately small: the drawer opens on the recent page and pulls older
// ones on demand, so a user with hundreds of chats doesn't pay for all of them to open a chat.
const HISTORY_PAGE_SIZE = 25

// One window of a conversation's messages: the size the server opens a conversation with
// (ChatConversationSerializer.DEFAULT_MESSAGE_WINDOW) and pages older messages by.
const MESSAGE_WINDOW = 50

// DRF PageNumberPagination reports the full total in `count`. An unpaginated (bare-array) response
// has no total — fall back to what we hold, which reads as "nothing more to load".
// The agent's task list for a conversation (TODO_WRITE, AGENT_ENGINE_CAPABILITIES_PLAN.md section 7): the same shape
// from the `todo_update` frame, from the conversation's `todos` on load and from the turn's `run_finished` frame. An
// item without words is not a task. `stopped` (with its `reason`) is written by the server when the run settles
// (ADM-1296): an item the turn left in progress, drawn still.
const TODO_STATUSES = new Set(['pending', 'in_progress', 'completed', 'stopped'])
export function normalizeTodos(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((t) => t && typeof t.content === 'string' && t.content.trim())
    .map((t) => ({
      content: t.content.trim(),
      status: TODO_STATUSES.has(t.status) ? t.status : 'pending',
      activeForm: typeof t.active_form === 'string' && t.active_form.trim() ? t.active_form.trim() : '',
      ...(t.status === 'stopped' ? { reason: typeof t.reason === 'string' ? t.reason.trim() : '' } : {}),
    }))
}

function countOf(d, loaded) {
  return d && typeof d.count === 'number' ? d.count : loaded
}

// Append a page, dropping ids we already hold. A conversation bumped to the top by new activity
// between two page fetches would otherwise arrive twice and duplicate a row.
function mergeById(current, incoming) {
  const seen = new Set(current.map((s) => String(s.id)))
  return current.concat(incoming.filter((s) => !seen.has(String(s.id))))
}

// The chat frame a replayed run event carries, or null for a lifecycle event (`plan_created`, `run_completed`: no
// frame). The server sends the frame's type in `frame` and the frame itself in `payload` (`run_events.entry`). The
// page read `frame` as the frame object, so on a reload it applied nothing, only cleared the bubble, and the timeline
// came back from the next live frame on: 13 steps from "Creating a file" instead of 24 (phase 8 run 3, finding 30).
function replayedFrame(e, conversationId) {
  if (!e || typeof e.frame !== 'string' || !e.frame || !e.payload || typeof e.payload !== 'object') return null
  const frame = { ...e.payload, type: e.frame }
  if (frame.conversation_id == null) frame.conversation_id = conversationId
  return frame
}

//: The composer's modes (LONG_RUN_LIKE_CLAUDE_CODE_PLAN §3.2). There is no "auto": the mode is the conversation's,
//: kept by the server (`turn_mode` on the conversation) and read when the chat opens.
export const TURN_MODES = ['chat', 'work', 'plan']

// What a sent message's bubble shows of each attachment (a voice note plays from its local recording until the
// saved copy is loaded).
function _bubbleAttachment(a) {
  return { name: a.name, isImage: a.isImage, url: a.url, mime: a.mime, attachment_id: a.attachment_id,
    isAudio: !!a.isAudio, isVoiceNote: !!a.isVoiceNote }
}

/**
 * An answer's saved timeline with a row for each compaction the server saved on it (`model_info.compactions`,
 * `agent.runtime.run_compaction`). The page's own snapshot normally holds them already; one that lacks them (it
 * was not saved, or was written before the row existed) gets the missing ones at the top of its steps, and an answer
 * with no snapshot gets a finished timeline holding only them. So the row stays after a reload, whatever the snapshot.
 * A "Compact now" (`scope: 'manual'`) was made AFTER the answer it is saved on, so its row goes at the end.
 */
export function timelineWithCompactions(timeline, saved) {
  const rows = Array.isArray(saved) ? saved.filter((c) => c && typeof c === 'object') : []
  if (!rows.length) return timeline || null
  const base = timeline && typeof timeline === 'object' ? timeline : {
    statusLabel: '', steps: [], sources: [], summary: null, isComplete: true, interrupted: false,
  }
  const steps = Array.isArray(base.steps) ? base.steps.slice() : []
  const runRows = rows.filter((c) => c.scope !== 'manual')
  const manualRows = rows.filter((c) => c.scope === 'manual')
  const have = steps.filter((st) => st && st.isCompaction && !st.isManualCompaction).length
  const haveManual = steps.filter((st) => st && st.isManualCompaction).length
  const missing = runRows.slice(have).map((c, i) => compactionStep(c, `compact_saved_${have + i}`))
  const missingManual = manualRows.slice(haveManual)
    .map((c, i) => compactionStep(c, `compact_manual_saved_${haveManual + i}`))
  if (!missing.length && !missingManual.length) return base
  return { ...base, steps: [...missing, ...steps, ...missingManual] }
}

/**
 * A `context_usage` frame (or a conversation's saved measurement) as the ring reads it, or null when it says nothing
 * usable. `percent` is the share of the model's window in use; `compactAt` the share at which the run summarizes.
 */
export function normalizeContextUsage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const used = Number(raw.used_tokens)
  const window = Number(raw.window_tokens)
  if (!isFinite(used) || !isFinite(window) || used < 0 || window <= 0) return null
  const compactAt = Number(raw.compact_at_percent)
  return {
    used: Math.round(used),
    window: Math.round(window),
    percent: Math.max(0, Math.min(100, Math.round((used / window) * 100))),
    compactAt: isFinite(compactAt) && compactAt > 0 ? Math.round(compactAt) : null,
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isStreaming: false,
    conversationId: null,
    repoId: 0,
    // The open conversation's task list ({content, status, activeForm}), drawn near the composer. Set from the
    // conversation on load and replaced by each `todo_update` frame of this conversation; empty hides it.
    todos: [],

    // Create-Image mode (per-turn signal, sticky in the composer). When on, the backend runs the agent as
    // a focused image generation/editing assistant (image toolset + guided pipeline prompt). Sent as
    // `image_mode` on each WS message while on. Requires the agent to have an image model (composer blocks
    // the toggle otherwise).
    imageMode: false,
    // Video Studio's Agent / Manual mode (D15), sent with every message while the Studio is open ('' elsewhere).
    studioMode: '',
    // The Video Studio page this message is sent from ({page, preset?, preset_title?, helper?}), set by the page.
    studioContext: null,
    // A surface's own frames (Let's Code: the diff card, the permission card, the app preview). Called with each
    // frame before the chat handles it; returning true means the surface consumed it.
    surfaceHandler: null,
    // Let's Code: the project a NEW chat is bound to, set only while the project page is open. Never read from
    // `repoId`, which also holds the repository of an old project chat opened from the main chat's history.
    newChatRepoId: null,
    // DEEP RESEARCH mode (per-turn signal, sticky in the composer) + the DEPTH the user picked.
    // The depth is a COST decision, so it is the user's and not the model's: it sets how many independent
    // sub-questions one research fan-out may open and how many source pages each of those must read. Sent
    // as `research_mode` / `research_depth`; the backend enforces both when the agent launches a research subagent and states
    // the budget in the turn's tool guidance, so the agent plans to it instead of discovering it.
    researchMode: false,
    researchDepth: 'standard',
    // CHAT / WORK / PLAN for the open conversation — one engine, three defaults (see TurnModeSwitch). Set from the
    // conversation when it opens (`turn_mode`, the person's choice kept by the server, else its default: Work in a
    // Coding Agent project chat, Chat elsewhere) and sent with every message, so the server keeps the choice.
    // A new chat starts on Chat; a new Let's Code project chat on Work (`reset`, `newChatRepoId`).
    turnMode: 'chat',
    // The mode Plan returns to (Chat or Work): Plan is picked in the composer's Mode menu beside Manual and Autonomous,
    // like Claude Code's plan mode, and leaving it goes back to where the person was. The switch shows this one.
    planReturnMode: 'chat',
    // HOW FULL THE MODEL'S CONTEXT WINDOW IS for the open conversation, like Claude Code's ring: `{ used, window,
    // percent, compactAt }` from the run's `context_usage` frames, and from the conversation when it opens (its last
    // measurement). null = not measured yet (a new chat, or a model whose window is unknown): the ring is not shown.
    contextUsage: null,
    // The person's own "Compact now" of the open chat (the ring's menu): status '' | 'running' | 'done' | 'failed', and
    // the words the server answered (a refusal or a failure) or the row's own line when it is done.
    compaction: { status: '', message: '' },
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

    // Once-guard: event_ids of plan DECISION events (approved / changes_requested / cancelled) already
    // bridged to a resume. The canonical outbox may re-deliver a plan_event (sweeper / reconnect), so
    // this prevents an approved run from being re-sent (and re-executed) more than once.
    _resolvedDecisionEventIds: new Set(),
    // The last turn THIS page sent was in plan mode: its plan comes as a `plan_approval` card, and the run's
    // older `plan_approval_required` event for the same plan is display-only (never a second card, never a pause).
    _planModeTurn: false,
    // The last run event this page APPLIED, per conversation (backend phase 1b: `run_events_replay` events carry
    // the run's own `seq`). A reconnect asks for what came after it; an event at or below it is never applied
    // twice. Cleared when a conversation is opened from history: the page then has no turn on screen to continue.
    _runSeq: {},
    // This turn's text or reasoning reached the page as it streamed (not from the run's stored events), and a frame
    // being applied comes from those stored events: together they keep a followed run's live copy of the same text
    // from being drawn twice (_applyRunEvents).
    _heardDeltasLive: false,
    _replaying: false,

    // A plan the run's older `plan_approval_required` frame paused on (not plan mode, whose plan is answered on its
    // `plan_approval` card). Feeds the "Waiting for approval" header and the WS resume mechanic only.
    pendingPlan: null,
    // Full-document cost gate (manual mode): a complete-mode KB scope overflowed the model
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
    _builtinsPromise: null,         // single-flight for the built-in agents list
    _superAgentPromise: null,       // single-flight for the Super Agent card

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
    // A chat the page LEFT while its turn was running keeps its own socket, so the turn keeps its connection and
    // runs to the end (closing a turn's socket starts the server's 15-minute stop; ADM-1221). conversationId ->
    // the ChatConnection. Opening that chat again takes the socket back; the turn's end closes it.
    _parked: {},
    // What each such chat is doing, for the tabs that show it: 'working' | 'needs_input' | 'done' | 'failed'.
    parkedRuns: {},
    // A surface's hook for the frames of a chat it left (Let's Code: the files a background turn changed).
    parkedFrameHandler: null,
    // Whether leaving a running chat parks it. The Coding Agent's tabs turn it on (owner 2026-11-12: "this is only
    // for coding agent"); every other chat keeps its one socket, as before.
    keepRunsOnLeave: false,
    _assistantId: null,
    _planResumeSentAt: 0,   // when this page last sent the turn that carries out an approved plan
    newChatProjectId: null, // the project a NEW chat is started in (?project= on /dashboard/chat/new)
    conversationProjectId: null, // the project the OPEN chat is filed in (null: none)
    // setInterval handle for the resumed-turn progress poll (see _startProgressPolling).
    _progressTimer: null,
    // What this page last told the server about the chat it shows (`chat_presence`): "<conversation>|<viewing>".
    _presenceSent: '',
    _presenceTimer: null,
    //: When a frame last arrived from the server, and the watchdog that notices when they stop.
    //: A socket can die WITHOUT onClose/onError — a server restart whose FIN never reaches the browser,
    //: or a half-open connection — and then nothing on this page ever learns the turn finished.
    _lastFrameAt: 0,
    _deafTimer: null,
    //: When this page last had PROOF the turn on screen is still running: a frame of the turn itself,
    //: or the server answering "it is running" to a `turn_progress` question. Recovery reads it so it
    //: never settles a turn that is plainly still going.
    _turnAliveAt: 0,
    //: One recovery at a time. Three things ask for one (the socket opening, the server saying nothing
    //: runs, the silence watchdog) and they overlap.
    _recoveryRunning: false,
    //: True after several failed reconnects in a row: the chat shows "Connection lost" with a
    //: "Reconnect now" action while the socket keeps retrying on its own (it never gives up).
    connectionLost: false,
    //: True while the run host that runs this chat's turn restarts (LONG_RUN_LIKE_CLAUDE_CODE_PLAN.md phase 1d): the
    //: server sent `agent_status` reason RUN_HOST_RESTART and has not yet said the turn continues. The turn is
    //: handed on, not ended: it keeps showing it runs (Stop stays), and nothing here settles or errors it while the
    //: next host picks it up. Cleared by RESUMED_AFTER_RESTART, `turn_resumed` with `after_restart`, or the turn's end.
    runHostRestarting: false,
    //: openConversation bookkeeping (F-C3): the conversation being loaded right now, and the one whose
    //: last load FAILED, so re-opening that chat loads it again instead of no-oping on an empty thread.
    _loadingConversationId: null,
    _loadFailedConversationId: null,
  }),
  getters: {
    isEmpty: (s) => s.messages.length === 0,
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
      a + ((m.usage && shownCost(m.usage))
           || (m.status === 'streaming' && _tl.tokens.value && _tl.tokens.value.cost) || 0), 0),

    //: True while a turn is working (the composer reads it to keep Stop up).
    isBusy: (s) => s.isStreaming,

    // ── Live activity timeline (the currently-streaming message) — the SOLE activity renderer
    // (AgentActivityTimeline): friendly, param-free steps (Searching → Generating), reasoning, tokens. ──
    richActive: () => _tl.hasActivity(),
    //: True while this conversation's plan waits for the person's decision: the turn has ended on the plan card and
    //: nothing runs until they choose. The paused turn reads "Waiting for approval". A plan's progress after that is
    //: the task list's alone (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md).
    planAwaitingApproval: (s) => !!s.pendingPlan,
    liveStatus: () => _tl.currentStatus.value,
    liveSteps: () => _tl.steps.value,
    liveSources: () => _tl.sources.value,
    liveSummary: () => _tl.summary.value,
    liveComplete: () => _tl.isComplete.value,
    liveReasoning: () => _tl.reasoning.value,
    // The live turn's running token count and when it began here: the Work timeline's status line (ADM-1302).
    liveTokens: () => _tl.tokens.value,
    liveStartedAt: () => _tl.startedAt.value,
    //: Is the newest turn a WORK turn? Its approvals and questions go onto its rail (ADM-1302); the surfaces keep them
    //: where they were for a Chat or Plan turn.
    latestTurnIsWork: (s) => {
      for (let i = s.messages.length - 1; i >= 0; i--) {
        const m = s.messages[i]
        if (m && m.role === 'assistant') return m.turnMode === 'work'
      }
      return false
    },
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
        // The list never picks an agent. Which agent a chat runs is the page's decision (?agent=, the
        // conversation's own agent, else the Platform Super Agent); picking the first library agent here
        // raced it, and a Super Agent chat loaded another agent's model, voice and effort settings first.
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
      await Promise.all(this._chattableSources())
    },

    // The three sources of chattable agents, each its own (shared, in-flight) request.
    _chattableSources() {
      return [
        this.loadAgents(),
        this.ensureSuperAgent().catch(() => null),
        this._loadBuiltinAgents(),
      ]
    },

    _loadBuiltinAgents() {
      if (this._builtinsPromise) return this._builtinsPromise
      this._builtinsPromise = (async () => {
        try {
          const { data } = await api.listBuiltinAgents()
          const rows = Array.isArray(data) ? data : (data && data.agents) || []
          for (const b of rows) {
            if (!b || b.id == null) continue
            if (this.agents.some((a) => String(a.id) === String(b.id))) continue
            this.agents.push({ ...b, is_builtin_agent: true })
          }
        } catch (e) { /* built-ins are optional — the picker still lists own agents */ }
      })().finally(() => { this._builtinsPromise = null })
      return this._builtinsPromise
    },

    // The ONE shared Platform Super Agent — the DEFAULT agent for a naked New Chat (no ?agent=…).
    // Lazily fetched (the endpoint also provisions it server-side) and cached in the agents list so
    // currentAgent/mode/model wiring all resolve normally. Returns the agent or null.
    async ensureSuperAgent() {
      const sa = this.agents.find((a) => a.is_platform_super_agent)
      if (sa) return sa
      if (this._superAgentPromise) return this._superAgentPromise
      this._superAgentPromise = (async () => {
        try {
          // SLIM card: chat only needs identity + run mode + image model. The full payload (capability
          // inventory / tool catalog) belongs to the Super Agent page, not to opening a chat.
          const { data } = await api.getSuperAgentCard()
          if (data && data.id) {
            if (!this.agents.some((a) => String(a.id) === String(data.id))) this.agents.push(data)
            return data
          }
        } catch { /* no super agent available (e.g. backend down) — caller falls back */ }
        return null
      })().finally(() => { this._superAgentPromise = null })
      return this._superAgentPromise
    },

    // Make agent `id` resolvable in `agents` so currentAgent, the composer and the header find it. A shared
    // agent (the Platform Super Agent, a built-in such as Video Studio) is never in the library list and
    // /agents/<id>/ does not return it, so it comes from the chattable set; any other agent by id.
    // Without this a reloaded shared-agent chat showed "Choose an agent" and no agent name (2026-10-20).
    async ensureAgent(id) {
      const has = () => this.agents.find((a) => String(a.id) === String(id)) || null
      if (id == null || id === '' || has()) return has()
      // Settle on the FIRST source that brings the agent in, not on the slowest of the three: the
      // library list is the slowest, and a Super Agent chat waited for it although its own card was
      // already in.
      const found = await Promise.any(this._chattableSources().map((p) => Promise.resolve(p)
        .catch(() => null)
        .then(() => has() || Promise.reject(new Error('not in this source'))))).catch(() => null)
      if (found) return found
      try {
        const { data } = await api.getAgent(id)
        if (data && data.id != null && !has()) this.agents.push(data)
      } catch { /* not visible to this user */ }
      return has()
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
      // conversation (the first message creates a new one and conversation_created sets the id). A turn still
      // running is never stopped by it: its chat keeps its socket and runs on (_parkIfBusy), and the new chat
      // gets a socket of its own, since one socket runs one turn at a time.
      this._parkIfBusy()
      this._clearTurnState()
      this.messages = []
      this.conversationId = null
      this.todos = []
      // A new chat starts on its default mode: Work for a Coding Agent project chat (Let's Code), Chat elsewhere.
      this.turnMode = this.newChatRepoId ? 'work' : 'chat'
      this.planReturnMode = this.turnMode
      this.contextUsage = null
      this.compaction = { status: '', message: '' }
      this.error = ''
      this.messagesHasMore = false
      this.messagesTotal = 0
      this.pendingPlan = null
      this.fullDocCostGate = null
      this.newChatProjectId = null
      this.conversationProjectId = null
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
    // A STEER row (a message the person sent while a run worked, taken in by that run) is shown INSIDE the
    // run that took it in: in the following answer's step list, never as a bubble of its own (its saved order
    // — before the answer — made it jump above the answer on reload). If the answer's saved timeline lacks
    // the line (the snapshot is written after the answer), it is added at the top of that run's steps. With
    // no run timeline to hold it, it stays a bubble: the person's words are never dropped.
    // The waiting bubble a steering frame is about: by the saved row's id, then by the page's own client id, then
    // (an older server) by its words. Newest first, so two equal messages resolve to the latest.
    _queuedBubble(msg) {
      const waiting = [...this.messages].reverse().filter((m) => m.role === 'user' && m.queued)
      if (msg.message_id != null) {
        const byId = waiting.find((m) => m.serverId != null && String(m.serverId) === String(msg.message_id))
        if (byId) return byId
      }
      if (msg.client_message_id) {
        const byClient = waiting.find((m) => m.clientMessageId === msg.client_message_id)
        if (byClient) return byClient
      }
      const text = msg.message || ''
      return waiting.find((m) => (m.content || '') === text) || null
    },

    _foldSteers(list) {
      const out = []
      for (let i = 0; i < list.length; i++) {
        const m = list[i]
        if (!(m && m.role === 'user' && m.kind === 'steer')) { out.push(m); continue }
        let next = null
        for (let j = i + 1; j < list.length; j++) { if (list[j] && list[j].role === 'assistant') { next = list[j]; break } }
        const steps = next && next.timeline && Array.isArray(next.timeline.steps) ? next.timeline.steps : null
        if (!steps) { out.push(m); continue }
        const text = String(m.content || '').trim()
        if (!steps.some((st) => st && st.isSteer && String(st.label || '').trim() === text)) {
          steps.unshift({
            stepId: `steer_${m.serverId || i}`, toolCallId: '', phase: 'steer', tool: '', argsPreview: '',
            label: text, status: 'ok', summary: '', durationMs: null, reason: '', nextAction: '',
            coalescedCount: 0, isSteer: true,
          })
        }
      }
      return out
    },

    _mapServerMessage(m, conversationId) {
      const info = m.model_info || {}
      return {
        id: nid(),
        // The DATABASE pk, kept alongside the client-side id. Message actions that hit the
        // backend (thumbs feedback) address this, not the local `id`.
        serverId: m.id ?? null,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        // 'plan_approval' marks the turn "Approve & run" started; it renders as the approval, not a bubble.
        kind: m.kind || 'message',
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
        // Searching → Generating activity timeline (with reasoning) as it was, with every compaction the server
        // saved on the answer (a reload never loses the row).
        timeline: timelineWithCompactions(info.timeline || null, info.compactions),
        // Provenance replay (decision #4): the answer_basis envelope carries the label + the
        // cited-or-top-4 sources, so a reopened chat shows the SAME footer + clickable panel.
        answerBasis: info.answer_basis || null,
        citations: (info.answer_basis && info.answer_basis.citations) || [],
        // WHICH RUN PRODUCED THIS MESSAGE — stamped by the server on every writer (agent/services/turn_metadata.py).
        runId: info.run_id || '',
        // WHO WROTE A USER-ROLE MESSAGE. A work run's continuation segments are persisted as
        // role='user' rows because the runtime reads the conversation back as turns — but the user
        // never typed them, and drawing them as their own blue bubble is what made conv 1561 read as
        // if the operator kept shouting "DO THE NEXT PIECE OF WORK". Absent == authored by the user.
        authoredBy: info.authored_by || 'user',
        // Let's Code: the checkpoint taken before this user message's turn first changed a file, so the chat can
        // offer "Restore to before this message" (AGENT_ENGINE_CAPABILITIES_PLAN.md section 9).
        restoreCheckpointId: (m.metadata && m.metadata.restore_checkpoint_id) || null,
        // User-uploaded attachments bound to this message (turn-level binding) — served /media/ URLs so
        // the thumbnail survives refresh (the live send-time blob URL is ephemeral).
        attachments: pickArray(m.attachments),
        // The answer spoken back to a voice note (VOICE_NOTES_PLAN.md), from its saved media.
        voiceReply: voiceReplyOf(m),
        // Connector buttons (Connect / Sign in again / Assign) CONNECT_SERVICE offered with this answer,
        // persisted on model_info so they stay in history after a reload.
        chatActions: pickArray(info.chat_actions),
        // The memories this answer drew on ({ref, kind, text, via, id?, status?}) — shown as chips under
        // it, where a fact can be marked outdated or forgotten. Persisted on model_info like the rest.
        memories: pickArray(info.memories),
        // The plan file this answer gave for review (plan mode): its file card under it.
        planFile: info.plan_file || null,
        // The memories this turn really saved ("Saved to memory"), kept on the answer by the server.
        memoriesSaved: pickArray(info.memories_saved),
        // The mode the turn ran in, stamped on the saved answer (backend `turn_metadata`): a Work answer is drawn on
        // the rail again, as it was live (ADM-1302). An answer saved before the stamp existed has none: the card.
        turnMode: info.turn_mode || '',
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
        const res = await api.getConversationMessages(id, { before: oldest.serverId, limit: MESSAGE_WINDOW })
        if (String(this.conversationId) !== String(id)) return   // switched conversation mid-flight
        const data = res.data || {}
        const older = pickArray(data.results).map((m) => this._mapServerMessage(m, id))
        this.messages = this._foldSteers(older.concat(this.messages))
        this.messagesHasMore = !!data.has_more
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
      // A load of this same conversation still in flight is not repeated. A load that FAILED is: the
      // thread is empty and only another request can fill it (it used to no-op whenever a socket existed).
      const sameId = String(this.conversationId) === String(id)
      if (sameId && String(this._loadingConversationId) === String(id)) return
      if (sameId && String(this._loadFailedConversationId) !== String(id) && (this.messages.length || this._conn)) return
      this._forgetRunSeq(id)
      // A chat left while its turn ran: take its socket back, so its live stream reaches this view (the server
      // sends a turn's frames to the socket that runs it). The chat on screen keeps running on its own socket if
      // it is busy, or its idle socket closes. A busy chat left for any other chat keeps running the same way.
      const _parked = this._parked[String(id)]
      if (_parked) {
        if (!this._parkIfBusy()) this._teardown(false)
        this._unpark(String(id), false)
        _parked.handlers = this._connectionHandlers()
        this._conn = _parked
      } else {
        this._parkIfBusy()
      }
      this._clearParkedRun(String(id))
      this._clearTurnState()   // switch conversation: clear UI state but KEEP the shared socket
      this.conversationId = String(id)
      this._loadingConversationId = String(id)
      this._loadFailedConversationId = null
      this.messages = []
      this.todos = []
      this.messagesHasMore = false   // recomputed from this conversation's response below
      this.messagesTotal = 0
      this.pendingPlan = null
      this._clearAttachments()
      this.loadingHistory = true
      this.error = ''
      try {
        const res = await api.getConversation(id)
        // The person opened another chat while this one loaded: its response must not land there.
        if (String(this.conversationId) !== String(id)) return
        const data = res.data || {}
        this.conversationProjectId = data.project ?? null
        this.todos = normalizeTodos(data.todos)
        // The conversation's mode: the person's choice kept by the server, else its default (Work in a Coding Agent
        // project chat, Chat elsewhere) — the server answers both in `turn_mode`.
        this.turnMode = TURN_MODES.includes(data.turn_mode) ? data.turn_mode : 'chat'
        this.planReturnMode = data.repository ? 'work' : 'chat'
        this.contextUsage = normalizeContextUsage(data.context_usage)
        this.compaction = { status: '', message: '' }
        this.messages = this._foldSteers(pickArray(data.messages).map((m) => this._mapServerMessage(m, id)))
        // Message windowing: the server returns the most recent page (see ChatConversationSerializer)
        // and reports whether older ones exist. loadOlderMessages() walks backwards from the oldest
        // row we hold. Older servers send neither field — then there is nothing more to fetch.
        this.messagesHasMore = !!data.has_more_messages
        this.messagesTotal = data.message_count || this.messages.length
        // The conversation's repository picks the socket (a Let's Code project chat → /ws/chat/repository/<id>/,
        // where the turn gets the project's CODE_* tools). The backend serializes it as a bare PK, like
        // agent_profile below; reading `.id` of that number lost it, so a reopened project chat went to the plain
        // agent socket and the agent said its "Code Mode" was off (prod conv 3200, 2026-11-09, ADM-1188).
        const repo = data.repository
        this.repoId = Number((repo && typeof repo === 'object' ? repo.id : repo) || data.repository_id || 0)
        // Backend serializes agent_profile as a bare PK (integer), with the human name
        // exposed separately as agent_profile_name — so read the id directly (older code
        // expected a nested object, which left selectedAgentId unset and hid the mode pill).
        const agentPk = (data.agent_profile && data.agent_profile.id) || data.agent_profile
        if (agentPk) {
          this.selectedAgentId = String(agentPk)
          this.ensureAgent(agentPk)   // not awaited: the history renders now, the agent's name follows
        }
        this._connect()
        // The socket taken back still points at this chat, so connecting asks nothing: ask whether its turn runs.
        if (_parked && this._conn === _parked) this._conn.sendIfOpen({ type: 'resume', conversation_id: String(id) })
      } catch {
        if (String(this.conversationId) !== String(id)) return
        this._loadFailedConversationId = String(id)
        this.error = 'Failed to load conversation'
      } finally {
        // Only the load of the chat still on screen owns these flags; a stale one leaves them alone.
        if (String(this._loadingConversationId) === String(id)) this._loadingConversationId = null
        if (String(this.conversationId) === String(id)) this.loadingHistory = false
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
        // A project chat (Let's Code) is bound to its repository; every other chat has none.
        const res = await api.startAgentChat(this.selectedAgentId, this.newChatRepoId || null, this.newChatProjectId)
        const d = res.data || {}
        this.conversationId = String(d.conversation_id ?? d.profile_id ?? '')
        this.repoId = d.repository_id || 0
        if (!this.conversationId) throw new Error('no conversation id')
        this.conversationProjectId = d.project_id ?? this.newChatProjectId ?? null
        this._connect()
        this.loadSessions(true)      // force-refresh this agent's history so the new chat shows up
        this.loadAllSessions(true)   // force-refresh the global recent-chats list + search
        return this.conversationId
      } catch {
        this.error = 'Failed to start chat.'
        notify.error('Could not start the chat. Your message is still in the box, so you can send it again.')
        return null
      }
    },

    // Canvas signalling for the WS message: `canvas_mode` auto-exposes the design tools for the turn,
    // and `canvas_selection` targets a specific element. For web_builder we send the STABLE element id
    // (not outerHTML) so the backend's builder tools can edit that exact entity (Phase 3B A13/A14);
    // static keeps sending the captured element markup.
    // Chat / Work / Plan for the open conversation. Sent with the next message, which is when the server keeps it as
    // the conversation's choice; a name that is not a mode changes nothing.
    setTurnMode(mode) {
      if (!TURN_MODES.includes(mode)) return
      if (mode === 'plan' && this.turnMode !== 'plan') this.planReturnMode = this.turnMode
      if (mode !== 'plan') this.planReturnMode = mode
      this.turnMode = mode
    },
    // Leave Plan for the mode it was entered from (Chat or Work).
    leavePlanMode() {
      if (this.turnMode === 'plan') this.turnMode = this.planReturnMode === 'work' ? 'work' : 'chat'
    },

    _canvasSendOpts() {
      let canvas
      try { canvas = useCanvasStore() } catch (_e) { return {} }
      const opts = {}
      if (canvas.mode) {
        opts.canvasMode = true
        // Which Canvas: the backend grants a different toolset for static / nextjs / web_builder.
        opts.canvasKind = canvas.kind
      }
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
          // Wait for ingestion only for a file the backend ingests (documents); video, audio and opaque
          // binaries are never ingested, so waiting on them only held Send for ~60 s.
          if (!a.isImage && fileId != null && willIngestChatAttachment(a.mime || a.file?.type, a.name)) {
            docs.push({ id: fileId, name: a.name })
          }
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

    // Returns false when the message was NOT sent, so the page can give the person their text back:
    // the composer clears itself on submit, and a chat that failed to start used to lose the message
    // without a word (seen twice in live tests right after a deploy, 2026-10-15).
    // `opts.videoRequest`: the Video panel's choices, sent with this message (Video mode goes through the
    // agent, like Create-Image; see useVideoStore.request). `opts.imageRequest` + `opts.imageMode`: the Studio's
    // Image panel (useVideoStore.requestImage), for this one message.
    async sendMessage(text, opts = {}) {
      // `opts.voiceNote`: a recording (utils/voiceNotes.voiceNoteAttachment). It is the whole message: the server
      // hears it and its words are what the agent answers (VOICE_NOTES_PLAN.md). Files waiting in the composer stay
      // there for the next typed message.
      const voiceNote = opts.voiceNote || null
      const content = voiceNote ? '' : (text || '').trim()
      const atts = voiceNote ? [voiceNote] : this.pendingAttachments.slice()
      if (!content && atts.length === 0) return false
      // Ask for browser-notification permission on this user gesture (once). Lets us notify the user when
      // the run finishes if they've stepped away to another window/tab. No-op if already asked/decided.
      ensureNotifyPermission()

      // Mid-run STEERING: the agent is already running. Don't start a second turn and don't drop the
      // message — send it as a steering message. The backend queues it and the running agent observes it
      // between steps. If the user ATTACHED files, upload them first and send their attachment_ids so the
      // reference is bound to this steering message too (previously attachments were silently dropped here,
      // which is one way the "agent can't see the uploaded image" race happened).
      if (this.isStreaming) {
        if ((!content && atts.length === 0) || !this.conversationId || !this._conn) return false
        // The same client id travels with the message and comes back on `message_queued` with the saved row's
        // id, so every later frame (taken in, deferred, cancelled) finds THIS bubble, not one with equal text.
        const steerClientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        this.messages.push({
          id: nid(), role: 'user', content, status: 'done', queued: true, clientMessageId: steerClientId,
          attachments: atts.map(_bubbleAttachment),
        })
        if (!voiceNote) this.pendingAttachments = []
        const { attachmentIds: steerIds } = await this._uploadAttachments(atts)
        this._conn.sendMessage(content, this.selectedAgentId, null, {
          ...this._canvasSendOpts(),
          codeContext: opts.codeContext || undefined,
          turnMode: this.turnMode,
          imageMode: opts.imageMode || this.imageMode || undefined,
          videoRequest: opts.videoRequest || undefined,
          imageRequest: opts.imageRequest || undefined,
          studioMode: this.studioMode || undefined,
          studioContext: this.studioContext || undefined,
          researchMode: this.researchMode || undefined,
          researchDepth: this.researchMode ? this.researchDepth : undefined,
          reasoningEffort: this.reasoningEffort || undefined,
          attachmentIds: steerIds,
          clientMessageId: steerClientId,
          voiceNote: !!voiceNote,
        })
        return true
      }

      // No agents at all → don't silently swallow the message. Tell the user what to do.
      if (this.needsAgent) {
        this.error = 'Create an agent before sending a message.'
        notify.warning('Create an agent before you can chat — no agents exist yet.')
        return false
      }

      // Start a conversation on the first message (or reuse one already created — e.g. by
      // ensureConversation() when the user added a link before typing).
      if (!this.conversationId) {
        const cid = await this.ensureConversation()
        if (!cid) return false
      } else if (!this._conn) {
        this._connect()
      }

      // Show the user turn (with attachment previews) and the assistant placeholder up-front. The client id travels
      // with the message, so a frame about it (a voice note that could not be heard) finds THIS bubble.
      const clientMessageId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.messages.push({
        id: nid(), role: 'user', content, status: 'done', clientMessageId,
        attachments: atts.map(_bubbleAttachment),
      })
      // Claimed by this turn; the message bubble keeps the preview urls. A voice note leaves them for the next message.
      if (!voiceNote) this.pendingAttachments = []
      this._planModeTurn = this.turnMode === 'plan'
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
        // Let's Code: the files the person mentioned with @ and the code they selected (ADM-1205 phase E).
        codeContext: opts.codeContext || undefined,
        // The mode is always sent: the server keeps it as the conversation's choice.
        turnMode: this.turnMode,
        imageMode: opts.imageMode || this.imageMode || undefined,
        videoRequest: opts.videoRequest || undefined,
        imageRequest: opts.imageRequest || undefined,
        studioMode: this.studioMode || undefined,
        studioContext: this.studioContext || undefined,
        researchMode: this.researchMode || undefined,
        researchDepth: this.researchMode ? this.researchDepth : undefined,
        reasoningEffort: this.reasoningEffort || undefined,
        attachmentIds,
        clientMessageId,
        voiceNote: !!voiceNote,
      })
      return true
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
      // Clear any pending approval so _endAssistant is allowed to finalize (Stop must always end the
      // turn, even mid-approval). The backend's stop_execution also cancels the server-side HITL wait.
      this.hitlRequests = []
      this.awaitingApproval = false
      this._endAssistant()
    },

    // ── HITL approval responses (sent over the same WS the backend awaits on) ──
    respondHitl({ request_id, response_value, feedback }) {
      const _answered = this.hitlRequests.find((r) => r.request_id === request_id)
      this._conn?.sendHitlResponse(request_id, response_value, feedback)
      // Optimistically clear; the hitl_response_ack will also clear it. Kept aside until then: a card the run replaced
      // meanwhile comes back reading "Replaced" (`hitl_resolved` with `superseded`, ADM-1281).
      if (_answered) _answeredHitl.set(request_id, _answered)
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== request_id)
      if (!_hasLiveCard(this.hitlRequests)) this.awaitingApproval = false
      // A PARKED card's answer continues its run as a NEW turn on the run host (phase 2b), which no `chat_message`
      // of this page started: open its bubble now, so the frames it sends over the user group have a place to land
      // and never overwrite the previous answer. Only for the conversation on screen, only when nothing streams.
      if (_answered && _answered.parked && !this.isStreaming && this.conversationId != null
          && String(_answered.conversation_id || this.conversationId) === String(this.conversationId)) {
        this._beginAssistant()
        const _cm = this._cur()
        if (_cm) _cm.prepStatus = 'Continuing after your answer'
      }
    },

    // Dismiss only a card with nothing to answer (a notification, one that expired or was replaced). A card that waits
    // for an answer is answered, skipped or cancelled, never dropped without telling the server (ADM-1283).
    dismissHitl(requestId) {
      const card = this.hitlRequests.find((r) => r.request_id === requestId)
      if (!card || !hitlNothingToAnswer(card)) return
      this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== requestId)
      if (!_hasLiveCard(this.hitlRequests)) this.awaitingApproval = false
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
    // THE APPROVAL IS ALREADY ON THE SERVER; this only starts the turn that carries the plan out. It used
    // to re-send the person's first message, and when that message said "launch the Plan agent and make
    // its plan the tracked plan" the agent did exactly that again: a new plan, a new approval card, the
    // same answer twice (prod conversations 2744 and 2746, 2026-10-14). The turn is told what it is for.
    //
    // ONE APPROVAL, ONE RUN. Two frames announce an approval (the decision's `plan_approved` ack and the
    // run's `approved` plan event), and both called this, so one click could start the plan twice. The
    // server is the guard: it runs a continuation only against the one-time token the approval issued
    // (agent/services/plan_resume.py) and answers `plan_resume_refused` to any other. The local guard
    // only saves the second request. The approval shows as an approval row, never as a user bubble.
    _resumeAfterPlan() {
      const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      const now = Date.now()
      if (this._planResumeSentAt && now - this._planResumeSentAt < PLAN_RESUME_DEDUPE_MS) return
      this._planResumeSentAt = now
      if (!this._conn && this.conversationId) this._connect()
      this.messages.push({ id: nid(), role: 'user', kind: 'plan_approval', content: PLAN_APPROVED_CONTINUE,
                           status: 'done', error: '', toolCalls: [] })
      this._beginAssistant()
      this._conn?.sendMessage(PLAN_APPROVED_CONTINUE, this.selectedAgentId, null,
                              { continuation: 'plan_approval' })
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

    // Skip: the next card comes first and this one waits at the back of the queue (ADM-1283). Nothing is sent.
    skipHitl(requestId) {
      this.hitlRequests = skipHitlCard(this.hitlRequests, requestId)
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
    // Leave the chat on screen while its turn runs: its socket stays open with its own small handler (the turn's
    // end closes it), and this view gets a fresh socket for the next chat. False when nothing was running.
    _parkIfBusy() {
      const id = this.conversationId ? String(this.conversationId) : ''
      const conn = this._conn
      if (!this.keepRunsOnLeave || !id || !conn || !this.isBusy) return false
      this._stopProgressPolling()
      conn.handlers = this._parkedHandlers(id)
      this._parked = { ...this._parked, [id]: conn }
      this._setParkedRun(id, 'working')
      this._conn = null
      // Its approval cards come back when the chat is opened again (the server re-sends pending ones on resume).
      this.hitlRequests = []
      this._taskRunActive = false
      return true
    },

    _parkedHandlers(id) {
      const noop = () => {}
      return { onEvent: (msg) => this._onParkedEvent(id, msg), onOpen: noop, onError: noop, onConnectionState: noop,
               onClose: noop }
    },

    _onParkedEvent(id, msg) {
      const t = msg && msg.type
      try { if (this.parkedFrameHandler) this.parkedFrameHandler(id, msg) } catch { /* a surface's hook never breaks a run */ }
      // An approval card or a permission ask: the chat waits for the person.
      if ((t === 'hitl_request' || t === 'permission_request')
          && (!msg.conversation_id || String(msg.conversation_id) === id)) this._setParkedRun(id, 'needs_input')
      // The turn ended (sent to every socket of the person, so it names its chat): its socket is no longer needed.
      if (t === 'run_finished' && String(msg.conversation_id || '') === id) {
        this._setParkedRun(id, (msg.status || 'completed') === 'error' ? 'failed' : 'done')
        this._unpark(id, true)
      }
    },

    _setParkedRun(id, state) {
      this.parkedRuns = { ...this.parkedRuns, [id]: state }
    },

    _clearParkedRun(id) {
      if (!(id in this.parkedRuns)) return
      const next = { ...this.parkedRuns }
      delete next[id]
      this.parkedRuns = next
    },

    _unpark(id, close) {
      const conn = this._parked[id]
      if (!conn) return null
      const next = { ...this._parked }
      delete next[id]
      this._parked = next
      if (close) { try { conn.close() } catch { /* already closed */ } }
      return conn
    },

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
          // A new socket: the server knows nothing of what this page shows yet.
          this._presenceSent = ''
          this._reportPresence(true)
        },
        onError: () => {
          // The socket never gives up reconnecting, so an error only ever means "reconnecting" —
          // don't scare the user or kill the turn.
          if (this.isStreaming) this._enterReconnecting()
        },
        onConnectionState: (state) => { this.connectionLost = state === 'lost' },
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
      this._watchPresence()
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
      this.runHostRestarting = false
    },

    // "Reconnect now" (shown once a few reconnects in a row have failed): try at once, fresh backoff.
    reconnectNow() {
      if (this._conn) this._conn.reconnectNow()
      else this._connect()
    },

    // Full teardown — ONLY for logout / app unmount. Closes the socket for good (no reconnect).
    // Send a frame on this chat's socket as it is (a surface's own action, e.g. Let's Code's diff actions). Held
    // and sent when the socket opens, like a message.
    sendRaw(obj) {
      if (!this._conn) this._connect()
      this._conn._send(obj)
    },

    disconnect() {
      if (this._presenceTimer) { clearInterval(this._presenceTimer); this._presenceTimer = null }
      this._teardown(true)
    },

    // ── Whether the person is looking at this chat (backend agent/services/chat_presence.py) ─────────────────────
    // Claude Code tells you a task finished only when you are not looking. The server skips the "<agent> finished"
    // notification for a turn whose chat a page shows to the person, visible and focused (phase 8 run 3, finding 41:
    // chat 1269 was open in a tab and still got one). This page says which chat it shows and whether it is in front
    // of the person: at once when that changes (focus, blur, the tab hidden or shown, checked every 5 s for another
    // chat opened), and again every 30 s, since the server forgets a page it has not heard from for 75 s.
    // Does this page show chat `conversationId` to the person now: it is the open chat, in a visible, focused page.
    // The one test for "looking at it", for the server's presence and the browser notification alike.
    _showsChat(conversationId) {
      return conversationId != null && this.conversationId != null && String(conversationId) !== ''
        && String(conversationId) === String(this.conversationId) && pageIsFocused()
    },

    _reportPresence(force = false) {
      const cid = this.conversationId != null ? String(this.conversationId) : ''
      const viewing = !!cid && this._showsChat(cid)
      const key = `${cid}|${viewing}`
      if (!this._conn || (!force && key === this._presenceSent)) return
      if (!cid && !this._presenceSent) return   // it never showed a chat: nothing to take back
      this._conn.sendIfOpen({ type: 'chat_presence', conversation_id: cid, viewing })
      this._presenceSent = key
    },

    _watchPresence() {
      if (this._presenceTimer || typeof window === 'undefined' || typeof document === 'undefined') return
      if (!_presenceListening) {   // once per page: the store lives as long as the page
        _presenceListening = true
        const now = () => this._reportPresence()
        window.addEventListener('focus', now)
        window.addEventListener('blur', now)
        document.addEventListener('visibilitychange', now)
      }
      let ticks = 0
      this._presenceTimer = setInterval(() => { ticks += 1; this._reportPresence(ticks % 6 === 0) }, 5000)
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
    //: The same, while the run host restarts: the turn is silent until the next host resumes it, which takes as long
    //: as the restart does. The server settles a turn that cannot continue (`error` + `run_finished`), so this is
    //: only the backstop for a page that has gone deaf.
    _RESTART_DEAF_AFTER_MS: 600000,

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
        const _quietFor = this.runHostRestarting ? this._RESTART_DEAF_AFTER_MS : this._DEAF_AFTER_MS
        if (Date.now() - (this._lastFrameAt || 0) < _quietFor) return
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
      this._recovering = false
      const m = this._cur()
      if (m) m.reconnecting = false
      if (this._recoveryRunning) return
      this._recoveryRunning = true
      try {
        await this._recover()
      } finally {
        this._recoveryRunning = false
      }
    },

    async _recover() {
      const wasPolling = !!this._progressTimer
      this._stopProgressPolling()
      // A TURN THAT IS STILL RUNNING IS NOT ONE TO RECOVER.
      //
      // This loop answers "did the turn finish while this page was not listening?" by reading history
      // until an answer is there, and after 90 seconds it stops waiting and settles the turn. It never
      // asked the other question: is the turn simply still going? MEASURED, production conversation
      // 2659 (2026-10-08): the socket opened with the first message already on its way, so recovery
      // began at second 1 of the turn; the turn then waited 3.5 minutes for the sandbox server to start,
      // sending a status line every 15 seconds the whole time; and at second 105 this loop ran out and
      // marked the turn finished. The chat went quiet with the work still running, the composer came
      // back, and the browser preview never appeared because nothing was watching for it any more.
      //
      // So the loop now looks for proof the turn is alive and, on finding it, goes back to listening:
      // a frame of the turn itself arriving on this socket, or the server answering a `turn_progress`
      // question with a snapshot (it answers with nothing when nothing runs). The silence watchdog is
      // re-armed on the way out, so a turn that later goes quiet is looked at again.
      const since = Date.now()
      // A turn whose run host is restarting is still this turn: it is handed on, never settled here.
      const stillRunning = () => this._turnAliveAt > since || this.runHostRestarting
      const backToListening = () => {
        if (!this.isStreaming) return
        this._startDeafWatchdog()
        // A resumed turn owned by another worker says where it is only when asked.
        if (wasPolling && !this._progressTimer) this._startProgressPolling()
      }
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
      // Bound to the conversation it started for: when the person opens another chat, this stops.
      const cid = this.conversationId
      const switched = () => String(this.conversationId) !== String(cid)
      for (let i = 0; i < 36; i++) {
        if (switched()) return
        const landed = await this._refreshHistory({ probe: true })
        if (switched()) return
        if (landed) { this.isStreaming = false; this._taskRunActive = false; this._assistantId = null; return }
        if (!this.isStreaming) return
        if (stillRunning()) { backToListening(); return }
        // Ask the server outright. Not on the first pass: a message sent as the socket opens is on the
        // wire ahead of this question, and the turn should be registered before it is asked about.
        if (i > 0 && this.conversationId) {
          try { this._conn?.sendIfOpen({ type: 'turn_progress', conversation_id: this.conversationId }) }
          catch { /* socket down; history is still being read */ }
        }
        await new Promise((r) => setTimeout(r, 2500))
      }
      if (!this.isStreaming || switched()) return
      if (stillRunning()) { backToListening(); return }
      // Waited ~90s with no answer saved and no sign the turn is running — clear the spinner without a
      // scary error.
      this._endAssistant()
    },

    // Re-fetch conversation messages from the server. Returns true once the turn that was running during
    // the drop has been persisted. Detection: the NEWEST saved message is an assistant with content — the
    // backend saves the user message at turn start, so a mid-flight turn ends in a 'user' row until done.
    // (The old assistant-COUNT delta was broken: the optimistic streaming bubble is already counted, so a
    // completed turn never increased the count → recovery gave up and the answer only showed on refresh.)
    //
    // It reads the windowed messages endpoint, not the whole conversation: nothing here uses the
    // conversation's own fields. `probe` (the recovery loop, every 2.5 s) reads only the newest message
    // until the answer has landed, and the latest window only then.
    async _refreshHistory({ probe = false } = {}) {
      const cid = this.conversationId
      const landedIn = (rows) => {
        const last = rows[rows.length - 1]
        return !!last && last.role === 'assistant' && (last.content || '').trim().length > 0
      }
      try {
        if (probe) {
          const peek = await api.getConversationMessages(cid, { limit: 1 })
          if (String(this.conversationId) !== String(cid)) return false
          if (!landedIn(pickArray(peek.data))) return false
        }
        const res = await api.getConversationMessages(cid, { limit: MESSAGE_WINDOW })
        // Another chat was opened while this read was in flight: never write its rows into that one.
        if (String(this.conversationId) !== String(cid)) return false
        const data = res.data || {}
        const rows = pickArray(data)
        if (!landedIn(rows)) return false
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
          kind: m.kind || 'message',
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
          timeline: timelineWithCompactions((m.model_info && m.model_info.timeline) || (_prev && _prev.timeline) || null,
            m.model_info && m.model_info.compactions),
          // Same durable run link as the main loader — a reconnect must not lose it.
          runId: (m.model_info && m.model_info.run_id) || (_prev && _prev.runId) || '',
          // Same turn mode as the main loader (ADM-1302); the live one until the saved answer says it.
          turnMode: (m.model_info && m.model_info.turn_mode) || (_prev && _prev.turnMode) || '',
          // Same continuation marker as the main loader — a reconnect must not resurrect the
          // machine-authored prompts as user bubbles.
          authoredBy: (m.model_info && m.model_info.authored_by) || 'user',
          // Same restore point as the main loader: a turn's checkpoint lands on its user row while it runs.
          restoreCheckpointId: (m.metadata && m.metadata.restore_checkpoint_id)
            || (_prev && _prev.restoreCheckpointId) || null,
          citations: (m.model_info && m.model_info.answer_basis && m.model_info.answer_basis.citations)
            || (_prev && _prev.citations) || [],
          // User-uploaded attachments bound to this message (served URLs; survive refresh).
          attachments: pickArray(m.attachments),
          // The spoken answer: the saved one, else the live state (still being recorded) until it is saved.
          voiceReply: voiceReplyOf(m) || (_prev && _prev.voiceReply) || null,
          // Same connector buttons as the main loader; the live copy until the server row carries them.
          chatActions: pickArray(m.model_info && m.model_info.chat_actions).length
            ? pickArray(m.model_info.chat_actions) : ((_prev && _prev.chatActions) || []),
          memories: pickArray(m.model_info && m.model_info.memories).length
            ? pickArray(m.model_info.memories) : ((_prev && _prev.memories) || []),
          planFile: (m.model_info && m.model_info.plan_file) || (_prev && _prev.planFile) || null,
          // The server's saved list plus any save shown live that the row does not hold yet (a learner's save).
          memoriesSaved: mergeSavedMemories(m.model_info && m.model_info.memories_saved,
            _prev && _prev.memoriesSaved),
          conversationId: String(this.conversationId),
        }))
        this.messages = this._foldSteers(this.messages)   // a STEER shows inside its run (see _foldSteers)
        // The thread is now the latest window again, so older pages are "more" whenever the server has them.
        this.messagesHasMore = !!data.has_more
        return true
      } catch {
        return false
      }
    },

    // Let's Code: a turn's restore point is saved on its user message WHILE the turn runs, and no frame
    // carries it, so the "Restore to before this message" button appeared only after the chat was reopened
    // (live test 2026-11-11, ADM-1213). Read the newest messages once the turn has ended and copy each
    // message's restore point onto the one on screen with the same server id. Changes nothing else.
    async refreshRestorePoints() {
      const cid = this.conversationId
      if (!cid) return
      try {
        const res = await api.getConversationMessages(cid, { limit: MESSAGE_WINDOW })
        if (String(cid) !== String(this.conversationId)) return
        const rows = pickArray(res.data).filter((m) => m.role === 'user')
        // A message sent in this session has no server id yet (only the answer's id arrives, on
        // `message_saved`): adopt it from the newest server row with the same text that no message on
        // screen holds already, newest first, so two identical messages are never given one row.
        const held = new Set(this.messages.filter((m) => m.serverId != null).map((m) => String(m.serverId)))
        const unbound = [...this.messages].reverse().filter((m) => m.role === 'user' && m.serverId == null)
        for (const m of unbound) {
          const row = [...rows].reverse().find((r) => !held.has(String(r.id))
            && String(r.content || '').trim() === String(m.content || '').trim())
          if (row) { m.serverId = row.id; held.add(String(row.id)) }
        }
        const byId = new Map(rows.filter((m) => m.metadata && m.metadata.restore_checkpoint_id)
          .map((m) => [String(m.id), m.metadata.restore_checkpoint_id]))
        for (const m of this.messages) {
          if (m.role === 'user' && m.serverId != null && byId.has(String(m.serverId))) {
            m.restoreCheckpointId = byId.get(String(m.serverId))
          }
        }
      } catch (_e) { /* the button then appears on the next load, as before */ }
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
      this._heardDeltasLive = false   // a new turn has streamed nothing to this page yet
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
        citations: [], // P6: KB sources for the "Sources" panel (set on assistant_message_complete)
        answerBasis: null, // provenance envelope (label + cited-or-top4) set on assistant_message_complete
        timeline: null, // activity-timeline snapshot, pinned on completion (friendly, param-free)
        chatActions: [], // connector buttons offered by CONNECT_SERVICE (live `chat_action` frames)
        memories: [], // memories this answer drew on (live `memories_used` frame, after the save)
        memoriesSaved: [], // memories this turn really saved (live `memory_saved` frames) — "Saved to memory"
        // The mode this turn runs in (the one sent with the message, the conversation's). A Work turn is drawn on the
        // Work timeline's rail (ADM-1302); the saved answer says it again (`model_info.turn_mode`) for a reload.
        turnMode: this.turnMode,
        _serverMid: null, // §4b: server's per-turn message_id, adopted from the first stamped event
      })
      this._assistantId = this.messages[this.messages.length - 1].id
      this.isStreaming = true
      this._startDeafWatchdog()
      _think.reset()
      _tl.reset(this.turnMode)   // fresh live activity timeline for this turn (a Work turn's keeps its narration and IN/OUT)
    },

    _cur() {
      return this.messages.find((m) => m.id === this._assistantId)
    },

    // The bubble this turn was writing into, even after `_endAssistant` released it.
    //
    // `_cur()` answers "which message is LIVE", which becomes undefined the moment a turn ends. A
    // terminal frame that arrives after that still belongs to the message the turn produced, and
    // dropping its text is how an answer ends up visible only after a page reload.
    //
    // The newest assistant bubble, AN ERRORED ONE INCLUDED: every turn opens its bubble at the end, so the newest is
    // the turn's own. Skipping errored bubbles wrote a failed turn's final text into the PREVIOUS answer: the balance
    // ran out, the `error` frame ended the new bubble, and the turn's `assistant_message_complete` that followed ("I
    // completed this before the run was interrupted… balance $0.09") and its token counts landed on the build summary
    // above it (phase 8 run 3, conversation 1281; the database had them apart, 4807 and 4809).
    _lastAssistantOfTurn() {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].role === 'assistant') return this.messages[i]
      }
      return null
    },

    _endAssistant() {
      this._stopDeafWatchdog()
      // While a human approval is pending, DON'T finalize the turn. The task/CRS path can emit a
      // premature "complete" for the step-0 text while the agent is actually blocked on an approval
      // card; finalizing here would show "Done", hide the Stop button, and orphan the pending card.
      // The REAL completion (after the human responds, once hitlRequests is empty) ends the turn.
      // A PARKED card (phase 2b) does not hold the turn: its run has already ended its turn and continues as a new
      // one when the person answers, so a turn on screen that ends next to it ends.
      if (_hasLiveCard(this.hitlRequests)) return
      this.runHostRestarting = false
      this._stopProgressPolling()
      const m = this._cur()
      if (m) {
        const safeTail = _think.flush()
        if (safeTail) m.content += safeTail
        _tl.finalize()
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()   // pin the activity timeline onto this message
        if (m.status === 'streaming') m.status = 'done'
        // No browser notification here: this end cannot tell an answered turn from a stopped or empty one.
        // The server's `run_finished`, which reaches this socket too, says how the turn ended and notifies.
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

    // A turn that stopped to wait for the person (a plan to approve). It is over, so it stops streaming
    // and keeps its timeline; but nothing finished, so there is no "run finished" notification and no
    // history refetch for a missing answer (there is no answer to fetch).
    _pauseAssistant(reason) {
      this._stopDeafWatchdog()
      this._stopProgressPolling()
      const m = this._cur()
      if (m) {
        const safeTail = _think.flush()
        if (safeTail) m.content += safeTail
        _tl.finalize()
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()
        if (m.status === 'streaming') m.status = 'done'
        m.pausedFor = reason
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
    },

    _persistTurnMeta(m) {
      // Snapshot the finished activity timeline back to the server so the "Done · N steps · …"
      // accordion + reasoning survive a page refresh (usage/stop are already persisted server-side).
      // Best-effort: the row was just saved by the turn, so the backend attaches this to it.
      //
      // Addressed to the SAVED ROW by id. The answer frame goes out before the server saves the answer, so
      // until `message_saved` gives us the id this waits (`timelineUnsent`) and that frame sends it. Sent
      // without an id, the server put it on "the newest answer": lost when the save was late (conv 2881),
      // or written onto the previous answer.
      try {
        if (!m || !m.timeline || !this.conversationId || !this._conn) return
        if (m.serverId == null) { m.timelineUnsent = true; return }
        const timeline = JSON.parse(JSON.stringify(m.timeline))
        this._conn.send({ type: 'persist_turn_meta', conversation_id: this.conversationId,
                          message_id: m.serverId, timeline })
        m.timelineUnsent = false
      } catch { /* best-effort — never block the turn */ }
    },

    _errAssistant(err, retryable = true, fromServer = false) {
      this._stopDeafWatchdog()
      this.runHostRestarting = false
      const m = this._cur()
      if (m) {
        m.status = 'error'
        m.error = err || 'Something went wrong.'
        m.retryable = retryable
        // interrupt (not finish): the live timeline collapses to "Interrupted", not "Done". An error FRAME
        // is the server ending the turn, not a lost connection — it reads "Could not complete".
        if (fromServer) _tl.fail(m.error)
        else _tl.interrupt(m.error)
        if (_tl.hasActivity()) m.timeline = _tl.snapshot()
      }
      this.isStreaming = false
      this._taskRunActive = false
      this._assistantId = null
    },

    // ── Reload / reconnect catch-up: the run's ordered events (backend phase 1b) ─────────────────────────────
    _forgetRunSeq(conversationId) {
      const key = String(conversationId ?? '')
      if (!key || !(key in this._runSeq)) return
      const next = { ...this._runSeq }
      delete next[key]
      this._runSeq = next
    },

    // Ask the server for this conversation's run events after the last one applied here. Nothing applied yet
    // (a reload): from the start, and the turn on screen is rebuilt from them (see _applyRunEvents).
    _askRunEvents(sinceSeq) {
      const cid = this.conversationId
      if (!cid || !this._conn) return
      const since = sinceSeq != null ? sinceSeq : (this._runSeq[String(cid)] || 0)
      this._conn.send({ type: 'run_events_since', conversation_id: cid, since_seq: since })
    },

    // `run_events_replay`: { conversation_id, events: [{seq, type, frame?, payload, plan_version, ts}], last_seq,
    // has_more?, live? }. Events are applied in `seq` order and a `seq` already applied is dropped, so an event that
    // comes both in the replay and live is shown once. An event with a `frame` (the frame's TYPE, a string) is a chat
    // frame whose body is `payload` (backend `run_events.entry`), and goes through the normal frame handling.
    // `events_missing` means the server recorded a gap: it is logged, nothing is shown.
    _applyRunEvents(msg) {
      const cid = msg.conversation_id != null ? String(msg.conversation_id) : String(this.conversationId ?? '')
      if (!cid || this.conversationId == null || cid !== String(this.conversationId)) return
      const events = (Array.isArray(msg.events) ? msg.events : [])
        .filter((e) => e && Number.isFinite(Number(e.seq)))
        .sort((a, b) => Number(a.seq) - Number(b.seq))
      const before = this._runSeq[cid] || 0
      // A replayed batch (not live) belongs on screen only while this page shows the run's turn as running; a turn
      // that ended is already in the loaded history, so its events only move the cursor.
      const onScreen = !!msg.live || this.isStreaming || this._recovering
      // From the start, onto a turn already drawn here (a dropped socket the page lived through): the bubble is
      // rebuilt from the log instead of the log being added to what it already shows.
      if (!msg.live && before === 0 && onScreen && events.some((e) => replayedFrame(e, cid) && Number(e.seq) > 0)) {
        const m = this._cur()
        if (m) { m.content = ''; _think.reset() }
        const began = _tl.startedAt.value              // the turn's own start (turn_resumed), kept through the rebuild
        _tl.reset(_tl.mode.value)
        if (began) _tl.startedAt.value = began
      }
      let last = before
      for (const e of events) {
        const seq = Number(e.seq)
        if (seq <= last) continue
        last = seq
        if (e.type === 'events_missing') {
          console.info('[chat] the run recorded a gap in its events', e.payload || {})
          continue
        }
        if (!onScreen) continue
        const frame = replayedFrame(e, cid)
        if (!frame) continue
        // A FOLLOWED run's typing, sent live, is the stored copy of text this page already drew as it streamed: the
        // store joins a round's chunks into one `replace` row, so drawing it opened the round a second time and showed
        // every sentence twice ("Got | Got it — … it — …", phase 8 run 5, 2026-11-20). Drawn only when nothing streamed
        // here (a run that sends no live frames to the person's tabs); the catch-up after a reload is drawn in full.
        if (msg.live && this._heardDeltasLive && STREAMED_DELTAS.has(frame.type)) continue
        this._replaying = true
        try { this._onEvent(frame) } catch (_e) { /* one bad frame never stops the catch-up */ } finally {
          this._replaying = false
        }
      }
      if (last !== before) this._runSeq = { ...this._runSeq, [cid]: last }
      // A long run comes in pages: ask again from the last one received.
      if (msg.has_more && !msg.live && last > before) this._askRunEvents(last)
    },

    // "Compact now" (Claude Code's /compact): the server checks every refusal and queues the summary; the chat is
    // told when it is done (`run_compacted`, scope manual) or why not (`compaction_failed`). A refusal comes back here.
    // `instructions`: what the summary should focus on (optional; the server refuses one over 2,000 characters).
    async compactNow(instructions = '') {
      const id = this.conversationId
      if (!id || this.isStreaming || this.compaction.status === 'running') return
      this.compaction = { status: 'running', message: '' }
      try {
        await api.compactConversation(id, String(instructions || '').trim())
      } catch (e) {
        if (String(this.conversationId) !== String(id)) return
        const data = e?.response?.data || {}
        this.compaction = { status: 'failed',
          message: String(data.error || 'The conversation could not be compacted. Try again in a moment.') }
      }
    },

    // The row of a "Compact now" at the END of the last answer's timeline (it happened after that answer).
    _addManualCompaction(frame) {
      const last = [...this.messages].reverse().find((m) => m && m.role === 'assistant')
      const step = compactionStep(frame, `compact_manual_${Date.now()}`, Date.now())
      if (last) {
        const tl = last.timeline && typeof last.timeline === 'object' ? last.timeline : {
          statusLabel: '', steps: [], sources: [], summary: null, isComplete: true, interrupted: false,
        }
        last.timeline = { ...tl, steps: [...(Array.isArray(tl.steps) ? tl.steps : []), step] }
      }
      this.compaction = { status: 'done', message: step.label }
    },

    _onEvent(msg) {
      this._lastFrameAt = Date.now()
      const t = msg?.type
      if (t === 'ping') return   // server keepalive heartbeat — nothing to render
      // A turn the run host runs (LONG_RUN_LIKE_CLAUDE_CODE_PLAN.md phase 1c) has no socket: every frame it sends comes
      // over the user group, which carries every open tab, marked `via_user_group` by the server. One addressed to
      // another conversation is dropped BEFORE the surface sees it, so a project chat's changed files, preview link or
      // permission card never reach another chat's panel. A NEW chat (no conversation yet) has no turn of its own: its
      // conversation is made before its first message is sent (`ensureConversation`), so every such frame is another
      // chat's. It used to be let through, and a project chat's resumed turn was drawn in a new chat (live, 2026-11-19).
      if (msg?.via_user_group === true && msg.conversation_id != null && msg.conversation_id !== '' &&
          String(msg.conversation_id) !== String(this.conversationId ?? '')) {
        return
      }
      if (t === 'run_events_replay') {
        this._applyRunEvents(msg)
        return
      }
      // This turn's typing reached the page as it streamed (its own socket, or `work_stream` over the user group): the
      // run's stored copy of the same text, which a followed run also sends live, is not drawn again (_applyRunEvents).
      if (STREAMED_DELTAS.has(t) && !this._replaying) this._heardDeltasLive = true
      if (this.surfaceHandler) {
        try { if (this.surfaceHandler(msg)) return } catch (_e) { /* a surface's card must never break the chat */ }
      }
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
      // (A frame marked `via_user_group` for another conversation was already dropped above, before the surface.)
      if (msg?.conversation_id != null && this.conversationId != null &&
          WORK_FORWARDED_TYPES.has(t) && String(msg.conversation_id) !== String(this.conversationId)) {
        return
      }
      if (TURN_ALIVE_TYPES.has(t) && this.isStreaming) this._turnAliveAt = Date.now()
      // The task list of a conversation, replaced whole by each update. Another conversation's list (the frame can
      // reach every socket of this person) never lands on the one on screen.
      if (t === 'todo_update') {
        if (msg.conversation_id != null && String(msg.conversation_id) !== String(this.conversationId ?? '')) return
        this.todos = normalizeTodos(msg.todos)
        return
      }
      // Video jobs (VIDEO_WORKSPACE_PLAN.md section 7) are broadcast to the user group with their
      // conversation inside. The video store mirrors every one (its tray filters by conversation); when the
      // server posted a finished result into THIS conversation, reload the thread so the message shows.
      if (t === 'video_job') {
        try { useVideoStore().onFrame(msg) } catch { /* the chat continues without the card */ }
        if (msg.message_posted && this.conversationId != null
            && String(msg.conversation_id || '') === String(this.conversationId) && !this.isStreaming) {
          this._refreshHistory()
        }
        return
      }
      // A storyboard plan (ADM-1146): one approval card for every scene, mirrored by the video store.
      if (t === 'video_plan') {
        try { useVideoStore().onPlanFrame(msg) } catch { /* the chat continues without the card */ }
        return
      }
      // A run's plan event (the run's event stream, run_coordinator): the chat draws no plan from it -- a plan is
      // reviewed on its card and beside the chat, and followed on the task list (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md).
      // It still names the run of the message it reaches and carries the person's plan DECISION. Scope to THIS
      // window's conversation (the frame is broadcast to the user group with conversation_id inside).
      if (t === 'plan_event') {
        const pcid = msg.conversation_id
        if (pcid == null || this.conversationId == null || String(pcid) === String(this.conversationId)) {
          try {
            // WHICH RUN PRODUCED THIS MESSAGE, stamped on every message the run's events reach: a Work run's
            // segments each have their own assistant message, and the renderer reads it from the message.
            const cur = this._cur() || this.messages.filter((x) => x.role === 'assistant').slice(-1)[0]
            const rid = msg.run_id || (msg.plan_view && msg.plan_view.run_id)
            if (cur && rid) cur.runId = rid
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
            // ANSWERED IN THE RUN (plan mode): the run that gave the plan waits on its card and goes on with the answer
            // by itself, so nothing is re-sent. Re-sending it made the running turn take the platform's own
            // instruction in as the person's message ("You added: Approved. Carry out the approved plan…", and the
            // notes of "keep planning" twice; phase 8 run 2, conversation 1268).
            if (msg.answered_in_run === true && (ct === 'approved' || ct === 'changes_requested')) {
              if (eid) this._resolvedDecisionEventIds.add(eid)
              this.pendingPlan = null
            } else if ((ct === 'approved' || ct === 'changes_requested' || ct === 'cancelled')
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
        // THE RUN HOST RESTARTS UNDER THIS TURN (phase 1d), and later resumes it. While restarting, the turn keeps
        // showing it runs: the bubble stays open, Stop stays, the line says it continues in a moment.
        if (t === 'agent_status' && msg.reason === 'RUN_HOST_RESTART') {
          this.runHostRestarting = true
          // A page that opened (or settled) during the restart is told the turn continues: give it its bubble.
          if (!this.isStreaming) this._beginAssistant()
          this._turnAliveAt = Date.now()
          const _rsm = this._cur()
          if (_rsm) _rsm.reconnecting = false
          this._startDeafWatchdog()   // re-armed, with the restart's longer threshold
        } else if (t === 'agent_status' && msg.reason === 'RESUMED_AFTER_RESTART') {
          this.runHostRestarting = false
        }
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
        if (m._serverTurn == null && msg.turn_id) m._serverTurn = msg.turn_id   // read by `run_finished`
      }
      // Feed the live activity timeline (Thinking → tools → Generating → Done). Rich events already
      // returned above; this also folds in reasoning + token metering (no-op for other event types).
      if (m && t !== 'error') _tl.ingest(msg)
      switch (t) {
        case 'message_saved': {
          // The answer has been persisted; adopt its DB pk so the thumbs buttons have something to
          // address. Emitted after `assistant_message_complete`, so the bubble may already be 'done' —
          // bind to the last assistant message rather than only to a still-streaming one.
          const target = m || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (target && msg.message_id != null) target.serverId = msg.message_id
          if (target && target.timelineUnsent) this._persistTurnMeta(target)   // it waited for this id
          break
        }
        case 'voice_reply': {
          // The answer to a voice note, spoken back (backend agent/services/voice_replies.py): pending when it is
          // queued, then ready with its audio, or failed with the reason. Pushed to every page of the person, so
          // only this conversation's answer is touched.
          if (msg.conversation_id != null && String(msg.conversation_id) !== String(this.conversationId)) break
          const target = this.messages.find((x) => x.role === 'assistant' && x.serverId != null
            && String(x.serverId) === String(msg.message_id))
          if (target) target.voiceReply = voiceReplyFromFrame(msg)
          break
        }
        case 'voice_note_failed': {
          // The voice note could not be heard (no speech, unreadable, no transcription model, no balance): no turn
          // started. Said where the person looks: on the note itself when it was sent while the agent was working
          // (that run carries on), else in the answer bubble that was waiting for it.
          if (msg.conversation_id && String(msg.conversation_id) !== String(this.conversationId)) break
          const note = msg.client_message_id
            && this.messages.find((x) => x.role === 'user' && x.clientMessageId === msg.client_message_id)
          if (note && note.queued) {
            note.queued = false
            note.voiceNoteError = msg.error || 'That voice note could not be sent.'
            break
          }
          const _vb = this._cur()
          if (_vb && msg.code) _vb.errorCode = msg.code
          this._errAssistant(msg.error || 'That voice note could not be sent. Record it again.', false, true)
          break
        }
        case 'plan_ready': {
          // PLAN MODE (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): the answer just saved gives a plan for review. Its file card
          // goes under it, and the plan opens beside the chat by itself on a wide screen (the card opens it on a phone).
          if (msg.conversation_id != null && String(msg.conversation_id) !== String(this.conversationId)) break
          const target = (msg.message_id != null
            && this.messages.find((x) => x.role === 'assistant' && String(x.serverId ?? x.id) === String(msg.message_id)))
            || m || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (!target || !msg.plan_file || !msg.plan_file.path) break
          target.planFile = msg.plan_file
          const wide = typeof window !== 'undefined' && window.matchMedia
            && window.matchMedia('(min-width: 1024px)').matches
          usePlanReviewStore().show(msg.plan_file, this.conversationId, { openPanel: !!wide })
          break
        }
        case 'plan_reply': {
          // The person's message approved the plan that waited for it: plan mode is over, so the composer leaves it
          // (back to Chat or Work), as Claude Code does. A change or a question keeps plan mode.
          if (msg.conversation_id != null && String(msg.conversation_id) !== String(this.conversationId)) break
          if (msg.decision === 'approve') this.leavePlanMode()
          break
        }
        case 'memories_used': {
          // The memories the answer drew on, sent once the answer is saved (its pk is in the frame).
          const target = (msg.message_id != null
            && this.messages.find((x) => x.role === 'assistant' && String(x.serverId ?? x.id) === String(msg.message_id)))
            || m || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (target && Array.isArray(msg.memories)) target.memories = msg.memories
          break
        }
        case 'memory_saved': {
          // A memory was REALLY saved from this chat (backend `store.announce_saved`): a MEMORY_WRITE / MEMORY_EDIT
          // during the turn, or the end-of-run learner after it. Shown as "Saved to memory" under the answer it
          // belongs to — the one being written, else the last one. Sent to every page of the person, so only this
          // chat's saves are taken.
          if (msg.conversation_id != null && String(msg.conversation_id) !== String(this.conversationId)) break
          const target = m || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (target && Array.isArray(msg.memories)) {
            target.memoriesSaved = mergeSavedMemories(target.memoriesSaved, msg.memories)
          }
          break
        }
        case 'run_usage': {
          // EVERYTHING THE RUN PAID FOR — sub-agents, the goal check, routing, embeddings — sent once the turn
          // has nothing left to spend. The answer frame's usage counted only the answer rounds (conv 1689
          // showed 86.9k tokens; the run was billed ~1.02M). Replaces it on the message it belongs to.
          const byId = msg.message_id != null
            && this.messages.find((x) => x.role === 'assistant' && String(x.serverId ?? x.id) === String(msg.message_id))
          const byRun = !byId && msg.run_id
            && [...this.messages].reverse().find((x) => x.role === 'assistant' && String(x.runId || '') === String(msg.run_id))
          const target = byId || byRun || [...this.messages].reverse().find((x) => x.role === 'assistant')
          if (target && msg.usage) target.usage = msg.usage
          break
        }
        case 'turn_resumed': {
          // We reconnected (e.g. after a refresh) to a turn STILL RUNNING on the server. Open a fresh
          // streaming assistant bubble so the live tokens land, and show WHERE the run actually is —
          // step, running tool and elapsed time — instead of a bare "still working…", which a user
          // cannot tell apart from a hung run.
          // AFTER A RUN-HOST RESTART (phase 1d) it is the SAME turn, continued by the next host: a bubble still
          // streaming keeps it (its timeline, its text so far), and the restart line gives way to the run's frames.
          const _afterRestart = msg.after_restart === true
          if (_afterRestart) this.runHostRestarting = false
          if (!this.isStreaming) this._beginAssistant()
          this._turnAliveAt = Date.now()   // the server has just said this turn is running
          // The status line's clock counts from when the TURN began, not from when this page opened: a reload showed
          // "Working… (10s)" on a turn five minutes in (phase 8 run 5). The server's snapshot says how long it has run.
          const _ran = Number(msg.progress && msg.progress.elapsed_seconds)
          if (Number.isFinite(_ran) && _ran > 0) _tl.startedAt.value = Date.now() - _ran * 1000
          const rm = this._cur()
          if (rm) { rm.reconnecting = false; rm.prepStatus = resumeStatusLine(msg.progress, msg.status) }
          if (rm && msg.turn_id) rm._serverTurn = msg.turn_id   // its `run_finished` names this turn
          // CATCH UP FROM THE RUN'S OWN LOG (backend phase 1b): everything the run sent while this page was away (a
          // reload, a dropped socket) is replayed in order, after the last event this page applied.
          this._askRunEvents()
          // A resumed-after-restart turn runs on the run host, which sends this page every frame over the user
          // group: there is nothing to poll, and a poll answered "nothing runs here" must not read as a dead turn.
          if (_afterRestart) { this._startDeafWatchdog(); break }
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
            // The turn ended between polls. Stop polling and let the history refetch land the answer —
            // unless the server says it died unanswered (worker restarted), where there is nothing to land.
            this._stopProgressPolling()
            // Nothing runs WHILE the run host restarts: the turn waits for the next host, it did not die.
            if (this.runHostRestarting && this.isStreaming) break
            if (msg.interrupted && this.isStreaming) {
              this._recovering = false
              this._errAssistant('This reply was interrupted because the server restarted. Send your message again.', true, true)
              break
            }
            if (this.isStreaming) this._recoverAfterReconnect()
          } else {
            // A snapshot means the turn is running. That is the answer recovery is waiting for.
            if (this.isStreaming) this._turnAliveAt = Date.now()
            // The line under the bubble is for a RESUMED turn, which is the only kind that is polled
            // on a timer. A turn streaming on this socket already says where it is in its timeline.
            if (pm && pm.status === 'streaming' && this._progressTimer) {
              pm.prepStatus = resumeStatusLine(msg.progress)
            }
          }
          break
        }
        case 'turn_not_running': {
          // Nothing in flight. But the turn may have FINISHED during the reload gap — only the user row is
          // persisted mid-run, so the loaded history can end at the user's message. If so, re-fetch once to
          // pull in the completed answer (no-op when there's nothing new).
          this._stopProgressPolling()
          // Nothing runs WHILE the run host restarts (phase 1d): the turn is queued for the next host, not dead.
          if (this.runHostRestarting && (this.isStreaming || this._recovering)) {
            this._recovering = false
            const _rm = this._cur()
            if (_rm) _rm.reconnecting = false
            break
          }
          // The server says the turn DIED unanswered (its worker restarted mid-turn; conv 1947, 2026-09-25).
          // There is no answer to wait for, so say so now and offer a resend, instead of polling history
          // for 90s and then clearing the bubble without a word.
          if (msg.interrupted && (this.isStreaming || this._recovering)) {
            this._recovering = false
            this._errAssistant('This reply was interrupted because the server restarted. Send your message again.', true, true)
            break
          }
          const last = this.messages[this.messages.length - 1]
          if (last && last.role === 'user') this._refreshHistory()
          // Nothing is running server-side, so a spinner left over from before the drop is a lie. Settle
          // it against the server's history rather than spinning until the 30s give-up.
          if (this.isStreaming || this._recovering) this._recoverAfterReconnect()
          break
        }
        case 'run_finished': {
          // A turn ENDED: sent once per turn to every socket of this user (any tab, any worker, this
          // turn's own socket too), with `status` = completed | stopped | error | empty. An older backend
          // sent no status, and sent this only for an answered turn, so a missing status is `completed`.
          const status = msg.status || 'completed'
          // The browser notification (suppressed when actively viewing that chat) says a run FINISHED, so
          // only an answered turn gets one: the person ended a stopped turn, and a failed or empty one has
          // no answer to announce.
          // The task list as the run settled it (an item the turn left in progress is `stopped`, with its reason).
          if (Array.isArray(msg.todos) && String(msg.conversation_id || '') === String(this.conversationId || '')) {
            this.todos = normalizeTodos(msg.todos)
          }
          if (status === 'completed') {
            try {
              notifyRunFinished({
                agentName: msg.agent_name, snippet: msg.snippet, conversationId: msg.conversation_id,
                // Watched on this page, or on another of the person's pages (the server's presence), on any surface.
                seen: msg.seen === true || this._showsChat(msg.conversation_id),
              })
            } catch { /* best-effort */ }
          }
          // THIS conversation, still showing the turn as running (a cross-worker resume whose tokens
          // streamed elsewhere, or a frame of the turn's end that never reached this socket): settle it
          // now, whatever the status, instead of waiting until history has an answer.
          if (String(msg.conversation_id || '') !== String(this.conversationId || '')
              || !(this.isStreaming || this._recovering)) break
          const fm = this._cur()
          // The end of a different turn of this chat than the one on screen is not this turn's end.
          if (msg.turn_id && fm && fm._serverTurn && String(fm._serverTurn) !== String(msg.turn_id)) break
          this._recovering = false
          if (status === 'error') { this._errAssistant('', true, true); break }
          const blank = !!fm && !(fm.content || '').trim()
          this._endAssistant()                       // a blank bubble fetches the saved answer itself
          if (!blank) this._refreshHistory()         // the saved answer replaces what streamed here
          break
        }
        case 'assistant_message_chunk':
          // A multi-step run can invoke the model repeatedly. Its earlier prose is an in-progress draft,
          // not another answer. The backend marks the first visible chunk of each invocation so the UI
          // keeps one clean, current draft instead of accumulating repetitive paragraphs.
          if (m && msg.replace) {
            m.content = ''
            _think.reset()
            m._newRound = true
          }
          if (m) {
            const piece = _think.feed(msg.chunk || '')
            m.content += piece
            // A WORK turn keeps each round's text as its own row on the rail, in order with its tool calls (ADM-1302).
            // A round whose first chunks the think filter held back still opens its own row with its first text.
            if (piece && m.turnMode === 'work') {
              _tl.addText(piece, !!m._newRound)
              m._newRound = false
            }
          }
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
        case 'chat_action': {
          // A typed button the runtime attached to this answer (CONNECT_SERVICE: Connect / Sign in again /
          // Assign). One per connector + kind — a repeated call replaces, never stacks.
          const target = m || this._lastAssistantOfTurn()
          const act = msg.action
          if (target && act && act.kind) {
            const same = (x) => x.kind === act.kind && x.target_kind === act.target_kind
              && String(x.target_id) === String(act.target_id) && (x.url || '') === (act.url || '')
            target.chatActions = [...(target.chatActions || []).filter((x) => !same(x)), act]
          }
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
            for (const a of (msg.media_artifacts || [])) {
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
          // An MCP client's approval ("mcp:<session>") belongs to no chat: it is answered on the Sessions page.
          if (_hcid.startsWith('mcp:')) break
          if (_hcid && _hcid !== String(this.conversationId || '')) break
          // A PARKED approval (phase 2b, agent/services/hitl/parked_approvals.py): a run nobody watched stopped
          // before this step and ended its turn; the person's answer continues it. No clock, no "for the session".
          const _parked = !!(msg.payload && msg.payload.parked === true)
          // Avoid duplicates if the event is re-delivered.
          if (!this.hitlRequests.some((r) => r.request_id === msg.request_id)) {
            this.hitlRequests.push({
              parked: _parked,
              conversation_id: _hcid || null,
              request_id: msg.request_id,
              interaction_type: msg.interaction_type,
              response_type: msg.response_type,
              summary: msg.summary,
              services: msg.services || [],
              payload: msg.payload || {},
              options: msg.options || [],
              urgency: msg.urgency || 'medium',
              timeout_at: msg.timeout_at || null,
              // Whether it is live, and a Let's Code step's working copy and risk (backend `hitl.frames`, ADM-1281).
              state: msg.state || 'pending',
              working_copy: msg.working_copy ?? null,
              risk: msg.risk || null,
            })
          }
          // Nothing is running for a parked card: its run waits for the answer, so the chat does not claim a turn
          // is streaming (that would start the silence watchdog, which would then call the turn interrupted).
          if (_parked) break
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
          // card once it's answered anywhere (no stale card lingering on another window/surface). A card the run
          // REPLACED (it restarted and asked again, or ended) reads so for a moment instead of vanishing (ADM-1281).
          if (msg.type === 'hitl_resolved' && msg.status === 'superseded') {
            this.hitlRequests = supersedeHitlCard(this.hitlRequests, msg.request_id, _answeredHitl.get(msg.request_id))
            setTimeout(() => {
              this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== msg.request_id)
            }, SUPERSEDED_CARD_MS)
          } else {
            this.hitlRequests = this.hitlRequests.filter((r) => r.request_id !== msg.request_id)
          }
          _answeredHitl.delete(msg.request_id)
          if (!_hasLiveCard(this.hitlRequests)) this.awaitingApproval = false
          break
        // ── Mid-run steering: a message the user sent while the agent was working ──
        case 'message_queued': {
          // The server SAVED the message (it survives a refresh or a restart from here on) and queued it for the
          // running turn. Its row id comes back, so later frames find this exact bubble.
          const qm = this._queuedBubble(msg)
          if (qm && msg.message_id != null) qm.serverId = msg.message_id
          break
        }
        case 'context_usage': {
          // The run measured its context after a model call (`agent.runtime.run_compaction`): the composer's ring.
          if (msg.conversation_id != null && this.conversationId != null &&
              String(msg.conversation_id) !== String(this.conversationId)) break
          const usage = normalizeContextUsage(msg)
          if (usage) this.contextUsage = usage
          break
        }
        case 'run_compacted': {
          // The earlier conversation was summarized to stay within the window: a row in the run's timeline where
          // it happened, and the ring drops to what is left. The person's own "Compact now" (`scope: 'manual'`)
          // ran with no turn: its row goes at the end of the last answer's timeline, where the server saved it.
          if (msg.conversation_id != null && this.conversationId != null &&
              String(msg.conversation_id) !== String(this.conversationId)) break
          if (msg.scope === 'manual') {
            this._addManualCompaction(msg)
          } else {
            _tl.addCompaction(msg)
          }
          const usage = normalizeContextUsage({ ...msg, used_tokens: msg.tokens_after })
          if (usage) this.contextUsage = usage
          break
        }
        case 'compaction_failed': {
          // A "Compact now" the server refused or could not finish, in its own words (the ring's menu shows them).
          if (msg.conversation_id != null && this.conversationId != null &&
              String(msg.conversation_id) !== String(this.conversationId)) break
          this.compaction = { status: 'failed', message: String(msg.message || 'The conversation was not compacted.') }
          break
        }
        case 'steering_applied': {
          // The running agent took in a message the person sent while it worked: EVERY one is, and the model decides
          // whether it changes the current work or is a request to do after it (LONG_RUN_LIKE_CLAUDE_CODE_PLAN.md
          // 3.4; the separate-request "deferred" path and its judge were removed). It belongs INSIDE the run:
          // it leaves the bottom of the thread (where it was typed, below the working run) and becomes a
          // "You added: …" line in the run's step list at this point — the work before it above, the work and
          // the answer after it below. Saved with the run's timeline, and the server marks the row a STEER, so
          // a reload shows it in the same place instead of jumping above the answer.
          const text = msg.message || ''
          const qm = this._queuedBubble(msg)
          if (qm) this.messages.splice(this.messages.indexOf(qm), 1)
          _tl.addSteer(text)
          break
        }
        case 'queued_messages_cancelled': {
          // Stop means stop: messages that waited behind the run are not answered after it. They leave the
          // thread and their text goes back into the message box, so nothing the person wrote is lost.
          if (msg.conversation_id != null && this.conversationId != null &&
              String(msg.conversation_id) !== String(this.conversationId)) break
          const back = []
          for (const it of (Array.isArray(msg.messages) ? msg.messages : [])) {
            const qm = this._queuedBubble({ message_id: it.message_id, client_message_id: it.client_message_id,
                                            message: it.text })
            if (qm) this.messages.splice(this.messages.indexOf(qm), 1)
            if ((it.text || '').trim()) back.push(it.text.trim())
          }
          if (back.length && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('composer-restore', { detail: { text: back.join('\n\n') } }))
          }
          break
        }
        case 'turn_started': {
          // A NEW TURN BEGAN in this conversation (backend `turn_session`, sent to every tab of the person). The tab
          // that sent the message is already following it. Another tab showing this chat had no bubble, so it dropped
          // every frame of the turn and learned of the run only when a card arrived, about 40 s later (phase 8 run 2,
          // two tabs on conversation 1268): it now shows the person's message and follows the turn from here.
          if (msg.conversation_id == null || this.conversationId == null ||
              String(msg.conversation_id) !== String(this.conversationId)) break
          if (this.isStreaming) break
          const _sid = msg.message_id != null ? String(msg.message_id) : null
          if (!_sid || !this.messages.some((x) => x.role === 'user' && String(x.serverId ?? '') === _sid)) {
            const _approval = msg.kind === 'plan_approval'
            this.messages.push({ id: nid(), role: 'user', content: _approval ? PLAN_APPROVED_CONTINUE : (msg.message || ''),
                                 ...(_approval ? { kind: 'plan_approval' } : {}), serverId: msg.message_id ?? null,
                                 status: 'done', error: '', toolCalls: [] })
          }
          // A new run: its events are counted from its own start, not from the last run this tab followed.
          this._forgetRunSeq(this.conversationId)
          this._beginAssistant()
          break
        }
        case 'followup_turn_started': {
          // A turn the SERVER started. The user typed while the agent was working, the turn ended
          // before draining the queue, and the backend is now running that message as its own turn —
          // but this tab never sent a `chat_message` for it, so nothing here opened a bubble.
          //
          // Without one, `assistant_message_chunk` does `if (m) m.content += …` and silently drops
          // every streamed token, and then `assistant_message_complete` falls back to
          // `_lastAssistantOfTurn()` and OVERWRITES the previous turn's answer with this turn's.
          //
          // Production conv 2163: 'hi' was answered, 'what you can do' was queued and answered, and on
          // screen the second answer had replaced the first — both rows were correct in the database.
          // Opening the bubble here is what keeps the two answers apart.
          //
          // Scoped to THIS conversation on purpose. The frame is not in `WORK_FORWARDED_TYPES`, so the
          // cross-conversation guard in `_onEvent` does not cover it, and a user who navigated to
          // another chat between the queue and the drain would otherwise get an empty bubble opened in
          // whatever thread they are now looking at.
          if (msg.conversation_id != null && this.conversationId != null &&
              String(msg.conversation_id) !== String(this.conversationId)) break
          // The messages this turn answers are no longer waiting: by their saved ids, else by their words.
          // (Without either list, every waiting bubble is.)
          {
            const ids = Array.isArray(msg.message_ids) ? new Set(msg.message_ids.map(String)) : null
            const names = Array.isArray(msg.messages) ? new Set(msg.messages.map((t) => String(t || ''))) : null
            for (const m of this.messages) {
              if (m.role !== 'user' || !m.queued) continue
              const mine = ids && m.serverId != null ? ids.has(String(m.serverId))
                : (!names || names.has(m.content || ''))
              if (mine) m.queued = false
            }
          }
          if (!this.isStreaming) this._beginAssistant()
          break
        }
        // ── Task/CRS run lifecycle: a multi-step run (plan → tools) streams an assistant_message_complete
        //    PER step; the turn must end only on the run's terminal event, not the first step. ──
        case 'agent_planning':
          this._taskRunActive = true   // a multi-step task run is in progress
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
        //
        // THE TURN IS OVER WHEN THIS ARRIVES: the server sends it and ends the turn, with no completion
        // frame after it. Left streaming, the page kept a spinning "Working" and a Stop button over a plan
        // that waited for the person (prod conv 2814, 2026-10-15).
        case 'plan_approval_required': {
          // PLAN MODE: the plan is a message in the chat with its file (`plan_ready`), answered by the person's next
          // message, so the run's older event for the same plan is display-only. Pausing here would add a second plan.
          const _p = msg.plan || {}
          const _review = usePlanReviewStore().review
          const _planMode = this._planModeTurn
            || !!(_review && _review.runId && String(_review.runId) === String(_p.run_id || msg.run_id || ''))
          if (_planMode) break
          this.pendingPlan = _p
          this._pauseAssistant('plan_approval')
          break
        }
        // Human approved server-side → resume by re-sending the original instruction (it now
        // executes because the plan is approved). Rejection just clears the card + ends the turn.
        case 'plan_approved':
          this.pendingPlan = null
          this._resumeAfterPlan()
          break
        // The server ran no turn: this approval had already started its plan (or there was none).
        // Take back the approval row and the empty bubble this page opened for it. Not `_endAssistant`:
        // nothing finished, so nothing is pinned and no "run finished" notification is sent.
        case 'plan_resume_refused': {
          const opened = this.messages.findIndex((x) => x.id === this._assistantId)
          if (opened >= 0 && !String(this.messages[opened].content || '').trim()) {
            this.messages.splice(opened, 1)
            const row = opened - 1
            if (row >= 0 && this.messages[row].kind === 'plan_approval' && this.messages[row].serverId == null) {
              this.messages.splice(row, 1)
            }
            this._assistantId = null
            this.isStreaming = false
          }
          break
        }
        case 'plan_rejected':
          this.pendingPlan = null
          this._endAssistant()
          break
        // Human requested changes → the feedback becomes the next instruction; the agent re-plans.
        case 'plan_revise':
          this.pendingPlan = null
          this._resumeAfterRevise(msg.feedback)
          break
        // ── Full-document cost gate (manual mode): a complete-mode KB scope overflowed the model
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
          // A refusal by the person's prepaid balance (`wallet_empty`, `model_price_missing`): the bubble offers
          // "Top up" instead of Retry (backend PAYMENTS_TOPUP_PLAN.md §6.5). Read before _errAssistant releases it.
          const _errBubble = this._cur()
          if (_errBubble && msg.code) _errBubble.errorCode = msg.code
          this._errAssistant(em, msg.retryable !== false, true)
          break
        }
        default:
          // agent_typing / thought / planning / step — ignored for now
          break
      }
    },
  },
})
