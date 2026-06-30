# New Agent Create/Editor — "Fully Functional" Plan

Goal: make the **new unified Create/Editor** (`AgentEditor.vue`, route `/dashboard/agents/new` for create + `/dashboard/agents/:id/editor` for edit) and its **6 steps + header** fully functional and fully wired to the backend.

**Scope rule (per request):** we do NOT port anything from the legacy `/advanced` builder (no Workflows / Scripts / Data / Flow / Advanced / live Emulator dock / Deploy-&-Share / Workspace-bridge panel). Only the new editor's own surfaces are in scope. The legacy `/advanced` stays as the fallback until this plan is done, then it is retired.

Legend: **[HAVE]** = endpoint/field already exists in code (verify-existing). **[EXTEND]** = exists but needs more. **[NEW]** = must be built.

---

## 0. How the editor persists (the spine)

- The editor holds one `agent` object and saves the **whole object** via `PATCH /agents/:id/` (edit) or `POST /agents/` (create). **[HAVE]** (router CRUD on `AgentProfileViewSet`).
- Every "Continue" already auto-saves; Step 1 "Create Agent" creates the draft. **[HAVE]**
- **Therefore most "wiring" = (a) add missing model fields + serializer, (b) make the step write them onto `agent`, (c) build the few real endpoints + enforcement that PATCH can't cover (credentials, monitoring, quick-test, policy enforcement).**

### New AgentProfile model fields needed (one migration)
| Field | Type | Used by | Why |
|---|---|---|---|
| `response_style` | JSONField(default=dict) | Step 2 | Persist Response Style chips + tone (currently local-only) |
| `workspace` (or use bridge) | FK→Workspace / bridge row | Step 1 | Persist the workspace selection (no per-agent workspace today) |
| `max_actions_per_run` | PositiveIntegerField(null) | Step 5 | Currently crammed into `agent_policy` JSON; promote to a real, enforceable field |
| `max_runs_per_day` | PositiveIntegerField(null) | Step 5 | same |

(`max_cost_per_run_usd`, `daily_budget_usd`, `agent_policy`, `execution_mode`, `plan_mode_enabled`, `plan_approval_required`, `default_model`, `image/vision/audio/video_model`, `system_prompt_template`, `agent_rules`, `max_history_messages`, `tool_ids` already exist + are serializer-writable. **[HAVE]**)

---

## Step 1 — Agent Identity — ✅ DONE (2026-06-26)
**Outcome:** fully wired & persisted. Workspace → added nullable `workspace` FK to AgentProfile (**migration 0087**) + serializer (`workspace` writable + `workspace_name` read-only); selector binds to `agent.workspace`, persists via PATCH/POST. Templates → now load from `GET /agents/templates/` and **apply the template's real config** (system_prompt_template, agent_rules, prompt_mode, tools) on select, not just a description string. Dead "Learn more" button removed. Name/Purpose already persisted.

_Original gaps (now resolved):_ name/purpose persist; workspace select did NOT persist; template chooser only prefilled description.

- Name → `name`, Purpose → `description`. **[HAVE]** (PATCH).
- Workspaces dropdown source → `GET /workspaces/`. **[HAVE]**
- **Persist workspace selection** → **[NEW/EXTEND]**. Decide one:
  - (a) Add `workspace` FK on AgentProfile + serializer + migration → PATCH persists; OR
  - (b) Wire to the existing tenancy **WorkspaceAgentProfile bridge** via a small action `POST /agents/:id/workspace/ {workspace_id}` that upserts the bridge row. (`workspace_views` + bridges exist — confirm the exact bridge write path.) **Recommend (b)** to stay consistent with tenancy.
- **Make templates real** → **[EXTEND]**. Replace the hardcoded template cards with `GET /agents/templates/` **[HAVE]**, and on "Create Agent" with a non-blank template selected, create via `POST /agents/from-template/` **[HAVE]** instead of a blank POST + description prefill.

**Backend new:** workspace-assign action (if option b) OR `workspace` FK (option a).
**Frontend:** load real templates; create-from-template on blank-vs-template; bind workspace to the chosen persistence path.

---

## Step 2 — Define Brain
**Now:** Model (main + 4 capability) + System Prompt + Rules + Memory all persist. **Response Style is local-only.**

- AI Model: providers `GET /llm/providers/` **[HAVE]**, models `GET /llm/models/` **[HAVE]**; writes `default_model` + `image/vision/audio/video_model`. **[HAVE]** Fully wired.
- System Prompt → `system_prompt_template` **[HAVE]**. Behavioral Rules → `agent_rules` **[HAVE]**. Memory → `max_history_messages` **[HAVE]**.
- **Response Style chips + Tone** → ✅ **DONE (2026-06-26)**: added `response_style` JSONField (**migration 0088**) + serializer; frontend binds chips/tone to `agent.response_style` ({tags, tone}) → PATCH persists. **AND it affects behavior**: new helper `agent/services/prompt_style.py::response_style_directive()` injects a deterministic style directive into the system prompt at BOTH live assembly sites — `consumers.py` (main agent loop) and `chat_engine.py`. So the agent now actually follows the chosen tone/voice.

**Backend new:** `response_style` field (+ optional prompt-assembly hook).
**Frontend:** bind Response Style to `agent.response_style`.

---

## Step 3 — Knowledge & Tools
**Now:** Files + URLs + Tools wired; Memory Sources empty; tool toggle is per-category.

- Files: `GET /context_files/?agent_id=` **[HAVE]**, upload `POST /context_files/` **[HAVE]**, delete `DELETE /context_files/:id/` **[HAVE]**, status `GET /context_files/:id/status/` **[HAVE]**.
  - **[EXTEND] frontend:** poll/refresh index status so "Indexing → Indexed" updates live.
- URLs: `GET /web_sources/?agent_id=` **[HAVE]**, add `POST /web_sources/discover/` **[HAVE]**, delete **[HAVE]**, reindex `POST /web_sources/:id/reindex/` **[HAVE]**.
- Tools: `GET /tools/definitions/` **[HAVE]**, write `tool_ids` **[HAVE]**.
  - **[EXTEND] frontend:** add **per-tool** toggles (expand "View tools") in addition to the per-category master toggle (data already present; no backend).
- **Memory Sources** → **[NEW]**: there is no per-agent memory/KB-source list. Build `GET /agents/:id/memory-sources/` returning the agent's knowledge bases / vector stores with name + chunk counts, and `POST /agents/:id/memory-sources/ {source_id}` to attach (and DELETE to detach). Back it with the existing KB/DocumentChunk data. **Decision:** if memory-sources are out of near-term scope, render an honest empty state and hide "Add Source" — but to be "fully functional" this endpoint is the new work.

**Backend new:** memory-sources list/attach/detach endpoints.
**Frontend:** per-tool toggles; live file-index polling; memory-sources column wired.

---

## Step 4 — Credentials
**Now:** lists global vault + attaches; does NOT show attached state; permission modes are education-only.

- Vault list → `GET /credentials/` **[HAVE]**. Attach → `POST /agents/:id/credentials/:cid/assign/` **[HAVE]**.
- **Show attached state + Detach** → **[EXTEND]**: load `GET /agents/:id/credentials/` **[HAVE]** on mount; mark rows Attached; toggle Attach/Detach via assign + `DELETE /agents/:id/credentials/:cid/delete/` **[HAVE]**.
- **Permission modes (Use-Only / View / Edit)** → **[NEW]**: add `permission_mode` to the agent↔credential link model (migration), accept it on the assign endpoint, and **enforce it in the credential resolver** (use_only = never expose value; view = metadata; edit = mutate). Today these are display-only chips.
- Columns Workspace / Sharing / Status / Last Used → **[EXTEND]**: confirm `list_global_credentials` returns `workspace_name`, `is_global/shared`, `is_valid`, `last_used_at`; add any missing to the serializer so columns aren't fallback text.
- **Decision:** credential **creation** stays out (use the "Manage Vault" link → existing connections/vault page). Attach-only here.

**Backend new:** `permission_mode` field + enforcement; possibly extra fields on the global-cred payload.
**Frontend:** attached-state load + Attach/Detach toggle; permission-mode selector per attached cred.

---

## Step 5 — Autonomy & Safety
**Now:** execution mode + spend fields persist; approval/guardrails/action-limits write to `agent_policy` JSON but enforcement/validation is unverified; several "View …" links are no-ops; spend limits are advisory.

- Execution Mode → `execution_mode` + `plan_mode_enabled` + `plan_approval_required`. **[HAVE]** persists.
- Spending Limits → `max_cost_per_run_usd` / `daily_budget_usd`. **[HAVE]** persist, **[NEW] enforcement**: add a runtime cost-cap check (per-run + daily) in the cost-accounting layer that blocks/aborts when exceeded.
- Approval threshold (`risk_ceiling`) + Guardrails checklist + Action limits → currently in `agent_policy` JSON.
  - **[EXTEND] validation:** `agent_policy` is "admin-only, can-only-tighten" — add a **validated write path** (serializer validation or a dedicated `PATCH /agents/:id/autonomy/`) so a normal owner can set per-agent policy that may only tighten the org `GlobalAgentPolicy`.
  - **[NEW] enforcement:** honor per-agent `risk_ceiling`, `guardrails[]`, `max_actions_per_run`, `max_runs_per_day` in the approval / guardrail / tool-gating layer (today only `GlobalAgentPolicy` is enforced). Promote action-limits to real fields (§0).
- `approval_group` options are hardcoded labels → **[NEW/EXTEND]:** source real approval targets (workspace members/roles) and wire into the approval router; until then mark as cosmetic.
- Guardrails read summary → `GET /agents/:id/guardrails/`. **[HAVE]** (display).
- **Wire or remove** "View all rules / Manage guardrails / View spend history / View usage" links → point at real surfaces (e.g. `/guardrails`, `/costs`) or drop. **[EXTEND]**

**Backend new:** spend-cap enforcement; per-agent policy enforcement (risk/guardrails/action-limits); validated tighten-only write path; promote `max_actions_per_run`/`max_runs_per_day` to fields; real approval targets.
**Frontend:** bind to new fields; replace dead links.

---

## Step 6 — Test, Publish & Monitor
**Now:** publish/rollback/monitoring endpoints exist; lots of the UI is mock; Quick Test is a static mockup.

- Monitoring bundle → `GET /agents/:id/monitoring/` **[HAVE]** (kpis success_rate/avg_response_ms/runs_24h/cost_24h, health.status, activity_timeseries, recent_runs).
- Publish → `POST /agents/:id/publish/` **[HAVE]**. Rollback → `POST /agents/:id/rollback/` **[HAVE]**. Use real `published_by` / `published_at` from the agent. **[HAVE]**
- **Remove the mock fallbacks** and show real data + empty states → **[EXTEND] frontend**. Specifically these are currently fabricated:
  - `recentRuns` fake list, `activityStats` (+18.4%, Escalations 27, Feedback 4.8/5), `testRows` (Tokens 1,248, Tools 2/2, Confidence), all Health indicators = "Operational", Version `v1.0.{id}`, "Published By: Current user", Environment dropdown.
- **What needs new/extended backend to be real:**
  - **[EXTEND] monitoring bundle:** add tokens-used + per-run latency + a structured `last_test` (most-recent run with status) so "Last Test Result" + tokens are real, not hardcoded.
  - **Escalations / Feedback score** → **[NEW]** (no source) — either build signals/feedback capture or **remove these tiles** (recommend remove for v1).
  - **Health indicators (Model Endpoint / KB / Tools / Guardrails / Data Sync / Monitoring)** → **[NEW]** per-subsystem health checks, or collapse to the single `health.status` the bundle already returns (recommend collapse for v1).
  - **Environment (Prod/Staging)** → no multi-env backend → **remove** (or **[NEW]** environments — out of v1 scope).
  - **Version** → derive from `published_at` / a publish counter instead of `v1.0.{id}`. **[EXTEND]**
- **Quick Test panel → real streaming** → ✅ **DONE** (2026-06-26). The static sample conversation was replaced with the real **`AgentEmulator`** component (the same live-streaming test chat the legacy `/advanced` builder uses) in `TestPublishMonitorStep.vue` — props `:agent-id` + `:model-name`, keyed by `agent.id`. Gated: shows a **"Publish to test your agent"** lock state while the agent is draft/unpublished, and the live emulator once `published`. No new backend (reuses the existing chat WS + `chat-token`).

**Backend new/extend:** monitoring bundle additions (tokens/last_test); decide remove-vs-build for escalations/feedback/health-subsystems/environments.
**Frontend:** drop all mock fallbacks; wire real Quick Test streaming; real publish metadata + version.

---

## Header
- Save / Configure-Publish / Test Agent / caret→advanced → all wired. **[HAVE]**
- **Deploy button** = navigates to Step 6 only (UI-only, no backend) — that's by design (Publish on Step 6 is the real action). Keep, or rename to "Go to Publish".
- **"…" overflow menu** → **[EXTEND]:** wire real actions (Save as draft, Duplicate `POST /agents/` copy, Delete `DELETE /agents/:id/`, Open advanced) — endpoints **[HAVE]** — or remove the button.
- **breadcrumb ✏️ rename** → **[EXTEND]:** make it inline-edit `agent.name` (binds + PATCH). Currently decorative.

---

## Consolidated NEW backend build list
1. **Migration** — AgentProfile: `response_style` (JSON), `max_actions_per_run`, `max_runs_per_day`, and `workspace` FK *(if not using the bridge)*.
2. **Workspace assign** — FK serializer field *(option a)* or `POST /agents/:id/workspace/` bridge upsert *(option b)*.
3. **Credentials** — `permission_mode` on the agent↔credential link + accept on assign + **resolver enforcement**; ensure global-cred payload has workspace/sharing/status/last-used.
4. **Memory sources** — `GET/POST/DELETE /agents/:id/memory-sources/` over existing KB/vector data.
5. **Autonomy enforcement** — runtime **spend caps** (per-run + daily); per-agent **risk_ceiling / guardrails / action-limits** enforcement; **tighten-only validated** policy write; real approval targets.
6. **Monitoring bundle [EXTEND]** — add tokens-used, structured last_test; (decide) per-subsystem health + feedback/escalations or remove.
7. **Response Style [EXTEND]** — optional prompt-assembly hook so it affects behavior.

## Consolidated EXISTING endpoints (verify-existing — no build)
`POST/PATCH/GET /agents/:id/`, `/agents/templates/`, `/agents/from-template/`, `/agents/:id/publish/`, `/agents/:id/unpublish/`, `/agents/:id/rollback/`, `/agents/:id/monitoring/`, `/agents/:id/guardrails/`, `/agents/:id/chat-token/`, `/agents/:id/credentials/` (+ `/assign/`, `/:cid/delete/`), `/credentials/`, `/workspaces/`, `/llm/providers/`, `/llm/models/`, `/context_files/` (+ `/:id/index|status`), `/web_sources/` (+ `/discover|reindex|:id`), `/tools/definitions/`, and the chat WebSocket.

---

## Phased rollout (suggested)
- **Phase 1 — pure-frontend wins (no backend):** Step 4 attached-state + Detach; Step 3 per-tool toggles + live file-index polling; Step 6 drop all mock + ✅ **real Quick Test streaming (DONE — `AgentEmulator` swapped in)** + real publish metadata; header overflow + inline rename; Step 1 real templates + from-template.
- **Phase 2 — small migration + fields:** `response_style`, `max_actions_per_run`, `max_runs_per_day`; bind Step 2 Response Style + Step 5 action-limit fields; workspace persistence.
- **Phase 3 — enforcement & new endpoints:** credential `permission_mode` + enforcement; autonomy spend/policy enforcement + tighten-only validation; memory-sources endpoints; monitoring-bundle extensions.
- **Phase 4 — decisions cleanup:** remove or build (escalations, feedback, per-subsystem health, environments, approval-groups).

## Open decisions (need your call)
1. Workspace persistence: **FK on AgentProfile** vs **tenancy bridge**.
2. Memory Sources: build the endpoint now vs honest empty-state for v1.
3. Credential permission modes: build enforcement vs keep education-only.
4. Step-6 extras (Escalations / Feedback / per-subsystem Health / Environments / Version scheme): build vs trim to what the monitoring bundle really returns.
5. Approval groups: real targets now vs cosmetic until the approval surface is built.
