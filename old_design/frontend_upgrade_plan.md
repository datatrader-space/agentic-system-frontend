# Frontend Upgrade Plan — Agentic System v1 → v2

> **Goal:** Transform the current admin-style dashboard (top nav, cards, empty space, poor responsiveness) into a **chat-first AI agent workspace** — left sidebar for navigation/history, a center chat/work area, and a right contextual panel for system details, tools, repos, knowledge, logs, and settings. Target feel: ChatGPT / Claude / modern cloud agent dashboards.

---

## 0. CRITICAL — Stack reality (read first)

The original instruction referenced React/`.tsx` files (`AppShell.tsx`, `Button.tsx`, …). **This project is NOT React.** The real stack is:

| Concern | Actual tech |
|---|---|
| Framework | **Vue 3** (Composition API, `<script setup>`) |
| Build | **Vite** |
| State | **Pinia** (`pinia` already installed) |
| Routing | **vue-router 4** (routes defined in `src/main.js`) |
| Styling | **Tailwind CSS** + PostCSS |
| Toasts | `vue-toastification` |
| Markdown/code | `marked`, `marked-highlight`, `highlight.js`, `monaco-editor-vue3` |
| HTTP | `axios` (`src/services/api.js`, `tenancyApi.js`, `toolsApi.js`) |

**Therefore:** every component below is a **`.vue` Single File Component**, not `.tsx`. State lives in **Pinia stores**, not React context/hooks. Do **not** introduce React, TypeScript `.tsx`, or a second framework. Reuse the existing Vue components wherever possible (see the Reuse Map in §8) instead of rebuilding from scratch.

---

## 1. Current state audit

**Entry point today:** `/dashboard` → `src/views/SystemList.vue` (the old "Your Systems" card dashboard). Navigation is via `src/components/layout/AppHeader.vue` (top nav).

**Already built — REUSE, don't rebuild:**

| Existing file | Reuse as |
|---|---|
| `components/ChatHistory.vue` | Sidebar recent-chats list |
| `components/RepositoryChat.vue`, `components/PlannerChat.vue` | Reference impls for streaming chat + composer (WebSocket wiring already exists) |
| `components/layout/WorkspaceSwitcher.vue` | Sidebar workspace selector |
| `components/layout/AppHeader.vue` | Source of nav items to migrate into the sidebar (then retire) |
| `views/OrgSettings.vue` (already tabbed via `:tab` route) | **Pattern** for the new tabbed Settings experience |
| `views/Services.vue`, `views/MCPServers.vue`, `views/ToolRegistry.vue`, `views/AgentLibrary.vue`, `views/Benchmarks.vue` | Become pages reachable from the sidebar / right-panel tabs |
| `views/WorkspaceHub.vue`, `views/WorkspaceDashboard.vue` | Workspace context + remote-agent management |
| `views/SystemList.vue`, `views/SystemDetail.vue` | Move under `/dashboard/systems` (no longer the landing page) |
| `components/common/*` | Existing shared primitives — extend into the `ui/` design system |
| `components/{tools,services,mcp,knowledge,workspace,benchmarks}/*` | Domain components to mount inside the right panel / pages |

**Backend chat support already exists** (do not reinvent): WebSocket consumers in `agent/routing.py` (`RepositoryChatConsumer`, `PlannerChatConsumer`, `GraphChatConsumer`, `AgentRunnerConsumer`) + chat APIs. The new `ChatWorkspace` should connect to these, not a new stack.

**To retire (Phase 5 only):** the top-nav `AppHeader` layout once the sidebar fully replaces it.

---

## 2. Target architecture — 3-pane app shell

```
┌───────────────────────────────────────────────────────────────┐
│ AppShell.vue                                                   │
├───────────────┬───────────────────────────────┬───────────────┤
│ LeftSidebar   │ Main Chat / Workspace Area    │ RightContext  │
│               │                               │ Panel         │
│ - New Chat    │ - Welcome / message thread    │ - System info │
│ - Chats       │ - Agent + tool-call states    │ - Repos       │
│ - Systems     │ - Streaming response          │ - Knowledge   │
│ - Agents      │ - Composer (sticky bottom)    │ - Tools / MCP │
│ - Repos       │                               │ - Activity    │
│ - Knowledge   │                               │ - Settings    │
│ - Tools / MCP │                               │ (collapsible) │
│ - Benchmarks  │                               │               │
│ - Activity    │                               │               │
│ - Settings    │                               │               │
└───────────────┴───────────────────────────────┴───────────────┘
```

**Shell rule:** use a CSS **grid** app shell (`grid-template-columns: auto 1fr auto`) with independently scrollable panes and **no page-level horizontal scroll**. Each pane scrolls internally (`overflow-y: auto; min-height: 0`).

**Responsive behavior:**

| Width | Left sidebar | Right panel | Chat |
|---|---|---|---|
| ≥1280px (desktop) | Always visible (expanded) | Visible, collapsible | Center, max width |
| 1024–1279px (tablet) | Collapse to icons | Drawer (toggle) | Primary |
| <768px (mobile) | Slide-out drawer | Bottom sheet / full-screen | Primary screen, sticky composer |

Test explicitly at **1440 / 1024 / 768 / 390 px**.

---

## 3. Routing changes (vue-router, in `src/main.js`)

Introduce a dashboard layout route with children. `/dashboard` defaults to the chat-first experience.

```txt
/dashboard                       → redirect to /dashboard/chat/new
/dashboard/chat/new              → ChatWorkspace (empty/welcome state)
/dashboard/chat/:sessionId       → ChatWorkspace (loaded session)
/dashboard/systems               → SystemList (moved here)
/dashboard/systems/:systemId     → SystemDetail
/dashboard/agents                → AgentLibrary
/dashboard/repositories          → repositories view
/dashboard/knowledge             → knowledge view
/dashboard/tools                 → ToolRegistry / Services
/dashboard/mcp                   → MCPServers
/dashboard/benchmarks            → Benchmarks
/dashboard/activity              → activity / logs
/dashboard/settings              → redirect to /dashboard/settings/general
/dashboard/settings/:tab         → SettingsLayout (tabbed)
```

- Keep existing top-level routes working during migration (don't delete `/services`, `/mcp`, etc. until Phase 5) to avoid breaking links and preserve functionality.
- The `AppShell` is the layout component; child routes render into the **center pane** via `<router-view />`. Sidebar + right panel persist across navigation.

---

## 4. State management (Pinia stores)

Create stores under `src/stores/` (new dir):

```txt
stores/
  useLayoutStore.js     # sidebar collapsed?, right panel open?, active right tab, mobile drawer open?
  useChatStore.js       # sessions list, active session, messages, streaming state, send/stop/retry
  useSystemStore.js     # selected system, repos, knowledge, MCP status (feeds right panel)
  useSettingsStore.js   # settings tab state + persisted prefs
```

- `useLayoutStore` is the backbone of responsiveness (collapse/expand, drawers).
- `useChatStore` wraps the existing chat WebSocket/API; it owns message list, `isStreaming`, `error`, and actions `send()`, `stop()`, `retry()`.
- Persist layout prefs (sidebar/panel collapsed) to `localStorage`.

---

## 5. Component structure (Vue SFCs)

Adapt the proposed structure to Vue under `src/components/`:

```txt
src/
  components/
    app-shell/
      AppShell.vue
      LeftSidebar.vue
      SidebarNavItem.vue
      SidebarChatHistory.vue        # wraps existing ChatHistory.vue
      WorkspaceSwitcher.vue         # reuse existing layout/WorkspaceSwitcher.vue
      RightContextPanel.vue
      MobileSidebarDrawer.vue
    chat/
      ChatWorkspace.vue
      ChatWelcome.vue               # "What would you like your agent to do?"
      ChatMessageList.vue
      ChatMessage.vue               # user + assistant bubbles, markdown via marked
      ChatComposer.vue              # sticky; Enter=send, Shift+Enter=newline; attach/@/send
      ToolCallCard.vue              # tool execution status (running/done/error)
      StreamingIndicator.vue        # "Thinking…" + streamed tokens
    systems/
      SystemOverviewPanel.vue
      SystemStatusBadge.vue
      RepositoryList.vue
      KnowledgeList.vue
    settings/
      SettingsLayout.vue            # follows OrgSettings.vue tab pattern
      SettingsTabs.vue
      GeneralSettings.vue
      AIProviderSettings.vue        # reuse LLMSettings.vue content
      ModelSettings.vue
      AgentRulesSettings.vue
      MCPSettings.vue               # reuse MCPServers.vue content
      WorkspaceSettings.vue
      SecuritySettings.vue
    ui/                              # design-system primitives (extend components/common/)
      BaseButton.vue
      BaseCard.vue
      BaseBadge.vue
      BaseTabs.vue
      BaseInput.vue
      BaseTextarea.vue
      BaseDropdown.vue
      BaseModal.vue
      BaseDrawer.vue
      BaseTooltip.vue
      EmptyState.vue
      SkeletonLoader.vue
```

> Prefix shared primitives `Base*` to avoid clashing with existing domain components. Where `components/common/*` already provides a primitive, extend/rename it instead of duplicating.

---

## 6. Right context panel — contextual content

The panel content **changes with context** (driven by `useSystemStore` / route):

- **Selected chat** → tabs: `Context · Tools · Files · Activity · Settings`
- **Selected system** → tabs: `Overview · Repositories · Knowledge · Agents · MCP · Activity · Settings`
- **Settings route** → the full tabbed settings (see §7)

Requirements: collapsible (hide/show button in the panel header), responsive (drawer on tablet, bottom sheet/full-screen on mobile), internally scrollable. Reuse existing domain components (`mcp/`, `services/`, `tools/`, `knowledge/`, `workspace/`) inside the tabs.

The reference screenshot maps directly: **Current System** card (name, status badge, created date, Repositories/Knowledge/MCP/Error-rate stats), **Overview/Tools/Files/Activity/Settings** tabs, **Repositories**, **Knowledge Base**, **MCP Tools** (with Active status), **Recent Activity** — all live in this panel.

---

## 7. Settings experience (tabbed)

Follow the existing `OrgSettings.vue` `:tab` pattern. Route: `/dashboard/settings/:tab`.

```txt
Settings
├── General          (GeneralSettings.vue)
├── AI Providers     (AIProviderSettings.vue — reuse LLMSettings.vue)
├── Models           (ModelSettings.vue)
├── Agent Rules      (AgentRulesSettings.vue)
├── Tools            (tools settings)
├── MCP              (MCPSettings.vue — reuse MCPServers.vue)
├── Workspaces       (WorkspaceSettings.vue — reuse WorkspaceHub.vue)
├── Billing / Usage  (usage view)
├── Security         (SecuritySettings.vue)
└── Advanced         (danger zone)
```

Each tab = clean cards, forms, toggles, explicit **Save** buttons. Never one long page.

---

## 8. Reuse map (existing → new home)

| Existing | New location |
|---|---|
| `ChatHistory.vue` | `app-shell/SidebarChatHistory.vue` |
| `RepositoryChat.vue` / `PlannerChat.vue` | Streaming/composer reference for `chat/*` |
| `layout/WorkspaceSwitcher.vue` | `app-shell/WorkspaceSwitcher.vue` |
| `layout/AppHeader.vue` | Nav items → `LeftSidebar`, then **retire** |
| `SystemList.vue` / `SystemDetail.vue` | `/dashboard/systems*` |
| `Services.vue` / `ToolRegistry.vue` | `/dashboard/tools` + right-panel Tools tab |
| `MCPServers.vue` | `/dashboard/mcp` + Settings → MCP |
| `LLMSettings.vue` / `LLMDashboard.vue` | Settings → AI Providers / Models |
| `OrgSettings.vue` | Tabbed-settings **pattern** |
| `WorkspaceHub.vue` / `WorkspaceDashboard.vue` | Settings → Workspaces + right-panel context |
| `AgentLibrary.vue` / `AgentPlayground.vue` | `/dashboard/agents*` |
| `Benchmarks.vue` | `/dashboard/benchmarks` |
| `common/*`, domain dirs | Right-panel tabs + `ui/` primitives |

---

## 9. Design system & tokens

- Use **Tailwind tokens consistently**; centralize accent + neutrals in `tailwind.config.js` `theme.extend.colors` (e.g. `brand` purple/blue). **No raw hardcoded hex scattered in templates.**
- Visual style: light background, soft borders, rounded cards, generous spacing, professional typography, **purple/blue accent**, clear hover/active states, smooth panel transitions.
- Reuse one set of primitives (`ui/Base*`) everywhere — Button, Card, Badge, Tabs, Input, Textarea, Dropdown, Modal, Drawer, Tooltip, EmptyState, SkeletonLoader.
- Avoid: large empty dashboard space, too many top-nav items, unorganized raw Tailwind soup, non-responsive fixed widths, cluttered cards.

---

## 10. Responsive acceptance criteria

```txt
- No horizontal page scroll at 1440 / 1024 / 768 / 390 px.
- Grid app shell; each pane scrolls internally (min-height:0 + overflow-y:auto).
- Left sidebar: expanded → icon-rail → slide-out drawer (by breakpoint).
- Right panel: visible → drawer → bottom sheet/full-screen; collapsible everywhere.
- Chat composer stays sticky + usable on mobile (safe-area aware).
- Main content never hidden behind panels.
```

---

## 11. Implementation phases

### Phase 1 — App Shell (no backend changes)
- Build `AppShell.vue` (grid layout) + `LeftSidebar.vue` + `RightContextPanel.vue` + `MobileSidebarDrawer.vue`.
- Add `useLayoutStore`; wire collapse/expand + mobile drawer.
- Migrate `AppHeader` nav items into the sidebar (keep `AppHeader` temporarily).
- Convert `/dashboard` to the shell layout with `<router-view/>` center. Guarantee **zero horizontal scroll**.

### Phase 2 — Chat Workspace
- Build `ChatWorkspace.vue`, `ChatWelcome.vue`, `ChatMessageList.vue`, `ChatMessage.vue`, `ChatComposer.vue`, `ToolCallCard.vue`, `StreamingIndicator.vue`.
- Add `useChatStore`; connect to the **existing** chat WebSocket/API (model the wiring on `RepositoryChat.vue` / `PlannerChat.vue`).
- States: loading/thinking, streaming, error + **Retry**, **Stop generation**, attachments. Enter=send, Shift+Enter=newline.
- Make chat the **default** `/dashboard` experience.

### Phase 3 — Right Context Panel
- Populate from `useSystemStore`: current system (name, status, created), Repositories count, Knowledge count, MCP tools + status, Recent Activity.
- Tabs (chat vs system context per §6). Collapsible + responsive.

### Phase 4 — Settings
- Build `SettingsLayout.vue` + `SettingsTabs.vue` (`/dashboard/settings/:tab`).
- Move `LLMSettings`, `MCPServers`, workspace, security into tabs. Cards/forms/toggles + Save.

### Phase 5 — Polish & QA
- Skeleton loaders, empty states, keyboard shortcuts, focus states, color-contrast/a11y.
- Responsive QA at all 4 breakpoints. **Remove the old top-nav `AppHeader` layout** and dead routes.

---

## 12. Mock data isolation

When an API isn't ready, put **all** mock data in a single isolated module, e.g. `src/mocks/index.js`, exporting clearly-named fixtures. Components import from there so real API wiring is a one-file swap. No inline mock objects scattered in components.

---

## 13. Preservation rules (do NOT break)

```txt
- Authentication + route guards (meta.requiresAuth)
- Existing axios services (api.js, tenancyApi.js, toolsApi.js) and endpoints
- Existing systems / AI-provider / MCP / tools / workspace data + logic
- Existing WebSocket chat consumers
```

Refactor **UI first**. Backend changes only where genuinely required for chat-session support. Keep old routes alive until Phase 5 so nothing 404s mid-migration.

---

## 14. Final acceptance criteria

```txt
- /dashboard opens as a modern chat-first AI workspace.
- Left sidebar replaces the old top navigation.
- "New Chat" starts a session in the center area.
- Chat is the main center experience (streaming, tool calls, retry/stop).
- Right context panel shows live system/session context and is collapsible.
- Settings are organized into clean tabs.
- Fully responsive at 1440/1024/768/390 px with NO horizontal scrollbar.
- Old "Your Systems" card view lives under /dashboard/systems, not the landing page.
- Quality comparable to ChatGPT/Claude-style AI platforms.
- All preserved functionality still works.
```

---

## 15. Open decisions (confirm before/while building)

1. **`ui/` primitives** — extend `components/common/*` in place, or introduce a fresh `Base*` set and migrate gradually? (Recommend: fresh `Base*`, migrate per-phase.)
2. **TypeScript** — stay plain JS `.vue` (current setup) or adopt `<script setup lang="ts">`? (Recommend: stay JS to avoid scope creep; revisit later.)
3. **Old top-level routes** (`/services`, `/mcp`, …) — redirect to `/dashboard/*` equivalents or keep as aliases?
4. **Chat backend** — which consumer powers the new general chat (`AgentRunnerConsumer` vs a new session consumer)? Confirm session persistence/history API.
5. **Landing/marketing pages** (`LandingPage`, `Pricing`, `Blog`, …) — out of scope for this upgrade; leave untouched.

---

## 16. Summary

v2 stops looking like an admin dashboard and becomes a **modern Vue 3 chat-first agent workspace**: sidebar = navigation + history, center = chat/work area, right = live context + settings. The work is mostly **re-housing existing Vue components into a responsive grid shell** and adding a polished chat experience on top of the chat infrastructure you already have — not a rewrite, and **not** a move to React.
