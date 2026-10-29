// The workspace pages (backend: training_models_data/app_api.py — workspace/models/, published/<key>/…,
// workspace/deployments/, workspace/events/, workspace/audit/, assistant/), and the person's own workflows (AADML's
// /api/workflow-graphs/, which lists only the workflows of the person signed in). Every rule is the backend's.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const APP = '/training-data/app';
// These answers settle work in progress (a published model being made ready, a test server starting): longer than a page.
const SLOW = 60000;

// A query string of the values that are set, in a stable order.
export function query(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();
}

export const workspaceApi = {
  models: () => apiFetch(`${APP}/workspace/models/`, { timeoutMs: SLOW }),
  // range: 1w, 2w, 1m (the backend's default) or all: the overview's successful calls, day by day.
  deployments: (range = '1m') => apiFetch(`${APP}/workspace/deployments/?${query({ range })}`, { timeoutMs: SLOW }),
  events: ({ kind = 'received', project = '', before = '' } = {}) => apiFetch(`${APP}/workspace/events/?${query({ kind, project, before })}`),
  audit: ({ outcome = '', before = '' } = {}) => apiFetch(`${APP}/workspace/audit/?${query({ outcome, before })}`),
  assistant: () => apiFetch(`${APP}/assistant/`, { timeoutMs: SLOW }),
  workflows: () => apiFetch('/workflow-graphs/'),
  // Dedicated deployments: the list with what may be chosen, starting one, and stopping one. Each answers the page.
  dedicated: () => apiFetch(`${APP}/workspace/dedicated/`, { timeoutMs: SLOW }),
  // The source is the project's trained model (project ref + model number) or an open model of the workspace (its id).
  startDedicated: ({ source, name, project, model, open_model, instance_type, kind }) => apiFetch(`${APP}/workspace/dedicated/`, {
    method: 'POST',
    body: source === 'open_model'
      ? { source: 'open_model', open_model, name, instance_type, kind }
      : { name, project, model, instance_type, kind },
    timeoutMs: SLOW,
  }),
  stopDedicated: id => apiFetch(`${APP}/workspace/dedicated/${enc(id)}/stop/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
};

// ── Dedicated deployments ──────────────────────────────────────────────────────────────────────────
// The rules are the backend's; these only say them before a request is sent and put the answer in words.

// A name: 5 to 30 lowercase letters, digits and hyphens, starting with a letter. Answers what is wrong, or ''.
export const DEDICATED_NAME_RULE = '5 to 30 lowercase letters, digits and hyphens, starting with a letter.';
export function dedicatedNameProblem(name) {
  const value = String(name ?? '');
  if (!value.trim()) return 'Enter a name.';
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(value)) return `Use ${DEDICATED_NAME_RULE}`;
  return '';
}

// A price in US dollars: up to three decimals under a dollar (a machine's hour), whole dollars when `whole` (a month)
// or from a hundred.
export function usdText(value, whole = false) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '';
  const v = Number(value);
  if (whole || v >= 100) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v < 1) return `$${v.toFixed(3).replace(/(\.\d\d)0$/, '$1')}`;
  return `$${v.toFixed(2)}`;
}

// What the person is charged for a machine: its hosting price x the platform markup (`charged_*`, dedicated.machines),
// or the hosting price where the backend gives no charged one.
const hourly = machine => machine.charged_usd_per_hour ?? machine.usd_per_hour;
const monthly = machine => machine.charged_usd_per_month ?? machine.usd_per_month;

// What a machine costs, as its radio card says it.
export function machineCost(machine) {
  if (!machine) return '';
  return `${usdText(hourly(machine))} an hour, about ${usdText(monthly(machine), true)} a month`;
}

// The line above "Start deployment": what the choice costs, when it stops, and that it is billed from the balance.
export function dedicatedCostSummary(machine, kind, idleMinutes = 60) {
  if (!machine) return '';
  const hour = usdText(hourly(machine));
  if (kind === 'development') {
    return `${machine.instance_type} costs ${hour} an hour while it is on, billed by the second from your balance. It stops itself after ${idleMinutes} minutes without a call.`;
  }
  return `${machine.instance_type} costs ${hour} an hour, about ${usdText(monthly(machine), true)} a month, billed by the second from your balance until you stop it.`;
}

// The models of a project that may run as a deployment of this kind: those with the approval the kind needs.
export const dedicatedModels = (project, kind) => (project?.models || []).filter(model => model?.approved?.[kind]);

// Why no model of the project can be chosen for this kind.
export function missingApproval(project, kind) {
  if (!project) return 'Choose a project first.';
  if (!project.models?.length) return `${project.name} has no trained model yet.`;
  const needs = kind === 'production' ? 'production' : 'staging';
  return `No model of ${project.name} is approved for ${needs}, which a ${kind === 'production' ? 'Production' : 'Development'} deployment needs. Approve one on the project's Models page.`;
}

// A deployment's state as a badge: its tone and the backend's own word for it.
const STATE_TONES = { starting: 'purple', live: 'green', stopped: 'neutral', failed: 'red' };
export function dedicatedState(deployment) {
  const state = deployment?.state || '';
  const fallback = state ? state[0].toUpperCase() + state.slice(1) : 'Unknown';
  return [STATE_TONES[state] || 'neutral', deployment?.state_label || fallback];
}

export const anyStarting = deployments => (deployments || []).some(deployment => deployment.state === 'starting');

// ── an open model as is (TRAINING_OPEN_MODELS_PLAN.md section 4) ──
export const DEDICATED_SOURCES = [
  { value: 'model', label: 'Your trained model', about: 'An approved model of one of your projects.' },
  { value: 'open_model', label: 'Open model', about: 'A model your workspace added from Hugging Face, as it is.' },
];

// The open models that can be deployed as is (the backend says which, and why not for the others).
export const deployableOpenModels = models => (models || []).filter(model => model?.deployable);

// The machines the start form offers: a trained model's, or those of the open machines that hold the chosen open model.
export function dedicatedMachinesFor(options, source, openModel) {
  if (source !== 'open_model') return options?.machines || [];
  const fits = new Set(openModel?.machines || []);
  return (options?.open_machines || []).filter(machine => fits.has(machine.instance_type));
}

// What a machine is, in a few words: its processors and whether it has a graphics card.
export function machineKind(machine) {
  if (!machine) return '';
  const cpus = machine.cpus ? `${machine.cpus} CPUs` : '';
  return machine.gpu ? [cpus, '1 GPU'].filter(Boolean).join(', ') : cpus;
}

// What an open model is, as its option and help line say it.
const TASK_WORDS = {
  'image-segmentation': 'finds regions in a photo', 'object-detection': 'finds objects in a photo',
  'image-classification': 'names what a photo shows', 'depth-estimation': 'estimates depth in a photo',
  'text-generation': 'answers chat messages',
};
export const openModelTask = model => TASK_WORDS[model?.task] || model?.task || '';
export function openModelLine(model) {
  if (!model) return '';
  return [model.repo, openModelTask(model), model.size, model.licence_name || model.licence].filter(Boolean).join(', ');
}

// Why no open model can be chosen.
export function missingOpenModel(models) {
  const list = models || [];
  if (!list.length) return 'Your workspace has no ready open model. Add one from Hugging Face on the Models page.';
  if (!deployableOpenModels(list).length) return list[0].why_not || 'None of your open models can be deployed as is.';
  return '';
}

// A deployment's source, as its row says it: the project and model, or the open model.
export function dedicatedSource(deployment) {
  if (deployment?.source === 'open_model' && deployment.open_model) {
    return { label: 'Open model', title: deployment.open_model.name || deployment.open_model.repo, detail: deployment.open_model.repo };
  }
  const model = deployment?.model;
  return { label: 'Trained model', title: deployment?.project?.name || '', detail: model ? modelName(model) : '' };
}

// How an app calls an open chat model: OpenAI's own client, with the deployment's address as its base URL.
export const DEDICATED_CHAT_LANGUAGES = ['Python', 'JavaScript', 'cURL'];
export const DEDICATED_CHAT_INSTALL = 'pip install openai';
export const chatBaseUrl = url => String(url || '').replace(/\/chat\/completions\/?$/, '');
export function dedicatedChatSnippet(language, url, name) {
  const base = chatBaseUrl(url);
  if (language === 'Python') {
    return `from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="<your app key>")

answer = client.chat.completions.create(
    model="${name}",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=256,
)
print(answer.choices[0].message.content)`;
  }
  if (language === 'JavaScript') {
    return `const answer = await fetch('${url}', {
  method: 'POST',
  headers: { Authorization: 'Bearer <your app key>', 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: '${name}', messages: [{ role: 'user', content: 'Hello' }], max_tokens: 256 }),
});
if (!answer.ok) throw new Error((await answer.json()).error.message);
console.log((await answer.json()).choices[0].message.content);`;
  }
  return `curl -X POST "${url}" \\
  -H "Authorization: Bearer <your app key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${name}", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 256}'`;
}

// The languages, install line and code of "Use", by how the deployment is called.
export const useLanguages = deployment => (deployment?.call === 'chat' ? DEDICATED_CHAT_LANGUAGES : DEDICATED_LANGUAGES);
export const useInstall = deployment => (deployment?.call === 'chat' ? DEDICATED_CHAT_INSTALL : DEDICATED_INSTALL);
export const usesInstall = (deployment, language) => language === (deployment?.call === 'chat' ? 'Python' : 'Python SDK');
export function useSnippet(deployment, language, url) {
  if (!deployment) return '';
  return deployment.call === 'chat' ? dedicatedChatSnippet(language, url, deployment.name) : dedicatedSnippet(language, url, deployment.name);
}

// How an app calls a dedicated deployment: Python through AADML's SDK (Client.dedicated, from 0.3.0), by the
// deployment's name. The key is never filled in: the code always says <your app key>.
export const DEDICATED_HOST = 'https://aadml.com';
export const DEDICATED_LANGUAGES = ['Python SDK', 'JavaScript', 'cURL'];
export const DEDICATED_INSTALL = 'pip install "aadml-training>=0.3"';
export function dedicatedSnippet(language, url, name) {
  if (language === 'Python SDK') {
    return `from aadml_training import Client

client = Client(api_key="<your app key>")      # or set AADML_API_KEY

result = client.dedicated("${name}", "room.jpg")   # JPEG, PNG or WebP
print(result)`;
  }
  if (language === 'JavaScript') {
    return `const form = new FormData();
form.append('file', photo);                       // a File or Blob: JPEG, PNG or WebP

const answer = await fetch('${url}', {
  method: 'POST',
  headers: { Authorization: 'Bearer <your app key>' },
  body: form,
});
if (!answer.ok) throw new Error((await answer.json()).error);
console.log(await answer.json());`;
  }
  return `curl -X POST "${url}" \\
  -H "Authorization: Bearer <your app key>" \\
  -F "file=@room.jpg"`;
}

export const publishedApi = {
  state: key => apiFetch(`${APP}/published/${enc(key)}/`, { timeoutMs: SLOW }),
  act: (key, action) => apiFetch(`${APP}/published/${enc(key)}/${action}/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
  // A model on a CPU can take a while on a large photo.
  predict: (key, file) => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch(`${APP}/published/${enc(key)}/predict/`, { method: 'POST', body: form, timeoutMs: 180000 });
  },
};

// The Deployments overview's time ranges, as the backend names them (app_api.py DEPLOYMENT_RANGES).
export const RUN_RANGES = [['1w', '1W'], ['2w', '2W'], ['1m', '1M'], ['all', 'All Time']];
export const API_REFERENCE = '/dashboard/help-center/api-reference';

// The overview's area chart: points {day, answered} drawn in a width × height box as a smooth curve that never dips
// below zero or overshoots a peak (monotone cubic, Fritsch–Carlson). Answers the line and area paths, the x and y of
// each point (for the hover readout) and the largest value.
export function runsChart(series, width = 1000, height = 200, pad = 8) {
  const n = series.length;
  if (!n) return { line: '', area: '', xs: [], ys: [], max: 0 };
  const max = Math.max(0, ...series.map(p => p.answered || 0));
  const xs = series.map((_, i) => (n === 1 ? width / 2 : (i * width) / (n - 1)));
  const ys = series.map(p => height - pad - (max ? ((p.answered || 0) / max) * (height - 2 * pad) : 0));
  const round = v => Math.round(v * 100) / 100;
  if (n === 1) {
    const line = `M0,${round(ys[0])} L${width},${round(ys[0])}`;
    return { line, area: `${line} L${width},${height} L0,${height} Z`, xs, ys, max };
  }
  const slopes = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const tangents = xs.map((_, i) => (i === 0 ? slopes[0] : i === n - 1 ? slopes[n - 2]
    : slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2));
  slopes.forEach((d, i) => {
    if (d === 0) { tangents[i] = 0; tangents[i + 1] = 0; return; }
    const a = tangents[i] / d; const b = tangents[i + 1] / d; const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); tangents[i] = t * a * d; tangents[i + 1] = t * b * d; }
  });
  let line = `M${round(xs[0])},${round(ys[0])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = (xs[i + 1] - xs[i]) / 3;
    line += ` C${round(xs[i] + third)},${round(ys[i] + tangents[i] * third)} ${round(xs[i + 1] - third)},${round(ys[i + 1] - tangents[i + 1] * third)} ${round(xs[i + 1])},${round(ys[i + 1])}`;
  }
  return { line, area: `${line} L${width},${height} L0,${height} Z`, xs, ys, max };
}

// A point of the overview in words: "20 Oct" for a day, "week of 13 Oct" for a week.
export function runsDay(iso, bucket = 'day') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return bucket === 'week' ? `week of ${text}` : text;
}

// Where a workspace page opens one of a project's own pages: App.vue follows this address (notifications.readDeepLink).
export const projectLink = (ref, page) => `#project/${enc(ref)}/${page}`;

// Trying a published model is three steps, in this order. A model made ready once stays ready: its first step is done.
export const TRY_STEPS = [
  ['preparing', 'Make it ready', 'Its published weights are turned into the form this server answers from. About a minute, and only once.'],
  ['starting', 'Start its test server', 'A trained model is placed on the shared test server in a few seconds; a published model starts a server of its own, in a few minutes.'],
  ['ready', 'Try a photo', 'Choose a photo: what the model finds is drawn on it. The photo is not kept.'],
];

export function trySteps(state) {
  const order = TRY_STEPS.map(([key]) => key);
  const made = state?.published?.state === 'ready';
  const at = order.indexOf(state?.phase);
  return TRY_STEPS.map(([key, label, hint], index) => {
    let now = 'next';
    if (at >= 0) now = index < at ? 'done' : index === at ? (key === 'ready' ? 'done' : 'now') : 'next';
    else if (index === 0 && made) now = 'done';
    if (index === 0 && state?.phase === 'failed') now = 'failed';
    return { key, label, hint, state: now };
  });
}

// An environment of the Deployments page in words, with a badge tone.
export function environmentState(environment) {
  if (environment.live) return environment.live.healthy === false ? ['amber', 'Not answering'] : ['green', 'Live'];
  if (environment.starting) return ['purple', 'Starting'];
  if (environment.stopped) return ['neutral', 'Stopped'];
  return ['neutral', 'Not deployed'];
}

export const modelName = model => (model ? `${model.name} ${model.version}${model.smoke ? ' (smoke test)' : ''}` : '');

// How long ago a moment was, as a person says it; a date once it is more than a week ago.
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const [value, unit] = seconds < 3600 ? [Math.floor(seconds / 60), 'minute'] : seconds < 86400 ? [Math.floor(seconds / 3600), 'hour'] : [Math.floor(seconds / 86400), 'day'];
  if (unit === 'day' && value > 7) return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

export function bytesText(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The AADML pages a Workspace Settings entry opens, outside this page. The others are pages or dialogs of their own.
export const SETTINGS_PAGES = { 'Plan & Billing': '/dashboard/billing', 'Credit Usage': '/dashboard/settings/usage' };

// A workflow of AADML's builder: its own page there, and where new ones are made.
export const workflowLink = id => `/dashboard/workflow-builder/${enc(id)}`;
export const WORKFLOW_BUILDER = '/dashboard/workflow-builder';
export const WORKFLOW_RUNS = '/dashboard/workflow-runs';
export const AADML_CHAT = '/dashboard/chat/new';

// A notification's link opens here when it is a page of this UI (only its hash changes), else it is followed.
export function openLink(link, where = globalThis.location) {
  if (!link) return;
  const [path, hash] = link.split('#');
  if (hash !== undefined && (path === '' || path === where.pathname)) where.hash = hash;
  else where.assign(link);
}
