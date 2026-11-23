// A frame workflow (ADM-1351 phase 2, VISION_WORKFLOWS_PLAN.md §5.2): a workflow that starts with "Each camera frame"
// (`trigger.frame`). A stream in Training Data runs its published version on each frame, in memory; the server refuses
// a Run of it (409 `frame_trigger`) and refuses to start a stream with a version holding any step whose registry entry
// is not `frame_mode` (the builder reads it as `frameMode`). A Test of the draft stays possible: a photo stands in for
// the frame, as `{{trigger.image}}`.
//
// Pure, so the page, the picker and the node window read the same rules and they are tested without a DOM.
import { WF_TYPES, wfDef } from '@/config/wfNodeDefinitions'

export const FRAME_TRIGGER = 'trigger.frame'

/** Why the builder offers no Run for a frame workflow (the server refuses it anyway). */
export const FRAME_RUN_NOTE = 'Runs on each frame of a stream: start a stream with it in Training Data.'

/** True when the workflow starts with "Each camera frame". */
export function isFrameWorkflow(nodes) {
  return (nodes || []).some((n) => n?.type === FRAME_TRIGGER)
}

/**
 * Why `type` cannot be added to a frame workflow, or '' when it can. A frame workflow has one trigger: the frame.
 * Any other step the registry does not mark `frameMode` is refused by the stream when it starts.
 */
export function frameRefusal(type) {
  const def = wfDef(type)
  if (!def) return ''
  if (def.trigger) return 'This workflow already starts on each camera frame.'
  if (!def.frameMode) return 'A stream cannot run this step on a camera frame.'
  return ''
}

/** The steps that may follow "Each camera frame", by their names, in the registry's order (enumerated, not a category). */
export function frameStepLabels() {
  return WF_TYPES.filter((t) => wfDef(t)?.frameMode && !wfDef(t).trigger).map((t) => wfDef(t).label)
}

/**
 * What a run of the draft asks for before it starts: the manual trigger's inputs ({ key, type, default }), or, for a
 * frame workflow, one photo under `image` (its trigger declares no inputs, but its steps read {{trigger.image}}).
 */
export function runInputs(nodes) {
  const list = nodes || []
  if (isFrameWorkflow(list)) return [{ key: 'image', type: 'image', default: '' }]
  const manual = list.find((n) => n?.type === 'trigger.manual')
  return (Array.isArray(manual?.data?.inputs) ? manual.data.inputs : []).filter((i) => i && i.key)
}
