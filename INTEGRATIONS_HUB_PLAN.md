# Integrations Hub — Audit & Implementation Plan

**Status:** Proposed
**Created:** 2026-08-14
**Repos:** `e:\agentic-system-frontend` (primary) + `e:\agentic-system-backend` (supporting API)
**Goal:** One **Integrations** page in the sidebar that is the single place every integration lives —
starting with a first-class **AADML MCP** section that exposes the control plane to ChatGPT/Claude.

---

## 1. Audit — what exists today

### 1.1 The frontend is fragmented; the nav hides most of it

Seven separate views, **~8,400 lines**, across **14 routes** — and only **one** of them is reachable
from the sidebar.

| View | Lines | What it actually does | Routes | In sidebar? |
|---|---|---|---|---|
| [ConnectorsPage.vue](src/views/ConnectorsPage.vue) | 1,145 | The closest thing to a hub: services + MCP servers + per-connector tools + permissions, scoped global/workspace | `/dashboard/connectors` | ✅ "Connectors" |
| [Connections.vue](src/views/Connections.vue) | 1,546 | OAuth **provider** CRUD (admin-ish) *and* end-user connect/disconnect | `/dashboard/connections` | ❌ |
| [ServiceRegistrationV2.vue](src/views/ServiceRegistrationV2.vue) | 4,623 | OpenAPI import wizard → register an API as a service | `/dashboard/services/register`, `/services/wizard` | ❌ |
| [ServiceDrafts.vue](src/views/ServiceDrafts.vue) | 419 | Drafts from that wizard | `/dashboard/services/drafts` | ❌ |
| [ToolsPage.vue](src/views/ToolsPage.vue) | 372 | Tool catalogue browse/search | `/dashboard/tools` | ❌ |
| [ConnectionDocs.vue](src/views/ConnectionDocs.vue) | 358 | Docs for connections | `/dashboard/connections/docs` | ❌ |
| [IntegrationGuide.vue](src/views/IntegrationGuide.vue) | 361 | Per-agent integration guide | `/dashboard/integration-guide/:agentId?` | ❌ |
| OAuthProviderRegistration | — | Register an OAuth provider | `/dashboard/connectors/oauth-provider/new` | ❌ |

**This is the problem, stated precisely.** It is not that the pages are bad — it is that six of the seven
have no entry point. A user who has not memorised `/dashboard/connections` cannot find OAuth providers at
all. Four routes (`services`, `mcp`, `integration-hub`, `workspaces`) already redirect into
`/dashboard/connectors`, which shows a previous consolidation attempt that stopped halfway: the *routes*
were merged, the *pages* were not.

### 1.2 The backend is in better shape than the frontend

| Endpoint family | Backs | Notes |
|---|---|---|
| `/api/connectors/`, `/api/connectors/bundle/` | ConnectorsPage | **Already an aggregate read model.** `bundle/` returns connectors + agents + workspaces in one call. |
| `/api/services/…` (15 routes) | Service wizard, drafts | CRUD + discover + enrich + validate + drafts |
| `/api/mcp/servers/…` | ConnectorsPage | MCPServerConfig CRUD + tool sync (**AADML as MCP _client_**) |
| `/api/connections/providers/…`, `/api/connections/…` | Connections | OAuthProvider CRUD + UserConnection connect/disconnect |
| `/api/oauth/start|callback|status|disconnect/` | services | Per-service OAuth |

`/api/connectors/bundle/` matters: the aggregation the new page needs **mostly exists already**. This is a
frontend information-architecture problem far more than a backend one.

### 1.3 The gap that motivated this work

There is **no surface anywhere** for *AADML as an MCP server* — the control plane just built under
`mcp_gateway/`. A user who wants to drive AADML from ChatGPT currently has:

- no way to discover the endpoint URL,
- no way to see which clients they have authorized,
- **no way to revoke one** — `McpAuthGrant` was reachable only through Django admin, so a non-staff user
  who connected ChatGPT to their workspace had to ask an administrator to disconnect it.

That last point is the sharpest: an OAuth grant a user cannot see is an OAuth grant a user cannot revoke.

### 1.4 Naming collision to be deliberate about

"MCP" now means two opposite things in this product, and the page must not blur them:

- **MCP servers** (existing, `/api/mcp/servers/`) — *outbound*: third-party MCP servers AADML consumes.
- **AADML MCP** (new, `/api/mcp/v1`) — *inbound*: AADML exposing itself, consumed by ChatGPT/Claude.

The page will label these **"Connected MCP servers"** vs **"AADML as an MCP server"** and never abbreviate
either to bare "MCP".

---

## 2. Target information architecture

One route, one sidebar item, sections rather than scattered pages.

```
Sidebar:  Integrations            →  /dashboard/integrations

  ┌ AADML MCP ─────────────────── connect ChatGPT / Claude to AADML   (§3, ships first)
  ├ Connected accounts ────────── OAuth connections (UserConnection)
  ├ MCP servers ───────────────── third-party MCP servers AADML consumes
  ├ API services ──────────────── registered REST services + the import wizard + drafts
  ├ Tools ─────────────────────── the tool catalogue these produce
  └ OAuth providers ───────────── provider configuration (admin-gated)
```

> **SCOPE (2026-08-14): AADML MCP only.** The sections below `AADML MCP` describe the eventual shape and
> are explicitly **NOT** being built now. What ships is the page, the nav entry, and the AADML MCP
> section — phases 1–3. Phases 4–7 remain written down so the page is designed to receive them, not so
> they get built by inertia.

**Nav decision (revised for the narrowed scope).** "Integrations" is **added alongside** "Connectors",
not in place of it. Replacing it was the right call for a full consolidation — two sidebar entries for
one concept is the disease, not the cure — but with only the AADML MCP section shipping, a redirect
would orphan connectors, services, MCP servers and tools with nothing yet standing in for them.
"Connectors" is retired in phase 5, when its replacement sections actually exist.

**Migration decision — sections wrap, they do not rewrite.** ServiceRegistrationV2 alone is 4,623 lines;
rewriting it to fit a new shell would be a large change with no user-visible benefit and real regression
risk. Sections either embed the existing component or deep-link to it. The consolidation is of
*navigation*, not of *implementation*, and every existing route keeps working.

---

## 3. Section 1 — AADML MCP (ships first)

The section answers four questions in order, because that is the order a user actually has them:

**1. What is this?** One short paragraph: AADML speaks MCP, so ChatGPT and Claude can drive your agents,
runs, approvals and sandboxes directly. Plus what it is *not* — not a bypass; the client gets exactly the
permissions you consent to, and never more than your own role allows.

**2. How do I connect?** The endpoint URL, copyable, correct for the environment being viewed (built from
`request.build_absolute_uri`, never a hardcoded setting — a localhost developer must not be handed a
production URL). Client-specific instructions for ChatGPT and Claude. Because clients self-register via
RFC 7591 dynamic client registration, **there is no API key to create** — the page must say so, or users
will hunt for a "generate key" button that does not exist.

**3. What is connected right now?** A table of `McpAuthGrant` rows: client name (rendered as untrusted,
client-supplied text), granted scopes in plain language, which workspaces it can reach, when it was
granted, when it was last used, and how many sessions are live.

**4. How do I disconnect?** A per-row **Disconnect** action, behind `useConfirm` (never a native
`confirm()`), which calls revoke and reflects the result immediately.

### 3.1 Backend API required

Three session-authenticated endpoints in a new `mcp_gateway/views.py`:

| Endpoint | Purpose |
|---|---|
| `GET /api/mcp/connections/` | The caller's grants — metadata only |
| `POST /api/mcp/connections/<id>/revoke/` | Disconnect one client, immediately |
| `GET /api/mcp/info/` | Endpoint URL, contract version, live tool count, discovery URLs, scope catalogue, the caller's 7-day call count |

Three boundaries these endpoints must hold, each for a concrete reason:

- **Session auth, never a bearer token.** The MCP surface is audience-bound, so an MCP token must not
  reach back and manage the grants that authorize it — otherwise a compromised client could revoke every
  *other* client and leave itself as the only connection. Session-only inverts that: the human can evict
  the client; the client can never evict the human.
- **Hard-scoped to `request.user`**, with an unknown id answering **404, not 403**, so the endpoint is not
  an existence oracle for other users' rows.
- **No secrets.** A grant row sits beside access tokens, refresh tokens and a client secret. The
  serializer emits none of them — not even a token prefix. Who / what scopes / which workspaces / when
  last used is everything a trust decision needs.

Revocation delegates to `McpAuthGrant.revoke()` — the single place that also kills the DOT access and
refresh tokens and terminates live `McpSession` rows. A second revocation path here could drift from the
one the OAuth endpoints use, and a revocation that is only *mostly* applied is worse than none: the UI
would report success while the client kept working until token expiry. Revoke is idempotent (re-revoking
is 200, not 409) because a user who clicks "disconnect" twice must not get an error.

Revoked grants stay in the listing rather than vanishing — *"I disconnected ChatGPT last Tuesday"* is
exactly what this page must be able to answer, and a row that disappears looks like the record was
destroyed.

---

## 4. Phases

| # | Phase | Deliverable | Exit criteria |
|---|---|---|---|
| **1** | Backend API | `mcp_gateway/views.py` + URL wiring | The three endpoints work; a test proves cross-user access 404s and no response carries a token |
| **2** | Page shell + nav | `IntegrationsPage.vue`, route `/dashboard/integrations`, sidebar item, `/dashboard/connectors` → redirect | Page renders, nav highlights, no existing route 404s |
| **3** | **AADML MCP section** | The four blocks in §3 | Connect + list + revoke work end to end against a real ChatGPT/Claude client |
| **4** | Connected accounts | Wrap the UserConnection half of Connections.vue | Connect/disconnect work from the new page |
| **5** | MCP servers + API services + Tools | Wrap/deep-link existing components | Every previously orphaned page is reachable from the sidebar |
| **6** | OAuth providers | Provider CRUD, admin-gated | Non-admins do not see it |
| **7** | Cleanup | Retire dead routes, update tours/docs that deep-link the old paths | No dangling links; guided tours still pass |

Phases 1–3 are the user's explicit request and ship together. 4–7 fold the rest in without breaking
anything.

---

## 5. Constraints (repo conventions, non-negotiable)

- **No native dialogs.** `useNotify` / `useConfirm` only — never `alert()` / `confirm()`.
- **Admin stays in the admin shell.** Anything admin-gated routes within its own shell; never push an
  admin user into `/dashboard`.
- **No runtime string templates** in Vue — this build has no runtime compiler; use SFC / render functions.
- **Client-supplied strings are untrusted.** An MCP client names itself at registration; render escaped,
  never as an authority claim, and always beside the stable `client_id`.
- Every existing route keeps working via redirect. This is a navigation change, not a rewrite.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| "MCP" meaning two opposite things confuses users | Never abbreviate: "Connected MCP servers" (outbound) vs "AADML as an MCP server" (inbound) |
| Rewriting the 4,623-line service wizard | Explicitly out of scope — sections wrap or deep-link |
| Consolidation breaks deep links in guided tours/docs | Phase 7 sweeps them; all old routes redirect rather than 404 |
| A second sidebar entry re-fragments the IA | "Connectors" is replaced, not supplemented |
| Endpoint URL wrong per environment | Built from `build_absolute_uri`, never a setting |
