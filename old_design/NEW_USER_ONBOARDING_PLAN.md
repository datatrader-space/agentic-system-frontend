# New-User Onboarding: "Create an agent first" guard + Feature Tour — Plan

> **Problem (two parts):**
> 1. A freshly-logged-in user with **zero agents** lands on `/dashboard/chat/new`, types a
>    message, and gets **nothing back** — `useChatStore.sendMessage` silently returns with
>    `error = 'Select an agent to start chatting.'`. The user is confused: the box accepts text
>    but nothing happens.
> 2. New users have **no idea what each feature does** (Agents, Connectors, Workflow Builder,
>    Let's Code, Activity). There is currently **no onboarding/tour infrastructure at all**.
>
> **Goal:** Make the empty-agent state impossible to miss (clear "create an agent first" prompt +
> hard guard on send), and add a lightweight first-run **feature tour** that explains the product.
> No new heavy dependencies — build it with the existing Vue 3 + Pinia + localStorage patterns.

---

## 0. Current state (verified)

| Concern | Today | File |
|---|---|---|
| Landing route after login | `/dashboard/chat/new` | `src/main.js:175` |
| Send blocked with no agent | sets `error`, returns silently — message never sends | `src/stores/useChatStore.js:223-225` |
| Existing "no agents" hint | small text link in welcome screen, easy to miss | `src/components/chat/ChatWelcome.vue:11-13` |
| Agent picker | searchable combobox, `:disabled="!agents.length"` | `src/components/chat/AgentSelect.vue` |
| Agents loaded flag | `chat.agentsLoaded` / `chat.agents` | `src/stores/useChatStore.js:73-90` |
| Create-agent route | `/dashboard/agents/new` (AgentBuilderCanvas) | `src/main.js:183` |
| Agent list route | `/dashboard/agents` (AgentLibrary) | `src/main.js:182` |
| Notify / Confirm helpers | `notify.*`, `confirm(...)` (NEVER native dialogs) | `src/composables/useNotify.js`, `useConfirm.js` |
| Current user | `GET /auth/me`, `provide('currentUser')` from `app.vue` | `src/app.vue`, `src/services/api.js:337` |
| Tour / onboarding infra | **none** — no library, no `hasSeen` flag | — |
| localStorage flag pattern | established (`v2_layout_prefs`, `app-theme`, `aadml_consent`) | `src/stores/useLayoutStore.js:6-22` |
| App shell mount point | `AppShell.vue` (dashboard shell, sibling of CommandPalette) | `src/components/app-shell/AppShell.vue` |

**Key insight:** infra is missing but the patterns to build it cleanly already exist. No backend
change is required for v1 (localStorage flags); a `/auth/me` flag can be added later for cross-device.

---

## Part A — "Create an agent first" guard (high ROI, low risk)

### A1. Prominent empty-state on the New Chat welcome screen
`src/components/chat/ChatWelcome.vue`

- Replace the tiny inline `no-agent` link (lines 11-13) with a real **empty-state card** shown when
  `chat.agentsLoaded && !chat.agents.length`:
  - Icon + heading **"Create an agent to start chatting"**
  - One line: *"Agents are the AI workers that answer your messages. You need at least one before you can chat."*
  - Primary CTA button **"Create your first agent"** → `router.push('/dashboard/agents/new')`
  - Secondary ghost link **"Browse agents"** → `/dashboard/agents`
- When this card is shown, **visually de-emphasize / disable the composer** (the input + send) so the
  user understands chatting isn't available yet. Reuse the existing `AgentSelect` disabled state
  (`:disabled="!agents.length"`) and add a disabled state to the textarea + send button.
- Guard against flicker: only show the card after `agentsLoaded === true` (don't flash it during load).

### A2. Hard guard + visible feedback on send
`src/stores/useChatStore.js` (`sendMessage`, ~line 223)

- Keep the early-return, but make the failure **loud, not silent**:
  - If `this.agentsLoaded && !this.agents.length` → set a distinct flag `this.needsAgent = true`
    (or reuse error) **and** surface it. The store can't call `notify` cleanly, so the component
    layer reacts to it.
- In the composer/welcome component, when a send is attempted with no agent:
  - call `notify.warning('Create an agent before sending a message.')` (uses `useNotify`, never
    native alert — per project rule), and
  - scroll/focus the empty-state card / open the create-agent CTA.
- If agents exist but none is selected (edge case), keep the existing
  `'Select an agent to start chatting.'` but also surface it via `notify` instead of silent state.

### A3. (Optional) one-time info modal on first landing with zero agents
- If the user reaches `/dashboard/chat/new` with `agentsLoaded && !agents.length` **and** the
  `onboarding_seen_create_agent` localStorage flag is unset, show a friendly dismissible modal:
  *"Welcome! To start, create an agent — your personal AI worker. Want a quick tour?"* with
  **[Create an agent]**, **[Take the tour]**, **[Maybe later]**.
- This is the natural bridge into Part B. Set the flag on dismiss so it never nags again.

**Part A acceptance:**
- A zero-agent user sees an unmistakable "create an agent" card; the composer is visibly disabled.
- Attempting to send with no agent shows a toast (no silent dead-end).
- Clicking the CTA routes to `/dashboard/agents/new`.
- Users **with** agents see zero behavior change (regression-safe).

---

## Part B — First-run feature tour

### B1. Persistence: backend `/auth/me` flag (DECISION: cross-device, not localStorage)
Onboarding state lives on the **User model** so it survives cache clears and follows the user across
devices. localStorage is used only as a fast read-through cache to avoid a flash on load.

**Backend (`agent/`):**
- `agent/models.py` — add to `class User(AbstractUser)` (next to `email_verified`, line ~48):
  `onboarding_completed = models.BooleanField(default=False)` (+ optional
  `onboarding_step = models.PositiveSmallIntegerField(default=0)`). New migration.
- `agent/serializers.py:20` `UserSerializer.Meta` — add `onboarding_completed` to `fields`
  (and to `read_only_fields` if only mutated via the dedicated endpoint below). It then ships in the
  `GET /api/auth/me` response (`agent/auth_views.py:199 current_user`) and `/auth/check`.
- New endpoint **`PATCH /api/auth/me/onboarding`** in `agent/auth_views.py`
  (`@api_view(['PATCH'])`, `IsAuthenticated`): sets `onboarding_completed` (and `onboarding_step`),
  `user.save(update_fields=[...])`, returns the updated user. Wire in `agent/urls.py`.

**Frontend — `src/composables/useOnboarding.js`** (mirrors `useTheme.js` pattern):
- Reads `currentUser.onboarding_completed` (already injected via `provide('currentUser')` in `app.vue`)
  as the source of truth; mirrors into localStorage key `v2_onboarding` for instant first-paint.
- API: `isTourCompleted()`, `startTour()`, `nextStep()`, `prevStep()`, `endTour(completed)`, `resetTour()`.
- `endTour(true)` / `resetTour()` fire `api.patch('/auth/me/onboarding', {...})` and update both the
  injected user and the localStorage mirror; the PATCH is best-effort (UX never blocks on it).
- Add `updateOnboarding` to `src/services/api.js` alongside `getCurrentUser` (api.js:337).

### B2. Tour UI components
New `src/components/onboarding/`:
- `FeatureTour.vue` — orchestrator; reads steps, renders the active step's spotlight + tooltip card,
  handles Next / Back / Skip / Finish, ESC to dismiss, progress dots ("3 of 6").
- `TourSpotlight.vue` — dim full-page overlay with a cut-out highlight around the target element
  (target resolved by a `data-tour="<id>"` attribute or element ref). Tooltip auto-positions near it.
- Mount `FeatureTour.vue` once in `AppShell.vue` (sibling of `CommandPalette`), so it can highlight
  sidebar nav items and page chrome on any `/dashboard/*` route.

### B3. Tour content (the steps)
Driven by a config array (anchor `data-tour` id → copy). Cover the real nav from `LeftSidebar.vue`:
1. **Welcome** — centered card, no anchor: "Here's a 60-second tour of what you can do."
2. **Agents** (`/dashboard/agents`) — "Create AI agents — your specialized workers. Start here."
3. **New Chat** — "Talk to any agent here. Pick an agent, ask anything."
4. **Connectors** — "Connect services, MCP servers, and workspaces your agents can use."
5. **Workflow Builder** — "Chain agents and tools into automated, multi-step workflows."
6. **Let's Code** — "Point an agent at a repo to read, explain, and edit code."
7. **Activity** — "Track token usage, costs, and runs."
8. **Finish** — "You're set! Create your first agent to begin." → CTA to `/dashboard/agents/new`.

Steps that point at a different route should `router.push` to that route before highlighting (or
gate steps to the current route). Add `data-tour="agents|connectors|workflow|lets-code|activity"`
attributes to the corresponding `LeftSidebar.vue` nav items (non-invasive, just attributes).

### B4. Triggering the tour
- **Auto** on first dashboard load when `!isTourCompleted()` (and user is authenticated). Debounce so
  it doesn't fight the create-agent modal — show the A3 welcome modal first; "Take the tour" launches B.
- **Manual** re-entry: a **"Take a tour"** / **"?"** item in the left sidebar footer or help menu, and
  a "Replay tour" action in Settings, calling `resetTour()` + `startTour()`.

**Part B acceptance:**
- First-run user gets the tour once; completing or skipping sets the flag and it never auto-shows again.
- Tour highlights each real nav item with correct copy; Next/Back/Skip/progress all work.
- Tour can be replayed on demand from the sidebar/Settings.
- Tour is keyboard-accessible (ESC closes; focus trapped in the tooltip card).
- Zero impact when the flag is already set (returning users never see it).

---

## C. Build order & risk

1. **A1 + A2** first — biggest confusion-killer, smallest surface, fully regression-safe.
2. **A3** modal — bridges into the tour.
3. **B1 → B2 → B3 → B4** — tour, additive and behind the first-run flag.

**Risks / guards:**
- Don't flash the empty-state before `agentsLoaded` (handle the loading window).
- Use `useNotify` / `useConfirm` only — **no native `alert`/`confirm`** (project rule).
- Tour overlay must not trap users (always-visible Skip; ESC closes; clicking the CTA routes out).
- Persistence is the backend `onboarding_completed` flag → survives cache clears and follows the user
  across devices. localStorage is only a first-paint mirror; the User flag is the source of truth.
- **Tour built from scratch — NO new dependency** (DECISION). Custom `TourSpotlight.vue` (dim overlay +
  cut-out highlight + auto-positioned tooltip). Matches the existing Vue 3 + Pinia patterns.
- Migration + restart required for the backend field; ship the field/serializer/endpoint before
  wiring the frontend so `GET /auth/me` already returns the flag.

## D. Files touched (summary)

**New**
- `src/composables/useOnboarding.js` — reads `currentUser.onboarding_completed`, PATCHes on finish
- `src/components/onboarding/FeatureTour.vue` — orchestrator (steps, Next/Back/Skip/progress)
- `src/components/onboarding/TourSpotlight.vue` — from-scratch overlay + spotlight + tooltip
- (optional) `src/components/onboarding/WelcomeModal.vue` (A3)

**Modified — frontend**
- `src/components/chat/ChatWelcome.vue` — empty-state card + disabled composer (A1)
- `src/stores/useChatStore.js` — `needsAgent` flag / loud guard (A2)
- `src/components/app-shell/AppShell.vue` — mount `FeatureTour` (B2)
- `src/components/app-shell/LeftSidebar.vue` — `data-tour` anchors + "Take a tour" entry (B3/B4)
- `src/services/api.js` — `updateOnboarding()` PATCH helper (B1)
- (optional) Settings view — "Replay tour" action (B4)

**Modified — backend**
- `agent/models.py` — `User.onboarding_completed` (+ `onboarding_step`) field + migration (B1)
- `agent/serializers.py` — expose `onboarding_completed` in `UserSerializer` (B1)
- `agent/auth_views.py` + `agent/urls.py` — `PATCH /api/auth/me/onboarding` endpoint (B1)

---

## Bottom line
Part A removes the silent dead-end so a new user is told **exactly** what to do (create an agent),
with a visible, blocking empty state and a toast on misuse. Part B teaches the product once, with a
skippable, replayable spotlight tour built on the patterns already in the codebase — no backend
change and no heavy library for v1.
