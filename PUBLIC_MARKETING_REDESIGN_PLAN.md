# Public Marketing Redesign — "AADML Editorial" Theme Adoption Plan

**Goal:** Adopt the new static design (`public markeeting static pages design/uploads/*`) on the **public marketing pages only**, without leaking the new theme into the authenticated dashboard/app. Migrate the 5 pages that have a static reference, then extend the same design language to the 3 pages that don't.

**Status:** Plan only — no code written yet.

---

## 1. What we're adopting

The reference is a warm **editorial / "paper"** aesthetic, fundamentally different from the current public theme (Vibrant Light Mesh, `--vm-*` blue/teal gradient tokens).

| Trait | Current (`PublicLayout.vue`) | New design (`site.css`) |
|-------|------------------------------|-------------------------|
| Palette | `--vm-*` blue/teal on white | `--paper #f7f4ed`, `--ink #14221d`, `--green/blue/red/amber/violet` accents |
| Display type | sans (`--vm-font-sans`) | **serif** (`Georgia`) for all H1/H2/section titles |
| Backdrop | animated blob mesh | soft radial paper gradient + grid-paper diagram panels |
| Chrome | sticky glass header, 4-col footer | `top-note` bar + 76px sticky nav (serif brand mark) + 5-col footer |
| Motifs | rounded cards | orbit/core diagrams, workflow canvas, console/lab boards, `data-reveal` scroll-in |

### Source files (`public markeeting static pages design/uploads/`)
- `site.css` — the **single source of truth** for the new theme (~410 lines; the per-page HTML files inline a copy of it).
- `site.js` — scroll-reveal (`.reveal`/`data-reveal`) + interactive `runBuilder()` (workflow node animation).
- `index.html` → **Landing/Home** (`/`) — hero orbit panel, mission tabs (JS-driven), workflow canvas, execution/science/government bands, architecture, CTA.
- `features.html` → **Features** (`/features`) — feature-index chips, alternating `feature-block` rows with UI mockups.
- `docs.html` → **Docs** (`/docs`, `/docs/:slug`) — quickstart, browse-by-area, guides, API/SDK sections.
- `pricing.html` → **Pricing** (`/pricing`) — 4 plan tiers, compare table, metering, FAQ.
- `blog.html` → **Blog** (`/blog`) — featured post, recent list, newsletter band.
- `platform.html`, `workflow-builder.html` — **extra** reference pages (no current route). Optional: harvest sections for Features/How-It-Works; not in scope unless we add routes.

---

## 2. Core architectural decision — theme isolation

The new palette reuses generic-sounding class names (`.btn`, `.node`, `.hero`, `section`, `.brand`) and bare-element selectors (`section{padding:110px 0}`, `body{...}`). Importing `site.css` globally **will collide** with the dashboard and Tailwind utilities.

**Rule: scope the entire new theme under a single root class** applied only by `PublicLayout`.

- Create `src/styles/aadml-public.css` from `site.css`, with every rule prefixed by a scope root — e.g. `.aadml-public`:
  - `.aadml-public .btn { ... }`, `.aadml-public section { ... }`, `.aadml-public .hero h1 { ... }`.
  - Move the `body{...}` background rule onto `.aadml-public` (the scroll container), **not** `body`.
  - Keep `:root{ --paper: ... }` custom-property block, but redeclare the tokens on `.aadml-public` instead of `:root` so they don't override app tokens.
- `PublicLayout.vue` adds `aadml-public` to its root element and imports the stylesheet (unscoped `<style src>` or a plain import in the layout, loaded once).
- Do **not** use `<style scoped>` for the theme sheet — the diagram markup is verbose and shared across pages; a single class-scoped global sheet is cleaner and matches how the static pages already work.

> This keeps the new look on `/`, `/features`, `/docs`, `/pricing`, `/blog`, `/about`, `/contact`, `/how-it-works` and nowhere else. The authenticated `AppShell` and every `/dashboard/*` route are untouched.

---

## 3. Shared chrome — rebuild `PublicLayout.vue`

Replace the current vm-styled header/footer with the new design's chrome, **preserving all existing Vue behaviour**:

- **Keep:** `router-link` nav, mobile drawer + burger, `AppBreadcrumbs`, `CookieConsent`, `/login` CTAs, scroll listener, `isActive()`.
- **Restyle to new design:**
  - `top-note` announcement bar (new): "A common operating layer for intelligent systems."
  - Header: 76px `.nav` with serif `.brand` + `.brand-mark` circle logo; `.nav-links`; `.nav-actions` with a `.btn` "Get started" (→ `/login`) and a `.text-link` "Sign in".
  - Footer: 5-column `.footer-grid` (Product / Execution / Systems / Developers + brand blurb) with `.footer-bottom` copyright. Rewire all `*.html` anchors to `router-link`s (`platform.html` → `/features` or a new route; `#missions` → `/#missions`, etc.).
- Nav link set stays route-based: Home `/`, Features `/features`, Docs `/docs`, Pricing `/pricing`, Blog `/blog`. (New design also shows "Platform" → map to `/features` or drop; decide during build.)
- Mobile drawer reuses the same `navLinks` array, restyled to paper tokens.

**Reveal + interaction:** port `site.js` into reusable Vue utilities under the layout/pages:
- `useReveal()` composable (or a `v-reveal` directive) implementing the `IntersectionObserver` + failsafe timers from `site.js`. Elements opt in with `class="reveal"` / `data-reveal`.
- `useMissionTabs()` / `useWorkflowRunner()` composables for the Landing page's mission-tab switcher and `runBuilder()`/`runWorkflow()` node animation (the inline `<script>` at the bottom of `index.html`).
- Respect `prefers-reduced-motion` (already partly handled).

---

## 4. Per-page migration (pages **with** a static reference)

For each, replace the current SFC `<template>` (and remove its bespoke `<style>` that references `--vm-*`) with markup transcribed from the static HTML's `<main>`, converting:
- static `<a href="x.html#y">` → `<router-link>` / in-page `#y` anchors,
- JS-driven blocks → the composables from §3,
- hard-coded copy → keep as-is initially (content parity), swap to real product copy in a follow-up,
- images (`uploads/pasted-*.png`) → copy into `src/assets/` and import, or keep as decorative CSS (most visuals are pure CSS/SVG, so few real images).

| Page | View file | Sections to port (from static `<main>`) |
|------|-----------|------------------------------------------|
| Home `/` | `src/views/LandingPage.vue` | hero (orbit `world-panel`), institution strip, intro `principles`, **mission tabs** (JS), workflow **canvas** (JS), execution grid, science band, public/gov band, event fabric, architecture (dark band), governance, CTA panel |
| Features `/features` | `src/views/Features.vue` | `feature-hero-mosaic`, `feature-index` chips, 3 `group-title` groups of alternating `feature-block` rows w/ UI mockups (agent-config, code-window, browser-window, phone) |
| Docs `/docs` (+`/docs/:slug`) | `src/views/Docs.vue` | page-hero + `subnav`, quickstart, browse-by-area `layer-table`, guides, API/SDK. Keep existing `:slug` handling; the redesign is the shell/landing, per-slug content stays. |
| Pricing `/pricing` | `src/views/Pricing.vue` | page-hero, 4 plan tiers, compare table, metering, FAQ |
| Blog `/blog` | `src/views/Blog.vue` | page-hero, featured post, `Recent writing` list, newsletter band. Keep real post data feeding the list; static is layout only. `BlogPost.vue` (`/blog/:slug`) gets a matching article layout using `content-section` + serif headings. |

**Data-backed pages caveat:** `Blog`/`BlogPost`/`Docs` render real content (posts, doc slugs). Port the **layout/theme**, then re-wire the existing data (`v-for` over posts, slug routing) into the new markup — do **not** hard-code the static demo rows.

---

## 5. Extension pages (pages **without** a static reference)

Build these from the **same primitives** in `aadml-public.css` (`page-hero`, `content-section[.soft]`, `section-head-wide`, `group-title`, cards, `cta-panel`) so they read as one system:

| Page | View file | Suggested composition |
|------|-----------|-----------------------|
| How It Works `/how-it-works` | `src/views/HowItWorks.vue` | page-hero + `lifecycle` 5-card row (Build→Ground→Execute→Govern→Operate) + a `runtime-board`/`console` mockup + CTA. Harvest from `platform.html` / `workflow-builder.html`. |
| About `/about` | `src/views/About.vue` | page-hero (serif statement), `principles` grid (mission/values), `infra-boxes` stats, team/`gov-cards`, CTA. |
| Contact `/contact` | `src/views/Contact.vue` | page-hero + two-column: `content-section` contact form styled with `.form-line`/`.btn` + an `info-card` stack (sales / support / security). Reuse existing form submit logic if present. |

These share the rebuilt header/footer and reveal composable automatically via `PublicLayout`.

---

## 6. Fonts & assets

- Serif is `Georgia` (system) — no webfont needed. `Inter` (`--sans`) is already used app-wide; confirm it's loaded on public routes.
- Copy any real raster assets from `uploads/*.png` into `src/assets/public/` and import; most "graphics" are CSS/SVG and need nothing.
- Add `src/styles/aadml-public.css` to the build (imported by `PublicLayout` only).

---

## 7. Execution order

1. **Theme sheet** — generate `src/styles/aadml-public.css` (scoped `.aadml-public` transform of `site.css`); verify zero global/`body`/bare-`section` selectors escape the scope.
2. **Composables** — `useReveal`, `useMissionTabs`, `useWorkflowRunner` from `site.js`.
3. **`PublicLayout.vue`** — swap chrome to new header/top-note/footer; add `aadml-public` root class; keep drawer/breadcrumbs/cookie/login wiring. **Visual checkpoint:** every public page instantly reskins.
4. **Landing `/`** — port `index.html` (most complex; validates mission tabs + canvas).
5. **Features, Pricing, Docs, Blog/BlogPost** — port in that order; rewire real data for Docs/Blog.
6. **Extend** — HowItWorks, About, Contact from shared primitives.
7. **Isolation regression** — load `/dashboard/*` and confirm the app theme is unchanged (no paper background, no serif bleed, Tailwind intact).

## 8. Verification checklist

- [ ] `/dashboard` and app shell visually unchanged (theme fully isolated).
- [ ] All 8 public routes render the new theme; nav/footer links are `router-link`s (no `*.html` hrefs).
- [ ] Mobile: burger drawer, responsive breakpoints (`1100/760px` from `site.css`) behave.
- [ ] Reveal-on-scroll works and content is never left hidden (failsafe timers).
- [ ] Mission tabs + workflow "Run" animation work on Landing.
- [ ] Blog list / Docs slugs still render **real** data, not static demo rows.
- [ ] Breadcrumbs + CookieConsent still present.
- [ ] `npm run build` passes (Vitest runner is known-broken — build is the gate).
- [ ] `prefers-reduced-motion` disables animations.

---

### Open questions (confirm before/while building)
1. **"Platform" nav item** in the new design has no current route — map to `/features`, add a new `/platform` route (from `platform.html`), or drop it?
2. **Copy:** port the static demo copy verbatim for parity first, or substitute final product copy during migration?
3. **`workflow-builder.html`** — fold into Features/HowItWorks, or promote to its own route later?
