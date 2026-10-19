# AADML theme review — 2026-10-15

Scope: isolated training-data frontend prototype. Low-impact presentation change; no permissions, backend, API calls, production changes, commits or pushes.

Palette follows the existing application tailwind.config.js: blue #2563EB, deep blue #1D4ED8, slate #0F172A, light surfaces #F8FAFC and teal accents. Inter follows the main application's existing Google Fonts setup, with system fallbacks. Shared app styles are read only.

Added src/aadml-theme.css as the prototype token source. Converted purple presentation styles to those tokens, applied a light navigation shell, blue upgrade action and AADML wordmark. Existing annotation class colors and generated example images remain data illustrations, not branding colors.

Verification: Vite production build passed; all four existing preview-state tests passed. Browser checked annotation board and Models; confirmed computed Inter font stack and blue active tab. Screenshot: screenshots/aadml-theme-models.jpg. Full responsive and accessibility audit NOT RUN. No deployment. Phase 2 remains awaiting owner review.

Rollback: revert only these theme edits within training-data; retain other prototype work.
