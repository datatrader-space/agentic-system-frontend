# Backend coordination for the approved Studio frontend

This supplements the v8 handoff already given to the backend agent. Reuse existing domains. No new API namespace, chat database, wallet, model registry, or Production Studio is requested by this frontend change.

## Already reused

- The existing built-in Studio agent, conversation open/send, typed `studio_context`, upload and existing-media paths.
- Existing capability/readiness checks and Manual forms. A look never overrides model readiness or starts a request.
- Existing `ChatMessageList`, `VideoJobsTray`, `VideoJobCard` and inline `HITLModal`. Quote amounts, maximums, state and approval enforcement remain authoritative backend concerns. No illustrative prices or simulated jobs from the prototype were copied into production UI.
- Existing `/video/chats/` pagination and conversation links. History search currently filters loaded chat titles; it does not claim server-wide message search.
- Existing `/video/versions/`, project versions and `/video/selection/` for free **video** take selection. These are not used as fabricated generic image/audio restore endpoints.
- Existing Library and Ingredients/Elements CRUD, permissions and use-in-workflow actions.

## Presentation data that needs backend mapping/verification

1. **69 visual looks:** `src/services/studioLooks.js` is a static presentation catalogue with prepared, editable user prompts and illustrative media. Its entries are marked `clientOnly`. Selecting one does not execute anything. The frontend excludes these client-only IDs from the existing trusted `studio_context.preset` field; the authored/edited prompt is sent through the normal agent path. Existing image/video preset IDs remain available and keep their established context mapping. Map these new looks to the current server-owned recipe/preset service if durable server preset analytics, validation or reuse is required. Do not create a second preset service.
2. **Capabilities and reference roles:** the prepared looks do not prove a particular model supports a named operation, reference combination, duration, resolution, consent state or continuity guarantee. Continue validating against the existing current catalogue and permissions. Agent asks for missing inputs; Manual keeps its current field validation.
3. **Structured responses:** existing chat/HITL/job events should supply reference requests, proposed settings, quote cards, approval outcomes and job/artifact updates. Preserve approval idempotency and requester/scope checks. Loading or reopening a conversation must never submit a job or replay an approval.
4. **Other media version lineage:** audit the existing artifact version/restore implementation and map it to image/audio/character/element results where supported. Current new Versions view is explicitly video take selection. Do not invent missing historical settings or invoke generation as restore.
5. **History:** verify existing search support before adding title/message search to `/video/chats/`. Keep pagination owner/workspace-scoped and return authoritative page/preset context where available. The frontend already ignores stale responses after a signed-in-person change.
6. **Cost preference / model rationale:** the prototype's lower-cost preference, rationale and illustrative price rules are not copied as backend facts. Continue using actual agent requests and quote cards. Add optional typed preferences only by extending the verified existing context schema; an ordinary request for a cheaper draft can already be expressed in chat.
7. **Transport/error truth:** the existing version store historically maps an unsuccessful version-list read to an empty list. Return an explicit failure status through the existing read flow if richer recovery is required. Do not infer absence of historical versions from an unreachable service.

## Acceptance to verify jointly

- New/changed brief, references or settings invalidate stale quote authorization; refreshing history does not execute or charge.
- All media uploads, reads, versions and selection remain scoped server-side; UI visibility is not authorization.
- Reconnect and duplicate events reconcile against existing jobs without duplicate submissions or lost completed outputs.
- Consent and identity permissions are checked for each applicable operation; a preset or historic chat is not consent.
- Client-only look selection, text refinement, navigating Discover and opening old chats never starts media generation.

Frontend verification uses synthetic fixtures. Live provider execution, billing correctness and backend tenant isolation are **not verified** by this local frontend implementation. The owner's instruction is no commit, push or deployment.


## Full prototype completion pass — 3 November 2026

Frontend updates now include the approved workspace header and global tool/look/project finder, current-conversation jobs, saved-template discovery, editable variables for all 69 looks, full preview with playback controls, selected-look chat context, new chat on every creative tool, a visible lower-cost draft request, existing comparison-player access, tab-memory drafts, the existing editor's visual timeline overview, and updated Projects/Library/Help presentation.

The following remain integration boundaries for the backend agent to audit and map into existing services:

8. **Server-owned look catalogue / favorites:** the frontend restores the approved prompt templates, variable labels/defaults and reference requirements. Only client-only presentation IDs are saved as user-scoped local preferences. Saved-template selection does not persist customized prompts or media. If existing recipe/favorite APIs support this, map to them for cross-device sync; do not create another catalogue. All client suggestions remain untrusted user input.
9. **Durable unsent drafts:** creative pages reuse `studioDraftMemory` in tab memory, scoped by user/page/conversation. No prompt or media is serialized by this new helper. Reuse the existing server-side draft/conversation mechanism for reload/cross-device recovery if available. Restore attachment IDs only with server authorization; stale local File objects require reselection.
10. **Jobs scope:** the new header queue displays the real jobs already in the current conversation store. It does not fabricate an account-wide job feed. Audit any existing workspace-scoped job listing/event reconciliation before expanding the view. Preserve existing authorization, idempotency, quote expiry and late-provider-result semantics.
11. **Add to project / saved custom recipes:** the prototype's browser-only add-to-project and recipe-copy operations require mapping to the existing project/attachment/recipe membership APIs. The UI currently opens existing project conversations and Library collections. Do not treat its user-facing client look IDs as server recipe IDs or create duplicate tables.
12. **Typed Manual recipe hints:** generic creative direction is applied only to supported visible form fields, and spoken Script variables are separated from instructions. Audio looks select existing speech/sound/voice-change workflows. The provider-owned parameter schema, reference roles, voice IDs and consent still require real current capabilities; template defaults must never override unavailable models or fill consent. Map model-specific recipe options only after inspecting the server's existing typed recipe schemas.
13. **Structured Agent planning:** plan/storyboard/model-rationale/quote presentation uses existing agent messages, project scenes and approval/job cards. The prototype's canned plan, pretend prices, sample scene generation and recovery timers are not production facts. Verify that the existing agent emits these data through its current transports, and extend those responses only where proved necessary.

14. **Reuse artifact reads for generic version mapping:** `api.searchArtifacts`, `getConversationArtifacts`, `getArtifact`, `getArtifactPreview` and `getArtifactVersions`, plus `useArtifactsStore`/`ArtifactsPanel`, already supply generic artifact foundations. Audit these before extending Studio version lineage. `rerunArtifact` executes work; it must not be used as a free restore substitute. Existing video results now open the existing media viewer and comparison player. Generic restore remains a verified-contract integration task, not a new artifact service.

Selected looks now remain in the existing route's `preset`/`mode` query, preserving the conversation query. This is navigation state only and grants no capability, consent, authorization or quote approval.

UI tests use synthetic data. Production-provider execution and settlement are not exercised. Visual QA and final test/build results are tracked in `VIDEO_STUDIO_PROTOTYPE_IMPLEMENTATION.md`; completion must not be inferred from a prototype fixture or this handoff alone.

## Local connection check — 3 November 2026

The actual application (not the synthetic UI harness) was opened in the owner's Chrome at `http://localhost:5173/video-studio`. Vite is running from `E:\agentic-system-frontend` on loopback port 5173. The configured `VITE_API_TARGET` is `http://localhost:8001`.

**Not connected:** no listener was found on local port 8001. A direct read of `http://localhost:8001/api/video/features/` failed to connect. The frontend proxy read `/api/video/studio-agent/` returned HTTP 500; Vite recorded ECONNREFUSED for `/api/auth/check` and `/api/video/features/`. The actual Video page displayed a request-failed-500 error. Discover and template presentation remain browseable, but this does not establish authenticated backend operation.

Read-only source inspection of `E:\agentic-system-backend\video_studio\urls.py` confirms existing routes for studio-agent, capabilities, image-capabilities, features, routes, media/routes, recipes/run, jobs, projects/assets/timeline/storyboard, chats, versions/selection, library, consent, identities and ingredients. These are implemented source foundations, not verified running services. Do not rebuild them merely because the local server is stopped. No backend source or database was changed.

Backend-agent next steps: start the intended local ASGI/API service on 8001 (or provide the intended target); verify its required database/Redis/workers and current schema using the existing runbook; verify authentication/CSRF and authenticated read responses; verify conversation WebSocket/reconnect, upload/reference authorization, model capability readiness, quote approval and job recovery/settlement with the owner's test setup. No paid job or provider call was attempted in this check. Do not use production cookies or disable auth to make localhost work.

The remaining UI mappings above are still explicit: the 69 new looks are client-only prepared prompts; saved look IDs are local preferences; creative drafts are tab memory; header jobs cover the current conversation; history searches loaded titles; generic artifact restore and prototype-only custom recipe/project actions need existing-contract mapping. Source existence alone cannot close these integration items. Return verified existing endpoint schemas/events and runtime evidence before claiming full connection.

## Subsequent UI integration update — 3 November 2026

The existing project-association route has now been audited and wired to the creative tool header's Add to project picker. It reads `/video/projects/`, then explicitly confirms POST `/video/projects/{id}/open/` with the owned conversation ID and reloads project state through the existing store. It does not submit generation or implement generic artifact membership/export. Do not create a duplicate endpoint for this action. Custom recipe persistence and generic per-artifact project membership still need the separate existing-contract audit described above.

The local runtime state changed after the earlier connection check: port 8001 is now listening and the actual application is receiving signed-in account and existing Studio chat data. Therefore the earlier stopped-service observation is historical, not the latest overall status. This confirms those reads only; job execution, provider readiness, worker recovery, tenant enforcement and billing/settlement are still NOT VERIFIED end to end by this UI pass. No backend source was changed.

Projects page now also uses the existing POST `/video/projects/` for explicitly confirmed named project creation (no conversation approval or paid generation). A mocked test verifies that opening the dialog and editing a title alone do not create anything. This is an existing backend feature now wired into the approved header, not a request for a new project service.

Final project-picker response handling uses the authoritative existing association response, checks selected project ID/current account/current conversation, applies it only within that scope and refreshes versions through the existing guarded store. The pending-response account-switch test passed. No live association or project-creation write was submitted during this verification.
