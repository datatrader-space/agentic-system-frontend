# Project creation visual update — 2026-10-15

Scope: isolated frontend prototype only. Low-impact UI change using synthetic image data. No real biometric processing, permissions, backend integration or publication added.

- Public/Private descriptions react to the chosen listing preference. Photo/annotation access remains a separate data-policy choice; prototype does not enforce either policy.
- System sans-serif stack uses Segoe UI Variable Text / Segoe UI on Windows and platform fallbacks; no external font service. Form controls including textarea inherit the font. Project form labels and descriptions have increased sizes.
- Face Recognition is selectable, with a synthetic reference/image matching illustration and explicit backend-support-pending text.
- Asset: `../src/assets/project-types/face-recognition.png` (relative to training-data root: `src/assets/project-types/face-recognition.png`).
- Generation: built-in imagegen. Original retained in the tool's generated-images directory.

## Generation prompt

Generate a polished photorealistic educational visual for a computer vision project-type selector named Face Recognition. Landscape 1536x1024. Clean white and pale lavender background, professional product illustration combining two large photographic cards side by side of the SAME fictional adult woman, left frontal neutral portrait, right slightly turned smiling portrait in different lighting. Fully synthetic person, no real identity. Thin violet bounding rectangle around each face with small subtle facial landmark points, connecting violet line between cards with a check symbol. Clearly legible minimal labels: left 'Reference', right 'New image', center or bottom 'Same person'. Small footer 'Illustrative example'. Show identity matching rather than surveillance, no crowds, no sensitive attributes, no probability numbers. Modern refined UI overlay, photographic realism, spacious composition, no brand logos, no watermark.

## Verification

- Vite build passed: 1,750 modules, 13.57 seconds.
- Browser verified Private default copy, changed Public copy, Face Recognition selection and image load, and computed system font stack.
- Production security/inference checks: not run; no production or recognition capability changed.
- No commit, push or deployment. Rollback: revert this isolated component/style update and remove its unused asset if desired.
