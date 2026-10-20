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
  deployments: () => apiFetch(`${APP}/workspace/deployments/`, { timeoutMs: SLOW }),
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
