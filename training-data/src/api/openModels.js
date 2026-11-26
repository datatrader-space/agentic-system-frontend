// The workspace Models page's "Open models" tab (backend: training_models_data/open_models_api.py — open-models/,
// open-models/quote/, workspace/open-models/, workspace/open-models/<id>/remove/). Search Hugging Face Hub for open models AADML can train
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

// The kinds the search looks for (owner, 2026-11-26: the admin's search on the person's side; open_models.ADMIN_KINDS).
export const SEARCH_KINDS = [{ value: 'all', label: 'All models' }, { value: 'chat', label: 'Chat models' },
  { value: 'photo', label: 'Photo models' }, { value: 'image_generation', label: 'Image generation' },
  { value: 'video_generation', label: 'Video generation' }, { value: 'video_understanding', label: 'Video understanding' }];
// How many results show at once; "Show more results" shows the next ones (owner, 2026-11-26: at most 10).
export const SHOWN = 10;
// The pause after the last key before the search is asked (search as you type).
export const TYPE_PAUSE_MS = 350;
export const QUERY_LIMIT = 100;
export const REPO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
// While an added model is being fetched, the list is read again this often.
export const POLL_MS = 5000;

export const openModelsApi = {
  search: ({ q = '', kind = 'all', cursor = '' } = {}) =>
    apiFetch(`${APP}/open-models/?${query({ q: cleanQuery(q), kind, cursor })}`, { timeoutMs: SLOW }),
  list: () => apiFetch(`${APP}/workspace/open-models/`, { timeoutMs: SLOW }),
  // What adding a model costs, as the person pays it: worked out on the server (open_model_charges.py), never here.
  quote: repo => apiFetch(`${APP}/open-models/quote/?${query({ repo })}`, { timeoutMs: SLOW }),
  // ``place``: where the person chose to download it (machines | platform | runpod; open_models.PLACES): never chosen here.
  add: (repo, place) => apiFetch(`${APP}/workspace/open-models/`, { method: 'POST', body: { repo, place }, timeoutMs: SLOW }),
  // A full copy of a model kept for the person's own machines, on AADML's platform machine or RunPod, so RunPod can use it.
  copy: (id, place) => apiFetch(`${APP}/workspace/open-models/${enc(id)}/copy/`, { method: 'POST', body: { place }, timeoutMs: SLOW }),
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

// An added model's state as a badge: [tone, words]. A ready one is "Ready": what it is ready for (Use, Train) is said
// beside it from its uses (My models, the owner, 2026-11-03).
export function stateBadge(state) {
  if (state === 'ready') return ['green', 'Ready'];
  if (state === 'fetching') return ['purple', 'Being fetched'];
  if (state === 'failed') return ['amber', 'Fetch failed'];
  return ['neutral', 'Not added'];
}

export const anyFetching = models => (models || []).some(m => m.state === 'fetching');

// Why a result cannot be added now, in words; '' when it can. The backend decides again on add.
export function addRefusal(row, { mayAdd = false, gatedEnabled = false } = {}) {
  if (!mayAdd) return 'Adding a model needs the Train right in this workspace.';
  // The server says, for this person, whether it may be added and why not (open_models.person_search).
  if (row && row.addable === false) return row.why_not || 'This model cannot be added.';
  if (row && row.addable === true) return '';
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

// Where a model can be downloaded, as the backend offers it for this workspace (quote.places): each with its price or why
// it cannot be chosen now. Nothing is picked here: the person chooses (the owner, 2026-11-26).
export const PLACE_HELP = {
  machines: 'Each of your machines downloads it from Hugging Face the first time it uses it. AADML keeps only its small files. It cannot run on RunPod until you make a copy.',
  platform: "Downloaded once on AADML's platform machine and kept in AADML's storage: it runs anywhere, RunPod too.",
  runpod: "Downloaded once on RunPod and kept in AADML's storage: it runs anywhere, RunPod too.",
};

export function placeChoices(quote, { only = null } = {}) {
  return (quote?.places || [])
    .filter(p => !only || only.includes(p.value))
    .map(p => ({ value: p.value, label: p.label, help: PLACE_HELP[p.value] || '', refused: p.refused || '',
      price: p.price?.paid ? `About ${p.price.fetch?.about}${p.price.storage?.per_day ? `, then ${p.price.storage.per_day} a day` : ''}`
        : p.price?.paid === false ? 'Not charged on this server' : '' }));
}

// The quote with the price of the place chosen (the lines and the note follow the person's choice); the quote as it is
// when nothing is chosen yet.
export function quoteFor(quote, place) {
  const chosen = (quote?.places || []).find(p => p.value === place);
  return chosen?.price ? { ...quote, price: chosen.price } : quote;
}

// What an added model kept for the person's own machines says, '' for one with a full copy.
export function placeLine(model) {
  if (!model || model.complete !== false || model.state !== 'ready') return '';
  return 'Kept for your own machines: each one downloads its weights the first time. Make a copy to use it on RunPod.';
}

// The Add dialog's lines, from the quote the backend gave (GET open-models/quote/): every price is the backend's text,
// with the markup in, shown as it is; nothing is worked out here. [{label, value}], in the order they are shown.
export function quoteLines(quote) {
  if (!quote) return [];
  const lines = [
    { label: 'Model', value: [quote.publisher, quote.name].filter(Boolean).join(' / ') || quote.repo || '' },
    { label: 'Licence', value: quote.licence_name || quote.licence || '' },
    { label: 'Size', value: [quote.size, quote.bytes ? bytesText(quote.bytes) : ''].filter(Boolean).join(', ') },
  ];
  const price = quote.price || {};
  if (price.paid) {
    lines.push({ label: 'Fetch', value: `About ${price.fetch?.about}, up to ${price.fetch?.at_most} held` });
    lines.push({ label: 'Storage', value: `${price.storage?.per_day} a day, charged a day in advance` });
  } else if (price.paid === false) {
    lines.push({ label: 'Cost', value: 'Not charged on this server' });
  }
  return lines.filter(line => line.value);
}

// What the dialog says under the lines: the backend's own words on how the fetch and the storage are charged.
export function quoteNote(quote) {
  return quote?.price?.note || '';
}

// An added model's badge, its storage counted: an unpaid one says so (it is kept, and not used until it is paid).
export function modelBadge(model) {
  if (model?.state === 'ready' && model?.unpaid) return ['amber', 'Unpaid'];
  return stateBadge(model?.state);
}

// The storage line of an added model (My models, Workspace models): the backend's words, '' when it is not charged.
export function storageLine(model) {
  const storage = model?.storage;
  return storage?.charged ? storage.said || '' : '';
}

// What an added photo model trains for on a project's Train tab (open_models.TRAIN_TASK_WORDS, ``train_task_label``;
// ANY_MODEL_RUN_AND_TRAIN_PLAN.md P1b): every photo model whose head says its task trains there, by hf-train.
export function trainNote(model) {
  if (!model) return '';
  const gb = model.need_gb_train ? ` Training it needs about ${model.need_gb_train} GB of GPU memory (estimated).` : '';
  return model.train_task_label
    ? `Trains on a project's Train tab for ${model.train_task_label.charAt(0).toLowerCase()}${model.train_task_label.slice(1)}.${gb}`
    : `Trains on a project's Train tab for the task its head is made for.${gb}`;
}

// The GPU memory a model needs, as a card's facts: [[term, value]] for what the server said, nothing guessed.
export function gpuFacts(row) {
  const facts = [];
  if (row?.train_task_label) facts.push(['Trains for', row.train_task_label.split(':')[0]]);
  if (row?.need_gb_run) facts.push(['To run', `about ${row.need_gb_run} GB GPU`]);
  if (row?.need_gb_train) facts.push(['To train', `about ${row.need_gb_train} GB GPU`]);
  return facts;
}
