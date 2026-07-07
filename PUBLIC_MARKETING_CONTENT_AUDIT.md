# Public Marketing Content — Truthfulness Audit

**Purpose:** the current public pages copy was ported *verbatim* from the aspirational design mockups (`index/features/docs/pricing.html`). This audit checks every material claim against the **actual backend** (`agent/`, `tenancy/`, `billing/`, `llm/`) and flags anything false or overstated. **No copy has been changed yet — this is the report you asked for first.**

Method: 4 parallel code audits over the whole backend, each verdict backed by file evidence.

Legend: 🔴 **FABRICATED** (claim has zero backing — must fix) · 🟠 **OVERSTATED** (real thing exists but the wording overclaims — should soften) · 🟢 **ACCURATE** (keep).

---

## 1. 🔴 FABRICATED — false today, must be removed/replaced

| # | Claim (where) | Reality | Evidence |
|---|---|---|---|
| 1 | **"Daytona workspaces"** — a Daytona sandbox/IDE with clone-into-Daytona, snapshots, previews, lifecycle. Appears **12× on Home**, 3× on Features, in Docs. | **Zero** occurrences of "daytona" in the codebase. Coding runs in a **local git clone on the server**, edited via `subprocess`+`git`, reviewed as a diff. There is no Daytona, no container/VM isolation. | `agent/services/coding_runner.py`, `agent/services/coding_agent/runner.py` (clone_path, "server sandbox") |
| 2 | **Python SDK** — `pip install aadml`, `from aadml import Client` (Docs quickstart code block) | No package named `aadml`. `pyproject.toml` is a pytest config only; no `setup.py`. Product is a Django monolith, not a pip library. | `pyproject.toml`; no `from aadml` anywhere |
| 3 | **TypeScript SDK** — `npm i @aadml/sdk` (Docs) | No such package anywhere. Frontend calls the REST API directly. | grep `@aadml/sdk` → 0 |
| 4 | **CLI** — `aadml missions run` (Docs) | No `console_scripts`/entry point, no `aadml` executable. Only ad-hoc dev scripts. | `pyproject.toml` (no entry_points) |
| 5 | **REST API** — `POST /v1/missions` returning `mission_id`/`state` (Docs REST example) | No `/v1/` namespace and **no "missions" resource**. Real API is `/api/…` (agents/auth/llm/connectors/budgets) + a **WebSocket** chat layer. | `config/urls.py`, `agent/urls.py` |
| 6 | **SSO / SAML & SCIM provisioning** (Pricing → Enterprise tier) | No SAML, SCIM, or OIDC enterprise SSO anywhere. Only **consumer GitHub/Google OAuth** exists (not the same thing). | grep `saml\|scim\|oidc` → only unrelated hits |
| 7 | **Air-gapped runners · Sovereign Remote Runner network · Data-residency controls** (Pricing → Sovereign tier) | None exist. Self-hosting via Docker Compose is real, but there is no air-gap feature, no "sovereign runner network", no region/residency config. (The crawl pipeline actually *needs* an external Redis + remote worker — opposite of air-gapped.) | `docker-compose.yml`; grep `sovereign\|residency\|air-gap` → docs only |
| 8 | **Workspace-minutes metering** (Pricing → "Pay for execution… workspace minutes") | No time/minute metering exists at all. | `agent/budget_models.py`, `turn_usage_ledger.py` (tokens+USD only) |
| 9 | **Tool-calls as a billed/metered dimension** (Pricing metering) | Tool calls are *logged/receipted* and can be *count-limited per run* (a guardrail), but there is **no tool-call budget/ceiling** billed to the customer. | `agent/services/action_limits.py` (count guardrail, not metering) |
| 10 | **"7 years" retention** (Features → Governance) | No configurable audit retention; only `ANALYTICS_RETENTION_DAYS=180` and `WEB_SNAPSHOT_RETENTION_DAYS=90`. | `config/settings.py` |
| 11 | **"1,800+ tools"** headline (Login left column, About stat) | Real **built-in** tools ≈ **150–200**. The "1,800" is literally from a code comment counting *dynamically-generated* MCP/OpenAPI/remote tools — not first-party tools. Misleading as a headline number. | `agent/tools/tool_safety.py:7` comment; ~180 `BaseTool` subclasses |

---

## 2. 🟠 OVERSTATED — real capability, but wording overclaims (soften)

| # | Claim | What's actually true | Fix direction |
|---|---|---|---|
| A | **Media pipeline generates video** ("Image, **video**, and document generation"; "Video 72%") | **Image generation is real** (Nanobanana/Gemini). **Video is not AI-generated** — it's a Cloudinary **editing/assembly** pipeline (trim/concat/overlay), and the "generate video" tool falls back to a hardcoded Big Buck Bunny sample when unconfigured. | Say "image generation + video **assembly/editing**", drop the AI-video-synthesis implication. |
| B | **Android: "ADB, Appium, accessibility services, emulators, and device farms"** | Real **ADB / uiautomator2** control of an attached device (~55 actions). **No Appium, no emulator provisioning, no cloud device farm.** | Keep ADB/device control; drop Appium, emulators, device farms. |
| C | **"Remote runners"** — "extend into a laptop / instrument workstation / private network" via a runner | No runner daemon. Remote command execution is real via **SSH (paramiko)** and **AWS SSM**. | Reframe as "SSH / AWS SSM remote command execution", not a "remote runner network". |
| D | **Connectors: per-tool "allow · ask · deny"** | "allow" and "deny" are enforced; **"ask" is stored but NOT wired to an approval gate yet** (only deny blocks today). | Say allow/deny enforced; mark "ask" as coming, or don't headline it. |
| E | **"Immutable activity history"** (Features/About) | The org activity table (`AuditEvent`) is a normal, mutable Django table ("never delete" by convention only). **Tamper-evidence exists only in signed, hash-chained `AgentActionReceipt`** (per tool-call/decision). | Say "signed, hash-chained action receipts (tamper-evident)"; avoid "immutable" for the whole feed. |
| F | **Channels: "Slack & WhatsApp"** (Pricing Team) / Slack/Telegram/email **triggers** | **Slack** is real both directions. **Telegram/email** are **outbound only** (no inbound trigger). **WhatsApp is absent** (interface stub only). | Drop WhatsApp; say Slack (full), Telegram/email (send/notify). |
| G | **Missions framing** — laboratories, national services, public-benefits casework, sovereign institutions (Home hero + mission tabs) | These are *illustrative scenarios*, not shipped verticals or certified deployments. Acceptable as vision, but currently reads as claims of deployed regulated/government systems. | Frame explicitly as "example missions / what you can build", not deployed customers. |

---

## 3. 🟢 ACCURATE — verified real, keep as-is

- **Browser automation** — Playwright + stealth; DOM map, screenshots, network capture, JS exec, profiles/proxy. `agent/tools/builtin/browser_tools.py`
- **Android device control** — ADB/uiautomator2, ~55 actions (tap/type/swipe/install/permissions/shell). `android_tools.py`
- **Workflow Builder** — real node-graph engine: agent, tool, http, script, condition, approval, foreach, delay, sub-workflow; templated data flow, dry-run, retries, replay, versions, live WS overlays, node-level I/O. `agent/services/workflow_graph/*`
- **Signals / webhooks / schedules** — HMAC-verified inbound webhooks, auto-minted URLs, cron schedules, Redis-backed Celery queue, dead-letter alerts, outbound HMAC callbacks. `agent/signal_tasks.py`, `signal_views.py`
- **Approval gates / HITL** — workflow approval nodes + central tool-approval gate + full HITL manager (approve/choice/info/validate/escalate). `agent/approval/tool_gate.py`, `agent/services/hitl/manager.py`
- **Multi-agent** — coordinator→specialist handoff with history preservation, planning DAG, A2A surface. `agent/services/handoff.py`, `plan_dag.py`
- **Knowledge & RAG** — document upload + full-site crawl, token-aware chunking, pgvector embeddings, retrieval, **verified citation chips**, scheduled re-crawls. `agent/services/rag/*`, `web_ingest/*`, `DocumentChunk`
- **Connectors & MCP** — MCP stdio + HTTP/SSE, OAuth/PAT accounts, REST/GraphQL/DB services, credential vault, circuit breakers, risk classification (read/write/destructive). `agent/tools/mcp/*`, `connectors_views.py`
- **RBAC & tenancy** — roles **owner/admin/member/viewer/billing** (exact match), orgs/workspaces/teams, token invitations, tenant isolation. `tenancy/models.py`
- **Budgets** — token + USD ceilings, per-agent/workspace/org/workflow/run/turn scopes, warn/require-approval/**hard-block**, approval workflow. `agent/budget_models.py`, `budget_enforcement.py`
- **LLM providers** — OpenRouter, OpenAI, Anthropic, Google (Gemini), xAI (Grok), local Ollama + custom; real multi-LLM routing; bring-your-own-keys. `llm/router.py`, `llm/*_client.py`
- **Observability / metering** — per-turn token + USD ledger, request logs, tracing, cost by source/model. `turn_usage_ledger.py`, `UsageRecord`
- **Billing** — Stripe checkout, billing portal, signature-verified webhooks, real subscription plans. `billing/views.py`
- **Auth** — email verification, password reset, account lockout, TOTP 2FA (+recovery codes), GitHub/Google login. `agent/auth_views.py` (some hardening default-OFF)
- **Self-hosting** — full Docker Compose stack (pgvector, ASGI, Celery, Nginx, PgBouncer, hardened conversion worker). `docker-compose.yml`
- **Image generation** — real (Nanobanana/Gemini), saved artifacts. `nanobanana_tools.py`

---

## 4. Impact by page

- **Docs** — highest-risk: the **entire "Quickstart" + "REST API" code samples are fabricated** (`pip install aadml`, `from aadml import Client`, `aadml missions run`, `POST /v1/missions`, model `reasoning-pro`). A developer copy-pasting this gets nothing. Must be rewritten to the real API/WebSocket shape or replaced with the real CMS docs (the reader is already wired to `/content/`).
- **Pricing** — Enterprise/Sovereign feature bullets contain the most **false commercial promises**: SSO/SAML/SCIM, air-gapped, sovereign runner network, data residency; plus the **metering section** claims dimensions (workspace-minutes, tool-calls) that aren't billed. Plans themselves are real (wired to `/plans/`).
- **Home** — "Daytona" everywhere; "remote runners" and video overclaims; the lab/government/sovereign *missions* framing needs an "illustrative" qualifier.
- **Features** — Daytona; Android (Appium/emulator/farm); video generation; connectors "ask"; "immutable"; overstated tool counts.
- **Login / About** — "1,800+ tools" headline.
- **How It Works / Blog / Contact** — largely fine (generic/accurate); HowItWorks mentions "Daytona sandboxes" once.

---

## 5. Recommendation

Rewrite to lead with what is genuinely strong and differentiated — **all of it true**:

> A governed agent platform: **Playwright browser automation + ADB Android control + SSH/SSM remote exec**, a **visual Workflow Builder** (approvals, retries, replay, versions), **signals/webhooks/schedules** on a Redis-backed queue, **cited RAG** over your docs and site crawls, **MCP + connectors** with a credential vault and risk-classified permissions, **RBAC + token/USD budgets with hard ceilings**, **multi-LLM (OpenRouter/OpenAI/Anthropic/Gemini/xAI/Ollama) with your own keys**, **Stripe billing**, and **self-hosting via Docker**.

That story doesn't need the fabricated parts. Proposed edits, in priority order:
1. **Docs** — replace fabricated SDK/CLI/REST samples with the real API (or point at the live CMS docs).
2. **Pricing** — remove SSO/SAML/SCIM, air-gapped, sovereign-network, residency; fix metering to **tokens + USD** only.
3. **Home/Features** — replace "Daytona" with "reproducible cloud coding workspaces (Let's Code)"; soften Android to ADB; reframe remote-runners as SSH/SSM; make video = assembly/editing; drop WhatsApp; qualify the missions as examples.
4. **Login/About** — change "1,800+" to an honest "150+ built-in tools, plus any MCP server or API".
5. **Features** — "immutable" → "signed, hash-chained receipts"; mark connector "ask" as forthcoming.

I have not touched any copy yet — tell me which of these to apply (all, or a subset) and I'll implement them.
