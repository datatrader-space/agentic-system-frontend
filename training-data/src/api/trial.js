// The project's Test page (backend: training_models_data/app_api.py — test/, models/<n>/try/, models/<n>/try/<start|stop>/,
// models/<n>/try/predict/). The rules are the old Try page's (trials.py): a test server starts only when asked.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export const trialApi = {
  models: ref => apiFetch(`${base(ref)}/test/`, { timeoutMs: 60000 }),
  state: (ref, number) => apiFetch(`${base(ref)}/models/${enc(number)}/try/`, { timeoutMs: 60000 }),
  act: (ref, number, action) => apiFetch(`${base(ref)}/models/${enc(number)}/try/${action}/`, { method: 'POST', body: {}, timeoutMs: 60000 }),
  // A model on a CPU can take a while on a large photo.
  predict: (ref, number, file) => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch(`${base(ref)}/models/${enc(number)}/try/predict/`, { method: 'POST', body: form, timeoutMs: 180000 });
  },
};

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// What the model said about the photo as a whole, as the old Try page words it.
export const VERDICTS = {
  success: ['green', 'Walls found', 'The model is sure of at least one wall.'],
  low_confidence: ['amber', 'Found, but not sure', 'The model found walls, but is not sure of them: each is below the confidence it must reach.'],
  no_detection: ['neutral', 'Nothing found', 'The model found no wall above the confidence it returns a wall from.'],
};

// The answer with only what reaches ``least`` (0..1): the slider filters in the browser, the model is not asked again.
export function filtered(answer, least = 0) {
  if (!answer) return null;
  const keep = found => (found.confidence ?? 1) >= least;
  const walls = (answer.walls || []).filter(keep);
  const openings = (answer.openings || []).filter(keep);
  return { ...answer, walls, openings, hidden: (answer.walls || []).length - walls.length + (answer.openings || []).length - openings.length };
}

// Where a label goes: the middle of its points.
export function middle(points) {
  const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

export const percent = value => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`);
