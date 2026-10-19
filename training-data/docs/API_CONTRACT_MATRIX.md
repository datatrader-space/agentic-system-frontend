# Phase 1 — Existing backend contract matrix

Date: 2026-10-15. Source-verified only; requests NOT RUN.
Backend root: E:/agentic-system-backend.
See [route-level appendix](SOURCE_INVENTORY.md) for all 108 declarations, handler links and directly read input fields.

## Interpretation

- **Existing:** compatible operation/response is implemented in inspected source; runtime unverified.
- **Partial:** workflow exists but standalone UI lacks a structured read/bootstrap or mutation outcome.
- **Missing:** required generic feature/contract was not found in the audited training-data routes and relevant handlers; not a statement about every service in the company.

P = /training-data/<project-ref>/, where project-ref is owner slug or ~<id>.
W = /training-data/-/.
Every P endpoint uses session login plus project/object authorization unless expressly identified as a separate bearer API.
Unsafe session requests preserve CSRF. HTML errors/login redirects are possible even for endpoints whose normal success response is JSON.

## Common transport requirements

- Existing platform GET /api/auth/me returns {user: ...}; ensure_csrf_cookie primes the token. This supplies identity, not training project capabilities.
- Existing editor sends credentials: same-origin and X-CSRFToken, reading csrftoken or a rendered form token.
- Multipart forms send csrfmiddlewaretoken. Preserve fields and existing server constraints.
- Use the same browser host consistently; localhost and 127.0.0.1 are different cookie hosts.
- Standalone-port proxy/session behavior must be verified before integration; no CORS/CSRF relaxation is permitted.
- Inspect content type, redirect and status before parsing JSON. A redirect to a login/HTML page is not success.
- Do not add bearer credentials to session routes as a workaround.
- SessionCookieCsrfMiddleware is configured in config/settings.py; enforcement is observed in source, not tested here.
- Existing /training-data prefix is proxied wholesale to Django in frontend vite.config.js.

Sources: [auth](E:/agentic-system-backend/agent/auth_views.py:228), [middleware](E:/agentic-system-backend/agent/middleware/csrf.py), [mounts](E:/agentic-system-backend/config/urls.py:114), [Vite](E:/agentic-system-frontend/vite.config.js).

## Core workflows

| Operation | Method/path and inputs | Response / failure behavior | Access | Status |
|---|---|---|---|---|
| Current user/CSRF | GET /api/auth/me | JSON user; authenticated endpoint | Platform session | Existing |
| Workspace options | GET /api/v2/workspaces/ and default-workspace route | Platform workspace contract exists; detailed serializer not audited here | Platform auth | Partial: not TMD bootstrap |
| Select workspace | POST Wworkspace/switch/; workspace_id | Redirect; session selection | Membership | Partial |
| Projects | GET /training-data/; q, sort; folder route optional | HTML cards/context | Role-scoped visible projects | Partial |
| Create project | POST /training-data/; name, slug, description, kind | Success redirect to data-use; invalid form HTML | may_make | Partial |
| Project overview | GET P; record filters/page, photo list/photos_page, tag and other handler fields in appendix | HTML context incl counts, photos, batches, versions/runs/models by rights | VIEW, additional OVERVIEW for whole-project sections | Partial |
| Data use | GET/POST Pdata-use/; training, retention, viewers, allow_aws, allow_own_machine, deletion_rule_confirmed | HTML or redirect; versioned policy answers | MANAGE | Partial |
| Upload | GET/POST Pupload/; multipart photos[], origin, consent_source, grouping, group, group_<index> | HTML result with added/already/stored/rejected/skipped counts, sides and reasons | UPLOAD | Partial |
| Labeled import | GET/POST Pimport/; archive, origin, consent_source, source, grouping, group, class_wall, class_window, class_door (comma-separated names), approve | HTML per-photo/per-label outcomes; invalid archive/policy reported | UPLOAD + LABEL; BATCH for approval | Partial |
| Take in records | POST Pphotos/take-in/ | Redirect/messages | BATCH | Partial |
| Photo bytes | GET Pphotos/<uuid>/file/ | FileResponse; 404 when inaccessible/missing; private cache, nosniff | VIEW + visible photo scope | Existing, IDs/bootstrap required |
| Editor initial state | GET Pphotos/<uuid>/label/; optional start/review/detect | HTML with editor-data JSON, tags/comments/history; may trigger detection | LABEL + object scope; BATCH to review | Partial |
| Save/Done | POST same label route; JSON described below | JSON with semantic failure flags; 400 malformed, 409 frozen; auth can be HTML | LABEL | Existing write; missing independent bootstrap |
| Approve in editor | POST same label route; action=approve, review, shapes, nothing_to_mark | JSON approved/corrected/next; 400/404/409 or approved=false | LABEL + BATCH | Existing write; missing independent bootstrap |
| Next label/review | GET Pphotos/label/ or Pphotos/approve/next/ | Redirect to editor or project; not JSON queue | LABEL / BATCH | Partial |
| Bulk approve | POST Pphotos/approve/; label[] | Redirect/messages incl partial refusals | BATCH | Partial |
| Send back/take back | POST Plabels/<uuid>/send-back/ or take-back/ | Redirect/messages; send-back reason | BATCH | Partial |
| Add/remove tag | POST Pphotos/<uuid>/tags/; add, remove, next | Redirect to editor/tags; normalized short tag, max 20 | LABEL + photo scope | Partial |
| Comment | POST Pphotos/<uuid>/comments/; text | Redirect; empty rejected; text limited to 4000 | LABEL + photo scope | Partial |
| Batch create | POST Pbatches/new/; labeller, second_labeller, size, instructions | Redirect to assignment or first image; refusal messages | BATCH | Partial |
| Batch read/timeline | GET Pbatches/<number>/ and timeline/ | HTML progress/history | VIEW and batch access | Partial |
| Batch transition | POST return/accept/send-back/reject/reassign/reopen routes | Redirect/messages; state/role checks | LABEL or BATCH plus ownership/state | Partial |
| Classes | No generic class CRUD route found | Fixed wall/window/door categories in labels.py | Domain schema | Missing generic class CRUD |

Exact helpers and literal fields for ancillary folders, record assignment, invitations, settings and deletion are in SOURCE_INVENTORY.md. Those operations are not automatically approved for execution.

## Label save contract

Request to Pphotos/<uuid>/label/:

```json
{
  "shapes": [
    {"kind": "wall", "points": [[10, 10], [200, 10], [200, 150], [10, 150]],
     "corner_types": ["room", "room", "room", "room"]}
  ],
  "action": "save",
  "started_from": "from_scratch",
  "started_model": ""
}
```

Synthetic shape example only. Coordinates are upright-image pixels, not normalized fractions. kind is wall/window/door. Window/door use points; server associates openings with walls. Preserve server normalization rather than asserting a client-specific polygon order.

- action=save stores draft; action=done requests completion.
- nothing_to_mark=true is needed to finish an intentionally empty label.
- started_from accepts from_scratch/from_ai/from_correction; started_model carries the selected detector source.
- Normal response: ok, state, faults, shapes, refused_done, nothing_marked, message, document.
- ok=true does not imply Done succeeded. Examine state and refused_done.
- Frozen accepted/returned labels return 409.
- No base revision/If-Match precondition found in this handler; avoid claiming multi-client conflict protection.
- Current editor auto-saves and attempts a pagehide keepalive save. A new client should preserve dirty state on failure and must not assume unload delivery is guaranteed.

Approve request uses action=approve, review=<label UUID>, shapes, nothing_to_mark.
Success response: ok=true, approved=true, corrected, faults, label, message, next.
Validation can return HTTP 200 with approved=false; malformed/missing/frozen cases use 400/404/409.
Approve edits are not normal autosaves.

Sources: [save handler](E:/agentic-system-backend/training_models_data/views.py:1314), [approve helper](E:/agentic-system-backend/training_models_data/views.py:1670), [shape schema](E:/agentic-system-backend/training_models_data/labels.py:380), [client](E:/agentic-system-backend/training_models_data/static/training_models_data/editor.js:549).

## Versions, training and models

| Operation | Contract | Response/access | Status |
|---|---|---|---|
| Publish version | POST Pdatasets/publish/; kind=smoke/train_val/test/golden | Redirect/messages; BATCH plus policy | Partial |
| Version details | GET Pdatasets/<name>/ | HTML; OVERVIEW | Partial |
| Manifest | GET Pdatasets/<name>/manifest.json | JSON attachment; integrity/storage failure text/plain 409; OVERVIEW | Existing |
| Start run | POST Pruns/start/; dataset_version, config, key, max_runtime | Redirect/messages; TRAIN + policy | Partial |
| Run view | GET Pruns/<number>/ | HTML, may reconcile status; OVERVIEW | Partial |
| Run cancel/retry | POST corresponding run action | Redirect/messages; TRAIN/state checks | Partial |
| Run log | GET Pruns/<number>/attempts/<attempt>/log.txt | Log download; OVERVIEW | Existing download, not JSON status |
| Workspace models | GET Wmodels/ | HTML trained/catalog/readiness context | Partial |
| Reject/restore/check model | POST Pmodels/<number>/<action>/; reason where needed | Redirect/messages; TRAIN and state checks | Partial |
| Evaluate | GET/POST Pmodels/<number>/evaluate/; test_version, golden_version, previous, key, max_runtime | HTML/redirect; TRAIN | Partial |
| Evaluation details | GET Pevaluations/<number>/ | HTML; OVERVIEW | Partial |
| Evaluation report | GET Pevaluations/<number>/report.json | JSON attachment; 404 if absent/unreadable; OVERVIEW | Existing |
| Performance | GET Pperformance/ | HTML; OVERVIEW | Partial |
| Event analytics | GET Panalytics/?days=7/30/90/0 | HTML event-derived report; OVERVIEW | Partial, not dataset-health JSON |
| Usage | GET Pusage/?days=... | HTML; OVERVIEW | Partial |

Manifest fields observed: schema=aadml.dataset-manifest.v1, kind, annotation_schema, guideline_version, photos, split_counts, coco, files (hashes, storage keys, dimensions, group/split/origin, label references). Storage keys are not browser URLs; do not expose/derive bucket access from them.

## Testing and operational endpoints

| Operation | Contract | Caveat/status |
|---|---|---|
| Trained-model try page | GET Pmodels/<number>/try/ | HTML; TRAIN; can settle/restart server state |
| Try status | GET Pmodels/<number>/try/status/ | JSON {phase, waiting}; TRAIN; also calls state reconciliation |
| Try start/stop | POST Pmodels/<number>/try/start/ or stop/ | Redirect/messages; operational action, not authorized now |
| Try predict | POST Pmodels/<number>/try/predict/; multipart file plus CSRF | JSON prediction; TRAIN; 409 unavailable or PredictError status |
| Published-model try/status/start/stop/predict | Wmodels/<key>/try/... | Similar shape; workspace may_make gate; can prepare/start runtime |
| Model approval/revoke | POST model approve / approval revoke routes | Redirect/messages; TRAIN; privileged, excluded from current execution |
| Deploy/cancel/rollback | POST Pdeployments/<environment>/<action>/ | Redirect/messages; model/reason fields per appendix; TRAIN/approval rules |
| App credentials/grants | POST Papps/... | Redirect/one-time session disclosure; privileged, do not request for frontend integration |

Prediction fields used by existing try.js: image.width/height, walls[].corners/confidence/below_threshold, openings[].type/polygon/confidence, status, timing_ms.model/total, warnings. Status examples: success, low_confidence, no_detection. Original chosen image is displayed locally; runtime behavior is not tested.

Source: [try.js](E:/agentic-system-backend/training_models_data/static/training_models_data/try.js), [model state](E:/agentic-system-backend/training_models_data/views.py:2574), [published state](E:/agentic-system-backend/training_models_data/views.py:280).

## Separate machine-facing APIs — do not use as session UI substitutes

| Endpoint | Credential/input | Response |
|---|---|---|
| POST /api/training-data/v1/records/ | Project bearer key; JSON payload or multipart payload/file; optional Idempotency-Key | accepted+id 201 or duplicate+id 200; 401 key errors, 429 with Retry-After, parser/domain errors |
| POST /api/training-data/v1/projects/<id>/environments/<staging-or-production>/predict | Connected-app bearer credential; multipart file and optional payload | Prediction document or error/field; credential/grant/rate-limit controls |
| POST /api/partner/wall-marking/events/ | Existing partner compatibility route | Separate ingestion contract, outside new UI integration |

No privileged project/app/partner keys belong in browser fixtures, source or bundles.

## Integration checklist before Phase 4

- [ ] Confirm live session and CSRF behavior through approved non-operational requests.
- [ ] Resolve project/photo/bootstrap JSON gaps without HTML scraping.
- [ ] Confirm local proxy host/origin/cookie behavior without shared-file changes unless approved.
- [ ] Obtain synthetic IDs and authorized roles for positive/negative tests.
- [ ] Verify schema/content-type/error handling per connected operation.
- [ ] Test forbidden object access, expired login, missing CSRF and failed saves.
- [ ] Do not poll try/model/editor GET routes until their operational effects are approved.
- [ ] Record actual tests/results and unresolved gaps.

