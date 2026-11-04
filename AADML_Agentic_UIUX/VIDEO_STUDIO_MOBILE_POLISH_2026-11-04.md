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
