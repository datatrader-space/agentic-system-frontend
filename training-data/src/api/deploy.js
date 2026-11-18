// The project's Deploy page (backend: training_models_data/app_api.py — deploy/, deploy/<env>/<deploy|cancel|rollback>/,
// deploy/apps/…). The rules are the old Deployment tab's (deployments.py, connected_apps.py). Approving and revoking
// are the Models page's own calls (api/models.js).
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}/deploy`;
const SLOW = 60000;   // these answers look at endpoints and the serving runtime
export const DEPLOY_MS = 120000;

export const deployApi = {
  load: ref => apiFetch(`${base(ref)}/`, { timeoutMs: SLOW }),
  // A deploy starts the endpoint before it answers (20 to 30 s on a GPU host, live 2026-11-17): it is given longer.
  act: (ref, environment, action, body = {}) => apiFetch(`${base(ref)}/${enc(environment)}/${action}/`, { method: 'POST', body, timeoutMs: ['deploy', 'rollback'].includes(action) ? DEPLOY_MS : SLOW }),
  addApp: (ref, name) => apiFetch(`${base(ref)}/apps/`, { method: 'POST', body: { name }, timeoutMs: SLOW }),
  app: (ref, id, action, body = {}, item = null) =>
    apiFetch(`${base(ref)}/apps/${enc(id)}/${action}/${item === null ? '' : `${enc(item)}/`}`, { method: 'POST', body, timeoutMs: SLOW }),
};

// The Developer Quick Start's deploy options, laid out as Roboflow's (owner, 2026-10-21). Each says what it is in AADML
// today, and none says "Coming soon" (owner, 2026-11-18: "make them functional and available"):
//   here       works on this page, for this project: the Cloud API; Batch Processing and Dedicated Deployment are the
//              workspace Deployments page's own tabs (BatchTab.vue, DedicatedDeployments.vue) shown for this project
//   elsewhere  works on the workspace Deployments page and is linked there (Cloud Streaming: a video or a camera is the
//              workspace's, not a project's)
//   note       what exists today and what does not (MCP: nothing on AADML's MCP connection asks the model for an answer,
//              mcp_gateway/handlers/training.py; the AADML agent can, in a chat)
// ``icon`` names the page's icon for it.
export const DEPLOY_OPTIONS = [
  { id: 'cloud', name: 'Cloud API', icon: 'cloud', here: true },
  { id: 'streaming', name: 'Cloud Streaming', icon: 'radio', tab: 'streaming', elsewhere: 'Point a model at a video file or a live stream and download what it finds in its frames. It is set up for the whole workspace, on the Deployments page.' },
  { id: 'mcp', name: 'MCP', icon: 'plug', note: [
    "In a chat, the AADML agent uses this model as a tool: it tries it on a photo you attach, and runs it over the project's photos as a batch after you approve.",
    "AADML's MCP connection, for Claude, ChatGPT and other assistants, manages this project with its aadml_training tools (training, approvals, deployments), but none of them sends a photo to the model for an answer. An app asks the model through the Cloud API, with its own key.",
  ] },
  { id: 'batch', name: 'Batch Processing', icon: 'layers', here: true, group: 2 },
  { id: 'dedicated', name: 'Dedicated Deployment', icon: 'server', here: true, group: 2 },
];

// How an app asks for a prediction, in three languages, with the project's real address. The key is never filled in.
export function snippet(language, url, environment) {
  const address = url.replace('{environment}', environment);
  if (language === 'Python') {
    // AADML's SDK (aadml-training on pypi.org): the project's number and the environment come from the address.
    const project = (address.match(/\/projects\/(\d+)\//) || [])[1] || '<project number>';
    return `# pip install aadml-training
from aadml_training import Client

client = Client(api_key="<the app's key>")      # or set AADML_API_KEY

result = client.predict(project_id=${project}, image="room.jpg", environment="${environment}",
                        request_id="…", capture_id="…")          # the two ids are optional
print(result["walls"])`;
  }
  if (language === 'JavaScript') {
    return `const form = new FormData();
form.append('file', photo);                       // a File or Blob: JPEG, PNG or WebP, at most 15 MB
form.append('payload', JSON.stringify({ capture_id: '…', request_id: '…' }));   // optional

const answer = await fetch('${address}', {
  method: 'POST',
  headers: { Authorization: "Bearer <the app's key>" },
  body: form,
});
if (!answer.ok) throw new Error((await answer.json()).error);
console.log((await answer.json()).walls);`;
  }
  return `curl -X POST "${address}" \\
  -H "Authorization: Bearer <the app's key>" \\
  -F "file=@room.jpg" \\
  -F 'payload={"capture_id": "…", "request_id": "…"}'`;
}

// What an environment's card says about it, in one word and a tone.
export function liveTag(environment) {
  if (!environment.live) return ['neutral', 'Nothing deployed'];
  return environment.live.healthy === false ? ['amber', 'Live · not answering'] : ['green', 'Live'];
}
