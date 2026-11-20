// A new workflow started from a camera's page in Training Data (Cloud Streaming, ADM-1106 phase 6): the Workflow
// Builder opens with a "Camera event" trigger of that camera (and rule) already on the canvas. The camera page links to
// /dashboard/workflow-builder?trigger=training.stream_event&source=<id>&camera=<name>&workspace=<id>[&rule=<id>]
// (training-data's api/streaming.js workflowFromCamera); WorkflowsList.vue reads it. The workflow is made IN the
// camera's workspace (the owner's decision, 2026-11-18): the server makes it there or refuses, never elsewhere. The ids
// are only what the canvas starts with: the server fires the trigger only for a camera of the workflow's own workspace,
// and only once it is published.

export const CAMERA_EVENT_NODE = 'trigger.training.stream_event'

const wholeId = (value) => (/^[1-9][0-9]{0,11}$/.test(String(value ?? '')) ? Number(value) : null)

// What the query asks for, or null when it does not ask for a camera workflow.
export function cameraStarter(query) {
  if (!query || query.trigger !== 'training.stream_event') return null
  const source = wholeId(query.source)
  if (!source) return null
  const camera = [...String(query.camera || '')].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join('').trim().slice(0, 80)
  return { source, rule: wholeId(query.rule), camera, workspace: wholeId(query.workspace) }
}

// What is said when the link does not name the camera's workspace (a link made before 2026-11-18): nothing is made.
export const NO_CAMERA_WORKSPACE = 'This link does not say which workspace the camera is in, so no workflow was made. '
  + 'Open the camera in Cloud Streaming and choose Build a workflow again.'

// The new workflow: its name, the camera's workspace it is made in, and a canvas holding only the camera-event trigger.
export function cameraWorkflow({ source, rule = null, camera = '', workspace = null }) {
  const data = { source, source_name: camera }
  if (rule) data.rule = rule
  return {
    name: `${camera || `Camera ${source}`} events`.slice(0, 200),
    ...(workspace ? { workspace } : {}),
    graph: {
      nodes: [{ id: 'camera_event', type: CAMERA_EVENT_NODE, position: { x: 80, y: 120 }, data }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  }
}
