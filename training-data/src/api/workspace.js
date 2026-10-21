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
};

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
  ['starting', 'Start its test server', 'The model is loaded on a test server here. A few seconds, up to a few minutes on a busy server.'],
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
