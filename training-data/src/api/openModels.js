// The workspace Models page's "Open models" tab (backend: training_models_data/open_models_api.py — open-models/,
// workspace/open-models/, workspace/open-models/<id>/remove/). Search Hugging Face Hub for open models AADML can train
// or serve, and add one to the workspace as a base model for training. Every rule is the backend's (licence,
// architecture, safetensors only, no code of its own, size); the checks here only say early what it would say.
//
// Everything a search returns comes from Hugging Face and is untrusted: it is shown as text only (Vue's {{ }}), never
// as HTML, and a link to the Hub is built here from a checked repository name, never taken from the answer.
import { apiFetch } from './client.js';
import { query } from './workspace.js';

const APP = '/training-data/app';
const enc = encodeURIComponent;
// The backend waits up to 25 s for the Hub; an add also reads the model from the Hub and starts a fetch.
const SLOW = 45000;

export const KINDS = [{ value: 'chat', label: 'Chat' }, { value: 'photo', label: 'Photo' }];
export const USES = [{ value: 'train', label: 'Train' }, { value: 'deploy', label: 'Deploy as is' }];
export const QUERY_LIMIT = 100;
export const REPO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
// While an added model is being fetched, the list is read again this often.
export const POLL_MS = 5000;

export const openModelsApi = {
  search: ({ q = '', kind = 'chat', use = 'train', cursor = '' } = {}) =>
    apiFetch(`${APP}/open-models/?${query({ q: cleanQuery(q), kind, use, cursor })}`, { timeoutMs: SLOW }),
  list: () => apiFetch(`${APP}/workspace/open-models/`, { timeoutMs: SLOW }),
  add: repo => apiFetch(`${APP}/workspace/open-models/`, { method: 'POST', body: { repo }, timeoutMs: SLOW }),
  remove: id => apiFetch(`${APP}/workspace/open-models/${enc(id)}/remove/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
};

// The words as the backend reads them: one line, spaces collapsed.
export function cleanQuery(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function queryProblem(text) {
  return cleanQuery(text).length > QUERY_LIMIT ? `Search with at most ${QUERY_LIMIT} characters.` : '';
}

// The model's page on Hugging Face, from a checked name only; '' for anything else.
export function hubLink(repo) {
  const name = String(repo ?? '');
  return REPO.test(name) && !name.includes('..') ? `https://huggingface.co/${name}` : '';
}

// 1234 → "1.2K", 3400000 → "3.4M": how a count of downloads or likes is shown.
export function shortCount(value) {
  const n = Number(value) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.max(0, Math.round(n)));
}

export function bytesText(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(/\.0$/, '')} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(0, Math.round(n / 1024))} KB`;
}

// What a result can be used for, in words.
export function usesText(uses = []) {
  const train = uses.includes('train'); const deploy = uses.includes('deploy');
  if (train && deploy) return 'Train, or deploy as is';
  if (train) return 'Train';
  return deploy ? 'Deploy as is' : '';
}

// An added model's state as a badge: [tone, words].
export function stateBadge(state) {
  if (state === 'ready') return ['green', 'Ready to train'];
  if (state === 'fetching') return ['purple', 'Being fetched'];
  if (state === 'failed') return ['amber', 'Fetch failed'];
  return ['neutral', 'Not added'];
}

export const anyFetching = models => (models || []).some(m => m.state === 'fetching');

// Why a result cannot be added now, in words; '' when it can. The backend decides again on add.
export function addRefusal(row, { mayAdd = false, gatedEnabled = false } = {}) {
  if (!mayAdd) return 'Adding a model needs the Train right in this workspace.';
  if (row?.gated && !gatedEnabled) return row.gated_note || 'Its publisher asks for its terms to be accepted first, and AADML\'s own Hugging Face access is not set up yet.';
  return (row?.uses || []).length ? '' : 'AADML can neither train nor serve this model.';
}

// What an added model is for, said under its name.
export function addedFor(model) {
  const uses = model?.uses || [];
  if (uses.includes('train') && uses.includes('deploy')) return 'Offered in the Train tab, and can be deployed as is.';
  if (uses.includes('train')) return 'Offered in the Train tab.';
  return uses.includes('deploy') ? 'Deployed as is from a dedicated deployment; not offered for training.' : '';
}

// Why some models of the page are not shown, as one sentence, most common reason first; '' when none was left out.
export function hiddenSummary(hidden = {}, reasons = {}) {
  const rows = Object.entries(hidden || {}).filter(([, n]) => Number(n) > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, n]) => sum + Number(n), 0);
  if (!total) return '';
  const words = rows.map(([code, n]) => `${n}: ${String(reasons?.[code] || code).replace(/\.$/, '').toLowerCase()}`);
  return `${total} model${total === 1 ? '' : 's'} on this page ${total === 1 ? 'is' : 'are'} not shown (${words.join('; ')}).`;
}

// The next page's results after the ones already shown, each model once.
export function mergePage(shown = [], page = []) {
  const seen = new Set(shown.map(r => r.repo));
  return [...shown, ...page.filter(r => !seen.has(r.repo))];
}

// What the result list says to a screen reader once a search has answered.
export function resultsSaid(count, more) {
  if (!count) return 'No model matches. Try other words, or switch between Photo and Chat.';
  return `${count} model${count === 1 ? '' : 's'} shown${more ? '; more can be loaded' : ''}.`;
}
