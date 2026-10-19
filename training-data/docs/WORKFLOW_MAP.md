# Phase 1 — Workflow map

Date: 2026-10-15 (Asia/Karachi)
Status: Source audit complete; runtime behavior NOT VERIFIED.
Scope: Documentation only. No backend changes, UI implementation, commits, pushes or application requests.

## Findings that affect the design

The existing app is a session-authenticated Django workflow with a substantial wall-labeling pipeline. It is not a generic Roboflow API. Most screens and form results are HTML. Several narrowly scoped JSON operations can be reused, but complete independent frontend integration is not currently evidenced.

Read the [contract matrix](API_CONTRACT_MATRIX.md), [gap report](BACKEND_GAPS.md) and [source inventory](SOURCE_INVENTORY.md) together. The inventory covers 108 route declarations and 38 templates, with exact source links. These are source observations, not test results.

## 1. Identity, workspace and project access

1. Use existing platform authentication; do not create a parallel login or use ingestion credentials for UI access.
2. GET /api/auth/me provides the authenticated user and primes the CSRF cookie in source.
3. Platform tenancy routes expose workspace listing, but the training-data workspace selection is also stored in a separate server session key. A generic workspace list is not a training-project bootstrap.
4. Project references are the creator's slug or ~<id> for another authorized member. Preserve the server-provided reference rather than deriving another user's slug.
5. No project access resolves to 404; insufficient project rights produce 403 in source.
6. A project access read can update the current-workspace session state.

Sources: [access.py](E:/agentic-system-backend/training_models_data/access.py), [views._project](E:/agentic-system-backend/training_models_data/views.py:94), [current_user](E:/agentic-system-backend/agent/auth_views.py:228), [tenancy routes](E:/agentic-system-backend/tenancy/urls.py).

| Project role | Rights in source | UX implications |
|---|---|---|
| Owner | Manage, upload, label, batch, train, view, overview | Full workflow, subject to policy and readiness |
| Data preparer | Upload, label, batch, view, overview | Can prepare/approve datasets, cannot train/manage |
| Labeller | Label, view | Assigned photos/records only; no project-wide metrics, model list or export |
| Viewer | View, overview | Read-only project overview |

Workspace rights additionally govern project/folder creation and published-model work. Data-use policy can prevent membership access even where membership rows exist. UI hiding must never replace backend authorization.

## 2. Project creation and data use

Workspace projects → New project → name/optional slug/description/kind → Data-use questions → Upload (model project) or sending/records (data-only project).

- Existing project creation is a form POST to the project-list route.
- Invalid creation re-renders the HTML form; success redirects to data-use.
- The task registry currently supports fmw_walls, exposed as instance segmentation, plus data-only projects.
- Other project-type cards are explanatory/unavailable. Do not make object detection, arbitrary classification or multimodal creation appear functional.
- Private/public and shared annotation-group controls from Roboflow do not map directly to this project's data-use/membership model.
- Data-use fields govern training, retention, viewers, AWS/own-machine use and deletion confirmation.
- Preserve these controls in a separate polished screen; visual redesign must not skip them.

Sources: [project_list](E:/agentic-system-backend/training_models_data/views.py:509), [families](E:/agentic-system-backend/training_models_data/families.py), [policy](E:/agentic-system-backend/training_models_data/policy.py), [data_use](E:/agentic-system-backend/training_models_data/views.py:2122).

## 3. Upload and labeled import

### Raw photos

Choose development/customer origin → supply licence/consent where required → choose home/group strategy → select files → upload → inspect per-file outcome → label eligible photos.

Inputs include photos[], origin, consent_source, grouping, group and group_<index>. Grouping supports one shared group, individual filenames or ZIP folder grouping; per-file overrides take precedence.

Observed source limits: 100 loose files, 15 MiB per file, 90 MiB ZIP, 300 photos per request/archive processing limit. Display server capability values when available; these are current source constants, not permanent product promises.

Results: added, already, stored (record only), rejected, skipped. Added photos can be train, val, test or unassigned. Do not collapse stored or duplicate outcomes into “successfully added to dataset.”

### Already-labeled photos

ZIP + COCO annotations → origin/consent/grouping → source/team/vendor and class mapping → optional approval by authorized preparer/owner → approved/to-approve/to-fix/kept/none/refused outcomes.

This is not Roboflow's advertised 26-format import. Do not offer unsupported video/PDF/AVIF flows as connected features.

Sources: [upload handler](E:/agentic-system-backend/training_models_data/views.py:1073), [import handler](E:/agentic-system-backend/training_models_data/views.py:1116), [bulk](E:/agentic-system-backend/training_models_data/bulk.py), [labelled_import](E:/agentic-system-backend/training_models_data/labelled_import.py).

## 4. Photo lists, batches and review

The real photo progression is:

To label → draft → done / To approve → accepted / Ready → included in a version used by a finished run / Trained on.

“No wall” must be explicitly confirmed. An accepted no-wall photo is retained but excluded from dataset versions under the current pipeline.

A Roboflow-style three-column board must retain review status inside cards or filters. Do not equate “done” with “accepted” or hide the unassigned home/group pool.

Assignments add a separate workflow: create batch → sent to labeller → returned for review → accepted, sent back or rejected. Optional second labeller and timeline exist. Batches are labeling assignments, not necessarily named upload batches.

Accepted labels and labels in returned assignments can be frozen. Reopening, sending back and taking back approval have distinct rules. Labellers only see assigned content. Comments can span an assignment and include return/send-back notes, actor identity and photo context.

Sources: [labelling](E:/agentic-system-backend/training_models_data/labelling.py), [batches](E:/agentic-system-backend/training_models_data/batches.py), [batch handlers](E:/agentic-system-backend/training_models_data/views.py:1971).

## 5. Annotation editor

Initial state is built server-side and embedded in HTML as editor-data. It includes image URL, dimensions, shapes, save URL, source model, faults, read-only/review flags and next action.

- Labels are wall/window/door; fixed COCO IDs are 1/2/3.
- Coordinates are pixels in the upright image, top-left origin; not normalized coordinates.
- Preserve corner types room/image_edge, wall/opening association, source metadata and server validation.
- Server normalizes polygon order/rounding; display returned shapes after saving.
- More or fewer than four wall corners is not automatically invalid; do not impose a new four-corner-only rule.
- Save draft and Done are different. HTTP 200 can contain refused_done=true or approved=false.
- An approver's edited drawing may become their own approved label; the original author's drawing remains separate.
- Preserve undo/redo, fit/zoom, brightness, straightening, overlay toggle, tags/comments/history and assignment navigation.
- No optimistic revision/ETag precondition was found in the inspected label-save contract; multi-tab conflict protection is not established.

### AI-assisted labeling caveat

Detect is currently coupled to opening the HTML editor with a query or saved preference. It can prepare/start a model and record a detector answer. Model-only and basic/tidied modes exist. Never prefetch these pages as harmless reads.

This is a wall-specific head start requiring human review, not an arbitrary prompt-driven class labeling service.

Sources: [photo_label](E:/agentic-system-backend/training_models_data/views.py:1314), [labels](E:/agentic-system-backend/training_models_data/labels.py), [editor.js](E:/agentic-system-backend/training_models_data/static/training_models_data/editor.js), [geometry.js](E:/agentic-system-backend/training_models_data/static/training_models_data/geometry.js).

## 6. Dataset versions and splits

Group identity deterministically assigns approximately 70/15/15 train/val/test. Existing group/split identity is preserved. Missing groups do not get an invented fallback.

Version kinds:
- smoke: development data.
- train_val: eligible customer train/validation photos.
- test: held-out customer test data.
- golden: regression photos, not training data.

Versions are immutable manifests with hashes and accepted labels. Test/golden cannot be used as training input. Do not implement Roboflow's arbitrary split slider or image transformations as if they change server datasets.

Source: [splits](E:/agentic-system-backend/training_models_data/splits.py), [datasets](E:/agentic-system-backend/training_models_data/datasets.py).

## 7. Training, models, testing and deployment

Version → eligible training configuration → run → model → evaluation → approval → deployment.

- Training uses a dataset-version identifier, registered configuration, idempotency key and runtime bound.
- Model catalog includes available and unavailable models; registry descriptions are not proof a runtime is ready.
- Evaluation compares an eligible test version and optional golden/previous model inputs.
- Try/predict supports multipart images and JSON prediction output.
- Try pages and status polling may settle or restart test-server state. Do not assume GET means no operational effects.
- Model approval, deployment, app grants and credentials are distinct privileged actions.
- Prototype includes display states only; no training, inference, deployment or credential creation is authorized by Phase 1.

## 8. Analytics semantics

Existing /analytics/ measures wall.detected/wall.confirmed event outcomes, user corrections and corner distances over 7/30/90/all-time periods. It is not a dataset-health endpoint.

Performance, evaluation and usage screens have separate meanings. Keep event analytics, evaluation metrics and proposed dataset-health charts labeled separately; do not substitute one for another.

## 9. Prototype decisions resulting from the audit

- Keep the independent Roboflow-inspired visual design.
- Add a data-use/provenance screen to the core journey.
- Represent fixed wall/window/door classes accurately.
- Keep review and dataset eligibility visible.
- Replace editable split promises with a group/split summary for connected mode.
- Mark unsupported classes, imports, transforms, NAS and active learning as future/demo.
- Build the prototype with explicit fixtures, then connect only verified compatible contracts.
- Ask before shared proxy/routing changes. Do not remove the current Django proxy.

## 10. Verification and scope record

Risk: low for this documentation-only source audit; future integration is high impact because of customer photos, permissions and writes. Data read: internal source only, no customer media or secret files.

Static reads and route/template parsing completed. Runtime/API/browser tests, auth/tenant tests, build and deployment: NOT RUN. Existing tests were located, not executed. No claim of live security enforcement or full functional parity.

Phase 2 is not started by this audit. See BACKEND_GAPS.md for integration decisions needed before Phase 4.

Documentation verification completed: all local links in PLAN.md and the four Phase 1 documents resolve; the plan retains exactly six phase headings. The route/template appendix was produced with Python AST/text parsing, without importing or executing backend modules. The frontend tracked-file diff still lists only the pre-existing src/services/chatService.js modification; this task's changes are under the new training-data folder. Git reported an unreadable user-level ignore file, so Git status is recorded with that limitation. No commit or push was performed.

