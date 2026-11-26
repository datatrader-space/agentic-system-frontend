// Training any open photo model and an image or video generation model, and trying what they make (ADM-1365;
// backend: training_models_data/app_api.py training() ``hf_tasks``, ``open_models``, ``generation``; runs/ and
// runs/machines/ with ``task`` or ``generation``; photos/<id>/caption/; models/<n>/try/generate/; hf_runs.py,
// diffusion_runs.py, trials.py). The server checks every value again: these helpers only save a call it would refuse,
// and word what it sends back. Nothing here decides who may train or what is trained.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

// ── an open photo model's run (hf-train) ──────────────────────────────────────────────────────────────────────

// The figures each task's run measures, as hf_runs.METRICS names them: used when a run row carries no ``labels``.
export const FIGURE_WORDS = {
  map: 'mAP (COCO, IoU 0.50 to 0.95)', map50: 'mAP at IoU 0.50', mar100: 'mAR, 100 detections a photo',
  mean_iou: 'Mean IoU of the classes', mean_iou_with_background: 'Mean IoU with the background', pixel_accuracy: 'Pixel accuracy',
  mask_map: 'Mask mAP (COCO)', mask_map50: 'Mask mAP at IoU 0.50', mask_mar100: 'Mask mAR, 100 a photo',
  box_map: 'Box mAP (COCO)', box_map50: 'Box mAP at IoU 0.50',
  final_loss: 'Last step’s loss', mean_loss_last_10pct: 'Mean loss, last tenth', steps: 'Steps trained',
};
export const TASK_FIGURES = {
  'object-detection': ['map', 'map50', 'mar100'],
  'semantic-segmentation': ['mean_iou', 'mean_iou_with_background', 'pixel_accuracy'],
  'instance-segmentation': ['mask_map', 'mask_map50', 'mask_mar100', 'box_map', 'box_map50'],
};

// The task an added model is trained for by default: its own (``train_task``), else the first task the tab offers.
export function defaultTask(model, tasks = []) {
  const own = model?.train_task;
  if (own && tasks.some(t => t.value === own)) return own;
  return own || tasks[0]?.value || '';
}

// The settings a run of ``task`` starts from: the model's own when it is trained for that task, else the task's.
export function startingSettings(model, task, tasks = []) {
  if (model && model.train_task === task && model.settings && Object.keys(model.settings).length) return model.settings;
  return tasks.find(t => t.value === task)?.settings || {};
}

// The settings form, filled from what the server says a run starts with. LoRA and a frozen backbone are off unless
// the settings say otherwise; the flip chance is blank (the trainer's own) unless set.
export function settingsForm(settings = {}) {
  const lora = settings.lora || {};
  const flip = settings.augmentation?.horizontal_flip;
  return {
    epochs: settings.epochs ?? 30, learning_rate: settings.learning_rate ?? 1e-4, batch_size: settings.batch_size ?? 4,
    resolution: settings.resolution ?? 512, weight_decay: settings.weight_decay ?? 0,
    freeze_backbone: !!settings.freeze_backbone,
    lora_enabled: !!lora.enabled, lora_r: lora.r ?? 16, lora_alpha: lora.alpha ?? 32, lora_dropout: lora.dropout ?? 0.05,
    flip: flip === undefined || flip === null ? '' : flip,
  };
}

// hf_runs.OVERRIDABLE's ranges for the fields this form sets: [lowest, highest, whole number].
const HF_RANGES = {
  epochs: [1, 1000, true, 'Epochs'], learning_rate: [1e-8, 1, false, 'The learning rate'],
  batch_size: [1, 512, true, 'The batch size'], resolution: [32, 4096, true, 'The photo side'],
  weight_decay: [0, 1, false, 'The weight decay'], lora_r: [1, 512, true, 'The LoRA rank'],
  lora_alpha: [1, 2048, true, 'The LoRA alpha'], lora_dropout: [0, 0.9, false, 'The LoRA dropout'],
  flip: [0, 1, false, 'The chance of a flip'],
};
function numberOf(form, name, ranges) {
  const [low, high, whole, words] = ranges[name];
  const raw = form[name];
  const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (String(raw ?? '').trim() === '' || !Number.isFinite(value) || value < low || value > high || (whole && !Number.isInteger(value))) {
    return { error: `${words} is ${whole ? 'a whole number' : 'a number'} from ${low} to ${high}.`, field: name };
  }
  return { value };
}

// The ``settings`` a start sends: every number of the form (checked), LoRA when it is on, a frozen backbone when it is
// on, the flip chance when one is given. { settings } | { error, field }.
export function settingsBody(form) {
  const settings = {};
  for (const name of ['epochs', 'learning_rate', 'batch_size', 'resolution', 'weight_decay']) {
    const got = numberOf(form, name, HF_RANGES);
    if (got.error) return got;
    settings[name] = got.value;
  }
  if (form.lora_enabled && form.freeze_backbone) {
    return { error: 'Choose LoRA or a frozen backbone, not both: LoRA already leaves the base weights as they are.', field: 'freeze_backbone' };
  }
  if (form.freeze_backbone) settings.freeze_backbone = true;
  if (form.lora_enabled) {
    const lora = { enabled: true };
    for (const [name, key] of [['lora_r', 'r'], ['lora_alpha', 'alpha'], ['lora_dropout', 'dropout']]) {
      const got = numberOf(form, name, HF_RANGES);
      if (got.error) return got;
      lora[key] = got.value;
    }
    settings.lora = lora;
  }
  if (String(form.flip ?? '').trim() !== '') {
    const got = numberOf(form, 'flip', HF_RANGES);
    if (got.error) return got;
    settings.augmentation = { horizontal_flip: got.value };
  }
  return { settings };
}

// The words of an added model's GPU memory: what training takes, against AADML's largest GPU.
export function gpuLine(model) {
  if (!model) return '';
  const parts = [];
  if (model.need_gb_train) parts.push(`Training needs about ${model.need_gb_train} GB of GPU memory (estimated)`);
  if (model.largest_gpu_gb) parts.push(`AADML's largest GPU has ${model.largest_gpu_gb} GB`);
  return parts.length ? `${parts.join('; ')}.` : '';
}

// What a run's place answer says it needs: "About 18 GB of GPU memory (estimated): batch 4 at 512 px".
export function needsLine(needs) {
  if (!needs || !needs.gpu_gb) return '';
  return `About ${needs.gpu_gb} GB of GPU memory${needs.estimated ? ' (estimated)' : ''}${needs.settings ? `: ${needs.settings}` : ''}.`;
}

// The query of runs/machines/: an open photo model's (``task``) or a generation model's (``generation``). Settings
// are not sent (a query carries no object); epochs is, as the server reads it.
export function machinesQuery({ version, model, task, epochs, generation } = {}) {
  const pairs = generation ? { generation: 1, version, model, task } : { version, model, task, epochs };
  return Object.fromEntries(Object.entries(pairs).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

// ── a generation model's LoRA (diffusion-train) ──────────────────────────────────────────────────────────────

export const GEN_TASK_WORDS = {
  'text-to-image': 'Text to image', 'image-to-image': 'Image to image',
  'text-to-video': 'Text to video', 'image-to-video': 'Image to video',
};
export const genTaskWords = task => GEN_TASK_WORDS[task] || task || '';

export function generationForm(settings = {}) {
  return {
    rank: settings.rank ?? 16, max_train_steps: settings.max_train_steps ?? 1000, learning_rate: settings.learning_rate ?? 1e-4,
    trigger_words: (settings.trigger_words || []).join(', '), sample_prompts: (settings.sample_prompts || []).join('\n'),
  };
}

// diffusion_runs.OVERRIDABLE's ranges for this form, and its 8 trigger words of 64 characters, 8 prompts of 500.
const GEN_RANGES = {
  rank: [1, 256, true, 'The LoRA rank'], max_train_steps: [1, 100000, true, 'The number of steps'],
  learning_rate: [1e-7, 1e-2, false, 'The learning rate'],
};
export function generationBody(form) {
  const settings = {};
  for (const name of ['rank', 'max_train_steps', 'learning_rate']) {
    const got = numberOf(form, name, GEN_RANGES);
    if (got.error) return got;
    settings[name] = got.value;
  }
  const words = String(form.trigger_words || '').split(',').map(w => w.trim()).filter(Boolean);
  if (words.length > 8 || words.some(w => w.length > 64)) return { error: 'At most 8 trigger words, each up to 64 characters.', field: 'trigger_words' };
  const prompts = String(form.sample_prompts || '').split('\n').map(p => p.trim()).filter(Boolean);
  if (prompts.length > 8 || prompts.some(p => p.length > 500)) return { error: 'At most 8 sample prompts, one a line, each up to 500 characters.', field: 'sample_prompts' };
  if (words.length) settings.trigger_words = words;
  if (prompts.length) settings.sample_prompts = prompts;
  return { settings };
}

// ── run progress and figures ─────────────────────────────────────────────────────────────────────────────────

// How far an hf or diffusion run says it is (hf_runs.progress, diffusion_runs.progress): steps of a batch.
export function stepsLine(progress) {
  if (!progress || !Number(progress.steps)) return null;
  const steps = Number(progress.steps); const done = Math.min(Number(progress.steps_done) || 0, steps);
  const left = progress.steps_left ?? Math.max(0, steps - done);
  const phase = { preparing: 'Preparing', training: 'Training', exporting: 'Exporting the model', sampling: 'Making sample pictures', done: 'Done' }[progress.phase] || progress.phase || 'Training';
  return { share: done / steps, text: `${phase} · step ${done} of ${steps} · ${left} left` };
}

// A run's figures as rows to show: the primary one first, each with its label and value ('n/a' when not measured).
export function figureRows(figures) {
  if (!figures || typeof figures !== 'object') return [];
  const final = figures.final || {}; const labels = figures.labels || {};
  const names = Object.keys(labels).length ? Object.keys(labels) : (TASK_FIGURES[figures.task] || Object.keys(final));
  const ordered = figures.primary && names.includes(figures.primary) ? [figures.primary, ...names.filter(n => n !== figures.primary)] : names;
  return ordered.map(name => {
    const value = final[name];
    const shown = typeof value === 'number' && Number.isFinite(value) ? (name === 'steps' ? String(value) : value.toFixed(4)) : 'n/a';
    return { name, label: labels[name] || FIGURE_WORDS[name] || name, value: shown, primary: name === figures.primary };
  });
}

// A run row's one-line figure: "mAP (COCO…) 0.4123" or ''.
export function primaryFigure(figures) {
  const first = figureRows(figures).find(r => r.primary && r.value !== 'n/a');
  return first ? `${first.label} ${first.value}` : '';
}

export const runKindWords = run => (run?.kind === 'hf' ? 'Open photo model' : run?.kind === 'diffusion' ? 'Generation LoRA' : '');

// ── captions ─────────────────────────────────────────────────────────────────────────────────────────────────

export const CAPTION_MAX = 1000;
// What is saved: spaces made single, as the server does. { caption } | { error }.
export function cleanCaption(raw) {
  const caption = String(raw ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (caption.length > CAPTION_MAX) return { error: `A caption is at most ${CAPTION_MAX} characters.` };
  return { caption };
}
export const captionApi = {
  save: (ref, photo, caption) => apiFetch(`${base(ref)}/photos/${enc(photo)}/caption/`, { method: 'POST', body: { caption } }),
};

// ── trying a trained version ─────────────────────────────────────────────────────────────────────────────────

// A LoRA of a generation model (``served_form`` diffusers-lora): asked with a prompt, on the person's own machine.
// The test/ list and the try state may say it (``served_form``; a hook until the backend sends it there), and a run's
// ``kind`` 'diffusion' says it too.
export const isLoraModel = m => !!m && (m.served_form === 'diffusers-lora' || m.kind === 'diffusion');

export const LORA_SCALE = { min: 0, max: 2, step: 0.05, start: 1 };
// The body of a LoRA try: what generateBody makes, with the LoRA's strength. { body } | { error, field }.
export function loraBody(made, scale) {
  if (made.error) return made;
  const value = Number(scale);
  if (!Number.isFinite(value) || value < LORA_SCALE.min || value > LORA_SCALE.max) return { error: 'The LoRA strength is from 0 to 2.', field: 'lora_scale' };
  return { body: { ...made.body, lora_scale: value } };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const safeUrl = url => (typeof url === 'string' && /^(https:\/\/|\/)/.test(url) ? url : '');
const side = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
// What a LoRA made, as links a page can show: media-gen-serve's own answer (``output``: images[{png}], video{mp4},
// base64) becomes data: URLs; an answer already kept as links (a later submit-and-poll answer: ``url``) is used as it
// is. The answer is untrusted: only PNG and MP4 base64, and https or same-site links, are used.
export function loraMedia(answer) {
  const out = answer?.output && typeof answer.output === 'object' ? answer.output : (answer || {});
  const images = (Array.isArray(out.images) ? out.images : []).slice(0, 8).map(image => {
    if (!image || typeof image !== 'object') return null;
    const url = typeof image.png === 'string' && BASE64.test(image.png) ? `data:image/png;base64,${image.png}` : safeUrl(image.url);
    return url ? { url, width: side(image.width), height: side(image.height) } : null;
  }).filter(Boolean);
  let video = null;
  const v = out.video;
  if (v && typeof v === 'object') {
    const url = typeof v.mp4 === 'string' && BASE64.test(v.mp4) ? `data:video/mp4;base64,${v.mp4}` : safeUrl(v.url);
    if (url) video = { url, width: side(v.width), height: side(v.height), seconds: side(v.seconds), fps: side(v.fps) };
  }
  const seed = Number.isInteger(out.seed) ? out.seed : null;
  return { images, video, seed };
}

export const tryGenerateApi = {
  // A video can take minutes on the person's machine.
  generate: (ref, number, body) => apiFetch(`${base(ref)}/models/${enc(number)}/try/generate/`, { method: 'POST', body, timeoutMs: 15 * 60 * 1000 }),
};
