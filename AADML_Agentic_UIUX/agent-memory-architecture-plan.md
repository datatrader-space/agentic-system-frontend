# Agent Memory Architecture — Final Plan

Consolidates the manager's review + our discussion into a buildable plan. Scope: redesign the agent
**memory model + Step-2 Memory card**, **remove "dreaming" as a memory layer**, add **Global User Memory**
(UI-managed, bounded), and replace **per-turn autopilot** with **end-of-run learning**.

**Guiding principle (bake in):**
> Memory comes from the **user**, **real completed runs**, **project facts**, or **trusted sources** — never from the model's imagination.

Legend: **[HAVE]** exists in code · **[EXTEND]** exists but needs more · **[NEW]** must be built.

---

## Decisions (LOCKED — manager-approved 2026-06-27)
1. **Reuse `AgentMemory(scope='user' / 'project')`** — yes, no new tables.
2. **Dreaming injection — hard-stop for ALL agents** (gated off by default).
3. **End-of-run learning — gate per agent** (`end_of_run_learning_enabled`).
4. **Global memory limits — 100 active + ~1.5k injection tokens** (+ pinned cap 20).
5. **UI — simple switches first; read/write split only under Advanced.**
6. **NO `.env` flags for memory/history — the frontend + DB are the control plane.** Remove `LLM_STRUCTURED_MEMORY_ENABLED` and `MEMORY_AUTOPILOT_ENABLED`. Source of truth = **`UserMemorySettings`** (account) + **`AgentProfile`** (per-agent) + item eligibility + **code-level safety rules**. Effective = `user_setting && agent_setting && item_eligibility && safety_policy`. `.env` keeps **ops config only** (DB URL, Celery broker, provider keys, rate limits) — never product behavior.
7. **Launch-state (replaces the old global-flag rollout guard):** since there's no global gate, **defaults govern launch behavior.** New users/agents default ON (memory works out of the box — the product goal). For EXISTING rows, a one-time data migration decides: on-now (matches intent) vs off-until-opt-in (safer). Recommend **new=ON**, and a deliberate choice for existing (see §1).

---

## 0. Final layer model (6 layers — NO dreaming)

| # | Layer | Backing | What it is |
|---|---|---|---|
| 1 | **Conversation context** | `max_history_messages` + `agent_context` history blocks | Recent turns + checkpoint digest. Ephemeral, token-bounded. **Not memory.** |
| 2 | **Global user memory** | `AgentMemory(scope='user')` | User-controlled, shared across all the user's agents. UI-managed, **bounded active limit.** |
| 3 | **Scoped durable memory** | `AgentMemory(scope agent/project/conversation)` | Agent / repo / conversation memories, router-governed. |
| 4 | **Explicit remember/forget** | `MANAGE_MEMORY` tool + `/memory/forget/` | Immediate save/update/delete on explicit user intent. |
| 5 | **End-of-run learning** | (was `memory_autopilot`) | After a completed run, propose grounded memory candidates → router. |
| 6 | **Knowledge base / RAG** | `ContextFile` / `WebSource` / `DocumentChunk` | External docs, crawls, uploads. |

**Dreaming is removed from this model** (see §3).

---

## 1. Per-agent policy fields (one migration) — **[NEW]**

Add to `AgentProfile` (all resolved through `MemoryPolicy` together with the account `UserMemorySettings` — see §2; no env flags):

```python
use_global_memory          = BooleanField(default=True)   # inject the user's global memories
structured_memory_enabled  = BooleanField(default=True)   # master per-agent switch (read+write+inject)
memory_read_enabled        = BooleanField(default=True)   # inject/search active memories
memory_write_enabled       = BooleanField(default=True)   # allow MANAGE_MEMORY writes
end_of_run_learning_enabled= BooleanField(default=True)   # allow end-of-run extraction
use_project_memory         = BooleanField(default=True)   # inject project/repo-scoped memories
```

**ROLLOUT GUARD (required before build).** App-level `default=True` is for *new* agents only. The migration
must set the two behavior-changing fields to **False on all EXISTING rows**, so the account-level
`memory_enabled` default does NOT silently switch every existing agent on:
```python
# migration data step (existing agents only):
AgentProfile.objects.update(structured_memory_enabled=False, end_of_run_learning_enabled=False)
# new agents created after launch keep the model default=True
```
(`use_global_memory`, `memory_read_enabled`, `memory_write_enabled`, `use_project_memory` can stay default
True — they're inert while `structured_memory_enabled=False` via MemoryPolicy.)

Add all six to `AgentProfileSerializer.fields`. Simple UI exposes a couple of these; the rest are Advanced.

### 1b. `UserMemorySettings` — account-level, DB-backed (the global control plane) — **[NEW]**
Replaces the removed `.env` kill switches. One row per user; created on demand; editable from **Settings → Memory**.
```python
class UserMemorySettings(models.Model):
    user = OneToOneField(User, on_delete=CASCADE)
    memory_enabled              = BooleanField(default=True)   # account master
    global_memory_enabled       = BooleanField(default=True)
    agent_memory_enabled        = BooleanField(default=True)
    project_memory_enabled      = BooleanField(default=True)
    end_of_run_learning_enabled = BooleanField(default=True)
    history_enabled             = BooleanField(default=True)
    history_mode                = CharField(max_length=16, choices=[("auto","Auto"),("manual","Manual")], default="auto")
    max_history_messages        = IntegerField(null=True, blank=True)   # account default; agent can override
    global_memory_active_cap             = IntegerField(default=100)
    global_memory_injection_token_budget = IntegerField(default=1500)
    created_at = DateTimeField(auto_now_add=True); updated_at = DateTimeField(auto_now=True)
```
+ a small REST endpoint (`GET/PATCH /me/memory-settings/`) for the Settings UI. `UserMemorySettings` = account preference; `AgentProfile.*` = per-agent override.

---

## 2. `MemoryPolicy` resolver — **[NEW]** (the single source of truth, DB-only)

Create `agent/services/memory_policy.py`. **Every** memory + history path calls it. It reads **only DB-backed
settings** (`UserMemorySettings` + `AgentProfile` + `AgentMemory` item state) plus **hardcoded safety rules** —
**no `.env`**.
```python
@dataclass(frozen=True)
class MemoryPolicy:
    can_inject_memory: bool          # user.memory_enabled and agent.structured_memory_enabled and agent.memory_read_enabled
    can_search_memory: bool          # == can read
    can_write_memory: bool           # master and agent.memory_write_enabled
    can_run_learning: bool           # master and user.end_of_run_learning_enabled and agent.end_of_run_learning_enabled and can_write
    use_global_memory: bool          # can_read and user.global_memory_enabled and agent.use_global_memory
    use_agent_memory: bool           # can_read
    use_project_memory: bool         # can_read and user.project_memory_enabled and agent.use_project_memory
    use_conversation_memory: bool    # can_read
    max_injection_tokens: int        # user.global_memory_injection_token_budget
    allowed_sensitivity: tuple       # safety: e.g. ("normal","personal") — secrets/credentials/regulated excluded
    disabled_reason: str | None      # "disabled_by_user_or_agent_setting" — drives UI message + debug

    @staticmethod
    def for_agent(agent_profile, conversation=None, user=None) -> "MemoryPolicy":
        s = UserMemorySettings.objects.get_or_create(user=user)[0]
        master = s.memory_enabled and agent_profile.structured_memory_enabled
        can_read  = master and agent_profile.memory_read_enabled
        can_write = master and agent_profile.memory_write_enabled
        ...
```
**Safety rules live in code, not flags:** never store/inject secrets/credentials; don't inject regulated/sensitive
unless allowed; respect delete/forget; respect ownership/scope. These are non-negotiable and not user-toggleable.

Wire it into: the `agent_context` structured-memory provider (injection), `SEARCH_MEMORY`/`MANAGE_MEMORY` tool
exposure, the end-of-run enqueue path, and `memory_router`. UI shows *"Disabled by your memory settings"* via
`disabled_reason` — never "disabled by system policy/.env".

**Replace the old env checks everywhere:**
```python
# before:  if not settings.LLM_STRUCTURED_MEMORY_ENABLED: return ""
# after:   if not MemoryPolicy.for_agent(agent_profile, conversation, user).can_inject_memory: return ""

# before:  if settings.MEMORY_AUTOPILOT_ENABLED: enqueue_memory_autopilot(...)
# after:   if policy.can_run_learning: enqueue_run_learning(...)
```
**Remove from settings/code:** `LLM_STRUCTURED_MEMORY_ENABLED`, `MEMORY_AUTOPILOT_ENABLED`, any `HISTORY_*` /
dreaming/reflection env flag that changes user-visible behavior. (Backend-only constants like default token
budgets become code constants or DB fields — not hidden deploy flags.)

---

## 3. Remove "Dreaming" as a memory layer — **[EXTEND] (decommission, NOT delete)**

Today dreaming auto-injects unsourced, LLM-generated `KnowledgeCard` content into the system prompt by
default (`get_l1_prompt`, consumers.py:8740; `dreaming_enabled` defaults on). That is the one
non-traceable, model-imagined source — remove it from the live path.

**Do:**
1. **Stop the injection in CODE (no `.env` flag)** — `get_l1_prompt` is decommissioned; hard-return empty:
   ```python
   def get_l1_prompt(agent_profile):
       # Dreaming is decommissioned as a memory layer. KnowledgeCard data is kept for admin/legacy review only.
       return ""
   ```
   Per-agent `dreaming_enabled=True` is **no longer meaningful in the live prompt path**. If "Agent Reflection"
   is reintroduced later, gate it on a **DB field** `agent_reflection_enabled = BooleanField(default=False)` — never an env flag.
2. **Default `auto_dream = False`** so nothing self-generates without explicit intent.
3. **Remove dreaming from the Step-2 Memory card** (and don't surface `dreaming_enabled`/`auto_dream`/`dream_frequency`/`dream_model` as memory controls).
4. **Keep the model + `KnowledgeCard` data + Celery tasks + admin** intact (no destructive migration). Just decommissioned from the active/default path.
5. **If revived later → "Agent Reflection"**, NOT memory: candidate-only, **source-referenced**, router-gated, never auto-injected, per-agent opt-in.

Its product role is replaced by **end-of-run learning** (§5), which is grounded in real completed work.

---

## 4. Explicit remember/forget — **[HAVE], keep immediate + add real delete**

- Already immediate via `MANAGE_MEMORY` → `memory_router` (save/update/supersede/deactivate/delete) and `/memory/forget/`. **Keep on the immediate path** (NOT deferred to end-of-run).
- **[EXTEND] hard-delete/redact:** default stays supersede/archive, but add a user-requested **forget/redact** that **redacts content + keeps a minimal tombstone** (audit-safe) for privacy/compliance. Build on `/memory/forget/` + the router `delete` op.

---

## 5. End-of-run learning (replace per-turn autopilot) — **[EXTEND]**

Rename `agent/services/memory_autopilot.py` → **`run_learning.py`** (a.k.a. memory consolidator).

- **Trigger change:** fire on **run completion** (full agent loop / final answer), not per message. The run boundary must attach to the **agent execution lifecycle**, not a message-created signal. Define run state (on `AgentSession` or a run record):
  ```python
  run_started_at, run_completed_at
  run_status = running | completed | failed | cancelled
  run_final_response_id, run_transcript_snapshot_id
  ```
  Learning fires only when: `run_status == completed` AND a final response exists AND `policy.can_autopilot` AND no learning-run exists for it. **Failed/cancelled runs:** skip — or extract only a narrow `correction`/`failure_lesson` candidate when there's reliable evidence. For plain chat, run = the single turn (unchanged); for tool/coding runs it waits for PLAN→…→FINAL so it sees the **final outcome** (fixes the "saved Redis, then user switched to Postgres" over-save).
- **Input:** the **whole run transcript**, not one message.
- **Keep** every existing guarantee: off hot path (Celery), idempotent per run, **secret scan before any LLM call**, cheap pre-filter, **candidate-by-default**, router has final authority, versioned extractor.
- Gated by **`policy.can_run_learning`** (DB-driven; `MEMORY_AUTOPILOT_ENABLED` env flag removed) — can't run when memory write is off, killing the confusing half-state.

---

## 6. Global User Memory — **[EXTEND] data + [NEW] UI/limits**

Reuse the unified store: **`AgentMemory(scope='user')`** (do NOT create a separate model). Injection already
pulls `scope=user` for the conversation's user (`active_for_injection`). What's missing:

- **[NEW] per-agent gate:** `use_global_memory` (see §1) consulted by the injection provider.
- **[NEW] UI CRUD** (Settings → Memory → Global Memories): list / add / edit / delete / **pin** / disable, and "which agents can use it." Needs REST endpoints for user-scoped `AgentMemory` (writes go through `memory_router`; reads via a user-scoped list). `AgentMemoryViewSet` is read-only today — extend.
- **[NEW] bounded active limit (storage ≠ injection):**
  - **Injection budget:** `max_injection_tokens` (~1.5k) enforced by the selector (§7). Storage may exceed this.
  - **Three limits — DB-backed + user-editable** (a pinned cap stops users defeating compaction by pinning everything):
    - `UserMemorySettings.global_memory_active_cap` (default 100) — editable in Settings → Memory.
    - `UserMemorySettings.global_memory_injection_token_budget` (default 1500) — editable.
    - `GLOBAL_MEMORY_PINNED_CAP = 20` — code constant for now (can become a field later). Not an env flag.
  - Background **compaction** job archives/merges low-importance + dedups duplicates when over the active cap; **pinned** items never auto-compacted (but bounded by the pinned cap).
  - Add a `pinned` BooleanField to `AgentMemory` (or metadata flag).

---

## 7. Injection selector + conflict precedence — **[EXTEND]**

- **Selector** (not "inject everything"): scope match + relevance + importance + recency-decay + token budget + conflict/dedup. Apply inside `memory_router.render_injection_block` / the `agent_context` memory provider. (Today `active_for_injection` orders by importance+recency only; the `agent_context` compiler already enforces a cross-block token budget — extend with intra-memory ranking + dedup.)
- **Explicit precedence table** (document it; superseded items never injected):
  1. Current user/developer/system instructions
  2. Active conversation-scoped memory
  3. Active project-scoped memory
  4. Active agent-scoped memory
  5. Active global user memory
  6. Recent verbatim history
  7. Checkpoint digest
  8. Query-only retrieved memories (L3, on demand)
- **L2 triggers:** keep keyword triggers; add cheap **alias expansion** (invoice/payment/pricing → billing) now; **defer semantic similarity** (embedding cost on hot path) until evidence shows keyword-miss hurts.

---

## 8. Step-2 Memory card redesign — **[NEW] frontend** ("Memory & Context")

Sections (each maps to real DB backing; a section disabled by the user's account settings shows *"Disabled by your memory settings"* via `policy.disabled_reason` — never "system policy"):

- **Conversation context** → `max_history_messages` (Auto / Manual N). *Relabel away from "Memory".*
- **Global user memory** → `use_global_memory` (On/Off) + link to Settings → Global Memories.
- **Agent memory** → "Allow this agent to remember" (`structured_memory_enabled`) + "Learn at end of runs" (`end_of_run_learning_enabled`). Advanced: read/write split (`memory_read_enabled` / `memory_write_enabled`).
- **Project memory** → `use_project_memory` (On/Off).
- ~~Dreaming~~ → **removed** (§3).

### Account control plane — **Settings → Memory** (new) — **[NEW] frontend** (`UserMemorySettings` via `/me/memory-settings/`)
- **Memory:** Use memory across my account · Use global memories · Use agent memories · Use project memories · Learn from completed runs.
- **History:** History on/off · Auto vs Manual · default last-N.
- **Global memory limits:** Active memory limit (100) · Injection budget (1500 tokens).
- **Global memories (CRUD):** Add / Edit / Delete / Pin / Disable (user-scoped `AgentMemory` via the router) — §6.

---

## Consolidated NEW backend build list
1. **Migration:** 6 per-agent policy fields (§1) + `UserMemorySettings` model (§1b) + `AgentMemory.pinned` (§6). Data step for launch-state on existing rows (§1/Decision 7).
2. **`memory_policy.py`** — `MemoryPolicy.for_agent()` resolver (**DB-only, no env**); wire into injection / tools / learning-enqueue / router (§2). **Remove `LLM_STRUCTURED_MEMORY_ENABLED` + `MEMORY_AUTOPILOT_ENABLED` + any `HISTORY_*`/dreaming env flags; replace all checks with policy calls.**
3. **`/me/memory-settings/`** endpoint (GET/PATCH) for the account Settings → Memory UI (§1b).
4. **Dreaming decommission** — `get_l1_prompt` hard-returns `""` (no env flag); default `auto_dream=False`; remove from card (§3).
4. **End-of-run learning** — rename autopilot → `run_learning.py`; trigger on run completion; whole-transcript input; gate via `MemoryPolicy` (§5).
5. **Global User Memory** — user-scoped `AgentMemory` CRUD endpoints (router-mediated writes) + active-count cap + injection budget + compaction job + `pinned` (§6).
6. **Selector + precedence** — intra-memory ranking/dedup + explicit precedence; alias-expanded L2 (§7).
7. **Hard-delete/redact** path with tombstone (§4).

## Consolidated EXISTING ([HAVE], no build)
`AgentMemory` (scopes/lifespan/status/sensitivity/provenance) · `memory_router` (decide+override+audit `MemoryDecisionLog`) · `MANAGE_MEMORY` / `SEARCH_MEMORY` tools · `/memory/forget/` · `active_for_injection` (conversation+agent+user+project) · `agent_context` history + compiler token budget · `max_history_messages` Auto/Manual.

## Config policy (env vs DB)
- **`.env` = ops only:** DB URL, Celery broker, model-provider keys, rate limits, deployment env.
- **DB + UI = all product behavior:** whether memory/history exist, auto-learning runs, global memory injects, dreaming injects (it doesn't). The frontend must never "lie" because of a hidden deploy flag.
- **To be REMOVED from settings/code:** `LLM_STRUCTURED_MEMORY_ENABLED`, `MEMORY_AUTOPILOT_ENABLED`, any `HISTORY_*` env flag, any dreaming/reflection env flag.

---

## Phased rollout (risk-first order — manager-approved)
- **Phase 1 — Stop risky behavior — ✅ DONE (2026-06-27):** `get_l1_prompt` hard-returns `""` (verified; no env flag); `auto_dream` default→False + **migration 0089** also disabled it on all existing agents; Define-Brain Memory card relabeled "Conversation Memory" → **"Conversation Context"** with Auto/Manual semantics (dreaming was never exposed in the new card, so nothing to remove). Backend check + build green.
- **Phase 2 — DB control plane + policy — ✅ DONE (2026-06-27):** added `UserMemorySettings` (§1b) + 6 per-agent fields + **migration 0090** (existing agents opt-in **OFF**: `structured_memory_enabled=False`, `end_of_run_learning_enabled=False`); `GET/PATCH /api/me/memory-settings/` endpoint; `MemoryPolicy.for_agent()` (DB-only, verified `disabled_by_user_or_agent_setting` when off); rewired the **injection gate** (`structured_memory_block`), **auto-learning enqueue** (`enqueue_for_turn`), and the Celery worker body (`run_extraction`) to `MemoryPolicy`; **env gating removed** (`MEMORY_AUTOPILOT_ENABLED` env read deleted; `LLM_STRUCTURED_MEMORY_ENABLED` → non-env constant kept only for the legacy ambient tool-doc path + tests). Django check green.
  - **Phase 2 closure — ✅ DONE (2026-06-29):** (1) memory suite **167 passed**; (2) autopilot tests no longer gate on `MEMORY_AUTOPILOT_ENABLED` — they now attach an `AgentProfile` and toggle the **DB** `end_of_run_learning_enabled` field; (3) **`memory_write_enabled` enforced at `MANAGE_MEMORY`** (`execute_manage_memory` returns disabled when `not policy.can_write_memory`); (4) **`memory_read_enabled` enforced at `SEARCH_MEMORY`** (`execute_search_memory` returns empty when `not policy.can_search_memory`) — both gate only when an `agent_profile` is present, leaving agentless/system writes alone; (5) explicit remember/forget works immediately when write is enabled (covered by `MemoryPolicyEnforcementTests`); (6) confirmed no `.env` flag controls memory/history behavior (`is_enabled()` now dead/deprecated; settings read deleted). Frontend wiring of these fields is Phase 3.
- **Phase 3 — Honest Memory & Context card — ✅ DONE (2026-06-29):** Define-Brain card relabeled **"Memory & Context"** with grouped switches — Conversation Context (Auto/Manual N) · Global User Memory (`use_global_memory`) · Agent Memory (`structured_memory_enabled` master + `end_of_run_learning_enabled`) · Project Memory (`use_project_memory`) · Advanced (`memory_read_enabled` / `memory_write_enabled`). Honest disable: account master off → amber "Memory is turned off in Settings"; agent master off → dependent rows nested-off with "Turn on Allow this agent to remember". **No env/system-policy wording.** Saved via the editor's existing `save()` PATCH. Build green.
- **Phase 5 — Global memory management — ✅ DONE (2026-06-29):** **Settings → Memory** tab (`MemorySettings.vue`, registered in `SettingsLayout`) = account toggles (`GET/PATCH /me/memory-settings/`) with hierarchy explainer + history mode + limits (active cap / injection budget) + **Global Memories CRUD** (`GET/POST /me/memories/`, `PATCH/DELETE /me/memories/<id>/`): add/edit (router supersede)/pin/archive-restore/delete + search + empty/loading/error states. Backend writes route through `memory_router.manage_memory` (secret-scan/dedup/audit), owner-scoped; reuses `AgentMemory(scope='user')` (no new model). 7 API tests green; frontend build green. API client: `getMemorySettings/updateMemorySettings/listGlobalMemories/createGlobalMemory/updateGlobalMemory/deleteGlobalMemory`.
- **Phase 4 — End-of-run learning — ✅ DONE (2026-06-29):** TRUE run-boundary refactor (not a rename). New `agent/services/run_learning.py` (extractor internals moved + `enqueue_for_run(session)` / `run_learning_extraction(session_pk)` / `build_run_transcript`). **Single run-completion hook** in `consumers.py::_update_session_log` fires `enqueue_for_run` only when status → `success`/`completed` (covers all chat/task/hybrid/unified paths); the **3 per-message `enqueue_for_turn` sites removed** (main chat, unified Let's Code, agent_runner). `AgentSession` is the run boundary; transcript = `user_request` + `steps` (tool actions/results) + `final_answer`; extractor prompt now says "prefer the FINAL outcome over abandoned mid-run approaches" (kills the Redis→Postgres save-the-early-idea bug). One pass per run (idempotency marker keyed `run:{session_id}:{v}`); **failed/cancelled skipped**; secret-scan + policy (`can_run_learning`) gate enqueue AND worker. New Celery task `run_end_of_run_learning_async`; old `run_memory_autopilot_async` kept as deprecated drain. `memory_autopilot.py` = thin re-export shim; `enqueue_for_turn` now a deprecated no-op. Explicit MANAGE_MEMORY/forget UNCHANGED (immediate). Tests: `test_run_learning.py` (new, incl. mid-run-no-enqueue + failed-no-enqueue + full-transcript + per-run idempotency + policy-off); `test_memory_autopilot.py` deleted; combined memory suite **105 passed**; Django check clean.
  - **Phase 4 surface gate — ✅ DONE (2026-06-29):** audited every `agent_runner.execute` caller. Real owner chat/task already complete via `_update_session_log` (covered). The Emulator is the **builder surface (repo_id 0)** which DOES flow through that hook → it would have learned, which is wrong. Fix: `enqueue_for_run(session, *, surface)` now skips `_NON_LEARNING_SURFACES = {builder, emulator, public, benchmark, test, workflow, direct}`; the hook passes `self._resolve_stream_tier()` so only a real owner conversation ('user' tier) learns. The other uncovered `agent_runner` callers are intentionally non-learning: **benchmark** = test surface, **execution.py healing** (mode='direct') = internal utility, **workflow_graph node** = automated + has no `ChatConversation` to anchor scope (run_learning needs one). Tests: emulator/public excluded + user learns. Failed/cancelled unchanged; no failure-lessons built (future, source-backed only).
- **Phase 6 — Selector/ranking + conflict/dedup + tombstone + compaction — ✅ DONE (2026-06-29):** built in the SAFE order (selector → conflict/dedup → tombstone → compaction last). **(1) Injection selector** `agent/services/memory_selector.py::select_for_injection` wired into `memory_router.render_injection_block` (+ provider passes the resolved policy): sensitivity filter (secrets/credentials/regulated never inject), active-only, scope-precedence conflict resolution (conversation>project>agent>global user>workspace>org), near-duplicate dedup (Jaccard≥0.8, winner-first), pinned-boost ranking, then importance + 30-day recency decay; account **injection-token budget** (`policy.max_injection_tokens`) caps the rendered block. **(2) Conflict/dedup** = the same selector (superseded/archived/rejected/expired excluded by status; current/project beats global). **(3) Redact tombstone** = new `redact` router op: user forget SCRUBS content (''), clears triggers, sets sensitivity normal + status archived + `metadata.redacted`, `injection_policy=query_only` → removed from injection forever, minimal tombstone kept + decision-logged; wired to global-memory DELETE endpoint + chat "forget X" (`_apply_actions`); autopilot *undo* stays a hard delete (it's an undo, not a privacy forget); list view hides redacted (NULL-safe Python filter), keeps archived restorable. **(4) Compaction** `agent/services/memory_compaction.py::compact_global_memories` + `compact_memories` mgmt command (`--user/--all/--dry-run`): archive-only (reversible, NEVER touches pinned, never hard-deletes), merges near-dupes (Jaccard≥0.85), archives stale low-importance (imp≤3 & age>90d), enforces account active cap (default 100, pinned always kept), logs every decision (`MemoryDecisionLog` operation='compact'). Tests: `test_memory_phase6.py` (selector 4 + redact 2 + compaction 5) + updated global-memory delete→tombstone; **116 memory tests pass**; Django check clean. No new model, no env flags, dreaming not revived.

**Step 2 simplification + global decoupling — ✅ DONE (2026-06-29):** manager directive — the Define-Brain "Memory & Context" card was too many toggles (exposed internal read/write/project/advanced). Now just **3 user decisions**: Conversation context (Auto/Manual + N, "Auto is recommended"), **Use my global memory** (`use_global_memory`), **Allow this agent to remember** (composite master — one switch sets `structured_memory_enabled`+`memory_read_enabled`+`memory_write_enabled`+`use_project_memory`+`end_of_run_learning_enabled` together; OFF clears them), with sub-toggle **Learn at end of runs** (`end_of_run_learning_enabled`, enabled only when allow-remember on) + a "Manage all memory settings →" link to Settings → Memory. Read/write/project/advanced removed from Step 2 (still in Settings → Memory). **Backend: global memory DECOUPLED from the per-agent own-memory master** — `MemoryPolicy.use_global` now needs only account `memory_enabled` + account `global_memory_enabled` + agent `use_global_memory` (NOT `structured_memory_enabled`); `can_inject_memory = can_read OR use_global`; the injection **selector now scope-filters by `policy.use_*`** so an agent with own-memory OFF but global ON injects ONLY account-wide memories. `test_memory_router` injection conv given an agent (realistic); new selector test for scope toggles; **120 memory tests pass**, FE build green.

**PLAN COMPLETE — all 6 phases shipped (2026-06-29).** Final memory model live: conversation context · global user memory · scoped durable memory · explicit remember/forget · end-of-run learning · RAG. Dreaming removed. DB-only control plane (UserMemorySettings + AgentProfile + MemoryPolicy), no `.env` memory/history flags anywhere.

## Decisions
All resolved — see **Decisions (LOCKED)** at the top. No open items; ready to build Phase 1.
