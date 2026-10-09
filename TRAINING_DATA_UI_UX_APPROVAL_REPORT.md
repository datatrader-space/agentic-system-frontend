# Training Data UI/UX Redesign — Full Approval Report

**Date:** October 8, 2026  
**Status:** Proposal for approval; no application implementation  
**Target:** `http://127.0.0.1:8765/training-data/`  
**Scope:** Frontend UI/UX only

## 1. Purpose and boundaries

Modernize the training-data experience into a professional workspace inspired by the supplied Roboflow references. The desired outcome is clear navigation, consistent typography and spacing, polished controls, media-focused layouts, useful visualization, and complete interaction states.

This document is the deliverable before any implementation. No frontend implementation or backend changes are authorized by this report itself. Future implementation must stay within frontend files and existing integration contracts. Backend code, migrations, databases, workers, training services, infrastructure, and API behavior are outside that scope.

The screenshots are design evidence, not instructions to execute their actions or copy their business model. Their sample data, commercial limits, pricing, branding, and eligibility thresholds are not requirements for our application.

## 2. Evidence and current-system limitations

All 13 supplied screenshots were reviewed: Projects, Upload, Annotate, Dataset, Versions/Preprocessing, Analytics, Classes & Tags, Training, Models, NAS, Test/Visualize, Deployments, and Active Learning.

The supplied local URL includes an incomplete suffix (`/training-data/....so`). Browser inspection was attempted at the base training-data route but timed out. Therefore:

- The current application's visual state and behavior have not been independently verified.
- The user's assessment that it looks simple and raw is the starting point.
- Existing frontend components, framework, routes, and API coverage are not confirmed.
- The backend table below describes capabilities to verify, not a claim that all are missing.

Menus, dialogs, tabs, and content below the screenshot boundary are not fully observable. Visible controls do not prove their underlying behavior.

## 3. Complete visible feature inventory

### 3.1 Shared global and project navigation

- Dark global sidebar with workspace selector and abbreviated identity.
- Agent, Projects, Asset Library, Workflows, Models, Deployments, Vision Events, and Universe links.
- Upgrade button, Activity, Settings, user identity/avatar, and Roboflow branding at the bottom.
- Sidebar-collapse affordance.
- Contextual project sidebar with workspace back link, Object Detection task label, project thumbnail placeholder, project name, and overflow menu.
- Collapsible Data, Models, and Deploy navigation groups.
- Data links: Upload Data, Annotate, Dataset with count badge, Versions, Analytics, Classes & Tags.
- Model links: Train, Models, NAS, Test.
- Deploy links: Deployments, Active Learning.
- Selected-item borders/backgrounds, icons, separators, and badges.

### 3.2 Projects / workspace

- Workspace name, plan/member metadata, profile avatar, Invite Team.
- Open Agent panel with New Chat, recent-chat item, and collapse affordance.
- Announcement banner about Neural Architecture Search with task-type links.
- Partly obscured search input, Date Edited sort dropdown, and sort-direction control.
- New Folder and New Project buttons.
- Project card with task type, title, recency, image/model metadata, and overflow menu.
- Some project-card content is obscured by the Agent panel.

### 3.3 Upload Data

- Upload Data heading.
- Batch Name field with timestamp-style default.
- Tags search/add field with help icon.
- Create batch instantly checkbox.
- Large dashed dropzone, upload icon, Select File(s), Select Folder.
- Supported-format panel: images (.jpg, .png, .bmp, .webp, .avif), annotations link advertising 26 formats, videos (.mov, .mp4), PDFs (.pdf).
- Reference image size/dimension limits and video-size limit.
- Guidance column: phone-upload QR code and explanation.
- Public dataset/image search card with input and submit arrow.
- Cloud storage integration card mentioning S3, GCS, Azure and scheduled mirroring; Set Up button.
- Another lower card has a code icon, but its label and function are cut off.

### 3.4 Annotate

- Board and Insights tabs with active underline.
- Sort by Newest.
- Roboflow Labeling and Enable Review Mode actions with lock indicators.
- New Version primary action.
- Unassigned, Annotating, Dataset columns with counts.
- Empty Unassigned state with icon, text, and Upload action.
- Job cards with title, media count, progress bar, status counts, age, assignee avatar.
- Column help and upload/view affordances.
- Annotation canvas, actual review flow, Insights content, and board drag behavior are not shown.

### 3.5 Dataset

- Dataset heading and How to Search link.
- Train Model dropdown.
- NAS eligibility/promotion banner and Train With NAS action.
- Search, Add Filter, Sort by Newest, Search by Image.
- Show Annotations toggle and list/grid switch.
- Image thumbnail with annotation overlay, truncated filename, and small status/type badge.
- Footer with per-page selection, visible item range/total, previous/next controls.
- Filter menus, media detail view, selection actions, and search-by-image results are not shown.

### 3.6 Versions / preprocessing

- Versions history column with no-versions empty state.
- Shortcut banner: training can build a version automatically.
- Create New Version heading, Uses Credits badge, descriptive text, Version Name field.
- Five-step vertical workflow: Source Images, Train/Test Split, Preprocessing, Augmentation, Create.
- Completed checkmarks, active step number, future muted steps, connecting line, Edit links.
- Source summary: images, classes, unannotated count.
- Split summary: training, validation, testing counts; blank counts are not assumed to be zero.
- Preprocessing explanation and help link.
- Auto-Orient row with Edit/remove.
- Resize row showing Stretch to 512×512 with Edit/remove.
- Add Preprocessing Step, Back, Continue.
- Augmentation options and final creation settings are not expanded.

### 3.7 Dataset Analytics

- Generated timestamp and Regenerate.
- Number of Images card with missing-annotation and null-example counts.
- Number of Annotations card with average per image and class coverage.
- Average Image Size card with minimum/maximum megapixel values.
- Median Image Ratio card with dimensions and orientation.
- Classes section: help, explanation, Tags filter, Rebalance, Download CSV.
- Class-name search, All Splits/Train/Valid/Test controls, Sort.
- Class name/count and horizontal distribution bar.
- Dimension Insights: help, explanation, Class/Tags filters.
- Dimension plot with median width/height guides and neighboring Images panel.
- Lower chart content is cut off. The large blank remainder is not evidence of additional features.
- Counts differ between screenshots; they are examples, not defaults or authoritative totals for our product.

### 3.8 Classes & Tags

- Heading and What is a class? help.
- Classes/Tags tabs with counts.
- Search classes, Add, Lock Classes checkbox, Class Ascending sort.
- Table: Color, Class Name, Count with refresh icon, Modify.
- Color swatches, names, count pills, row checkboxes and header checkbox.
- Tags contents, edit dialogs, bulk effects, and lock enforcement are not shown.

### 3.9 Train a Model

- Select Engine heading and explanatory text.
- Custom Training card with architecture selection, model size/checkpoint, and parameter guidance.
- Neural Architecture Search card with Not Available state and How It Works link.
- Warning about annotated-image eligibility and Add Annotated Images action.
- Bottom workflow bar showing Engine stage and disabled Start Training.
- Actual configuration forms, training progress, logs, and results are not shown.
- The reference eligibility threshold must not be copied as our product rule.

### 3.10 Models

- Train Model dropdown.
- Compare tab with New badge, Fine-tuned tab/count, Universe tab/count.
- Informational banner and View Fine-tuned action.
- Train → Evaluate → Compare stage indicator.
- Empty-state guidance: Start with a trained model.
- Train a Model and Upload Custom Weights actions.
- Accuracy versus median latency chart and Model Comparison badge.
- Explicit statement that the chart is an illustrative preview, not model results.
- Populated catalog and real evaluation/comparison screens are not shown.

### 3.11 Neural Architecture Search

- NAS title, large headline, supporting description.
- Credit-investment note and workflow comparison.
- Paper/publication links.
- Three explanatory cards: Try thousands of models, Designed custom for you, Best at every latency.
- Accuracy/latency scatterplot with frontier curve and architecture-count callout.
- New NAS Run button and No searches yet empty state.
- Configuration, live progress, and measured candidate results are not shown.

### 3.12 Test / Visualize

- Visualize title while Test is selected in navigation.
- Illustrated empty state: no trained models available.
- Guidance to train with latest dataset version.
- Train a Model action.
- Actual inference upload, thresholds, predictions, and results are not shown.

### 3.13 Deployments

- Developer Quick Start card.
- Current model badge plus navigation/edit affordances.
- Cloud API pricing/usage text and Learn more.
- Deployment options: Cloud API, MCP, Batch Processing, Dedicated Deployment.
- Media tabs: Images, Video, Stream with Beta badge.
- Language tabs: Python, JavaScript Fetch, HTTP/cURL.
- Scrollable syntax-highlighted code with placeholder API credential.
- Build on this Model assistant card: prompt field, Open Chat.
- Suggestions: Detect and Count objects, Track objects in a video, Customize with Workflows.
- Dependent Workflows table: refresh, View Models, Model Name, Workflow, Updated On, sort indicator.
- Actual provisioning, endpoint health, and target dialogs are not shown.

### 3.14 Active Learning

- Large production-data improvement headline and explanation.
- Cloud-deployment-only badge.
- Benefits: set conditions/limits; collect/review; train on new data; background collection.
- Configure Active Learning.
- Illustrated flow: Live Inference Data → Conditions Applied → Ready for Review → Add to Dataset and Train.
- Thumbnail grids, example class/confidence rule, detection-size rule, overflow count.
- Configuration forms, collected review queues, and retraining controls are not shown.
- Displayed conditions are examples, not approved rules.

## 4. Recommended scope and priorities

Inventorying every reference feature does not mean every feature belongs in the first release.

| Priority | Frontend deliverables | Recommendation |
|---|---|---|
| P0 | Contextual shell, upload, dataset browse, annotation entry points, classes/tags, shared states | First implementation phase |
| P1 | Annotation board, version wizard, dataset analytics | Include where aligned with current product |
| P2 | Training configuration, model catalog/comparison, test interface, deployment guidance | Later phase after contract verification |
| P3 | NAS, production active learning, mobile/cloud imports, collaboration, assistant integrations | Separate advanced scope |

Workspace billing, public marketplaces, invitations, chat agents, and workflow orchestration should not be added simply because they appear in Roboflow.

## 5. Information architecture and user journeys

Retain the existing training-data entry point and application identity. Proposed sections:

- Overview / project context
- Upload
- Annotate
- Dataset
- Versions
- Analytics
- Classes & Tags
- Approved later model/deployment modules

Use existing app navigation plus a contextual project panel. Avoid three permanent sidebar columns. Collapse project context into a drawer or section selector on smaller screens.

Primary journey: select project → upload batch → validate/import labels → annotate/review → browse dataset → inspect health → prepare version.

Training actions should reflect actual prerequisites and backend availability. Route names and component structure must be finalized after inspecting the existing frontend.

## 6. Professional visual direction

| Element | Proposal |
|---|---|
| Canvas | Light neutral #F7F8FC |
| Surfaces | White #FFFFFF with subtle borders |
| Text | Primary #172033; secondary #64748B |
| Accent | Restrained purple #6D28D9 |
| Borders | Neutral #E2E8F0 |
| Typography | Existing suitable sans-serif; 14–16px body, 24–28px page titles |
| Spacing | Consistent 4/8px rhythm, approximately 24–32px page gutters |
| Corners | Approximately 8–12px cards/overlays |
| Elevation | Subtle shadows for raised surfaces; avoid excessive depth |
| Controls | Unified heights, icon style, focus states, badges and dropdowns |

Validate color contrast before finalizing tokens. Preserve existing branding rather than copying Roboflow logos.

Use clear title/subtitle/action headers, one dominant primary action, restrained secondary buttons, and readable table density. Dataset images should receive more space than promotional banners. Illustrations should support empty states. Charts need labels, units, and honest data provenance.

## 7. Screen-by-screen frontend proposal

| Screen | Proposed layout and interactions |
|---|---|
| Overview | Project context, real counts, recent activity if supported, next-step guidance |
| Upload | Metadata header, large dropzone, file/folder selection, thumbnail queue, per-file validation/status/retry/remove |
| Annotate | Board with counts/progress and assignees when supported; accessible list alternative; editor/review entry points |
| Dataset | Search/filter toolbar, active filter chips, sort, grid/list, annotation toggle, selection, details drawer, pagination |
| Versions | History plus five-step wizard, source summary, split editor, transform cards, final review |
| Analytics | KPI cards, class chart/table, split filters, dimensions plot, selected-image panel, generated timestamp |
| Classes/tags | Searchable tables, color/name/count, add/edit dialogs, selection; locks only if enforceable |
| Training | Engine cards, actual eligibility, configuration form, summary, job state if supported |
| Models | Real catalog, comparison selector, measured metrics, supported artifact-import flow |
| Test | Model selection, sample input, prediction overlays, confidence controls and timing when available |
| Deployment | Supported targets, safe copyable snippets, placeholders for credentials, current-model context |
| Advanced | NAS and active-learning screens only within explicitly approved scope |

Upload queues, detail drawers, selection flows, and inference controls are proposed additions; they are not all directly visible in the references.

## 8. Frontend and backend responsibility

Frontend owns layout, styling, navigation, interactive controls, local drafts/validation/previews, responsive behavior, accessibility, and presentation of existing API responses.

Frontend alone cannot provide persistent uploads, saved annotations, authoritative counts, version generation, actual training/inference, cloud deployment, NAS, or production active learning.

| Feature | Backend capability to verify or build separately | Frontend behavior until available |
|---|---|---|
| Project context | List/detail, task type, counts, permissions, supported create/update | Render existing data; omit unsupported mutations |
| Uploads | Accepted formats/limits, batches/sessions, upload/processing states, errors, retry/cancel | Local selection/preview; no false saved-success state |
| Folder/label import | Manifest/path mapping, format parsing, class mapping, per-file outcomes | Preview and supported-format guidance |
| Phone/cloud imports | Authorized upload sessions, provider connections, scheduled sync jobs | Omit or clearly mark unavailable |
| Dataset browse | Pagination, totals, filters/search/sort, thumbnails/media, metadata, annotation geometry | Limited client filtering only when clearly scoped |
| Annotation/review | Persistent annotation CRUD, coordinates, conflict handling, job assignments, review decisions | Preserve existing save flow; label local drafts |
| Classes/tags | CRUD/colors/counts, assignment, rename/merge effects, lock enforcement | Forms and dialogs with defined semantics |
| Versions | Source snapshot, split policy/seed, transforms, generation job/status, output metadata | Wizard draft/summary; backend generates real output |
| Analytics | Defined aggregates, distributions, dimensions, filters, timestamp, refresh/export | Real data and honest empty/pending/stale states |
| Training | Engines, eligibility, parameters, start/status/cancel/logs, artifacts | Explain prerequisites; disable unavailable actions |
| Models | Catalog, imported-weight validation, evaluation dataset, metrics and latency methodology | Never present illustrative charts as measured results |
| Inference/test | Readiness, input/output schema, classes/geometry/confidence/timing | Render real predictions/errors |
| Deployment | Supported targets/configuration, endpoint status, authorization, dependencies | Safe documentation/snippets; no secret exposure |
| NAS | Eligibility, search jobs, candidate metrics/artifacts | Optional future module |
| Active learning | Deployment sources, rules, sampling/retention, review/promotion/retraining | Optional future module |
| Collaboration | Membership, permissions, invitations, assignment, audit events | Omit unsupported team controls |

These are logical contracts, not prescribed endpoint URLs. Classify coverage as Existing / Partial / Missing during the read-only audit. Reuse existing APIs before requesting new ones.

Long-running operations need stable IDs, meaningful queued/running/succeeded/failed states, useful errors, and supported polling/events. Media requires stable IDs, dimensions, thumbnail access, and documented annotation coordinates. Eligibility and upload limits should come from backend capabilities.

Browser transformation previews do not prove training data was transformed. Client-side CSV export can cover loaded data; full-dataset export may need backend support.

## 9. Interaction and state requirements

- Every data screen: loading, populated, empty, filtered-no-results, error/retry, permission/unavailable states where relevant.
- Upload: drag-over, selected, queued, validation failure, upload, processing, success, partial failure; retry/cancel only where supported.
- Forms: visible labels, inline validation, pending and completion states, useful errors, draft preservation.
- Dataset: distinguish image and annotation counts; retain filters/view state and avoid accidental selection loss.
- Wizard: current/completed/future steps, edit/back, prerequisites, unsaved-change handling, final review.
- Jobs: meaningful status/timestamps; progress only when real, never fabricated percentages.
- Toasts for transient feedback; persistent inline messages for failures needing action.
- Unavailable actions must explain why or be omitted.
- Approved mock previews must be explicitly labeled and isolated from production data.

## 10. Responsive and accessibility plan

Desktop: full contextual workspace and compact toolbars. Tablet: collapsed project panel and wrapping actions. Mobile: drawer navigation, stacked cards, compact filters, and usable table overflow.

Annotation editing may need a larger viewport; browsing and status views should remain usable across sizes.

Target WCAG 2.2 AA: keyboard navigation, visible focus, named icon buttons, programmatic labels/errors, dialog focus handling, contrast, non-color status cues, reduced motion, accessible chart summaries, and adequate touch targets. Provide file-picker alternatives to drag/drop and non-drag alternatives to board actions.

## 11. Implementation plan after approval

1. Read applicable repository instructions and successfully inspect actual frontend routes/screens.
2. Audit existing frontend API usage without editing backend files.
3. Confirm approved screens/phases and visual tokens.
4. Build shared frontend primitives and contextual shell using existing conventions.
5. Modernize P0 flows while preserving working behavior.
6. Add approved P1/later screens; record unmet backend capabilities.
7. Run relevant frontend checks and targeted responsive/keyboard/visual/state verification.
8. Deliver final frontend change summary and confirmed backend handoff.

No framework migration is proposed merely for visual polish. If frontend assets are served inside a backend repository, confirm their exact boundary before implementation.

## 12. Acceptance criteria

- Consistent professional hierarchy, spacing, typography, controls, and navigation.
- Existing supported workflows and API behavior preserved.
- Approved reference patterns adapted to this product without copied branding or unsupported services.
- Required loading/empty/error/unavailable and responsive states implemented.
- Real data used for metrics and charts; illustrative previews labeled.
- Accessible keyboard interactions and contrast verified.
- Backend gaps documented clearly.
- Relevant frontend checks completed; no backend implementation changes.

## 13. Risks and decisions

| Risk/uncertainty | Proposed resolution |
|---|---|
| Current UI not verified | Read-only live and source audit after report approval |
| Reference scope exceeds training-data scope | Implement approved P0/P1 first |
| Existing API coverage unknown | Existing/Partial/Missing capability matrix |
| Annotation geometry compatibility | Confirm coordinate/schema contract before overlays/editor changes |
| Large datasets | Use existing server pagination and thumbnail patterns |
| Mock UI mistaken for functionality | Explicit preview labeling; no fabricated success |
| Reference business rules copied accidentally | Use product/backend capability definitions |

## 14. Approval checklist

- [ ] Approve P0 scope.
- [ ] Select which P1 screens to include.
- [ ] Decide whether P2/P3 belong to this request or future work.
- [ ] Approve light workspace, restrained purple accent, and contextual navigation direction.
- [ ] Choose whether unsupported features are omitted or clearly labeled previews.
- [ ] Confirm frontend-only implementation with separate backend handoff.

**Recommended decision:** Approve P0 plus relevant P1 screens. Keep advanced model/deployment/NAS/active-learning services as separate scope until capabilities are verified.

Approval of this report is required before application implementation. No frontend or backend application code has been changed.

