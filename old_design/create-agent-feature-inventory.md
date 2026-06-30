# Create-Agent — Current Feature Inventory & Redesign Mapping

Companion to `create-agent-ui-upgrade.md`. **Purpose:** capture *everything* the current
6-tab "Agent Configuration" drawer (`AgentBuilder.vue`) does **before** we redesign, so the
new UI keeps every feature — and we decide consciously what stays core, what moves to
**Advanced**, and what (if anything) is dropped.

> Source of truth: `src/components/AgentBuilder.vue` + sub-panels `SignalPanel.vue`,
> `SchedulePanel.vue`, `tools/CredentialManager.vue`.

---

## 1. What each tab does today

### Tab 1 — General
| Feature | Field / behavior |
|---|---|
| Name | `name` |
| Description | `description` |
| LLM Provider | dropdown of the user's providers (e.g. "My OpenRouter") |
| Default Model | searchable dropdown + **model info card** (context window, capability badges: Image Input / Coding / Long Context, description) → `default_model` |
| Chat History Limit | slider 2–100 (default 50) → `max_history_messages` |
| System Prompt | big textarea → `system_prompt_template` |
| ↳ Prompt Mode | **Append / Override** toggle → `prompt_mode` (Override = your prompt is the whole system prompt, place tool docs with `{{tool_protocol}}`) |
| ↳ Placeholder chips | insert `{{tools}}`, `{{knowledge}}`, `{{tool_protocol}}`, `{{code_mode}}`, … into the prompt |
| ↳ char/token counter | live count |
| ↳ Preview Full Prompt | modal showing the **exact** assembled system prompt with per-section sizes + copy |

### Tab 2 — Knowledge
| Feature | Field / behavior |
|---|---|
| Knowledge Base & Files | **Upload knowledge file** → `knowledge_files` |
| File list | per-file card with **AI Analysis** preview |
| Analysis modal | view full analysis (markdown), **Re-Run Analysis** |
| Remove file | delete a knowledge file |
| Knowledge scope | `knowledge_scope` (global/system/repository/none) — shown as "Global Context" badge |

### Tab 3 — Tools
| Feature | Field / behavior |
|---|---|
| Code Mode | toggle → `code_mode_enabled` (search+execute meta-tools, ~90% context saving) + `code_mode_services` |
| Builder Mode | toggle → `builder_mode_enabled` (admin; gives `REGISTER_OAUTH_PROVIDER` tool) |
| Capabilities (Tools) | multi-select tool picker → `tool_ids`; **view modes: Selected / Category / Service**; count selected; covers built-in, service, and MCP tools |

### Tab 4 — Credentials
| Feature | Field / behavior |
|---|---|
| Service & Built-in tool credentials | `CredentialManager` — connect / test / set default; OAuth / API key / Bearer / Basic |
| MCP Server Credentials | pick an MCP server → set **encrypted env vars** (key/value), update/delete |

### Tab 5 — Signals  (`SignalPanel.vue`)
| Feature | Field / behavior |
|---|---|
| Signal Processing | enable toggle → `signal_enabled` |
| Concurrency Mode | Parallel vs Sequential → `signal_parallel` (+ `signal_max_concurrent`) |
| Stats | Pending / Processed / Dead Letters / Today's Cost |
| Webhook Endpoint | **Webhook URL** + **WebSocket Chat URL** + **API Key** (generate/rotate) |
| Limits | Rate Limit (`signal_rate_limit`), Daily Budget (`signal_daily_budget_usd`), HMAC secret (`signal_webhook_secret`) |
| Redis Stream Bridge | Redis URL + Stream Key (consume an external stream) |
| Test Signal | inject a test signal |
| Signal Log | recent signals list (filter, refresh, retry/cancel) |

### Tab 6 — Schedules  (`SchedulePanel.vue`)
| Feature | Field / behavior |
|---|---|
| Scheduled Runs | create a schedule: **Prompt** + **Run Frequency** (presets + custom **cron**) |
| Per-schedule overrides | Model Override, System Prompt Override, Budget ($/run) |
| Guardrails | Max Total Runs, Daily Budget Cap ($), Pause After N Failures, **Read-only mode**, **Expires at** |
| Schedule list | active/pause, run history |

---

## 2. Mapping → new design (nothing is lost)

Legend: **Core** = visible on the canvas · **Advanced** = under the collapsed "Advanced ▾" accordion · **Same component reused**.

| Today (tab → feature) | New home | Notes |
|---|---|---|
| General → Name, Description | **Header / Identity** (Core) | + optional avatar |
| General → LLM Provider, Default Model (+info card) | **Model picker** (Core, compact — near Behavior / in emulator) | keep capability badges |
| General → System Prompt | **① Behavior** (Core) | "How should it behave?" |
| General → Prompt Mode (Append/Override), `{{…}}` chips, Preview | **① Behavior → "Insert ▾" + Advanced** | keep Preview button; Append default |
| General → Chat History Limit | **Advanced** | rarely changed |
| Knowledge → upload + AI analysis + scope | **② Knowledge** (Core) | reuse upload + analysis modal |
| Tools → Capabilities picker (Selected/Category/Service) | **③ Tools** (Core) | becomes the "+ Add tool" searchable picker |
| Tools → Code Mode, Builder Mode | **Advanced** (or small toggles in ③) | power features |
| Credentials → CredentialManager | **Advanced → Credentials** | same component |
| Credentials → MCP env vars | **Advanced → Credentials** | same UI |
| Signals → webhook/WS URL + API key + enable | **④ Channels** (Core) | the integration surface + Integration Guide link |
| Signals → concurrency, rate limit, daily budget, HMAC, Redis bridge, stats, test, log | **Advanced → Channels/Signals** | same `SignalPanel` (collapsed) |
| Schedules → full scheduler + overrides + guardrails | **Advanced → Automation** | same `SchedulePanel` |

**Result: 0 features dropped.** Everything is either promoted to a core section or relocated
(unchanged) under the Advanced accordion. The Advanced accordion literally re-mounts the
existing `SignalPanel` / `SchedulePanel` / `CredentialManager` components.

---

## 3. ⚠️ Mockup vs. reality — important

The Botpress-style mockup shows some elements **AADML does not have yet**. These must be
labeled "coming soon" or omitted in the first implementation so we don't imply features that
don't exist:

| Mockup element | AADML today | Verdict |
|---|---|---|
| Knowledge **source pills**: Website / Table / Web Search / Rich Text / Notion / API | Only **file upload + AI analysis** exists | Show **Upload** for real; others = future connectors (hide or mark "soon") |
| **Communication Channels**: WhatsApp, Slack, Telegram, Instagram, Messenger | Not built | AADML "channels" today = **Webhook + WebSocket + Redis Stream**. Replace those logos with the real channels, or mark social ones "soon" |
| Emulator **product card carousel** | Generic chat exists; no product-card renderer | Emulator should reuse the **real agent chat** (text + tool calls); product cards are not a feature |
| "Save & Publish" / "Integration Hub" | We have **Save Agent** + the **Integration Guide** | Keep AADML wording |

**Decision (UI-first):** we **build the full Botpress-style UI now** — including the connectors and
channels above — and **implement their backends later**. Items without a backend ship as visible
**disabled "connect later"** controls (honest, not fake) and activate when their backend lands.
See `create-agent-ui-upgrade.md` §11 for the roadmap table.

---

## 4. At-risk features to explicitly preserve (checklist)

Easy to accidentally drop in a "simplify" — must survive the redesign:

- [ ] Prompt **Append/Override** mode + `{{tool_protocol}}` placeholder
- [ ] **Preview Full Prompt** modal (exact assembled prompt + section sizes)
- [ ] Placeholder **insert chips**
- [ ] Knowledge **AI analysis** + **Re-Run**
- [ ] **Code Mode** / **Builder Mode** toggles
- [ ] Tool picker **view modes** (Selected / Category / Service) + MCP tools
- [ ] **CredentialManager** (service/built-in) + **MCP env vars**
- [ ] Signals: **concurrency, rate limit, daily budget, HMAC secret, Redis Stream Bridge, Test Signal, Signal Log, stats**
- [ ] Schedules: **cron + per-run overrides** (model/prompt/budget/max-runs/daily-cap/pause-on-failures/read-only/expiry)
- [ ] **Chat History Limit**, model **capability badges**

---

## 5. Suggested grouping in the new "Advanced ▾"

```
▾ Advanced
   ├─ Model & generation   (chat history limit, temperature, prompt mode)
   ├─ Tools (power)        (Code Mode, Builder Mode)
   ├─ Credentials          (CredentialManager + MCP env vars)        ← existing component
   ├─ Channels / Signals   (concurrency, limits, HMAC, Redis bridge,  ← SignalPanel
   │                         test signal, signal log, stats)
   └─ Automation           (Schedules: cron + overrides + guardrails) ← SchedulePanel
```
