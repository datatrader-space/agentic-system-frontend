# Agentic — Frontend UI/UX Transformation Plan (v2 · Full Coverage)

> **Goal:** Turn a flat, "early internal tool" UI into a premium, memorable product that reads as _serious and well-crafted_ the moment it opens.
> **Theme:** **Vibrant Light Mesh** (APPROVED). Light only — bright `#FBFAFF` canvas with a living animated color-mesh behind frosted-glass panels, candy gradients (violet/pink/amber/teal/sky), 3D-tilt cards, count-ups, and heavy-but-GPU-cheap motion. Locked by [`redesign-v2-preview.html`](redesign-v2-preview.html), with added "power-ups" (§2.5).
> **Scope (this revision):** **One** layout system — the new App Shell — used **everywhere**. **Every** authenticated page migrated into it and redesigned. Legacy layout + duplicate routes retired. Public/marketing pages re-skinned to the same light design system. Plus a set of optimizations (code-splitting, shared UI primitives, token consolidation, a11y, dead-code removal).
> **Stack:** Vue 3 (`<script setup>`) + Vite + Tailwind CSS 3 + Pinia + vue-router. Icons: `lucide-vue-next` / `@iconify/vue`. Motion: CSS + Vue `<transition>` (no new heavy deps).
> **Visual reference:** open [`redesign-preview.html`](redesign-preview.html) in a browser — it's the approved look for the shell, cards, forms, emulator, and palette.

---

## 0. Audit — current state (complete inventory)

### 0.1 The core problem: two layout systems + duplicate routes

| System | Files | Used by | Action |
|---|---|---|---|
| **v2 App Shell (KEEP)** | `app-shell/AppShell.vue`, `LeftSidebar.vue`, `SidebarNavItem.vue`, `MobileSidebarDrawer.vue`, `RightContextPanel.vue` | `/dashboard/*` | ✅ Becomes the **only** authenticated layout |
| **Legacy layout (RETIRE)** | `layout/AppHeader.vue`, `layout/AppSidebar.vue`, `layout/AppFooter.vue`, `layout/SidebarNavItem.vue` (a 2nd copy) | top-level auth routes + marketing header | ❌ Delete after migration |
| **Public/marketing** | `LandingPage` + 11 marketing/auth-gate views | unauthenticated routes | 🎨 New light `PublicLayout` sharing the design system |

Today `app.vue` branches on `isAppShell` (`/dashboard`) vs everything else, rendering the legacy `AppHeader` for non-dashboard pages. After this plan, `app.vue` collapses to three layout modes only: **AppShell** (auth), **PublicLayout** (marketing/login), **bare** (`/a/:token`, `/embed/:token`).

### 0.2 Other findings
- `tailwind.config.js` is **empty** — every color is a hardcoded hex inside components. → single token source.
- `style.css` is **dark-first** with a `[data-theme="light"]` override; `useTheme.js` toggles dark. Brief is **light only** → make light the only theme and remove dark dead code.
- Fonts: **Inter** (in `app.vue`). → **Outfit** (headings) + **Plus Jakarta Sans** (body).
- **Emoji used as icons** (`AgentLibrary`, `AgentEmulator`, empty states, …) → Lucide SVGs everywhere.
- `main.js` **eager-imports ~40 views** → no code-splitting (perf optimization opportunity).
- Notifications already centralized (`vue-toastification` + `useNotify`/`useConfirm`) — **keep**, never native dialogs.
- Unrouted/likely-legacy files to verify before deleting: `views/AutomationDashboard.vue`, `views/ServiceRegistration.vue` (V2 is the live one). Flagged in §5, not assumed.

### 0.3 Complete route → page map (post-consolidation target)

| Route (target) | View | Today's layout | Target |
|---|---|---|---|
| `/dashboard/chat/new`, `/chat/:id` | `ChatWorkspace` | Shell | Shell ✅ |
| `/dashboard/systems` | `SystemList` | Shell | Shell |
| `/dashboard/systems/:id` | `SystemDetail` | **top-level** | **→ Shell** |
| `/dashboard/systems/:sysId/repos/:repoId` | `RepositoryPage` | **top-level, fullscreen** | **→ Shell (focus mode)** |
| `/dashboard/agents` | `AgentLibrary` | Shell | Shell |
| `/dashboard/agents/new`, `/:id/configure` | `AgentBuilderCanvas` | Shell | Shell |
| `/dashboard/agents/:id` | `AgentPlayground` | Shell | Shell |
| `/dashboard/agents/:id/monitor` | `AgentMonitor` | Shell | Shell |
| `/dashboard/tools` | `ToolRegistry` | Shell | Shell |
| `/dashboard/services` | `Services` | Shell | Shell |
| `/dashboard/services/register`, `/wizard` | `ServiceRegistrationV2` | **top-level** | **→ Shell** |
| `/dashboard/services/drafts` | `ServiceDrafts` | **top-level** | **→ Shell** |
| `/dashboard/mcp` | `MCPServers` | Shell | Shell |
| `/dashboard/benchmarks` | `Benchmarks` | Shell | Shell |
| `/dashboard/workspaces` | `WorkspaceHub` | Shell | Shell |
| `/dashboard/workspace/:wsId/:tab` | `WorkspaceDashboard` | **top-level** | **→ Shell** |
| `/dashboard/activity` | `LLMDashboard` | Shell | Shell |
| `/dashboard/llm-context` | `LLMContextDashboard` | Shell | Shell |
| `/dashboard/llm-settings` | `LLMSettings` (`/ai-settings`) | **top-level** | **→ Shell** |
| `/dashboard/connections`, `/docs/connections` | `Connections`, `ConnectionDocs` | **top-level** | **→ Shell** |
| `/dashboard/integration-guide/:id?` | `IntegrationGuide` | **top-level** | **→ Shell** |
| `/dashboard/org/:slug/settings/:tab` | `OrgSettings` | **top-level** | **→ Shell** |
| `/dashboard/settings/:tab` | `SettingsLayout` | Shell | Shell |
| `/admin` | `AdminPanel` | **top-level** | **→ Shell** |
| `/` `/features` `/how-it-works` `/blog` `/blog/:slug` `/pricing` `/about` `/contact` `/docs` `/docs/:slug` | marketing views | legacy header | **→ PublicLayout (light)** |
| `/login`, `/invite/accept/:token` | `Login`, `InviteAccept` | legacy | **→ PublicLayout (light)** |
| `/a/:token`, `/embed/:token` | `PublicChat` | bare | bare (re-skinned) |

**Old top-level duplicates** (`/agents`, `/tools`, `/services`, `/mcp`, `/benchmarks`, `/ai-dashboard`, `/workspaces`, …) → **301-style redirects** to their `/dashboard/*` equivalents, then removed. No dead links.

---

## 1. Layout consolidation strategy

1. **Single auth shell.** Move all 11 stray authenticated views to be children of `/dashboard` in `main.js`. `RepositoryPage` keeps a "focus mode" (collapsible sidebar) since it's content-heavy, but still inside the shell.
2. **Redirects.** Add `redirect` route records for every legacy top-level path → `/dashboard/...` so bookmarks/deep links survive. Update in-app `<router-link>`s and `router.push` targets to the new paths (grep for `/agents`, `/tools`, `/services`, `/mcp`, `/settings`, `/ai-settings`, `/workspace`, `/org`).
3. **Delete legacy layout.** Remove `layout/AppHeader.vue`, `layout/AppSidebar.vue`, `layout/AppFooter.vue`, `layout/SidebarNavItem.vue`. Re-home `WorkspaceSwitcher.vue` under the shell (already used by `LeftSidebar`).
4. **`app.vue` simplification.** Three modes: `AppShell` (default for auth), `PublicLayout` (`meta.public`), bare (`isBareChat`). Remove `isFullScreen`/`mainContentClass` legacy branches and the old inline notification list (toasts already handle it).
5. **Right context panel.** Keep `RightContextPanel` but make it **route-aware**: Context for chat, page-specific helpers elsewhere (e.g. run status on Benchmarks), hidden where not useful. Toggle stays on `Cmd/Ctrl+J`.

---

## 2. Design system — **Vibrant Light Mesh** (APPROVED · built in Phase 1)

> Locked by the approved mockup **[`redesign-v2-preview.html`](redesign-v2-preview.html)**. Bright, animated, glassmorphic; a living color-mesh canvas behind frosted panels. Light theme only.

### 2.1 Color tokens

| Token | Hex / value | Role |
|---|---|---|
| `--bg` | `#FBFAFF` | App canvas (under the mesh) |
| `--ink` | `#191427` | Primary text (deep indigo-black) |
| `--ink-soft` | `#4A4360` | Secondary text (AA-safe) |
| `--ink-faint` | `#9A93AE` | Labels / captions |
| `--surface` | `#FFFFFF` | Solid cards / inputs |
| `--glass` | `rgba(255,255,255,.62)` | Glass panels (blur 14–20px) |
| `--glass-strong` | `rgba(255,255,255,.82)` | Stronger glass (toolbars, chips) |
| `--violet` / `--violet-d` | `#7C3AED` / `#6D28D9` | Brand primary |
| `--pink` | `#EC4899` | Secondary accent |
| `--amber` | `#F59E0B` | Tertiary accent / warning |
| `--teal` | `#14B8A6` | Knowledge / success-ish accent |
| `--sky` | `#0EA5E9` | Interactive / focus rings / links |
| `--lime` | `#84CC16` | Extra accent (gradients) |
| `--green` / `--danger` | `#10B981` / `#EF4444` | Live status / destructive |
| `--line` / `--line-2` | `rgba(25,20,39,.08)` / `.14` | Hairlines |

**Gradients (the signature):** `--g-brand` `120deg #7C3AED→#EC4899` · `--g-cool` `#7C3AED→#0EA5E9` · `--g-warm` `#F59E0B→#EC4899` · `--g-teal` `#14B8A6→#0EA5E9` · `--g-multi` `#7C3AED→#EC4899→#F59E0B` (animated flow on headings & card borders).

**Mesh blobs (global animated bg):** four blurred radial blobs — lilac `#C7B6FF`, rose `#FFB6D9`, mint `#B6F0E6`, peach `#FFE0AE` — drifting + scaling on 26–32s loops, `mix-blend:multiply`, plus a faint SVG film-grain at 2.5% opacity.

### 2.2 Typography
**Bricolage Grotesque** (display/headings — distinctive, optical-size variable) + **Plus Jakarta Sans** (body/UI), Google Fonts, `display=swap`. Scale: hero 40/1.0·700 · h1 28 · h2 18–19 · body 14–15/1.55 · sm 12.5 · meta 11 (700, often uppercase). Animated gradient text on the hero word. Tailwind: `font-display`, `font-sans`.

### 2.3 Spacing / radius / shadow / motion
- **Radius** (rounder than v1): `md 13 · lg 15 · xl 18 · 2xl 26 · pill 999`. Cards `2xl`, inputs/buttons `lg`.
- **Shadows + glows:** `s` `0 2px 8px /.06` · `m` `0 8px 30px /.10` · `l` `0 24px 60px rgba(124,58,237,.16)` (hover lift) · `glow-v` `0 10px 34px rgba(124,58,237,.42)` · `glow-p` (pink) for CTAs.
- **Motion:** spring ease `--ease cubic-bezier(.34,1.56,.64,1)` (overshoot) + smooth `--ease2 cubic-bezier(.4,0,.2,1)`; durations `fast 150 · base 220 · slow 350`. Global `prefers-reduced-motion` kill-switch.

### 2.4 Motion vocabulary
Drifting mesh bg · staggered nav slide-in · hero gradient flow · **count-up** stat tiles + fill bars · **3D mouse-tilt** cards w/ gradient-border reveal + halo glow · floating/rotating icon tiles · status-orb pulse (green ring / grey fade) · CTA shine-sweep + spring press · page fade+rise on switch · shimmer skeletons · animated toggles · spinning tool-run + typing dots in emulator.

### 2.5 Power-ups (boss request — "more power")
Layered on top of the above, scoped across phases so the app feels *alive*:
1. **Global mesh canvas** — one fixed animated-mesh + grain layer behind the whole shell (GPU `transform`-only; pauses on `prefers-reduced-motion`).
2. **Command palette** (`Cmd/Ctrl+K`) — glass modal, fuzzy nav + actions ("Create agent", "New chat", jump to any page), keyboard-first. Upgrades the existing Ctrl+K.
3. **Scroll-reveal** — sections/cards fade-rise via `IntersectionObserver` as they enter the viewport (not just on load).
4. **Interactive depth** — 3D tilt on cards; buttons get spring-press + shine; nav items slide on hover; icon tiles float.
5. **Live data flourishes** — animated count-ups, progress/capability meters that fill, mini sparklines on dashboards/stat tiles.
6. **Status as motion** — pulsing orbs everywhere status exists (agents, services, MCP, runs); "Live" = green ring pulse.
7. **Delight on success** — subtle confetti / glow burst on **Save & Publish** and agent-created; restyled glass toasts (keeps `useNotify`).
8. **Premium loading** — shimmer skeletons shaped like the real cards (no bare spinners); route-transition progress shimmer.
9. **Animated empty states** — looping lightweight SVG illustrations (no emoji).
10. **Polish** — animated gradient borders on hover/focus, glass blur on overlays/drawers, smooth page transitions between routes.

> Performance guard: all motion is `transform`/`opacity` only, GPU-friendly, and fully disabled under `prefers-reduced-motion`. No new heavy deps — confetti via a tiny self-contained canvas helper.

---

## 3. Visuals
**Approved reference (canonical look):** **[`redesign-v2-preview.html`](redesign-v2-preview.html)** — open it and flip between *Agent Library* and *Configure Agent* with the top pill. Phase 1 reproduces this exact system in Vue/Tailwind. (The earlier `redesign-preview.html` is superseded.)

---

## 4. Shared UI primitives (optimization — built early, used by every page)

A `src/components/ui/` library so all 37 pages stay consistent and we stop re-styling the same elements. Each wraps the design tokens:

| Primitive | Replaces today's ad-hoc | 
|---|---|
| `AppButton` (variants: primary/ghost/danger/subtle, sizes, loading) | dozens of inline `<button class="px-4 py-2 bg-…">` |
| `AppCard` / `GlassCard` | hand-rolled card divs |
| `AppInput`, `AppTextarea`, `AppSelect` (floating label, sky focus ring) | raw inputs |
| `AppBadge`, `StatusDot` (idle/active/error pulse) | inline badge spans, emoji dots |
| `AppModal` (one host) | `MCPServerModal`, `ServiceRegistrationModal`, `ToolExecuteModal`, `HITLModal`, `ConfirmDialog`, … share it |
| `PageHeader` (title + subtitle + actions slot) | repeated header markup on every view |
| `EmptyState` (illustrated SVG, no emoji) | emoji empty states |
| `SkeletonCard` / `SkeletonList` (shimmer) | spinners |
| `SectionDivider` (◆ marker) | configure-page dividers |
| `Toolbar`, `SearchInput`, `Tabs`, `Tooltip` | scattered copies |

This is the backbone that makes "redesign all pages" tractable and consistent.

---

## 5. Complete page-coverage matrix (nothing missed)

Every view and its component family, what it becomes, and which phase. Rows whose summary begins with **"Migrate into shell"** are pages currently *outside* the new shell that get moved in (the 11 stray authenticated pages from §0.3).

### Authenticated app pages
| Page | Family components touched | Redesign summary | Phase |
|---|---|---|---|
| **Chat workspace** `ChatWorkspace` | `chat/ChatComposer, ChatMessage, ChatMessageList, ChatWelcome, StreamingIndicator, ToolCallCard` | Premium chat surface, gradient send, glow composer, tool-call cards, streaming dots, welcome hero | 4 |
| **Agent Library** `AgentLibrary` | `common/OwnerFilter` | Card grid w/ gradient accents, StatusDot, Lucide icons, shimmer, EmptyState, polished toolbar | 2 |
| **Agent Configure** `AgentBuilderCanvas` | `AgentBuilder, PromptBuilder, ToolPicker, agent/AgentModePicker, AgentRulesEditor, DeploySettings, PlanApprovalCard` | Sectioned form, floating inputs, SectionDivider, sticky action bar, styled tool/knowledge pickers | 3 |
| **Agent Playground** `AgentPlayground` + `AgentEmulator` | `activity/ActivityStream, ActivityStep, EmulatorInspector, TokenUsage` | Two-pane premium emulator; kill emoji controls; token chips | 4 |
| **Agent Monitor** `AgentMonitor` | `AgentRunnerDashboard, JobHistory, SessionTrace, TaskDashboard` | Dashboard cards, charts, status pills, timeline | 5 |
| **Systems list** `SystemList` | — | Card/list redesign, PageHeader, EmptyState | 5 |
| **System detail** `SystemDetail`  | `RelationshipViewer, BlueprintViewer` | Migrate into shell; tabbed detail, token styling | 5 |
| **Repository page** `RepositoryPage`  | `RepositoryChat, RepositoryDocs, RepositoryKnowledge, CodeBrowser, FileViewer, WorkspaceTreeNode, knowledge/*` | Shell focus-mode; redesign code/docs/knowledge panes | 5 |
| **Tools** `ToolRegistry` | `tools/ToolCatalog, ToolCard, ToolsPanel, RegisterToolModal, ToolExecuteModal, ExecutionHistory, ExecutionResultsPanel, MetricsDashboard, CredentialManager` | Catalog cards, AppModal, metrics dashboard, Lucide brand logos | 5 |
| **Services** `Services`  register/drafts | `services/ServiceCard, ServiceDetailModal, ServiceEditModal, ServiceRegistrationModal, ServiceShareModal` | Cards + unified modal; migrate register/wizard/drafts into shell | 5 |
| **MCP** `MCPServers` | `mcp/MCPServerCard, MCPServerModal, MCPServerDetailModal` | Server cards, status, AppModal | 5 |
| **Benchmarks** `Benchmarks` | `benchmarks/BenchmarkDashboard, ReportsList, ReportDetail, RunConfig, RunStatus, CRSPipelineDashboard` | Dashboard + charts redesign, run status in right panel | 5 |
| **Workspaces hub** `WorkspaceHub` | `AgentWorkspacePanel, workspace/WorkspaceStatus, WorkspaceTerminal` | Card grid, terminal styling | 5 |
| **Workspace dashboard** `WorkspaceDashboard`  | `ArtifactViewer, MediaRenderer, ScriptPanel, AutomationPanel, SchedulePanel, SignalPanel` | Migrate into shell; tabbed workspace | 5 |
| **Activity / LLM** `LLMDashboard`, `LLMContextDashboard` | `activity/TokenUsage` | Charts, token metering, usage tables | 5 |
| **LLM Settings** `LLMSettings`  | `MonacoJsonEditor, JsonNode` | Migrate into shell; provider/model forms | 5 |
| **Settings** `SettingsLayout` | `settings/GeneralSettings, AdvancedSettings, SecuritySettings, AgentRulesSettings` | Tabbed settings, AppInput/Select, section cards | 3 |
| **Connections / docs** `Connections`, `ConnectionDocs`  | — | Migrate; provider connect cards | 5 |
| **Integration guide** `IntegrationGuide`  | — | Migrate; step layout, code blocks | 5 |
| **Org settings** `OrgSettings`  | `common/OwnerFilter` | Migrate; members/roles tables | 5 |
| **Admin** `AdminPanel`  | — | Migrate; admin tables/cards | 5 |
| **Planner / misc** | `PlannerChat, ChatHistory, BackButton, ConfirmDialog, HITLModal, AgentBuilder` | Re-skin to primitives | 3–4 |

### Public / unauthenticated
| Page | Redesign | Phase |
|---|---|---|
| `LandingPage` | Light hero, feature blocks, CTA — same tokens, PublicLayout | 6 |
| `Features`, `HowItWorks`, `Pricing`, `About`, `Contact` | Light marketing sections | 6 |
| `Blog`, `BlogPost` (`data/blogPosts.js`) | Light article/list layout | 6 |
| `Docs` | Light docs layout, sidebar TOC | 6 |
| `Login`, `InviteAccept` | Centered light auth card, gradient accent | 6 |
| `PublicChat` (`/a`, `/embed`) | Re-skin bare widget to premium chat | 6 |

### Cross-cutting components (re-skinned once, used everywhere)
`app-shell/*`, `MobileSidebarDrawer`, `RightContextPanel`, `WorkspaceSwitcher`, `ConfirmDialog`, `HITLModal`, all `*Modal.vue`, `JsonNode`/`MonacoJsonEditor`, `MediaRenderer`/`ArtifactViewer`, `BackButton`.

> If any view in §5 turns out unrouted/dead (`AutomationDashboard`, `ServiceRegistration` v1), it's confirmed then deleted — not silently skipped.

---

## 6. Phased rollout

### Phase 1 — Vibrant Light Mesh design system + layout shell foundation
- `index.html`: **Bricolage Grotesque + Plus Jakarta Sans** (`display=swap`), `--bg` canvas.
- `tailwind.config.js`: full token system (mesh palette, gradients, fonts, rounder radii, shadow+glow scale, spring/smooth easings, keyframes — drift/float/shine/flow/ring/shimmer).
- `style.css`: **light-only** Vibrant Mesh tokens, motion keyframes & utilities (`.shimmer`, `.orb`, `.glass`, gradient-text, page transition), global `prefers-reduced-motion` kill-switch. Remove dark dead code.
- **`MeshBackground.vue`** (new): the global animated mesh + grain canvas layer (power-up #1), GPU transform-only.
- `AppShell.vue` + `LeftSidebar.vue` + `SidebarNavItem.vue`: glass panels over the mesh, gradient brand mark, glowing/shine New Chat, staggered nav, active gradient bar + icon glow, glass compact topbar.
- **`CommandPalette.vue`** (new): `Cmd/Ctrl+K` glass palette (power-up #2), wired into the shell.
- `app.vue`: collapse to 3 layout modes (AppShell / PublicLayout / bare); remove inline notifications (toasts handle it).
- Reusable motion helpers: `v-reveal` directive (IntersectionObserver scroll-reveal, power-up #3) + `useCountUp` composable.

### Phase 2 — Agent Library (flagship page)
Card redesign (gradient accents, Lucide, StatusDot, hover lift), toolbar, shimmer grid, illustrated empty state.

### Phase 3 — Forms: Configure, Settings, Org, LLM Settings
Build form primitives (AppInput/Select/Textarea, SectionDivider, sticky action bar); apply to `AgentBuilderCanvas`, `SettingsLayout`, `OrgSettings`, `LLMSettings`, `ServiceRegistrationV2`.

### Phase 4 — Chat & Emulator + micro-animations
Premium chat surface, emulator panes, tool-call cards, streaming indicator, page transitions, button feedback, global focus/contrast/reduced-motion pass, remove remaining emoji icons.

### Phase 5 — Migrate & redesign all remaining app pages
Move the 11 stray pages into the shell + redirects; redesign Tools, Services (+register/drafts), MCP, Benchmarks, Systems (+detail), Repository, Workspaces (+dashboard), Activity/LLM, Monitor, Connections, Integration guide, Admin — all on the primitives. Delete legacy `layout/*` + duplicate routes.

### Phase 6 — Public / marketing + auth pages
PublicLayout (light) for landing/features/pricing/blog/docs/about/contact; light Login/InviteAccept; re-skin PublicChat widget.

### Phase 7 — Polish, QA & cleanup
Code-splitting (§7), dead-code/file removal, cross-page consistency sweep, responsive QA (375/768/1024/1440), a11y audit, screenshot regression of every page.

---

## 7. Optimizations (bundled into the phases above)

1. **Route-level code-splitting** — convert `main.js` eager `import` of ~40 views to `() => import(...)` dynamic imports. Big first-load win. (Phase 7, but Monaco/pdf views split immediately.)
2. **Lazy-load heavy libs** — `monaco-editor`, `pdfjs-dist`, `highlight.js` loaded only on the routes that use them.
3. **Shared UI primitives** (§4) — kills style drift, shrinks markup, single source of truth.
4. **Token consolidation** — one tokens layer (Tailwind + CSS vars); remove all hardcoded hex.
5. **Dead-code removal** — dark-mode branch in `useTheme.js`, `[data-theme]` dark vars, `.app-dark-theme`, legacy layout files, duplicate `SidebarNavItem`, unrouted views.
6. **Icon standardization** — Lucide only; zero emoji-as-icon.
7. **Single modal host** — `AppModal` replaces N bespoke modals → less JS, consistent a11y/focus-trap.
8. **Motion/a11y system** — global `prefers-reduced-motion`, `:focus-visible` rings, page transitions as one reusable wrapper.
9. **Image perf** — `loading="lazy"`, width/height to prevent CLS on marketing pages.
10. **Command palette** — extend existing `Cmd/Ctrl+K` into a quick-nav/search palette (nice-to-have, Phase 7).

---

## 8. Guardrails (design-skill checklist + boss requirements)
No emoji icons (Lucide only) · `cursor-pointer` + non-shifting hover feedback · body text ≥ 4.5:1 (`--ink-soft` floor) · glass ≥ 62% opaque (visible on the mesh) · visible `:focus-visible` (sky) · transitions 150–350ms · `prefers-reduced-motion` · responsive 375/768/1024/1440 · reuse `useNotify`/`useConfirm`, never native dialogs.

### 8.1 ZERO feature loss / don't break the backend (hard rule)
Every redesign is **presentational only** — markup/classes/styles change, behavior does **not**. For each touched component we preserve: all props/emits/v-model contracts, store calls, API calls, router targets, keyboard shortcuts, and conditional states (loading/empty/error/locked). No backend payloads, endpoints, field names, or request shapes change. Sub-panels keep their logic (e.g. `AgentBuilder` canvas, `SignalPanel`, `SchedulePanel`, `CredentialManager`, `AgentEmulator` publish-gating). When a component is restyled, its test files must still pass. If a redesign would require a behavior change, it's flagged for sign-off first — never done silently.

### 8.2 Colorful brand icons (boss request)
Real integrations render their **full-color brand logos**, not monochrome strokes — exactly like the Communication Channels panel (WhatsApp green, Slack multicolor, Telegram, Instagram, Messenger, Redis, etc.). Use the already-bundled `@iconify/vue` **`logos`** collection (offline, in `main.js`) via `<Icon icon="logos:slack-icon" />`; generic UI glyphs stay Lucide. Applies to: Communication Channels, Services, MCP servers, Tools catalog, Connections, LLM providers, and any provider/tool chips. Status uses the animated `vm-orb` (green ring = active).

### 8.3 Wizard-style Configure (boss request)
The Configure page keeps its **step rail** (General ✓ · System Prompt · Knowledge · Tools · Autonomy · Advanced) as a real, clickable **wizard**: numbered/checked pills, current step highlighted (gradient), completed steps in teal, click to jump, with prev/next + inline progress. It must remain **non-destructive** to `AgentBuilder` — the canvas and all its sub-panels/logic stay; the wizard is a navigation/affordance layer over the existing single-scroll canvas (sections get anchors + a sticky rail). No feature from the current 6-tab/canvas builder is dropped.

## 9. Risks & decisions
- **Marketing pages light-only:** brief says light only; current landing is dark. Plan converts marketing to light. _Confirm if you want marketing kept dark as a deliberate exception._
- **RepositoryPage** is dense/fullscreen — kept in shell with a focus mode rather than ripped apart.
- **Redirects** preserve every old deep link; in-app links updated in the same pass to avoid double-redirects.
- **Sequencing:** Phases 1→4 deliver the visible "wow" fast; Phase 5 is the bulk migration; 6–7 finish coverage and perf.

---

_This revision supersedes the first plan. The look is locked by [`redesign-v2-preview.html`](redesign-v2-preview.html) (Vibrant Light Mesh); this document guarantees **every** page, component family, route, and the layout consolidation + optimizations are accounted for. Nothing in `src/views` or `src/components` is left unassigned, **no existing feature or backend contract is dropped** (§8.1), brand integrations use colorful logos (§8.2), and Configure becomes a true wizard (§8.3)._

---

## 10. Implementation log
- **Phase 7 (cleanup + a11y) — DONE & verified (build + 64 tests pass).** Removed dead legacy files `layout/AppSidebar.vue` + `layout/AppFooter.vue` (zero references; the dashboard uses `app-shell/*`). `layout/AppHeader.vue` is **kept** — it's the marketing-pages header and is fully var-driven (renders light), so no separate PublicLayout was needed. Added a global **`:focus-visible`** keyboard focus ring (sky) for a11y. Route-level code-splitting already landed (per-route chunks). _Intentionally left: the dark/`[data-theme=light]` CSS-var duality in `style.css` — light is force-locked via `app.vue`, so flattening it is low-value/high-risk; deep responsive + screen-reader QA needs the running app (recommended for the user to spot-check)._
- **Phase 6 (light everywhere) — DONE & verified (build + 64 tests pass).** Central flip in `app.vue`: forced `data-theme=light` (light-only, ignores any saved 'dark') and replaced the public `.app-dark-theme` (#030712) canvas with a light `.app-light-theme` (#FBFAFF). Because the marketing pages (Landing, Features, Pricing, Contact, HowItWorks, Blog, Docs) + Login are **var-driven** (`var(--bg-body)`/`var(--text-*)`), they now render light automatically. Per-page dark spots fixed: LandingPage `.ai-badge` + About `.cta-section` → brand gradient. The two hardcoded-dark in-app pages **OrgSettings** and **WorkspaceDashboard** were deliberately remapped dark→light (surfaces→white, borders→ink-alpha, light text→ink, accent text darkened for contrast on light tints, modals→white; colored buttons/avatars kept). _Note: marketing pages are now functionally light but were art-directed for dark — they may want a visual polish pass (can't verify rendering here)._
- **Phase 7 (perf) — route-level code-splitting DONE.** Converted all ~40 view imports in `main.js` to lazy `() => import()` factories. The single ~14 MB bundle is now split into per-route chunks (e.g. ToolRegistry 32 KB, MCP 44 KB, Benchmarks 26 KB), and heavy deps load on demand (pdf.js 447 KB, Monaco/CodeBrowser 3.8 MB, AgentPlayground 205 KB) instead of upfront. Build + 52 tests pass. _Remaining Phase 7: dead-code removal (legacy `layout/*`, dark CSS vars), a11y/responsive QA._
- **Phase 5b (in-shell page rethemes) — light pages DONE.** Rethemed headers/primary actions + mesh-friendly backgrounds on Tools, MCP, Services, Systems, Benchmarks, Activity (LLMDashboard), LLM Context, Workspaces, **Connections, SystemDetail, AdminPanel** — gradient display headings (`font-display` + violet→pink), gradient/glow buttons, gradient icon tiles, `text-ink`/`text-ink-soft`. Stale in-page links repointed to `/dashboard/*`. RepositoryPage is already light (fine in shell). ServiceRegistrationV2 has intentional dark code panels (left as-is).
  - **Finding:** `OrgSettings` and `WorkspaceDashboard` are **self-contained DARK pages** (`background:#030712; color:#f9fafb`) — they render as readable dark islands in the light shell. Partial accent edits would break their contrast, so their **full light conversion is folded into Phase 6** (alongside marketing/Login). Same for the marketing pages + `Login` (dark by design).
- **Phase 5a (route consolidation) — single layout everywhere.** Moved the 11 previously top-level authed pages into the `/dashboard` shell as children (SystemDetail, RepositoryPage, ServiceRegistrationV2 register/wizard, ServiceDrafts, WorkspaceDashboard, LLMSettings→`llm-settings`, Connections, ConnectionDocs, IntegrationGuide, OrgSettings, AdminPanel). Every old top-level path (`/tools`, `/services`, `/mcp`, `/benchmarks`, `/agents`, `/systems/:id`, `/ai-settings`, `/ai-dashboard`, `/workspace/*`, `/org/*`, `/connections`, `/integration-guide`, `/admin`, …) is now a **redirect** into the shell — names preserved so name-based nav + bookmarks + deep links keep working with no link-hunting. Result: there is now ONE authenticated layout (the mesh App Shell); the legacy `layout/*` header only serves public/marketing pages (removed for authed in Phase 6/7). _Per-page visual restyles of these in-shell pages (Tools/Services/MCP/Benchmarks/Systems/Workspaces/Activity/Repository/etc.) are the next Phase-5 sub-steps._
- **MeshBackground stacking fix.** `.mesh` was `z-index:0` as a child of `.app-shell`, painting OVER static page content (the Configure form looked empty though it was rendered & clickable). Fixed: `.mesh { z-index:-1 }` + `.center-col { position:relative; z-index:1 }`.
- **Agents in-place tab switcher.** Added `components/agent/AgentTabSwitcher.vue` — the approved top **"Agent Library | Configure Agent"** pill — centered on the Agent Library and in the Configure top bar (≥xl). Flips between the two in-place (SPA route swap + `vm-page` fade, no full-page redirect). Card **Configure** and **Chat** now BOTH open the unified Configure screen in edit mode (its right dock is the live Emulator, which defaults to the chat tab) instead of the separate playground. Playground/monitor routes remain for deep links. Build + 52 tests pass.
- **Phase 4 (Chat & Emulator) — DONE & verified (build + 52 tests pass).** Redesigned the chat surface to Vibrant Light Mesh: `ChatWorkspace` (glass header, gradient agent name, fade footer), `ChatWelcome` (gradient floating mark, gradient title accent, glass suggestion chips, gradient/glow send, sky focus, fixed stale `/agents`→`/dashboard/agents` link), `ChatComposer` (glass + sky focus + gradient glow send/spring), `ChatMessage` (gradient avatar tile, gradient user bubble, 📎 emoji → SVG), `StreamingIndicator` (violet dots), plus `AgentEmulator` light pass (emoji controls ↻/⋯/💾/■/▸ → SVGs, gradient send). Added subtle **route page transitions** (`vm-page`, reduced-motion safe) to the shell router-view. All chat behavior preserved (attachments, suggestions, Enter/Shift-Enter, streaming/stop, long-answer rehydrate, copy, retry, HITL modal, plan-approval card, mode picker). Note: `extend.colors` merges with Tailwind defaults, so legacy indigo/violet utility classes elsewhere keep working.
- **Phase 3 (Configure) — FIX applied.** The first pass made the builder body fully transparent (mesh showing through), which — combined with `scrollIntoView` over-scrolling — made the section cards read as "empty" across the step rail. Fixed: builder canvas now has a solid light lavender surface (not transparent) so the white section cards always pop; cards strengthened (solid white, radius 22, shadow-m, hover-lift); numbered step badges → gradient icon tiles (violet/teal/sky); `scrollToSection` rewritten to scroll the builder's own container via `getBoundingClientRect` offset (no more landing on blank space). Build + 52 tests pass.
- **Phase 3 (Configure) — DONE & verified (build + 52 tests pass).** `views/AgentBuilderCanvas.vue` rewrapped to the approved mockup: glass top bar (back chip, name, Unsaved/Published pill, Workspace, Deploy, gradient **Save & Publish** split + menu), a real clickable **wizard step-rail** (General · System Prompt · Knowledge · Tools · Autonomy · Advanced) with **scroll-spy** (IntersectionObserver) + click-to-scroll to anchors, mesh-friendly transparent layout, restyled **emulator dock** + publish-lock overlay. The 2344-line `AgentBuilder.vue` logic is **untouched** — only six harmless `id`/`vm-anchor` hooks added to section headers; everything else (model picker, prompt modes/preview, knowledge RAG upload+index, ToolPicker, autonomy/checkpoints, AgentRulesEditor, SignalPanel, CredentialManager, MCP creds, SchedulePanel, colorful `logos:` channel icons, `defineExpose` save/markClean) preserved. Section cards/inputs restyled cosmetically via `:deep()` from the wrapper. Zero feature/back-end change.
- **Phase 2 — DONE & verified (build + 52 tests pass).** `views/AgentLibrary.vue` rebuilt to the approved mockup: hero header (eyebrow + animated gradient title), **animated count-up stat row** over real data (total/live/tools/idle), glass toolbar (search, All/Live/Idle segmented filter, styled sort, `OwnerFilter` kept), **glass agent cards** with gradient accent + halo, **3D mouse-tilt** (reduced-motion safe), floating gradient icon tiles (Lucide via `@iconify`, **no emoji**), animated status orbs, model/tools/context chips, capability meter, Chat/Configure + overflow menu (Monitor/Integration/Duplicate/Delete), add-new card, **shimmer skeleton** loading grid, and illustrated SVG empty/no-match states. **Zero feature loss** — every original handler, route, store/API call, and the menu/confirm-delete flow preserved.
- **Phase 1 — DONE & verified.** Done: Bricolage+Jakarta fonts (`index.html`), full token system (`tailwind.config.js` + `style.css` `--vm-*` additive layer, keyframes, utilities), `MeshBackground.vue` (global animated mesh, mounted in `AppShell`), `useCountUp` composable, `v-reveal` directive (registered in `main.js`), redesigned `LeftSidebar.vue` + `SidebarNavItem.vue` (glass, gradient brand, shine New Chat, staggered nav, gradient active bar + icon glow — **all nav/history/workspace/footer logic preserved**), `AppShell.vue` (mesh + glass topbar), new `CommandPalette.vue` (Cmd/Ctrl+K, repurposed from the old new-chat shortcut). Legacy CSS-var theme + dark code intentionally left until Phase 7 cleanup to avoid breaking not-yet-migrated pages. _Pending: app.vue 3-mode collapse (deferred to Phase 5/6 with the legacy-layout retirement, so public pages keep their header for now)._
