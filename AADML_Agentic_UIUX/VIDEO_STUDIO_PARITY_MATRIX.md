# Approved prototype frontend coverage — 3 November 2026

This records source coverage and separates functional tests from rendered visual verification. The approved reference is the saved v8 prototype. No commit, push or deployment is authorized.

| Page | Existing implementation reused | Template coverage | Desktop/mobile status |
|---|---|---|---|
| Dashboard | Existing Studio composer/session/canvas | Wide Agent/Manual entry | Desktop/mobile Agent and Manual checked |
| Discover | Discover tool catalogue and direct routes | 69 looks | Desktop/mobile catalogue, search and saved-template reopening checked |
| Image | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Video | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Voice & audio | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Music | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Characters | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Identity training | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Elements | Shared Agent panel and existing Ingredients/VideoLibrary collection | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Image edit | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Motion transfer | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Swap & restyle | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Effects | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Enhance | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Storyboard | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Cinema | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Editor | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Ads Studio | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Product videos | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Ad remix | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Talking avatar | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Lip-sync | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Shorts from footage | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Explainer | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Projects | Existing project listing and conversation links | Not applicable | Desktop/mobile page and existing navigation checked |
| Library | Existing VideoLibrary | Not applicable | Desktop/mobile page and type/source filters checked |
| Canvas | Shared Agent panel, existing Manual tool, approvals/jobs/results | 3 looks | Desktop/mobile navigation and sections checked; 3 looks customized at each size |
| Help | Existing live capability help and starter recipes | Not applicable | Desktop/mobile page, starter links and sections checked |

All 23 creative pages expose the existing Agent/Manual switch and the shared desktop workspace or compact mobile sections. Image/Video retain their original 16 presets in addition to the 69 approved looks. Each approved look retains its prompt variables, required/optional references and local motion study. Selecting or customizing a look never starts a generation.

New template customization has a parameterized test for every one of the 69 looks. Creative-page selection, readiness refusals and client-only context handling have additional tests. Shared section navigation is tested at desktop and mobile media-query states. These tests do not establish pixel-level visual parity.

## Presentation and interaction checklist

- Workspace header, tool/look/project search, history and current-conversation jobs.
- Dashboard wide composer and Manual workflow cards, preserving real capability gating.
- Discover all tools, category/search filters, all 69 looks, user-scoped saved-template preferences.
- Tool chat with selected-look context, attachments, inline approvals, expanded conversation and New chat.
- Prepared look variables, editable prompt, full media preview and playback controls.
- Manual fields, existing reference validation, consent and quote paths.
- Existing Results/Library actions, video take selection and existing player comparison.
- Existing editor data shown as a visual sequence overview; no sample timeline data.
- Projects, Library/Elements and Help follow the shared visual language.
- Typed backend mapping gaps and prototype-only simulations are identified in the backend supplement.

## Rendered review

All 28 views were checked at desktop and mobile sizes using the actual Vue components in an excluded local harness with synthetic reads and rejected backend writes. All 23 creative tools exposed Agent/Manual and workspace sections. Every curated look (69 desktop + 69 mobile) was selected, its fields edited and applied to an unsent Agent brief with no document horizontal overflow. Desktop was 1440×900 (Characters also checked at 1920); mobile 390×844. The Video composer was reachable without horizontal overflow at 320×568. Search, history, current-conversation jobs, saved-template reopening and full preview were checked. Chrome transport failures were retained in the evidence log and superseded by successful retries. This establishes local UI interaction coverage, not live provider/billing/tenant verification or pixel-identical parity. Final test/build details are in VIDEO_STUDIO_PROTOTYPE_IMPLEMENTATION.md.



## Correction to visual sign-off — 3 November 2026

The route/template interaction results above remain navigation evidence, not proof that every layout matched v8. A direct comparison subsequently found sidebar, landing-page and default-preview differences. Those shared visual surfaces have been corrected in the current working tree; see VIDEO_STUDIO_PROTOTYPE_IMPLEMENTATION.md for the actual changes and evidence. Do not represent the earlier matrix as a pixel-identical match for every view. Live data, workspace identity, capability-driven form fields and real approvals take the place of prototype sample data and simulations.
