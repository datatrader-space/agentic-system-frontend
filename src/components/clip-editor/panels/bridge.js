// The one place the panels reach the editor's shared modules (VIDEO_EDITOR_PRO_CONTRACT.md section 11): plain re-exports,
// so there is one implementation of each. The registry is the server's (GET /api/video/editor/registry/, read once by
// the page before the panels show); `registry()` is the copy already read.
export { registry, loadRegistry, setRegistry, paramSpec, effectDefaults, clampParam, isAnimatable, transitionLabel, fontFor, ids, labelOf, effectDerive, effectPaid, editorLimits } from '../registry'
export { snap, setKeyframeOps, removeKeyframeOps, addEffectOps, setEffectOps, removeEffectOps, moveEffectOps, pasteAttributesOps, markerOps, ATTRIBUTE_GROUPS } from '../timelineModel'
export { evaluate } from '../keyframes'
export { curveLength } from '../speedCurve'
