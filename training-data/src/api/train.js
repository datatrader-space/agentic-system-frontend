// The Train page's data (backend: training_models_data/app_api.py — training/, runs/, runs/<n>/, runs/<n>/<action>/).
// Runs train on the server's CPU through the app's own run path (runs.launch, the local provider).
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export async function loadTraining(store) {
  store.training = await apiFetch(`${base(store.ref)}/training/`);
  return store.training;
}

export const trainApi = {
  start: (ref, body) => apiFetch(`${base(ref)}/runs/`, { method: 'POST', body }),
  run: (ref, number) => apiFetch(`${base(ref)}/runs/${enc(number)}/`),
  act: (ref, number, action) => apiFetch(`${base(ref)}/runs/${enc(number)}/${action}/`, { method: 'POST', body: {} }),
};

// The Train form's choices as the backend names them: "RF-DETR" -> "rf-detr", "Aadml-Vision-seg-A0" -> "segformer-b0".
export function modelValue(models, label) {
  return (models || []).find(m => m.label === label)?.value || '';
}

// A key for one press of "Start training": a resent request starts the same run, not a second one.
export function startKey() {
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// How far a run says it is, as one line and a share (0..1) for the progress bar; null when it has said nothing.
export function progressLine(progress) {
  if (!progress) return null;
  const share = progress.rounds ? progress.rounds_done / progress.rounds : 0;
  const phase = { preparing: 'Preparing', training: 'Training', exporting: 'Exporting the model', done: 'Done' }[progress.phase] || progress.phase;
  return { share, text: `${phase} · round ${progress.current_round} of ${progress.rounds} · ${progress.passes_done} of ${progress.passes} photo passes` };
}
