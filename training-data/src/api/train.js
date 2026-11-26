// The Train page's data (backend: training_models_data/app_api.py — training/, runs/, runs/<n>/, runs/<n>/<action>/).
// Runs train on the server's CPU through the app's own run path (runs.launch, the local provider).
import { apiFetch } from './client.js';
import { stepsLine } from './anyModel.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export async function loadTraining(store) {
  store.training = await apiFetch(`${base(store.ref)}/training/`);
  return store.training;
}

// Starting a run can take a while: a GPU machine is rented for it (RunPod) before the server answers (live,
// 2026-11-17: more than 15 s, and the page said "took too long" while the run had been made).
export const START_MS = 120000;

export const trainApi = {
  start: (ref, body) => apiFetch(`${base(ref)}/runs/`, { method: 'POST', body, timeoutMs: START_MS }),
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

// The key a start is sent with, kept while the person tries the SAME start again: pressing Start again after no answer
// came back (a timeout, a dropped connection) sends the same key, so the server gives the run it already made instead
// of a second paid one. A new key comes only when the form changes or a run was really started (``started``).
// ``body`` is what the start sends, without its key.
export function startKeys(make = startKey) {
  let sent = null; let key = '';
  return {
    keyFor(body) {
      const form = JSON.stringify(body ?? null);
      if (form !== sent || !key) { sent = form; key = make(); }
      return key;
    },
    started() { sent = null; key = ''; },
  };
}

// What to say when a start got no answer: it may have been made, so the person looks before pressing again, and
// pressing again is safe (the same key).
export const NO_ANSWER_START = 'No answer came back in time, so the run may have started. Its state is read again below; pressing Start again with the same settings does not start a second run.';

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
  // An open photo model's or a generation model's run counts steps of a batch, not rounds (hf_runs / diffusion_runs).
  if (progress.steps !== undefined && progress.rounds === undefined) return stepsLine(progress);
  const share = progress.rounds ? progress.rounds_done / progress.rounds : 0;
  const phase = { preparing: 'Preparing', training: 'Training', exporting: 'Exporting the model', done: 'Done' }[progress.phase] || progress.phase;
  return { share, text: `${phase} · round ${progress.current_round} of ${progress.rounds} · ${progress.passes_done} of ${progress.passes} photo passes` };
}

// What an unfinished run is doing when its job has said nothing of its progress yet (``progress`` empty): the run's and
// its latest attempt's own state, not always "Starting…" (live, 2026-11-17: a run that trained said "Starting…" all
// along). A run on one of the person's machines carries ``machine.label``, the server's own words for where it stands
// ("Waiting for your machine X: it is running another job …"), which come first. '' for a run that ended.
const STATE_RANK = { queued: 0, starting: 1, running: 2, finalizing: 3 };
export function runStateText(run, onGpu = false) {
  if (!run?.unfinished) return '';
  const said = run.machine?.label;
  if (typeof said === 'string' && said.trim()) return said.trim().slice(0, 300);
  const attempts = Array.isArray(run.attempts) ? run.attempts : [];
  const latest = attempts.reduce((a, b) => (!a || (Number(b?.number) || 0) >= (Number(a?.number) || 0) ? b : a), null);
  // The further of the two: the run's state can lag its attempt's for a moment, and the other way round.
  const states = [run.state, latest?.state].filter(s => s in STATE_RANK);
  const state = states.sort((a, b) => STATE_RANK[b] - STATE_RANK[a])[0] || run.state;
  if (state === 'finalizing') return 'Checking the result…';
  if (state === 'running') return 'Training…';
  if (run.on_own_machine) return 'Waiting for your machine to take the job…';
  if (state === 'queued') return onGpu ? 'Waiting for a GPU machine: one run trains at a time.' : 'Waiting for the CPU: one run trains at a time.';
  return latest?.submitted_at ? 'Starting the machine it trains on…' : 'Starting…';
}

// The fee a run on one of the workspace's own machines is charged, as "Where it trains" shows it (``price_text``,
// machines.fee_text: "$0.10 an hour, on your machine"). A machine of the person's is not free: AADML charges its platform
// fee by the second it trains (live, 2026-11-17: the review said "no AADML machine cost" while $0.0625 was held).
export function machineFeeLine(machine) {
  if (!machine) return '';
  const fee = String(machine.price_text || '').trim();
  return `Your machine ${machine.name}: ${fee ? `the platform fee, ${fee}` : 'the platform fee for your machine'}, charged by the second it trains`;
}
