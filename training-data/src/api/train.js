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
  // The GPUs and locations a run of ``{ version, model, size }`` can train on now (placement.py; training is GPU only;
  // its memory is measured, server side), and ``own_machines``: the workspace's machines, each saying whether it fits.
  machines: (ref, choice = {}) => apiFetch(`${base(ref)}/runs/machines/?${new URLSearchParams(Object.entries(choice).filter(([, v]) => v !== '' && v != null))}`),
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
// A person's machine getting a training job ready (agent 1.3.7): what comes down and how far, in words. Its runtime
// counts only once it trains. null for any other progress.
const READY_PART = { files: 'the base model and data', image: 'the training image', copy: 'the files into the job' };
export function readyText(progress) {
  if (!progress || !['downloading', 'starting'].includes(progress.phase)) return null;
  if (progress.phase === 'starting') return 'Starting the training on your machine';
  const gb = n => (n / 1e9).toFixed(n >= 1e10 ? 0 : 1);
  const part = READY_PART[progress.part] || 'its files';
  const amount = progress.total_bytes ? `: ${gb(progress.done_bytes)} of ${gb(progress.total_bytes)} GB` : progress.done_bytes ? `: ${gb(progress.done_bytes)} GB` : '';
  return `Downloading ${part}${amount}`;
}

export function progressLine(progress) {
  if (!progress) return null;
  const ready = readyText(progress);
  if (ready) return { share: progress.total_bytes ? progress.done_bytes / progress.total_bytes : 0, text: ready };
  const share = progress.rounds ? progress.rounds_done / progress.rounds : 0;
  const phase = { preparing: 'Preparing', training: 'Training', exporting: 'Exporting the model', done: 'Done' }[progress.phase] || progress.phase;
  return { share, text: `${phase} · round ${progress.current_round} of ${progress.rounds} · ${progress.passes_done} of ${progress.passes} photo passes` };
}
