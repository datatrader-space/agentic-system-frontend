# Agent Create / Configure — UX Upgrade Plan (v2)

High-level, professional plan to make building an agent simple without losing any current
capability. Pairs with **`create-agent-feature-inventory.md`** (the exhaustive list of what
exists today) and **`create-agent-ui-mockup.svg/png`** (the visual target).

---

## 0. TL;DR

- Replace the **6-tab side drawer** with a **single builder canvas** (4 plain sections) + a
  collapsed **Advanced** area + a **live emulator** — **built fully to the Botpress-style mockup**.
  Features without a backend yet ship as **disabled "connect later"** controls; their backends
  follow (UI-first — see §11).
- Split the agent screen into three clear modes: **Build · Test · Monitor**. Configuration ≠
  monitoring (industry best practice — don't mix setup with live data).
- Make the **Agent Library card** information-rich and action-first (status, model, capability
  counts, channels, health, quick actions).
- **Zero feature regression**: every item in the inventory has a defined home (table in §8).

---

## 1. Objectives & success criteria

| Objective | Measure of success |
|---|---|
| Lower time-to-first-working-agent | A new user can create + test an agent in **one screen**, no tab hunting |
| Reduce cognitive load | Only **4 fields** required to start; everything else is opt-in |
| Preserve power | 100% of current features reachable (see §8); power users lose nothing |
| Tight feedback loop | Edit → see the agent answer in the **live emulator** without leaving the page |
| Build the full UI now | Whole mockup built; unbuilt features render as honest **disabled "connect later"** controls, backends follow |

---

## 2. Design principles (best practices)

1. **Progressive disclosure** — show the 20% everyone needs; tuck the 80% behind "Advanced".
2. **One primary surface per task** — Build, Test, Monitor are distinct, not crammed into tabs of a modal.
3. **Configuration vs. operation separation** — setup (prompt, tools, channels) lives in the builder; live data (signal log, schedule runs, dead letters, cost) lives in **Monitor**.
4. **Immediate feedback** — live emulator + inline validation + "Preview full prompt".
5. **Plain language first, jargon on demand** — "How should it behave?" not "System Prompt Template (Append/Override)".
6. **Safe defaults** — Append prompt mode, sequential signals, model preselected, signals off until a key is generated.
7. **Reversible & non-destructive** — draft/autosave, confirm on destructive actions, rotate-not-expose for secrets.
8. **Consistency** — reuse existing components (`SignalPanel`, `SchedulePanel`, `CredentialManager`) rather than reinventing.
9. **Accessibility & responsive** — keyboard reachable, labelled controls, graceful stacking on narrow screens.

---

## 3. Information architecture (the 3 surfaces)

```
/dashboard/agents                         Agent Library  (cards, create, manage)
        │  click card / Configure
        ▼
/dashboard/agents/:id        ┌── Build ───┬── Test ───┬── Monitor ──┐
  (Agent workspace, in shell)│  builder    │ emulator  │ operations  │
                             │  canvas +   │ (live chat│ (signal log,│
                             │  Advanced   │  preview) │  schedules, │
                             │             │           │  cost, DLQ) │
                             └─────────────┴───────────┴─────────────┘
```

- **Build** = the new single-canvas builder (today's General/Knowledge/Tools/Credentials config).
- **Test** = the live emulator (chat with the in-edit agent).
- **Monitor** = operational/observability (today's Signal Log, Schedule run history, Dead Letters, Today's Cost) — *moved out of config* where it belongs.

> This aligns with the existing playground tabs (Knowledge/Data/Flows/Automation) but gives them
> a coherent top-level grouping: **Build / Test / Monitor**.

---

## 4. Surface A — Agent Library card  (`/dashboard/agents`)

Today's card shows: avatar, name, "7 Tools", "Global Context", description, **Configure** + **Deploy**.
That under-uses prime real estate and buries status. Proposed card:

```
┌───────────────────────────────────────────────┐
│ 🤖  codding_agent                     ● Active │   ← status dot (Active / Draft / Disabled)
│     Coding assistant for vivdmind-v2           │
│                                                │
│  claude-sonnet-4.6   · 7 tools · Global ctx    │   ← model + capability summary
│  🔗 Webhook  💬 WS        ⏱ 2 schedules        │   ← enabled channels + automation
│  ───────────────────────────────────────────  │
│  ⟳ 128 chats · $0.42 today · ⚠ 1 dead letter   │   ← lightweight live stats + health
│                                                │
│  [ 💬 Chat ]   [ ⚙ Configure ]            [⋯]  │   ← primary actions + overflow
└───────────────────────────────────────────────┘
```

**What to add to the card (and why):**

| Element | Why (best practice) |
|---|---|
| **Status dot** (Active / Draft / Disabled) | At-a-glance state; users shouldn't open it to learn it's a draft |
| **Model chip** (`claude-sonnet-4.6`) | Most-asked question about an agent; cheap to show |
| **Capability summary** (tools count · knowledge scope) | Already there — keep |
| **Channel badges** (Webhook / WebSocket / Slack…) | Shows where it's reachable; signals if integrated |
| **Automation badge** (N schedules · next run) | Surfaces background activity that's otherwise invisible |
| **Health/stats line** (chats, today's cost, ⚠ dead letters / failures) | Operational awareness; a red ⚠ pulls attention to problems |
| **Primary action: Chat/Test** | The #1 thing people do — make it the prominent button |
| **Secondary: Configure** | Opens the Build canvas |
| **Overflow ⋯** (Duplicate, Integration Guide, Export, Enable/Disable, Delete) | Keeps the card clean; advanced/rare actions tucked away |
| **Owner / Shared badge** | Multi-tenant clarity (is this mine or shared?) |

**Library-level additions:** keep `All / Mine` filter; add **search**, **sort** (recently used / name),
and a **status filter** (Active/Draft) as the library grows. "Create Agent" stays top-right and
should offer the **template chooser** (§5).

---

## 5. Surface B — Agent Builder canvas (Build)

Single scroll surface. Four core sections (the 80% case) + Advanced (the rest). See the rendered
mockup (`create-agent-ui-mockup.png`).

**Header / Identity** — avatar, **Name**, one-line **Description**.

**① Behavior** — the system prompt, humanized ("How should your agent behave?"). Quick-start
**Templates ▾**, **Insert ▾** for placeholders, and **Preview full prompt**. *(Append/Override mode
moves to Advanced; default Append.)*

**② Knowledge** — build the **full source-type row** from the mockup (Website, Document, Table,
Web Search, Rich Text, Notion, API). **Upload + AI analysis** is wired now; the other connectors
are **built in the UI** and render as **disabled "connect later"** chips until their backend lands.

**③ Tools** — searchable **tool picker** ("+ Add tool") grouped Built-in / Services / MCP, with the
existing Selected/Category/Service views inside the picker.

**④ Channels** — build the **full channel list** from the mockup (Webchat/WebSocket, WhatsApp,
Slack, Telegram, Instagram, Messenger, + More). **Webhook, WebSocket chat, Redis Stream** are
wired now (with **Integration Guide ↗** and **API key** generate/rotate); the social channels are
**built in the UI** as **disabled "connect later"** rows until their backend integrations land.

**Model** — compact provider+model picker (with capability badges) near the top / in the emulator header.

**▾ Advanced** (collapsed; groups the power/infra features, same components reused):
```
▾ Advanced
   ├─ Model & generation   chat history limit · temperature · prompt mode (Append/Override)
   ├─ Tools (power)        Code Mode · Builder Mode
   ├─ Credentials          CredentialManager + MCP env vars          (existing component)
   ├─ Channels (infra)     concurrency · rate limit · daily budget ·  (SignalPanel, config-only)
   │                        HMAC secret · Redis bridge config
   └─ Automation           Schedules: cron + per-run overrides+guardrails (SchedulePanel, config-only)
```

---

## 6. Surface C — Live Emulator (Test)

Right-hand panel (or the **Test** tab on mobile). Reuses the **real agent chat over WebSocket**.
Shows streamed reply + **tool-call/tool-result** inline so users see *why* it acted. "Restart chat",
model indicator, connection status. No product-card mock — that's not a real feature.

---

## 7. Surface D — Monitor (operational)

Everything that is **live data, not configuration** moves here (today it's scattered inside the
Signals/Schedules tabs):

- **Signal Log** (filter/refresh, retry/cancel) and **stats** (Pending/Processed/Dead/Today's Cost)
- **Schedule run history** (last/next run, failures, cost)
- **Dead-letter queue** + alerts
- **Usage/cost** rollups

Rationale: mixing a 200-row signal log into a config form is the #1 reason the current UI feels
heavy. Separating Monitor keeps Build calm and gives ops a real home.

---

## 8. Feature placement matrix (no feature dropped)

`Card` = Agent Library card · `Build` = builder core · `Adv` = Advanced accordion · `Test` = emulator · `Monitor` = operations.

| Feature (from inventory) | Home | Rationale |
|---|---|---|
| Name, Description | **Build** (header) + shown on **Card** | identity |
| LLM Provider, Default Model (+ badges) | **Build** (Model) + model chip on **Card** | core choice; surface on card |
| System Prompt | **Build → ① Behavior** | the heart of the agent |
| Prompt Mode (Append/Override), `{{tool_protocol}}` | **Adv → Model & generation** (+ Insert menu) | power feature, safe default Append |
| Placeholder insert chips, Preview full prompt | **Build → ① Behavior** | authoring aids |
| Chat History Limit, temperature | **Adv → Model & generation** | tuning |
| Knowledge upload + AI analysis + scope | **Build → ② Knowledge** | core |
| Tool selection (Selected/Category/Service, MCP) | **Build → ③ Tools** (picker) | core |
| Code Mode, Builder Mode | **Adv → Tools (power)** | infra/admin |
| Service & Built-in credentials | **Adv → Credentials** | secrets; reuse `CredentialManager` |
| MCP env vars | **Adv → Credentials** | secrets |
| Signals enable + Webhook/WS URL + API key | **Build → ④ Channels** | the integration users want |
| Concurrency, rate limit, daily budget, HMAC, Redis bridge | **Adv → Channels (infra)** | tuning/infra |
| Signal stats, Signal Log, Test Signal, Dead Letters | **Monitor** + health badge on **Card** | live data, not config |
| Schedules: cron + overrides + guardrails | **Adv → Automation** (config) | setup |
| Schedule run history / next-run / failures | **Monitor** + automation badge on **Card** | live data |
| Today's Cost | **Monitor** + stat on **Card** | observability |

---

## 9. Personas & progressive disclosure

- **First-timer**: Template → Name → Behavior → (optional Knowledge/Tools) → Test → Save. Never opens Advanced.
- **Builder**: adds Tools, Knowledge, Channels; rotates an API key; tests live.
- **Power/ops**: opens Advanced for prompt mode/code mode/credentials/schedules; lives in **Monitor** for signal log & cost.

Each persona meets only what they need; nothing blocks the next.

---

## 10. Interaction & save model

- **Draft/autosave** for create (so the live emulator can run against the saved draft); explicit **Save** still available.
- **Inline validation**: Name required; warn if Signals enabled but no key/model; warn if Override prompt lacks `{{tool_protocol}}`.
- **Required vs optional** visually distinct; only Name is hard-required.
- **Secrets**: never display by default (masked), **rotate** instead of reveal; copy buttons.
- **Destructive actions** (delete agent, rotate key, disable) confirm first.

---

## 11. UI-first roadmap (build the full mockup now, backends follow)

**Decision: we build the complete Botpress-style UI from the mockup now** — including the source
connectors and channels that don't have a backend yet — and **implement those backends later.**
To stay honest (not fake capability), unbuilt items render as **disabled "connect later"** chips/rows
with a tooltip, and flip to active when their backend ships. This lets the UI lead and gives a
clear, visible backlog.

| In the mock | Backend today | UI now | Backend later |
|---|---|---|---|
| Knowledge: Upload + AI analysis | ✅ wired | active | — |
| Knowledge: Website / Table / Web Search / Rich Text / Notion / API | ❌ | **built, disabled "connect later"** | add connectors |
| Channels: Webhook / WebSocket / Redis Stream | ✅ wired | active | — |
| Channels: WhatsApp / Slack / Telegram / Instagram / Messenger | ❌ | **built, disabled "connect later"** | add integrations |
| Emulator | ✅ real WebSocket chat | active (text + tool calls) | product-card renderer optional, later |

Each disabled item is tracked as a backend work-item so "connect later" is a real roadmap, not a dead end.

---

## 12. Accessibility & responsive

- Labels tied to inputs; full keyboard nav; visible focus.
- ≥1280px: canvas + emulator side-by-side. <1280px: **Build / Test / Monitor** become tabs; emulator full-width.
- Color is never the only signal (status dot has text; ⚠ has a label).

---

## 13. Phased delivery (with acceptance criteria)

| Phase | Scope | Done when |
|---|---|---|
| **P1 — Canvas** | Identity + ① Behavior + ② Knowledge + ③ Tools + Save; Advanced wraps existing `SignalPanel`/`SchedulePanel`/`CredentialManager` unchanged | Can create/edit an agent end-to-end with **no feature missing** vs the old drawer |
| **P2 — Live emulator** | Embedded WebSocket chat beside the canvas | Edit → test in one screen; tool calls visible |
| **P3 — Channels + templates** | ④ Channels surface + Integration Guide + quick-start templates + tool-picker polish | New user creates a working agent from a template in <2 min |
| **P4 — Card upgrade** | Richer Agent Library card (status, model, channels, health, actions, overflow) + search/sort/filter | Card answers "what is this & is it healthy?" without opening it |
| **P5 — Monitor** | Dedicated Monitor surface (signal log, schedule runs, DLQ, cost) | Operational data lives outside the builder |

**Hard guardrail:** P1 cannot ship until the §8 matrix is fully satisfied — every old feature reachable.

---

## 14. Open decisions (need your call)

1. **Build/Test/Monitor** as top tabs on the agent page — agreed? (recommended)
2. **Autosave drafts** vs explicit-save-only for new agents?
3. Agent-card **health stats** (cost/dead-letters) — show always, or only when signals enabled?
4. ~~Treatment for unbuilt connectors/channels~~ — **DECIDED: build the full UI now**, render unbuilt items as disabled "connect later", build backends later (see §11).
```
