# Annotation job and editor revision — 2026-10-15

Scope: Phase 2 local frontend prototype. No backend code, real permissions, notifications, training, commits, pushes or deployment changed. Low-impact UI revision; real image processing and access enforcement remain outside this preview.

- Annotating cards open a job gallery before the editor. Unassigned batches retain the labeling-choice flow.
- Job view contains actual local annotation progress, instructions, sample assignment, local event timeline, annotated/unannotated filters, sorting, and Continue Annotating.
- Job review submission requires every image to have labels or an explicit no-objects mark.
- Editor image navigation is limited to the opened job. Closing returns to the gallery.
- Editor adds a vertical navigation rail, Classes/Layers controls, available classes, Job details, a vertical tool palette, pan, no-objects control, and tool help. Existing drawing, vertex editing, undo/redo, save/review, tags and brightness controls are retained.
- Brush, rotate, smart selection, auto annotation, AI refine and Find Objects with AI show explicit pending-feature dialogs. These do not execute inference or image processing.
- Local image aspect ratios are preserved; annotation overlay uses the existing preview coordinate system. Production coordinate conversion is not connected.

Validation: Vite production build passed; existing preview-state tests passed 2/2. Browser checked card-to-job-to-editor navigation and return, job image counts (6 total / 2 annotated / 4 remaining), job-scoped filmstrip despite multiple batches, and brush pending-feature feedback. Full drawing/drag regression and backend tests NOT RUN in this revision. Screenshots: `screenshots/annotation-job.jpg`, `screenshots/annotation-editor-updated.jpg`.

Rollback: revert the isolated AnnotationJob component and ProjectStudio/AnnotationEditor changes. No persisted server data is involved.
