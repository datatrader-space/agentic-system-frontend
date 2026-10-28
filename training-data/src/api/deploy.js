// The project's Deploy page (backend: training_models_data/app_api.py — deploy/, deploy/<env>/<deploy|cancel|rollback>/,
// deploy/apps/…). The rules are the old Deployment tab's (deployments.py, connected_apps.py). Approving and revoking
// are the Models page's own calls (api/models.js).
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}/deploy`;
const SLOW = 60000;   // these answers look at endpoints and the serving runtime

export const deployApi = {
  load: ref => apiFetch(`${base(ref)}/`, { timeoutMs: SLOW }),
  act: (ref, environment, action, body = {}) => apiFetch(`${base(ref)}/${enc(environment)}/${action}/`, { method: 'POST', body, timeoutMs: SLOW }),
  addApp: (ref, name) => apiFetch(`${base(ref)}/apps/`, { method: 'POST', body: { name }, timeoutMs: SLOW }),
  app: (ref, id, action, body = {}, item = null) =>
    apiFetch(`${base(ref)}/apps/${enc(id)}/${action}/${item === null ? '' : `${enc(item)}/`}`, { method: 'POST', body, timeoutMs: SLOW }),
};

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
