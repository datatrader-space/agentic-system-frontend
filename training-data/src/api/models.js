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

// Published models that were asked for and are not in the backend's catalogue: shown, marked "Coming soon".
export const COMING_SOON = [
  { name: 'SAM 3', publisher: 'Meta AI', kind: 'Instance segmentation', description: 'Promptable object masks and polygons.' },
  { name: 'SAM 2', publisher: 'Meta AI', kind: 'Instance segmentation', description: 'Box and point guided segmentation.' },
  { name: 'Qwen VL', publisher: 'Alibaba', kind: 'Text prompting', description: 'Visual questions and image descriptions.' },
  { name: 'Florence-2', publisher: 'Microsoft', kind: 'Text prompting', description: 'Captioning, detection and grounding.' },
  { name: 'CLIP', publisher: 'OpenAI', kind: 'Classification', description: 'Image and text similarity.' },
  { name: 'YOLO-World', publisher: 'Tencent AI Lab', kind: 'Object detection', description: 'Open vocabulary object detection.' },
  { name: 'DocTR', publisher: 'Mindee', kind: 'OCR', description: 'Document text recognition.' },
  { name: 'EasyOCR', publisher: 'JaidedAI', kind: 'OCR', description: 'Text recognition across languages.' },
].map(row => ({ ...row, coming: true, soon: true, why_not: 'Not available in AADML yet.' }));

// The catalogue as the page lists it: the backend's rows, then the ones coming soon; filtered by words and kind.
export function catalogue(rows, words = '', kind = '') {
  const known = new Set((rows || []).map(row => row.name.toLowerCase()));
  const all = [...(rows || []), ...COMING_SOON.filter(row => !known.has(row.name.toLowerCase()))];
  const wanted = words.trim().toLowerCase();
  return all.filter(row => (!kind || row.kind === kind)
    && (!wanted || `${row.name} ${row.publisher} ${row.description}`.toLowerCase().includes(wanted)));
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
