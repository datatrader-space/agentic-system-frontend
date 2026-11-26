// ADM-1365: the Train tab trains any open photo model (hf-train) for a task and an image or video generation model's
// LoRA (diffusion-train); photos of an image generation project carry a caption; a trained version is tried by drawing
// its pipeline answer, or with a prompt and a LoRA strength. Backend contracts: training_models_data/app_api.py
// training(), runs/, runs/machines/, photos/<id>/caption/, models/<n>/try/generate/; hf_runs.py, diffusion_runs.py.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultTask, startingSettings, settingsForm, settingsBody, gpuLine, needsLine, machinesQuery, generationForm,
  generationBody, stepsLine, figureRows, primaryFigure, runKindWords, cleanCaption, CAPTION_MAX, captionApi, isLoraModel,
  loraBody, loraMedia, tryGenerateApi, genTaskWords, TASK_FIGURES,
} from '../src/api/anyModel.js';
import { progressLine, trainApi } from '../src/api/train.js';
import { trainNote, gpuFacts } from '../src/api/openModels.js';
import { TYPE_KIND } from '../src/api/training.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const studio = read('../src/components/ProjectStudio.vue');
const anyModel = read('../src/components/TrainAnyModel.vue');
const figures = read('../src/components/RunFigures.vue');
const testPage = read('../src/components/TestPage.vue');
const editor = read('../src/components/AnnotationEditor.vue');
const openModels = read('../src/components/OpenModels.vue');
const create = read('../src/components/ProjectCreate.vue');

const TASKS = [
  { value: 'object-detection', label: 'Object detection: a box around each object', settings: { epochs: 30, learning_rate: 1e-4, weight_decay: 1e-4, batch_size: 4, resolution: 640 } },
  { value: 'semantic-segmentation', label: 'Semantic segmentation: every pixel marked with its class', settings: { epochs: 30, learning_rate: 6e-5, weight_decay: 1e-2, batch_size: 4, resolution: 512 } },
  { value: 'instance-segmentation', label: 'Instance segmentation: the outline of each object', settings: { epochs: 30, learning_rate: 1e-4, weight_decay: 5e-2, batch_size: 2, resolution: 512 } },
];

async function sentBy(call) {
  const realFetch = globalThis.fetch; let sent;
  globalThis.fetch = async (url, options) => { sent = { url, options }; return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try { await call(); } finally { globalThis.fetch = realFetch; }
  return sent;
}

test('a model is trained for its own task, from its own settings, else the task’s', () => {
  const detr = { key: 'k1', train_task: 'object-detection', settings: { epochs: 12, learning_rate: 2e-4, batch_size: 8, resolution: 800, weight_decay: 0 } };
  assert.equal(defaultTask(detr, TASKS), 'object-detection');
  assert.equal(defaultTask({ train_task: '' }, TASKS), 'object-detection');           // none of its own: the first offered
  assert.equal(startingSettings(detr, 'object-detection', TASKS).epochs, 12);
  assert.equal(startingSettings(detr, 'semantic-segmentation', TASKS).learning_rate, 6e-5);
  const form = settingsForm(TASKS[2].settings);
  assert.deepEqual([form.epochs, form.batch_size, form.resolution, form.weight_decay], [30, 2, 512, 5e-2]);
  assert.equal(form.lora_enabled, false); assert.equal(form.freeze_backbone, false); assert.equal(form.flip, '');
});

test('the settings sent are checked against the server’s ranges; LoRA and a frozen backbone never both', () => {
  const form = settingsForm(TASKS[0].settings);
  assert.deepEqual(settingsBody(form).settings, { epochs: 30, learning_rate: 1e-4, batch_size: 4, resolution: 640, weight_decay: 1e-4 });
  assert.equal(settingsBody({ ...form, epochs: 0 }).field, 'epochs');
  assert.equal(settingsBody({ ...form, epochs: 2.5 }).field, 'epochs');
  assert.equal(settingsBody({ ...form, resolution: '' }).field, 'resolution');
  assert.equal(settingsBody({ ...form, learning_rate: 2 }).field, 'learning_rate');
  assert.equal(settingsBody({ ...form, lora_enabled: true, freeze_backbone: true }).field, 'freeze_backbone');
  const lora = settingsBody({ ...form, lora_enabled: true, lora_r: 8, lora_alpha: 16, lora_dropout: 0.1, flip: '0.5' }).settings;
  assert.deepEqual(lora.lora, { enabled: true, r: 8, alpha: 16, dropout: 0.1 });
  assert.deepEqual(lora.augmentation, { horizontal_flip: 0.5 });
  assert.equal(settingsBody({ ...form, flip: 1.5 }).field, 'flip');
  assert.equal(settingsBody({ ...form, freeze_backbone: true }).settings.freeze_backbone, true);
});

test('the GPU numbers are said, never hidden', () => {
  assert.equal(gpuLine({ need_gb_train: 22, largest_gpu_gb: 48 }), 'Training needs about 22 GB of GPU memory (estimated); AADML\'s largest GPU has 48 GB.');
  assert.equal(gpuLine({}), '');
  assert.equal(needsLine({ gpu_gb: 18, estimated: true, settings: 'batch 4 at 512 px' }), 'About 18 GB of GPU memory (estimated): batch 4 at 512 px.');
  assert.equal(needsLine({}), '');
  assert.deepEqual(gpuFacts({ train_task_label: 'Object detection: a box around each object', need_gb_run: 3, need_gb_train: 12 }),
    [['Trains for', 'Object detection'], ['To run', 'about 3 GB GPU'], ['To train', 'about 12 GB GPU']]);
});

test('where it trains is asked with the task, or as a generation run', async () => {
  assert.deepEqual(machinesQuery({ version: 'v2', model: 'k1', task: 'object-detection', epochs: 30 }), { version: 'v2', model: 'k1', task: 'object-detection', epochs: 30 });
  assert.deepEqual(machinesQuery({ generation: true, version: 'v1', model: 'sdxl', task: '' }), { generation: 1, version: 'v1', model: 'sdxl' });
  const sent = await sentBy(() => trainApi.machines('~3', machinesQuery({ generation: true, version: 'v1', model: 'sdxl', task: 'text-to-image' })));
  assert.equal(sent.url, '/api/training-data/app/projects/~3/runs/machines/?generation=1&version=v1&model=sdxl&task=text-to-image');
});

test('a generation LoRA’s settings: rank, steps, learning rate, trigger words and sample prompts', () => {
  const form = generationForm({ rank: 16, alpha: 16, learning_rate: 1e-4, max_train_steps: 1000 });
  assert.deepEqual(generationBody(form).settings, { rank: 16, max_train_steps: 1000, learning_rate: 1e-4 });
  const full = generationBody({ ...form, trigger_words: 'sks mug, ceramic ', sample_prompts: 'a sks mug on a beach\n\n a sks mug in snow' }).settings;
  assert.deepEqual(full.trigger_words, ['sks mug', 'ceramic']);
  assert.deepEqual(full.sample_prompts, ['a sks mug on a beach', 'a sks mug in snow']);
  assert.equal(generationBody({ ...form, rank: 300 }).field, 'rank');
  assert.equal(generationBody({ ...form, learning_rate: 0.5 }).field, 'learning_rate');
  assert.equal(generationBody({ ...form, trigger_words: Array.from({ length: 9 }, (_, i) => `w${i}`).join(',') }).field, 'trigger_words');
  assert.equal(genTaskWords('image-to-video'), 'Image to video');
});

test('an hf or diffusion run’s progress is in steps; a photo run’s stays in rounds', () => {
  const steps = progressLine({ phase: 'training', steps: 400, steps_done: 100, steps_left: 300 });
  assert.equal(steps.share, 0.25);
  assert.equal(steps.text, 'Training · step 100 of 400 · 300 left');
  assert.equal(stepsLine({ steps: 0 }), null);
  const rounds = progressLine({ phase: 'training', rounds: 10, rounds_done: 5, current_round: 6, passes: 100, passes_done: 50 });
  assert.match(rounds.text, /round 6 of 10/);
});

test('a run’s figures: its task’s, the primary first, labels from the server', () => {
  const rows = figureRows({ task: 'instance-segmentation', primary: 'mask_map', final: { mask_map: 0.41234, box_map: 0.5 }, labels: { mask_map: 'Mask mAP (COCO)', mask_map50: 'Mask mAP at IoU 0.50', box_map: 'Box mAP (COCO)' } });
  assert.deepEqual(rows.map(r => [r.name, r.value, r.primary]), [['mask_map', '0.4123', true], ['mask_map50', 'n/a', false], ['box_map', '0.5000', false]]);
  // No labels: the task's own figures, worded here.
  assert.deepEqual(figureRows({ task: 'semantic-segmentation', primary: 'mean_iou', final: { mean_iou: 0.6 } }).map(r => r.name), TASK_FIGURES['semantic-segmentation']);
  assert.deepEqual(figureRows({ task: 'object-detection', primary: 'map', final: {} }).map(r => r.label), ['mAP (COCO, IoU 0.50 to 0.95)', 'mAP at IoU 0.50', 'mAR, 100 detections a photo']);
  const loss = { task: 'text-to-image', primary: 'mean_loss_last_10pct', final: { mean_loss_last_10pct: 0.0812, steps: 1000 }, labels: { final_loss: 'Last step\'s loss', mean_loss_last_10pct: 'Mean loss, last tenth', steps: 'Steps trained' }, measured_on: 'training' };
  assert.equal(primaryFigure(loss), 'Mean loss, last tenth 0.0812');
  assert.equal(figureRows(loss).find(r => r.name === 'steps').value, '1000');
  assert.equal(figureRows(null).length, 0);
  assert.equal(runKindWords({ kind: 'hf' }), 'Open photo model');
  assert.equal(runKindWords({ kind: 'diffusion' }), 'Generation LoRA');
  assert.equal(runKindWords({ kind: 'walls' }), '');
});

test('a caption is saved with its spaces made single, at most 1000 characters', async () => {
  assert.deepEqual(cleanCaption('  a  photo\n of  sks mug '), { caption: 'a photo of sks mug' });
  assert.equal(cleanCaption('x'.repeat(CAPTION_MAX + 1)).error, 'A caption is at most 1000 characters.');
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const sent = await sentBy(() => captionApi.save('~3', id, 'a mug'));
  assert.equal(sent.url, `/api/training-data/app/projects/~3/photos/${id}/caption/`);
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(JSON.parse(sent.options.body), { caption: 'a mug' });
});

test('a LoRA is tried with a prompt and a strength from 0 to 2; what it makes is shown only from PNG, MP4 or safe links', async () => {
  assert.equal(isLoraModel({ served_form: 'diffusers-lora' }), true);
  assert.equal(isLoraModel({ served_form: 'hf' }), false);
  assert.deepEqual(loraBody({ body: { prompt: 'a mug' } }, 1.5).body, { prompt: 'a mug', lora_scale: 1.5 });
  assert.equal(loraBody({ body: { prompt: 'a mug' } }, 2.5).field, 'lora_scale');
  assert.equal(loraBody({ error: 'Describe what to make.', field: 'prompt' }, 1).field, 'prompt');
  const png = 'iVBORw0KGgo=';
  const media = loraMedia({ output: { images: [{ png, width: 1024, height: 1024 }, { png: 'not base64!' }, { url: 'javascript:alert(1)' }], seed: 7 } });
  assert.deepEqual(media.images, [{ url: `data:image/png;base64,${png}`, width: 1024, height: 1024 }]);
  assert.equal(media.seed, 7); assert.equal(media.video, null);
  const video = loraMedia({ output: { video: { mp4: 'AAAAGGZ0eXA=', seconds: 4, fps: 16, width: 768, height: 512 } } }).video;
  assert.equal(video.url, 'data:video/mp4;base64,AAAAGGZ0eXA='); assert.equal(video.fps, 16);
  assert.equal(loraMedia({ images: [{ url: 'https://x.example/a.png' }] }).images[0].url, 'https://x.example/a.png');   // a later, kept answer
  const sent = await sentBy(() => tryGenerateApi.generate('~3', 4, { prompt: 'a mug', lora_scale: 1 }));
  assert.equal(sent.url, '/api/training-data/app/projects/~3/models/4/try/generate/');
});

test('the Train tab starts an open photo model’s run with its task and settings, and a generation LoRA with generation', () => {
  assert.match(anyModel, /made = \{ version: version\.value, model: chosen\.value\.value, task: task\.value, settings: body\.settings, max_runtime/);
  assert.match(anyModel, /genMade = \{ generation: true, version: genVersion\.value, model: genBase\.value\.value, task: genTask\.value, settings: body\.settings/);
  assert.match(anyModel, /key: startKeysOf\.keyFor\(body\)/);                       // a resent start is the same run
  assert.match(anyModel, /picker\.value\.confirm\(/);                                // the machine is approved first
  assert.match(anyModel, /got\.gpu_too_small/);
  assert.match(anyModel, /m\.trainable \? '' : ` \$\{m\.why_not\}`/);                // why not, never hidden
  assert.match(anyModel, /gen\.unavailable/);
  assert.match(anyModel, /role="alert"/);
  assert.match(anyModel, /aria-live="polite"/);
  assert.doesNotMatch(anyModel, /window\.(alert|confirm|prompt)\(/);
});

test('the photo Train page offers the walls trainer only a SegFormer, and the new runs with their figures', () => {
  assert.match(studio, /wallModels=computed\(\(\)=>openModels\.value\.filter\(m=>m\.walls\)\)/);
  assert.match(studio, /m\.walls_trainable\)\|\|null/);
  assert.match(studio, /walls_why_not/);
  assert.match(studio, /<TrainAnyModel v-if="live&&page==='train'&&state\.training\?\.can_train/);
  assert.match(studio, /<template v-if="!\(live&&genProject\)"><h2>Select a training engine<\/h2>/);
  assert.match(studio, /<RunFigures v-if="runView\.figures"/);
  assert.match(studio, /primaryFigure\(r\.figures\)/);
  assert.match(figures, /<caption>/);
  assert.match(figures, /scope="col"/);
});

test('a trained version is tried by drawing its pipeline answer, or a LoRA with a prompt', () => {
  assert.match(testPage, /<PipelineResult v-else-if="answer\?\.hf_task"/);
  assert.match(testPage, /tryGenerateApi\.generate\(props\.projectRef, number, asked\.body\)/);
  assert.match(testPage, /type="range" :min="LORA_SCALE\.min" :max="LORA_SCALE\.max"/);
  assert.match(testPage, /own machines with an NVIDIA GPU/);
});

test('an image generation project’s photo gets a caption in the editor and shows it in the lists', () => {
  assert.match(editor, /<form v-if="live&&meta\?\.captioned" class="caption-editor"/);
  assert.match(editor, /captionApi\.save\(props\.state\.ref,it\.id,made\.caption\)/);
  assert.match(editor, /role="status" aria-live="polite">\{\{ captionSaid \}\}/);
  assert.match(studio, /'No caption yet'/);
  assert.equal(TYPE_KIND['Image generation'], 'image_generation');
  assert.match(create, /name: 'Image generation'/);
  assert.match(create, /sample: card\.sample/);
});

test('Open models says what an added photo model trains for, not that training is not open', () => {
  assert.doesNotMatch(openModels, /opens when the photo trainer takes one/);
  assert.match(openModels, /\{\{ trainNote\(m\) \}\}/);
  assert.match(openModels, /gpuFacts\(row\)/);
  assert.equal(trainNote({ train_task_label: 'Object detection: a box around each object', need_gb_train: 12 }),
    "Trains on a project's Train tab for object detection: a box around each object. Training it needs about 12 GB of GPU memory (estimated).");
  assert.equal(trainNote({}), "Trains on a project's Train tab for the task its head is made for.");
});
