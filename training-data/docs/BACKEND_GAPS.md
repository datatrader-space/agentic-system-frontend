# Phase 1 — Backend integration gaps and decisions

Date: 2026-10-15. Scope: handoff only; no backend implementation authorized.

## Conclusion

Phases 2–3 can build the isolated prototype with synthetic data. Complete independent SPA integration in Phases 4–5 is blocked for several workflows by HTML-only contracts and missing generic features. Existing server functionality is substantial, but it is not equivalent to a complete frontend-facing JSON API.

Do not claim the UI can be fully connected merely because form routes exist. Do not add backend code, scrape rendered HTML or place machine credentials in the browser to bypass these gaps.

## Gap register

Proposed fields below describe needed capabilities, not existing endpoints or approved API designs. Default owner for product decisions: Sajid. Backend implementation owner and due dates: not assigned. Frontend work remains limited to the dedicated folder.

| ID / priority | Existing evidence and exact gap | Proposed capability/data | Frontend treatment and owner decision |
|---|---|---|---|
| G01 / blocker | Projects/workspace state is rendered by project_list/project_detail. Platform workspace APIs exist but do not supply TMD project permissions, kinds, lists and counts. | Authenticated training bootstrap/list: current workspace, project refs/IDs/name/task, capabilities, folders, pagination and allowed kinds. Must enforce project and assigned-only scope. | Fixtures until available. Owner decides separate backend work or explicitly limited integration. |
| G02 / blocker | Upload/import returns HTML with results; batch names/tags in Roboflow upload have no equivalent upload contract observed. | Structured upload limits, accepted inputs, per-file ID/state/detail/split/group/eligibility; metadata persistence only if separately implemented. | Preserve provenance and existing formats. Do not use records-ingest key as substitute. Ask before dropping or changing metadata UX. |
| G03 / blocker | Editor bootstrap exists only in HTML; save/review JSON exists. GET can invoke detection or restart work. | Side-effect-free, authorized photo/editor read: image URL, dimensions, shapes, capabilities, faults, review state, next/previous, history/comments/tags. Separate explicit detection operation. | Prototype editor and JSON adapter design can proceed; connected editor requires a safe bootstrap decision. |
| G04 / high | Project photo lists/board, batch detail and timeline are HTML. Batch actions redirect and use messages. | Paginated board/photo/batch data; counts scoped to user; allowed transitions and structured action outcomes. | Do not infer board state from labels alone or treat HTTP redirect as successful approval. |
| G05 / scope | labels.py fixes wall/window/door and COCO IDs. Tags exist per photo, but generic class CRUD/merge/lock/count APIs were not found. | For current scope expose fixed categories; optional future generic taxonomy requires compatible model/schema migration owned separately. Tag reads/actions need structured responses for SPA. | Recommend fixed categories plus existing tag behavior. Generic class editing remains unavailable/demo. |
| G06 / scope | Version publishing supports immutable smoke/train_val/test/golden; grouping assigns fixed splits. No arbitrary preprocessing/augmentation version API found. | Version metadata/readiness/list and publish result; any new transformations need versioned specs and geometry-safe processing. | Recommend read-only split summary and actual version kinds. Do not connect decorative resize/split controls to unrelated endpoints. |
| G07 / high | /analytics/ is wall-event/correction analytics, not dataset health. Report is HTML. | Separate authorized event summary and, if desired, dataset counts/class distributions/dimensions with documented definitions and timestamps. | Label charts accurately. Dataset-health fixture data remains visibly demo. |
| G08 / high | Catalog/run/evaluation metadata lives in HTML; JSON report downloads alone do not provide lists/configuration/job state. | Authorized catalog/version/configuration/readiness/status lists, idempotent operation outcomes and bounded polling contracts. | Connect downloads only with valid context; do not call operational reads while previewing. |
| G09 / scope | Existing detector flow is model-specific wall assistance; arbitrary prompt-based class labeling, generic SAM/chat workflows, NAS and active learning not found in audited routes. | Separate feature design/service contract if desired. | Future/disabled modules; do not advertise third-party availability from screenshots. |
| G10 / high | Form failures and permission/login responses may be HTML or redirects; no uniform JSON outcome across operations. | Consistent outcome envelope, field/domain errors, capability reasons, pagination and safe auth-expiry handling. | Treat content-type/redirect mismatch as unresolved, never as saved success. Preserve dirty state. |
| G11 / routing | Existing Vite /training-data proxy routes all matching paths to Django. New entry at same address conflicts with legacy reads/writes. | Owner-approved frontend routing/proxy design preserving legacy endpoints and host/CSRF semantics. | Separate preview first. Ask before any shared config edit. Backend remains untouched. |
| G12 / reliability | Label saves lack an observed client revision/If-Match precondition. The existing client serializes local saves, but that is not multi-tab conflict control. | If concurrent editing is required: revision token, stale-write rejection and recovery payload. | Preserve local dirty/save state; do not promise collision protection. Owner decides concurrency requirement. |

Sources and exact methods/fields: [API_CONTRACT_MATRIX.md](API_CONTRACT_MATRIX.md), [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md). Absence claims are limited to the audited training-data routes/handlers, not all possible external services.

## Existing contracts worth reusing

- Platform identity + CSRF bootstrap: GET /api/auth/me.
- Authorized photo-file endpoint, when identifiers and context are known.
- Label save and approve JSON operations, once safe editor initialization is resolved.
- Dataset manifest and evaluation report downloads.
- Model prediction/status JSON, only within approved operational testing; status GET can do work.
- Existing domain logic and permission rules remain authoritative.

## Integration paths for the owner

1. **Recommended now:** Proceed with isolated prototype Phases 2–3; retain fixtures for incomplete contracts. No backend changes.
2. **Later partial integration:** Connect compatible operations only; clearly list what remains unavailable. Any link to legacy Django is a disclosed temporary workflow, not a claim of full migration, and needs product approval.
3. **Full replacement later:** A separately authorized backend owner supplies the missing contracts. This frontend task consumes them but never implements backend changes.

Do not remove Django templates until a separate migration decision and verified parity.

## Security and operational findings

- Editor GET with detect/preference may start detection and store answers.
- Try pages/status can reconcile or restart model servers.
- Workspace/project reads may update session selection.
- Existing auth+CSRF defenses are visible in source; runtime enforcement NOT VERIFIED.
- Application tests, including access-matrix and labeller-bound tests, exist but were NOT RUN.
- No runtime incident or exploit is asserted by this audit. These findings constrain safe integration/testing.

## Phase 1 completion

Workflow, route/input/response inventory and gap handoff are complete at source level. Live contract validation is explicitly deferred. No decision on backend changes is requested or implied here; those remain forbidden.

Phase 2 can proceed on owner instruction using the independent prototype approach. Phase 4 must resolve relevant blockers first.

