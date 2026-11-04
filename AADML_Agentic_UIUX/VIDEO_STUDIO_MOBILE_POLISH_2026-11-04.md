# Video Studio mobile polish — ADM-1163

Owner: sajid. Request dated 4 November 2026: inspect the live Studio, fix related frontend/backend issues, commit and push main, then verify live. This explicitly supersedes the earlier no-push instruction for this task.

Scope and risk: medium. Frontend presentation and keyboard interaction inside Video Studio only. Existing authentication, account/workspace scoping, reference handling, price estimates, human approval and job charging paths are reused. No backend source, provider configuration, credentials, migrations or customer media changed.

## Reproduced issues and corrections

- Live Discover used almost a whole mobile screen before showing a tool. Mobile now shows the first tool row at approximately 479px in a 390x844 viewport and uses a short introduction, one mode row, horizontally scrollable categories, search and a two-column tool grid. All 26 tools and 69 existing looks remain available. Compact template cards retain the existing real-result previews.
- At a short mobile viewport the old 330px chat minimum put Send below the visible panel. Removed that fixed minimum, kept the conversation scrollable and composer outside the transcript, and placed mode/preset side by side. At 390×500 the updated Send bottom is 487px, including the local backend-unavailable error state. At 320×568 it is 555px with no horizontal page overflow.
- Added visualViewport sizing for mobile browsers whose keyboard does not resize the layout viewport, with listener cleanup and pinch-zoom fallback. Actual iOS/Android hardware keyboard behavior is NOT VERIFIED; desktop browser viewport emulation and simulated viewport unit tests are the evidence.
- Mobile tool tabs now call the agent panel Chat and link to their controlled panels. Header content compacts on short screens; while typing, optional configuration yields space to the conversation.
- Phone Return inserts a newline; Send explicitly submits (desktop Enter and explicit shortcuts remain supported).
- Mobile drawer widened to 280px, keeps 44px navigation targets and existing focus/inert/escape controls. Dashboard introduction and input area are shorter.

## Verification before push

- Live pre-change audit: all 26 Discover destinations plus Dashboard inspected at phone size, existing thread resumed, and a fresh synthetic agent chat returned “Studio chat is ready.” No tools/media/jobs requested or approved. Historical provider quota errors in an old thread did not recur in the fresh chat; no provider limit/configuration was changed.
- Local preview uses existing source at 127.0.0.1:5173. Local backend is unavailable (proxy 500), so local dynamic generation/account behavior is NOT VERIFIED; this was not treated as a live backend failure.
- Studio regression: 468 passed / 42 files.
- Final affected smoke suite: 34 passed / 5 files; final accessible-tab test suite: 6 passed / 1 file.
- Production dependency audit: 0 vulnerabilities, npm audit --omit=dev --audit-level=high.
- Production build: full npm run build passed (including prerender and training-data). After the final CTA wording change, the main Vite production build passed again in 2m 5s. Existing large-chunk advisories remain. Final Discover tests: 12 passed / 1 file.
- No paid media generation, payment, charging/refund recovery or cross-account browser test performed. Existing automated guards retained. A route check is not a claim of end-to-end provider certification or pixel-identical prototype parity.

## Release and rollback

Use the existing main-branch GitHub Actions build/test/security/performance gates and automatic deploy. Do not bypass CI or deploy from the workstation. Rollback is a normal revert followed by the same gated deployment, or the existing deployment workflow with the previously successful image tag 9cf7507. Post-deploy checks must verify the current bundle and actual mobile/desktop layout, navigation, templates and chat. Exact results will be appended after the run.

## Dashboard keyboard consistency follow-up

Final review found Dashboard still submitted phone Return while tool chat inserted a newline. Applied the same coarse-pointer rule to the existing Dashboard composer; Manual Ctrl/Cmd+Enter estimate behavior is unchanged. Dashboard regression: 25 tests passed. This small logic follow-up uses the same gated production build/CI release; final live verification is pending the latest deployment. No backend changes.

## Samsung / Apple viewport follow-up

The owner's follow-up explicitly requested Samsung and Apple viewports. The installed Playwright device catalogue supplies Galaxy S24 360x780 (landscape 780x360), iPhone SE (3rd gen) 375x667, iPhone 17 402x681 (landscape 756x352), and iPhone 17 Pro Max 440x763. These are browser viewport presets, not physical-hardware or Safari-engine certification.

Live landscape testing found an additional clipping case when a generation-readiness notice was present. The follow-up keeps that notice as a compact, expandable explanation in Agent (open by default in Manual), puts setup and notices in a separate scrolling column on landscape phones, and makes Expand chat free the mobile tabs/settings space. Session failures remain visible and all readiness/approval controls are unchanged. Send and attach stay at least 44px on landscape phones too.

Local checks at an actual measured 780x360 viewport, including two backend-unavailable alerts, showed Send within both the viewport and its chat container. Expanded chat also fits (Send bottom about 350px, container bottom 356px). Affected regressions: 173 passed / 5 files, including a new test that setup remains disclosed and no API mutation occurs. Production Vite build passed in 2m 42s. Final CI and exact live device checks follow the gated deployment; they must not be inferred from pre-release measurements.

CI for 0194d5f passed all jobs and deployed successfully (run 41825685569). Its live desktop pass covered Dashboard + all 26 destinations and workspace tabs / mode switching for every creative page; an Effects browser-control timeout passed on explicit retry. Mobile checks are saved incrementally under outputs/studio-live-qa-2026-11-04.json; unfinished / timed-out checks are retained and must be retried before final signoff. The first rapid multi-viewport measurements were stale while resize events were pending: do not use them as device validation. Later checks wait for resize and record actual dimensions and clipping boundaries.

## Functional template hydration defect found during live catalogue QA

On the live 6ac9f77 build, direct template links for audio, music, editing and enhance kept ?preset=<valid-id> in the URL but reverted the selector to Your own idea and emptied the agent brief. Image/video links succeeded. The same shared draft helper is used by the other creative pages and Elements.

Cause: useStudioToolDraft treated the shell's initial asynchronous user hydration (null to the already authenticated person) as an account switch and unconditionally cleared the prepared public preset. The helper now distinguishes that first hydration from subsequent account changes. An explicit validated route preset survives first hydration; with no explicit preset only the authenticated person's own saved draft can restore. Sign-out, direct account changes and sign-out followed by another sign-in still clear text and selection. No server auth or tenant rules change, and no backend engine is missing for this defect.

Validation: 126 passed / 5 affected files, including new positive hydration tests and negative account-switch / logout-then-other-account tests. The exact production build remains gated by CI before deployment. Live failing template attempts are retained in outputs/studio-live-template-qa-2026-11-04.json; all 69 must be retried against the hydration fix before claiming catalogue success. The Samsung/Apple layout release 6ac9f77 itself passed all CI jobs and deployed (run 41830666973).
