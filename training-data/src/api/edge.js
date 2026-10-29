// Edge Devices: an approved model run on one of the workspace's own machines, managed from the page (backend:
// training_models_data/edge.py, machines.py and machines_api.py — workspace/edge/, workspace/machines/<id>/serve/,
// workspace/machine-jobs/<id>/stop/). Nothing is downloaded and no command is run by hand: the machine takes the model
// at its next poll. Every rule is the backend's: which model may leave AADML, for which environment, on which machine.
import { apiFetch } from './client.js';

const APP = '/training-data/app';

export const edgeApi = {
  // The models this person sees, each with the environments it may run in; the machines; the models being served.
  list: () => apiFetch(`${APP}/workspace/edge/`),
  // Run a model on a machine. Recorded as a release of the model outside AADML.
  serve: (machineId, { project, model, environment, port }) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(machineId)}/serve/`, {
    method: 'POST', body: { project, model, environment, ...(port ? { port: Number(port) } : {}) },
  }),
  stop: jobId => apiFetch(`${APP}/workspace/machine-jobs/${encodeURIComponent(jobId)}/stop/`, { method: 'POST', body: {} }),
};

// One model of the list, as the select names it.
export const choiceKey = row => (row ? `${row.project?.ref}#${row.number}` : '');
export const modelLabel = row => (row ? `${row.name} ${row.version}` : '');

// The models that may run first, then the others, each group in the backend's order.
export function sortedChoices(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return [...list.filter(row => row?.may_serve), ...list.filter(row => !row?.may_serve)];
}

// Why a model cannot be chosen, as one sentence.
export const whyNot = row => (row?.may_serve ? '' : String(row?.why_not || row?.refusals?.[0]?.message || 'This model cannot leave AADML.'));

export const ENVIRONMENT_LABELS = { staging: 'Staging', production: 'Production' };

// The machines a model of ``projectId`` can be sent to now: online, and not limited to other projects.
export function machinesFor(machines, projectId) {
  return (Array.isArray(machines) ? machines : []).filter(m => m?.state === 'online'
    && (!(m.projects || []).length || m.projects.some(p => p?.id === projectId)));
}

// What is wrong with a port, or ''.
export function portProblem(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? '' : 'Choose a port from 1024 to 65535.';
}

// ── calling a model on the machine (step 3 of the tab) ───────────────────────────────────────────────────────
// What the serving container answers (ml/fmw_walls/serve/app.py, the image machines.SERVE_FAMILY): it listens on 8080
// inside, published on the chosen port of EVERY interface of the machine (ml/machine_agent/jobs.py ServeJob: a port
// binding with no host address). ``POST /invocations`` takes ONE photo as the raw request body with its Content-Type
// (image/jpeg, image/png or image/webp; at most 6 MB): a multipart form is refused (415). ``GET /ping`` answers
// {"status":"ok"} once the model is loaded and a test prediction worked. There is no key and no CORS header: apps and
// servers on the network call it, a web page of another site cannot.
export const HOST_PLACEHOLDER = '<machine address>';
export const DEFAULT_PORT = 8080;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const IPV6 = /^[0-9A-Fa-f:.]{2,45}$/;

// The machine's address as typed, ready to go in a URL ([...] around an IPv6 address), or '' when it is not one: the
// code shown never carries anything but an address.
export function cleanHost(text) {
  const raw = String(text ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!raw) return '';
  if (IPV4.test(raw) || HOSTNAME.test(raw)) return raw;
  const bare = raw.replace(/^\[(.*)\]$/, '$1');
  return bare.includes(':') && IPV6.test(bare) && (bare.match(/::/g) || []).length <= 1 ? `[${bare}]` : '';
}

const portOf = port => (portProblem(port) ? DEFAULT_PORT : Number(port));

// An address on the machine: ``/invocations`` (a photo in, the answer out) or ``/ping`` (health).
export const edgeUrl = (host, port, path = '/invocations') => `http://${cleanHost(host) || HOST_PLACEHOLDER}:${portOf(port)}${path}`;

// The address the model answers on, for a person on the machine's own network.
export const answerAt = port => edgeUrl('', port);

export const EDGE_LANGUAGES = ['Python SDK', 'JavaScript', 'cURL'];

// What to install for the language, or '' when nothing is needed.
export const edgeInstall = language => (language === 'Python SDK' ? 'pip install "aadml-training>=0.3"' : '');

// Why nothing is installed, for the languages that need nothing.
export const NOTHING_TO_INSTALL = {
  JavaScript: 'Nothing to install: Node.js 18 or newer has fetch built in.',
  cURL: 'Nothing to install: curl comes with Linux, macOS and Windows 10 or newer (type curl.exe in PowerShell).',
};

// The code that sends one photo to the model on the machine. No key: the model answers anyone who reaches the port.
export function edgeSnippet(language, url) {
  const address = String(url || edgeUrl('', DEFAULT_PORT));
  if (language === 'Python SDK') {
    // AADML's SDK (aadml-training 0.3+): EdgeModel takes the machine's address and port and sends the photo itself
    // as the body, with its type; no key.
    const base = address.replace(/\/invocations$/, '');
    return `from aadml_training import EdgeModel

model = EdgeModel("${base}")        # your machine on your network: no key
result = model.predict("room.jpg")       # JPEG, PNG or WebP
print(result["status"], len(result["walls"]), "walls")`;
  }
  if (language === 'JavaScript') {
    return `// Node.js 18 or newer, on a computer of the same network
import { readFile } from 'node:fs/promises';

const address = '${address}';

const answer = await fetch(address, {
  method: 'POST',
  headers: { 'Content-Type': 'image/jpeg' },  // image/png or image/webp for those
  body: await readFile('room.jpg'),
});
const result = await answer.json();
if (!answer.ok) throw new Error(result.error);
console.log(result.status, result.walls.length, 'walls');`;
  }
  return `curl -X POST "${address}" \\
  -H "Content-Type: image/jpeg" \\
  --data-binary "@room.jpg"`;
}

// The one line that checks the model answers.
export const pingCommand = (host, port) => `curl ${edgeUrl(host, port, '/ping')}`;

// Docker publishes the port on every interface and its rules come before ufw's and firewalld's, so a rule that keeps the
// port to one network goes in Docker's own DOCKER-USER chain (Docker's "Packet filtering and firewalls" guide). The
// conntrack match names the port the caller used, before Docker's NAT changes it to 8080.
export const privateRule = (port, network = '192.168.1.0/24') =>
  `sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport ${portOf(port)} --ctdir ORIGINAL ! -s ${network} -j DROP`;

// A short real answer (fmw-predict.v1 as the container answers it: no request id, capture id or model block, which only
// AADML's gateway adds). Shortened: it also holds coordinate_system and wall_marking_v1.
export const ANSWER_EXAMPLE = `{
  "schema": "fmw-predict.v1",
  "status": "success",
  "image": { "width": 1600, "height": 1200 },
  "thresholds": { "wall_confidence": 0.5 },
  "walls": [
    {
      "id": "w1",
      "corners": [[112.0, 86.5], [948.2, 120.0], [940.6, 1104.3], [104.9, 1131.0]],
      "corner_types": ["room", "room", "room", "room"],
      "confidence": 0.9731,
      "below_threshold": false
    }
  ],
  "openings": [
    { "id": "o1", "type": "window", "wall_id": "w1",
      "polygon": [[402.0, 300.5], [690.0, 310.0], [684.2, 640.8], [398.1, 632.0]],
      "confidence": 0.9112 }
  ],
  "warnings": [],
  "timing_ms": { "model": 412.3 }
}`;

// The fields of the answer, in words.
export const ANSWER_FIELDS = [
  { name: 'status', text: 'success; low_confidence when a wall is below the threshold; no_detection when no wall was found.' },
  { name: 'walls', text: 'Each wall as corners in pixels of the upright photo, from its top left corner, with a confidence from 0 to 1.' },
  { name: 'openings', text: 'The windows and doors, each on the wall it belongs to.' },
  { name: 'warnings', text: 'For example exif_rotated, when the photo was turned upright first.' },
  { name: 'wall_marking_v1', text: "The same walls in FitMyWall's wall-marking format, ready to use." },
];

// When a call fails: the HTTP status and what to do. Every failure answers {"error": "...", "field": "..."}.
export const CALL_ERRORS = [
  { status: 415, text: 'The body is not a JPEG, PNG or WebP photo. Send the photo itself as the body, not a form.' },
  { status: 413, text: 'The photo is larger than 6 MB. Make it smaller first.' },
  { status: 400, text: 'There is no photo in the body, or it cannot be read.' },
  { status: 503, text: 'The model is still loading. Try again after the seconds in the Retry-After header.' },
  { status: 500, text: 'The prediction failed. The error says why.' },
];

// The serving jobs that answer calls now, the healthy ones first.
export function answering(jobs) {
  const list = (Array.isArray(jobs) ? jobs : []).filter(j => j?.kind !== 'train' && j?.state === 'running' && !j?.stopping);
  return [...list.filter(j => j.health?.ok), ...list.filter(j => !j.health?.ok)];
}

function agoText(iso, now) {
  const at = Date.parse(iso || '');
  if (Number.isNaN(at)) return '';
  const minutes = Math.round(Math.max(0, now - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// When a model started on its machine, or '' when that is not known.
export function startedLine(job, now = Date.now()) {
  const ago = agoText(job?.started_at || job?.created_at, now);
  return ago ? `Started ${ago}` : '';
}

const ACTIVE = ['queued', 'running', 'uploaded'];

// The state of each of the tab's three steps: [{ state: 'done' | 'current' | 'attention' | 'waiting', line }].
export function stepStates({ available = false, machines = [], jobs = [] } = {}) {
  const list = (Array.isArray(machines) ? machines : []).filter(m => m && m.state !== 'removed');
  const online = list.filter(m => m.state === 'online');
  const serving = (Array.isArray(jobs) ? jobs : []).filter(j => j?.kind !== 'train' && ACTIVE.includes(j?.state) && !j?.stopping);
  const healthy = serving.filter(j => j.state === 'running' && j.health?.ok);
  let first;
  if (!list.length) {
    first = available ? { state: 'current', line: 'No machine yet. Add one from Your machines.' }
      : { state: 'waiting', line: 'Machines can be added once the images they run are published.' };
  } else if (online.length) {
    first = { state: 'done', line: online.length === 1 && list.length === 1 ? `${online[0].name} is online.` : `${online.length} of ${list.length} machines are online.` };
  } else {
    first = { state: 'attention', line: `${list.length === 1 ? `${list[0].name} is` : `All ${list.length} machines are`} offline. Your machines says what to check.` };
  }
  let second;
  if (healthy.length) {
    const job = healthy[0]; const more = healthy.length - 1;
    second = { state: 'done', line: `${job.model?.name} ${job.model?.version} answers on ${job.machine?.name}, port ${job.port}.${more ? ` ${more} more model${more === 1 ? '' : 's'} too.` : ''}` };
  } else if (serving.length) {
    second = { state: 'current', line: `${serving[0].model?.name} ${serving[0].model?.version} is starting on ${serving[0].machine?.name}.` };
  } else if (!available) second = { state: 'waiting', line: 'Opens once machines can be added.' };
  else if (!online.length) second = { state: 'waiting', line: 'Waits for an online machine.' };
  else second = { state: 'current', line: 'Choose an approved model and start it.' };
  const third = healthy.length ? { state: 'current', line: 'Ready: your apps can call it now.' }
    : { state: 'waiting', line: 'The code below works once a model answers in step 2.' };
  return [first, second, third];
}
