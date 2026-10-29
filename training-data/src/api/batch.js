// Batch Processing on the workspace Deployments page: one model of a project run over that project's own photos,
// followed while it runs, and its results downloaded as one JSON Lines file.
// Backend: training_models_data/batch_api.py (workspace/batches/, .../<id>/cancel/, .../<id>/results/).
import { apiFetch, activeWorkspace, ApiError } from './client.js';

const APP = '/training-data/app';
const enc = encodeURIComponent;
// Starting a batch chooses its photos on the server; a little longer than a page.
const SLOW = 30000;

export const batchApi = {
  list: () => apiFetch(`${APP}/workspace/batches/`),
  start: ({ project, model, source, version }) => apiFetch(`${APP}/workspace/batches/`, {
    method: 'POST', body: { project, model, source, ...(source === 'version' ? { version } : {}) }, timeoutMs: SLOW,
  }),
  cancel: id => apiFetch(`${APP}/workspace/batches/${enc(id)}/cancel/`, { method: 'POST', body: {} }),
  download: id => downloadResults(id),
};

// The results are a file, not JSON: asked for with the person's own session and the selected workspace, as every
// other call, then handed to the browser to save.
export function resultsPath(id) { return `/api${APP}/workspace/batches/${enc(id)}/results/`; }

export async function downloadResults(id, { fetchImpl = fetch, doc = globalThis.document, store } = {}) {
  const headers = { Accept: 'application/x-ndjson, application/json' };
  const workspace = activeWorkspace(store);
  if (workspace) headers['X-Workspace-ID'] = workspace.id;
  let response;
  try {
    response = await fetchImpl(resultsPath(id), { headers, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach AADML. Check your connection and try again.');
  }
  if (!response.ok) {
    let message = 'The results could not be downloaded.';
    try { const data = await response.json(); if (typeof data?.error === 'string') message = data.error.slice(0, 300); } catch { /* not JSON */ }
    throw new ApiError(response.status, response.status === 403 ? 'forbidden' : 'server', message);
  }
  const blob = await response.blob();
  const name = fileNameFrom(response.headers.get('content-disposition')) || `batch-${id}-results.jsonl`;
  const url = URL.createObjectURL(blob);
  try {
    const link = doc.createElement('a');
    link.href = url; link.download = name; link.rel = 'noopener';
    doc.body.appendChild(link); link.click(); link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return name;
}

// The file name the server gave, from Content-Disposition; only safe characters are kept.
export function fileNameFrom(header) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(header || ''));
  if (!match) return '';
  let name = match[1];
  try { name = decodeURIComponent(name); } catch { /* keep as it is */ }
  return name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);
}

export const DEFAULT_LIMIT = 500;

// The photo choices of a project for the start dialog: all its photos, then each dataset version, with counts.
export function photoChoices(project) {
  if (!project) return [];
  const all = { value: 'all', label: 'All photos', photos: Number(project.photos) || 0 };
  const versions = (project.versions || []).map(v => ({
    value: `version:${v.name}`, version: v.name, photos: Number(v.photos) || 0,
    label: v.title ? `${v.title} (${v.name})` : `${v.kind_label || 'Dataset version'} ${v.name}`,
  }));
  return [all, ...versions];
}

// What a choice value means to the backend: {source, version}.
export function sourceOf(value) {
  const text = String(value || '');
  return text.startsWith('version:') ? { source: 'version', version: text.slice('version:'.length) } : { source: 'all', version: '' };
}

export const photosText = n => `${Number(n || 0).toLocaleString('en-US')} photo${Number(n) === 1 ? '' : 's'}`;

// Why a choice cannot start, or '' when it can.
export function limitProblem(count, limit = DEFAULT_LIMIT) {
  const n = Number(count) || 0;
  if (n <= 0) return 'There are no photos in this choice.';
  if (n > limit) return `This choice has ${photosText(n)}, and a batch takes at most ${limit.toLocaleString('en-US')} for now. Choose a dataset version with fewer photos.`;
  return '';
}

// Why the start button is off, in the order a person fixes it; '' when it can start.
export function startProblem({ may, project, model, choice, limit = DEFAULT_LIMIT }) {
  if (may && may.start === false) return may.reason || 'Batches cannot start here right now.';
  if (!project) return 'Choose a project.';
  if (project.running) return `${project.name} already has a batch running. Wait for it to end, or cancel it.`;
  if (!(project.models || []).length) return `${project.name} has no trained model yet.`;
  if (!model) return 'Choose a model.';
  if (!choice) return 'Choose the photos.';
  return limitProblem(choice.photos, limit);
}

export const modelLabel = m => (m ? `${m.name} ${m.version}${m.smoke ? ' (smoke test)' : ''}` : '');

// The line shown above Start: what will happen, in one sentence.
export function batchSummary(project, model, choice) {
  if (!project || !model || !choice) return '';
  const which = choice.value === 'all' ? `all ${photosText(choice.photos)} of ${project.name}` : `the ${photosText(choice.photos)} of ${choice.version}`;
  return `${modelLabel(model)} will look at ${which}, one at a time, and save what it finds in each.`;
}

// A batch's state chip: [tone, label].
const TONES = { queued: 'neutral', running: 'purple', done: 'green', failed: 'red', cancelled: 'neutral' };
const LABELS = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' };
export function batchState(b) {
  const state = b?.state || 'queued';
  return [TONES[state] || 'neutral', b?.state_label || LABELS[state] || state];
}

export const isActive = b => b?.state === 'queued' || b?.state === 'running';
export const anyActive = batches => (batches || []).some(isActive);

// The meter: the share answered and the share that failed, in whole percents that never add past 100.
export function progressParts(b) {
  const total = Math.max(0, Number(b?.total) || 0);
  const done = Math.min(total, Math.max(0, Number(b?.done) || 0));
  const failed = Math.min(total - done, Math.max(0, Number(b?.failed) || 0));
  if (!total) return { done: 0, failed: 0, processed: 0, total, percent: 0 };
  const donePct = Math.floor((done / total) * 100);
  const failedPct = Math.min(100 - donePct, Math.floor((failed / total) * 100));
  return { done: donePct, failed: failedPct, processed: done + failed, total, percent: Math.floor(((done + failed) / total) * 100) };
}

// The counts under the meter, said in words.
export function progressText(b) {
  const { processed, total } = progressParts(b);
  const failed = Number(b?.failed) || 0;
  if (b?.state === 'queued') return `Waiting to start, ${photosText(total)}`;
  if (b?.state === 'running' && b?.stage === 'placing' && !processed) return `Starting the model, ${photosText(total)}`;
  const base = `${processed.toLocaleString('en-US')} of ${photosText(total)}`;
  return failed ? `${base}, ${failed.toLocaleString('en-US')} without an answer` : base;
}

// What changed since the last read, said once for screen readers: a batch that ended, or one that started.
export function changeNotes(before, after) {
  const was = new Map((before || []).map(b => [b.id, b.state]));
  const notes = [];
  for (const b of after || []) {
    if (!was.has(b.id) || was.get(b.id) === b.state) continue;
    const name = `The batch of ${b.project?.name || 'a project'}`;
    if (b.state === 'done') notes.push(`${name} is done: ${progressText(b)}.`);
    else if (b.state === 'failed') notes.push(`${name} failed. ${b.error || ''}`.trim());
    else if (b.state === 'cancelled') notes.push(`${name} is cancelled.`);
    else if (b.state === 'running') notes.push(`${name} is running.`);
  }
  return notes.join(' ');
}

// How often the list is read again while a batch is queued or running.
export const POLL_MS = 3000;
