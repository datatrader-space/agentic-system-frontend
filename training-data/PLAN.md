# Training Data — Isolated UI/UX Prototype and Integration Plan

## Current owner direction ? Phase 4 started (2026-10-15)

Supersedes historical status and theme restrictions below: owner requested the AADML palette/fonts and then explicitly said "ok start phase 4". The prototype remains isolated; shared AADML files and backend remain untouched. Phase 4 is IN PROGRESS, not complete. Session-read integration is implemented, but local backend availability and structured training-data read contracts block connected core workflows. See docs/PHASE_4_STATUS.md. No commit, push or deployment is authorized.


Date: 2026-10-15 (Asia/Karachi)
Status: Phase 1 complete. Phase 2 prototype ready for review and NOT APPROVED. Backend integration has not started.
Owner/reviewer: Sajid
Current deliverables: This plan, the Phase 1 audit, and the independent Phase 2 clickable prototype.

## Phase status

- **Phase 1 complete — source audit:** [Workflow map](docs/WORKFLOW_MAP.md), [API contract matrix](docs/API_CONTRACT_MATRIX.md), [backend gaps](docs/BACKEND_GAPS.md), [source inventory](docs/SOURCE_INVENTORY.md).
- **Phase 2 READY FOR REVIEW, NOT APPROVED:** [Run instructions](README.md), [verification](docs/PHASE_2_VERIFICATION.md). Preview: http://127.0.0.1:5174/training-data/.
- **Phases 3?6 not started.** Backend integration has not started.
- Full standalone integration is not yet established: many workflows return HTML and need the contract decisions documented in the gap report. The isolated prototype can proceed separately.

## Owner clarification - supersedes the earlier phase split

Phase 2 must deliver the complete clickable prototype, including screens, forms, choices, hover panels, dialogs and transitions. The initial foundation was insufficient and is not approved. Backend gaps do not block frontend prototype features: label them "Backend not supported yet" and use local sample behavior. No later phase or live integration begins before explicit prototype approval.

Work step by step. [Current step review](docs/PHASE_2_STEP_REVIEW.md): The full review package is in [SCREEN_REVIEW.md](docs/SCREEN_REVIEW.md), with implemented flows, honest limitations, screenshots and checks. Earlier sections assigning full screens only to Phase 3 are superseded by this clarification.

## Mandatory rules — owner instruction

These rules apply to every phase of this training-data task:

1. **Frontend only:** Build the UI/UX in `E:\agentic-system-frontend\training-data\` and connect it to the existing backend.
2. **Never modify backend code:** Backend files may be read to understand behavior and contracts, but must never be created, edited, moved or deleted. This includes Django templates, views, URLs, models, serializers, static assets, settings and migrations. Do not change backend services, databases or infrastructure.
3. **Never commit or push:** Do not create Git commits or push code at any stage of this task. Leave changes local for the owner to review.
4. **Existing backend integration only:** Reuse existing endpoints, authentication, permissions, CSRF protections and request/response contracts. Do not create or modify backend APIs to make the frontend work.
5. **Report integration gaps:** If a feature cannot work with the existing backend, document the exact missing capability and ask the owner how to proceed. Do not implement a backend workaround or present mock behavior as connected functionality.
6. **Keep AADML separate:** Do not change the agentic dashboard, reuse its theme, or mix the new workspace into its UI. Ask before any required shared frontend routing or configuration change outside the dedicated folder.

These boundaries remain in force after prototype approval and throughout integration and verification.

## 1. Goal

Create a professional Roboflow-inspired training-data workspace inside a dedicated folder:

`E:\agentic-system-frontend\training-data\`

Use the supplied references for layout, navigation, typography, spacing, upload flows, project creation, model browsing, annotation and review. Give this workspace its own visual identity and browser entry point. Do not inherit the AADML agentic dashboard theme, shell, navigation or global styles.

First deliver a clickable prototype and screen previews for approval. Integrate approved screens with existing backend capabilities afterward.

## 2. Fixed boundaries

- Never commit or push changes for this task.
- Do not edit backend code, templates, static assets, configuration, database or infrastructure.
- Do not remove the Django templates.
- Do not modify or mix in the AADML agentic dashboard, its theme or components.
- Put new prototype/application files under the dedicated frontend training-data folder.
- Ask Sajid before any necessary change outside that folder, including shared routing, Vite configuration, package manifests or build configuration.
- Do not start training, paid inference, deployment, invitations, destructive operations or production mutations during prototype review.
- Use synthetic demonstration data for previews. Clearly distinguish it from connected data.
- Keep existing user modifications intact.
- Do not introduce an external hosting service or send customer photos to design/AI tools.

## 3. Inspection findings

Read-only inspection on 2026-10-15 covered the frontend instructions, package manifest, Vite configuration, training-data URL definitions, selected templates, selected view response locations, and frontend working-tree status.

### Frontend

- Existing stack: Vue 3, Vite 5, Vue Router, Pinia and Axios.
- Existing dependencies include Lucide icons, Chart.js and Vue testing utilities.
- The repository contains src, public and AADML_Agentic_UIUX.
- An existing src/views/TrainingDataPage.vue concerns training consent/corpus access; do not repurpose it as this independent vision workspace.
- Vite currently proxies /training-data to Django, using VITE_API_TARGET or a localhost:8001 default.
- Vite also proxies /api, /media and /static.
- Therefore adding a folder alone will not replace the current localhost:5173/training-data/ response.
- Existing modification observed: src/services/chatService.js. Leave it untouched.
- No dependency install, server restart, build or application mutation was performed.

### Django reference

Reference directory:
`E:\agentic-system-backend\training_models_data\templates\training_models_data\`

Discovered templates cover projects, home, upload/import, project details, label editor, batches, review, datasets, analytics, models, training runs, evaluation, inference testing, performance, deployment, usage, members, notifications, records and data-use controls.

Observed behavior in selected templates:

- Projects are role-scoped; folders arrange projects without granting access.
- Upload accepts JPEG/PNG/WebP and ZIP with server-provided limits.
- Upload distinguishes development images from customer photos.
- Development images require licence/consent information.
- Home/group identification affects dataset membership and split allocation.
- Customer photos without a home ID may be retained in an unassigned pool instead of training.
- Data-use refusal can keep uploads as records only.
- Upload outcomes distinguish added, already present, stored, skipped and rejected.
- The label editor supports undo/redo, corner types, straightening, deletion, overlay visibility, zoom/fit, brightness and assignment navigation.
- Editor bootstrap data is embedded through Django json_script.
- Templates use role/capability checks and CSRF-protected forms.

### Integration evidence

training_models_data/urls.py defines:

- /training-data/ UI routes with session authentication.
- /api/training-data/v1/ records ingestion and project/environment prediction routes.
- UI endpoints for labels, batches, uploads, datasets, runs, evaluation, models and deployment.

Selected view locations show JSON responses for label submission/review and prediction/status, plus dataset manifests and evaluation reports. This does not establish a complete JSON API for the new SPA.

A route existing is not proof it is directly usable by a standalone frontend. Full request/response schemas, bootstrap reads, authentication and failure behavior still require audit.

### Not verified

- Live local browser rendering and current server availability.
- Full template/static-script inventory and all request contracts.
- Server-side authorization/tenant enforcement through tests.
- End-to-end integration or complete JSON read coverage.

## 4. Separate entry point and routing decision

### Prototype approach

Create an independent Vue entry, HTML document, styles and local fixture data under training-data. Reuse installed framework packages without importing the dashboard application.

Prefer a standalone local preview configuration contained in training-data, on an available loopback port selected after checking conflicts. It must not stop or alter the running AADML server. Confirm the actual preview URL when implementation begins.

Do not promise that localhost:5173/training-data/ can serve the prototype without changing the current proxy.

### Later requested URL

Serving the approved frontend at localhost:5173/training-data/ will require an explicit routing decision because that prefix currently belongs to Django.

Before changing anything shared:

1. Show Sajid the smallest proposed routing/configuration diff.
2. Explain how legacy Django page/form endpoints will remain reachable.
3. Obtain approval for files outside training-data.
4. Verify both the new workspace and AADML routes after the change.

If approval is withheld, keep the independent preview address. Never silently remove the existing proxy or break legacy form endpoints.

## 5. Proposed folder structure

All names below are proposed; only PLAN.md is created in this task.

```text
training-data/
  PLAN.md
  index.html
  vite.config.js
  src/
    main.js
    TrainingDataApp.vue
    router.js
    styles/
      tokens.css
      workspace.css
    components/
      navigation/
      forms/
      data-display/
      annotation/
      feedback/
    screens/
      Workspace.vue
      CreateProject.vue
      Upload.vue
      AnnotationBoard.vue
      AutoLabel.vue
      AnnotationEditor.vue
      Dataset.vue
      Versions.vue
      Analytics.vue
      ClassesTags.vue
      Models.vue
      Training.vue
      TestModel.vue
      Deployment.vue
    services/
      trainingDataClient.js
      adapters/
    fixtures/
    assets/
  tests/
  docs/
    SCREEN_REVIEW.md
    API_CONTRACT_MATRIX.md
    BACKEND_GAPS.md
    VERIFICATION.md
  previews/
```

Keep the HTML entry independent from src/main.js and the dashboard router. Prefer scoped component styles and training-data-specific tokens. Any document-wide reset applies only inside this standalone document.

## 6. Prototype screen plan

| Screen | Design and prototype interactions |
|---|---|
| Workspace/projects | Dark compact rail, workspace header, project search/type/sort, folder controls, private-project cards, image/model metadata and overflow menus |
| Create project | Dedicated form, name validation, task-type choices and explanation/preview; privacy/sharing options only as supported or explicitly marked preview |
| Upload: empty | Batch metadata, tags, spacious dropzone, file/folder picker, format guidance, relevant help panel |
| Upload: selected | Thumbnail queue, All/Annotated/Not Annotated tabs, selection/removal, validation, Save and Continue prototype action |
| Upload: provenance | Modern presentation of existing origin, consent/licence, home/group and eligibility requirements; retain server semantics |
| Annotation board | Unassigned/Annotating/Dataset columns, counts, batch progress, empty states, sorting and review entry |
| Auto Label | Class/prompt editor, preview selection, model picker, preview/results region and manual/team alternatives |
| Annotation editor | Large photo canvas, left labels/layers panel, tools, right review/thumbnail rail, zoom/fit, brightness, undo/redo, comments/tags and clear save status |
| Dataset | Search/filter chips, grid/list, annotation toggle, image details, selection and pagination |
| Versions | History, source summary, split explanation, preprocessing/augmentation configuration preview and review step |
| Analytics | Realistic synthetic KPI states, class distributions, dimension insights and filters, clearly labeled sample data |
| Classes & Tags | Searchable tables, colors, counts, add/edit dialogs and tags |
| Models | My Models/catalog tabs, empty state, task filter, model cards and supported variants |
| Training/Test | Engine/configuration preview, prerequisite states, job/result designs and inference input/output layout |
| Deployment | Model/environment summary, safe example snippets and status layout; prototype actions never deploy |

The editor must retain domain-specific wall-label behavior. Roboflow's generic segmentation controls must not erase corner types, straightening, review rules or project-specific geometry semantics.

A simplified five-step version wizard must not imply that users can freely reassign splits when existing grouping rules prohibit leakage between train/validation/test.

## 7. Additional reference elements and scope

The newer references add:

- Agent landing with composer, suggestion chips, example cards and recent conversations.
- Expanded model catalog with model/variant choices.
- Auto-label model selection and class descriptions.
- Detailed full-screen annotation and review workspace.
- Uploaded-image preview tabs and similar-image suggestions.
- Full project creation with task types and privacy choices.

Agent landing, public catalog services, similar-image search, cloud import, QR upload, NAS and active learning can be represented in a screen index as proposed later features. Do not claim these services exist or copy reference model/provider availability into connected screens.

The first review should prioritize projects → create → upload → annotation board → auto-label/manual editor → dataset, with model and analytics screens showing the same design system.

## 8. Visual system

- Compact dark global rail, optional light project sidebar, white content surface.
- Restrained violet primary accent and pale violet selected states.
- Clear headings, 14–16px body text, consistent labels and muted helper text.
- Unified 4/8px spacing rhythm, thin borders, subtle elevation and restrained radii.
- Dense useful controls around media, generous whitespace around forms.
- Consistent icon family and visible focus/hover/disabled states.
- Avoid dashboard CSS imports, dashboard-specific gradients, shared sidebar components or global stores.
- Preserve the application's identity without copying Roboflow logos.
- Design desktop first, then tablet navigation collapse and mobile browsing/upload states.

Deliver a screen index and captured desktop previews. Include narrow-screen samples and representative empty/error/selected states. Prototype controls should navigate, validate or visibly update local state rather than being decorative.

## 9. Phases and approval checkpoints

The work follows these six phases in order. Updating this plan does not mark any phase complete or authorize implementation by itself.

### Phase 1 — Understand existing workflows

- Read the remaining relevant Django templates, referenced static scripts and targeted request handlers without changing backend files.
- Map projects, uploads, labels, review, datasets, models and their permissions.
- Record each operation's method, path, input, response type, authentication/CSRF requirements, errors and source evidence.
- Identify existing, partial and missing frontend integration contracts. Do not invoke backend writes during the audit.

**Deliverables:** Workflow map, API_CONTRACT_MATRIX.md and BACKEND_GAPS.md.

### Phase 2 — Build the independent UI foundation

- Create the standalone training-data entry point and application shell inside the dedicated folder.
- Build navigation, typography, colors, buttons, forms, feedback components and responsive layouts inspired by Roboflow.
- Keep styles, routing and application state separate from the AADML agentic dashboard.
- Provide a separate local browser preview without changing the current shared routing or stopping the dashboard server.

**Deliverable:** Independent browser preview with the workspace layout and reusable UI components.

### Phase 3 — Build clickable prototype screens

- Build Projects, Create Project, Upload, Annotation Board, Auto Label, Annotation Editor, Dataset, Classes & Tags, Versions, Analytics, Models, Training/Test and Deployment screens.
- Connect the prototype's navigation and local interactions using clearly labeled synthetic data.
- Include empty, loading, validation, error, selected and success-preview states.
- Keep save, approve, train and deploy prototype actions local; they must not trigger backend operations.
- Capture desktop and representative narrow-screen previews.

**Deliverables:** Clickable prototype, screenshots and SCREEN_REVIEW.md.

**Approval checkpoint:** Sajid approves the screens and interactions after Phase 3, before live backend integration.

### Phase 4 — Connect data and annotation workflows

- Connect supported project, upload, dataset, labeling, review and class/tag features through the isolated frontend client adapter.
- Start with authorized reads, then approved local test writes using synthetic fixtures.
- Preserve existing consent, home/group allocation, dataset split rules, permissions, authentication, CSRF and validation.
- Verify label geometry and save/reload behavior, including errors and read-only states.
- Document any unsupported feature and ask Sajid how to proceed before continuing that feature.

**Deliverables:** Working core workflows using existing backend contracts and an updated backend-gap report.

Do not use project ingestion keys as a substitute for session-based UI access. Do not scrape rendered HTML as an undocumented long-term data API.

### Phase 5 — Connect remaining supported workflows

- Connect versions, analytics, training status, models, testing and deployment information wherever existing contracts support them.
- Use real results and status values; clearly explain unavailable capabilities.
- Keep consequential training, paid inference and deployment operations subject to the owner's explicit approval; connecting a screen does not authorize running them.
- Report missing backend capabilities without creating or changing backend APIs.

**Deliverables:** Connected approved screens, clear unavailable states and a complete integration-gap handoff.

### Phase 6 — Verify and finalize access

- Run relevant frontend tests, a standalone build and targeted browser checks.
- Check responsive layouts, keyboard access, navigation, failures, save behavior, annotation accuracy and permissions using approved test fixtures.
- Verify that the AADML dashboard remains isolated and its existing behavior is preserved.
- Review the smallest concrete routing/configuration diff needed for localhost:5173/training-data/ with Sajid before changing any shared file.
- If that routing change is approved, verify the requested URL and continued access to the legacy Django UI. Otherwise retain the independent preview URL.

**Deliverables:** Verified frontend, final screenshots, VERIFICATION.md and remaining-gap report. Mark any unexecuted or blocked checks explicitly.

**Approval checkpoint:** Any shared frontend routing/configuration change requires approval before execution.

**Rules for all six phases:** No backend edits, commits, pushes, AADML dashboard changes, production deployment or Django template removal. If existing backend contracts cannot support a feature, document the gap and ask Sajid before proceeding with that feature.

## 10. API integration matrix to complete

| Area | Evidence already observed | Required audit |
|---|---|---|
| Projects/workspaces | Session UI routes and role-aware templates | JSON bootstrap/list/detail availability, pagination and permission representation |
| Upload/import | Multipart form and provenance/group inputs | Response format, CSRF, file limits, per-file mapping and errors |
| Labels | Embedded editor JSON and JSON submission responses | Safe bootstrap read, geometry schema, read-only rules, conflict/review handling |
| Board/batches | Assignment and review routes | List/status payloads and allowed transition mapping |
| Dataset/versions | Publish/detail/manifest routes | SPA list metadata, generation states and split constraints |
| Analytics | Analytics template/route | Aggregate JSON availability and definitions |
| Models/training | Run/model/evaluation routes | Lists, configuration, readiness, progress and response formats |
| Inference | Status/predict JSON response locations | Session permissions, input/output and startup cost controls |
| Deployment | Existing privileged UI actions | Display-only data contract; operational actions excluded from prototype |

Mark each feature Existing, Partial or Missing only with source evidence. Missing JSON reads, session bootstrap or compatible responses are backend handoff items, not permission to edit the backend.

For every gap document: desired UI behavior, existing route, exact missing contract, proposed payload, permission/tenant expectations, blocked frontend behavior, and decision needed from Sajid.

## 11. Security, privacy and reliability assessment

Current documentation task: low impact; internal engineering information only.

Prototype: low impact if isolated and synthetic. Integration: high impact under repository policy because it handles customer photos, session permissions and state-changing workflows.

Threats and planned controls:

| Scenario | Planned control/check |
|---|---|
| Dashboard styling or routing regression | Independent document/root/styles; shared-file edits only after approval; dashboard smoke checks |
| Cross-project/tenant photo access | Preserve server authorization; approved positive/negative test fixtures before integration readiness |
| CSRF/session regression | Preserve current protected request contract; no disabled checks or ad-hoc credentials |
| Loss of consent/group rules | Carry existing provenance fields and refuse unsupported split behavior |
| Labels corrupted through coordinates/zoom | Geometry round-trip and display-transform tests; server remains authoritative |
| Unsaved edits or concurrent writes | Dirty state, clear save status, preserve existing conflict handling; document missing capability |
| Customer images exposed in previews | Synthetic assets; no external processing/upload |
| Keys or sensitive data in browser/logs | No privileged credentials in bundle; redact errors; do not copy environment secrets |
| Accidental training/deployment/cost | No operational calls in prototype; explicit owner approval for consequential tests |

Controls observed in templates are not proof of server enforcement. Record tests as NOT RUN until executed. Do not claim SOC 2 compliance.

## 12. Planned verification and acceptance

Prototype acceptance:

- Separate workspace visually matches the approved Roboflow-inspired direction.
- Core journey is clickable; screens include loading, empty, validation, error and success preview states.
- No dashboard dependencies, global style leakage or backend mutations.
- Sample data and unavailable operations are clearly labeled.
- Keyboard navigation, focus, labeled icon buttons, dialog behavior and readable contrast work.

Integration acceptance:

- Verified supported reads/writes use existing contracts and real results.
- Upload consent/grouping and dataset split safeguards remain intact.
- Annotation geometry survives save/reload without shifts.
- Failed saves do not discard edits or show false success.
- Unauthorized and cross-project requests fail as expected in approved tests.
- Existing dashboard and Django routes remain usable.
- Missing backend capabilities are documented.

Checks: relevant Vue/Vitest tests, standalone build, browser interaction checks, responsive screenshots, request inspection without sensitive logging, targeted auth/tenant/misuse tests where integration is involved, and final diff review.

Build/test scripts may need to live under training-data to avoid writing the dashboard dist output. Do not modify root scripts or install dependencies without asking first.

Current application tests, builds, browser checks and security tests: **NOT RUN — planning-only task.**

## 13. Rollback and release boundary

During prototype work, rollback means stop the dedicated preview and revert only the newly introduced training-data changes after checking for user edits. No shared app or backend restoration should be necessary.

If a later route change is approved, record its exact diff and restore that change alone if checks fail. Do not use broad git reset/clean commands or overwrite unrelated work.

No production release is planned. Django template removal requires a separate decision after functional parity and verification.

## 14. Deliverables

1. This PLAN.md.
2. Read-only workflow and API contract inventory.
3. Independent clickable prototype and screenshot set.
4. Screen review checklist and documented approval.
5. Approved UI connected to supported existing backend endpoints.
6. Backend gap handoff.
7. Verification results and limitations.

## 15. Decisions before implementation advances

- Approve this plan and core prototype screen set.
- Review the independent preview URL once a free port is confirmed.
- Approve screen designs before real integration.
- Approve any necessary shared routing/configuration diff separately.
- Resolve backend gaps through separate backend ownership; this task stays frontend-only.

No implementation approval, design approval or routing approval is inferred from the creation of this document.

