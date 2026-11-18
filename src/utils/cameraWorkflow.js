// A new workflow started from a camera's page in Training Data (Cloud Streaming, ADM-1106 phase 6): the Workflow
// Builder opens with a "Camera event" trigger of that camera (and rule) already on the canvas. The camera page links to
// /dashboard/workflow-builder?trigger=training.stream_event&source=<id>&camera=<name>[&rule=<id>] (training-data's
// api/streaming.js workflowFromCamera); WorkflowsList.vue reads it. The ids are only what the canvas starts with: the
// server fires the trigger only for a camera of the workflow's own workspace, and only once it is published.

export const CAMERA_EVENT_NODE = 'trigger.training.stream_event'

const wholeId = (value) => (/^[1-9][0-9]{0,11}$/.test(String(value ?? '')) ? Number(value) : null)

// What the query asks for, or null when it does not ask for a camera workflow.
export function cameraStarter(query) {
  if (!query || query.trigger !== 'training.stream_event') return null
  const source = wholeId(query.source)
  if (!source) return null
  const camera = [...String(query.camera || '')].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join('').trim().slice(0, 80)
  return { source, rule: wholeId(query.rule), camera }
}

// The new workflow: its name and a canvas holding only the camera-event trigger.
export function cameraWorkflow({ source, rule = null, camera = '' }) {
  const data = { source, source_name: camera }
  if (rule) data.rule = rule
  return {
    name: `${camera || `Camera ${source}`} events`.slice(0, 200),
    graph: {
      nodes: [{ id: 'camera_event', type: CAMERA_EVENT_NODE, position: { x: 80, y: 120 }, data }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  }
}
