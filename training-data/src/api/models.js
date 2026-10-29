// The project's Models page (backend: training_models_data/app_api.py — models/, models/<n>/<action>/,
// models/<n>/evaluate/, models/usage/). The rules are the old pages': registry, approvals, evaluations, usage.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}/models`;

// These answers look at stored files and the job runtime, so they get longer than a page request; "check" reads every
// stored file back and hashes it, longer still.
const SLOW = 60000;
export const modelsApi = {
  load: ref => apiFetch(`${base(ref)}/`, { timeoutMs: SLOW }),
  act: (ref, number, action, body = {}) => apiFetch(`${base(ref)}/${enc(number)}/${action}/`, { method: 'POST', body, timeoutMs: action === 'check' ? 2 * SLOW : SLOW }),
  evaluateForm: (ref, number) => apiFetch(`${base(ref)}/${enc(number)}/evaluate/`, { timeoutMs: SLOW }),
  evaluate: (ref, number, body) => apiFetch(`${base(ref)}/${enc(number)}/evaluate/`, { method: 'POST', body, timeoutMs: SLOW }),
  usage: (ref, days) => apiFetch(`${base(ref)}/usage/?days=${enc(days)}`, { timeoutMs: SLOW }),
};

// A write whose answer never came may still have been done on the server: the page reads the models again before
// the person can press the button a second time.
export const unanswered = error => error?.code === 'timeout' || error?.code === 'network';

// The catalogue as the page lists it, filtered by words, kind and family ('vision' or 'llm'). Every row is the
// backend's (families.py): the coming-soon models moved there on 2026-10-28, so the page and the agent read one list.
export function catalogue(rows, words = '', kind = '', family = '') {
  const wanted = words.trim().toLowerCase();
  return (rows || []).filter(row => (!kind || row.kind === kind) && (!family || (row.family || 'vision') === family)
    && (!wanted || `${row.name} ${row.publisher} ${row.description}`.toLowerCase().includes(wanted)));
}

// How an app calls one of AADML's ready-to-use models ("Use model"). Python uses AADML's SDK (aadml-training on
// pypi.org); JavaScript and cURL call the address. The key is never filled in.
export const USE_LANGUAGES = ['Python SDK', 'JavaScript', 'cURL'];
export const SDK_INSTALL = 'pip install aadml-training';
export function useSnippet(language, url, model) {
  if (language === 'Python SDK') {
    return `from aadml_training import Client

client = Client(api_key="<your app key>")      # or set AADML_API_KEY

result = client.run("${model}", "room.jpg")
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

// What one call to a ready-to-use model costs, as the "Use model" dialog says it: its price with the markup
// (platform_api.use_row's usd_per_call), to four decimals as it is under a cent, and who pays. No price: no amount.
export function callCostText(use) {
  const price = Number(use?.usd_per_call);
  if (use?.usd_per_call === null || use?.usd_per_call === undefined || use?.usd_per_call === '' || Number.isNaN(price)) {
    return use?.cost_note || '';
  }
  return `$${price.toFixed(4)} a call. ${use.cost_note || ''}`.trim();
}

// A measure's value as the page shows it: a share as a percentage, an error as a share of the photo's diagonal.
export function measureText(key, value) {
  if (value === null || value === undefined) return '—';
  if (key === 'median_corner_error' || key === 'golden_regression') return `${(value * 100).toFixed(2)}% of the diagonal`;
  return `${Math.round(value * 1000) / 10}%`;
}

// Whether a value meets its threshold ("at_least" / "at_most"); null when there is nothing to compare.
export function meets(measure, value) {
  if (value === null || value === undefined || measure.threshold === null || measure.threshold === undefined) return null;
  return measure.direction === 'at_most' ? value <= measure.threshold : value >= measure.threshold;
}

// A duration in milliseconds as a person reads it.
export function msText(ms) {
  if (ms === null || ms === undefined) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
