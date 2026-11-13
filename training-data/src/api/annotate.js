// The Annotate screens' data, from the backend (training_models_data/app_api.py), in the shape the board, the
// labelling choices, the job view and the editor read (the same fields previewState.js gives the sample screens).
// ``live: true`` tells those components to read and write through the API.
import { reactive } from 'vue';
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;
const json = (path, method = 'GET', body) => apiFetch(path, method === 'GET' ? {} : { method, body });
// How long a model may take to draw one photo (detect, below).
export const DETECT_MS = 240000;

// The classes a person asks the AI for, from the project's own vocabulary.
// Kept in this browser, per project, as the classes left OUT, so a class
// added later is asked for. Every read and write survives a browser that keeps nothing (private window).
const skippedKey = ref => `aadml.autolabel.skipped.${ref}`;
export function askedClasses(ref, names) {
  let skipped = [];
  try { skipped = JSON.parse(localStorage.getItem(skippedKey(ref)) || '[]'); } catch { skipped = []; }
  const asked = names.filter(name => !skipped.includes(name));
  return asked.length ? asked : [...names];
}
export function keepAskedClasses(ref, names, asked) {
  try { localStorage.setItem(skippedKey(ref), JSON.stringify(names.filter(name => !asked.includes(name)))); } catch { /* not kept */ }
}

// The editor draws in 600 × 300 units stretched over the photo; the backend keeps photo pixels.
export const UNITS = { width: 600, height: 300 };

export function toUnits(points, width, height) {
  return points.map(([x, y]) => [x * UNITS.width / width, y * UNITS.height / height]);
}
export function toPixels(points, width, height) {
  return points.map(([x, y]) => [Math.round(x * width / UNITS.width * 10) / 10, Math.round(y * height / UNITS.height * 10) / 10]);
}

// A label of the backend as the editor's shapes. A wall's corner types are kept per corner (``cornerTypes``); the
// shape shows "image edge" when any corner touches the photo's edge.
export function fromBackend(shapes, width, height) {
  return (shapes || []).map((shape, index) => ({
    id: `s${index}-${Date.now()}`, kind: shape.kind, points: toUnits(shape.points, width, height),
    corner: (shape.corner_types || []).includes('image_edge') ? 'image_edge' : 'room',
    cornerTypes: shape.corner_types ? [...shape.corner_types] : null, cornerCount: shape.points.length,
  }));
}
// The editor's shapes as the backend reads them. A wall's corner types go back only while its corners are the ones
// that came with them; otherwise the backend decides each corner from where it is (labels.py, _corner_types).
export function toBackend(shapes, width, height) {
  return shapes.map(shape => {
    const out = { kind: shape.kind, points: toPixels(shape.points, width, height) };
    if (shape.kind === 'wall' && shape.cornerTypes && shape.cornerTypes.length === shape.points.length && shape.cornerCount === shape.points.length) out.corner_types = shape.cornerTypes;
    return out;
  });
}

// Where a photo stands, in the words the screens use.
export function photoState(batchState, labelState) {
  if (labelState === 'accepted') return 'Accepted';
  if (labelState === 'done') return 'In review';
  if (batchState === 'labelled') return 'In review';
  return 'Unlabeled';
}

function card(row) {
  return {
    id: `a${row.number}`, kind: 'assignment', number: row.number, code: row.code || '', name: row.name, givenName: row.given_name,
    count: row.total, done: row.done, group: row.state_label, status: row.column, assignee: row.labeller?.name || 'Unassigned',
    labeller: row.labeller, instructions: row.instructions, mine: row.mine, timeline: [], may: {},
  };
}

export function liveAnnotate(ref) {
  const store = reactive({
    live: true, ref, loading: true, error: '', batches: [], images: [], classes: [], tags: [], selectedImage: null,
    invitationDrafts: [], models: [], workflows: [], versions: [], runs: [], activeRules: [],
    counts: { to_label: 0, to_approve: 0, ready: 0, trained_on: 0 }, can: { batch: false, upload: false }, refused: '',
    labellers: null, roles: null,
  });
  return store;
}

export async function loadBoard(store) {
  store.loading = true; store.error = '';
  try {
    const body = await json(`${base(store.ref)}/board/`);
    const uploads = body.uploads.map(u => ({ id: `u${u.id}`, kind: 'upload', source: String(u.id), code: u.code || '', name: u.name, count: u.waiting,
      group: u.tags?.length ? u.tags.join(', ') : 'Upload', status: 'Unassigned', assignee: 'Unassigned', instructions: '', timeline: [] }));
    if (body.app_photos) uploads.push({ id: 'app', kind: 'upload', source: 'app', name: 'Photos from your app', count: body.app_photos,
      group: 'Sent by an app', status: 'Unassigned', assignee: 'Unassigned', instructions: '', timeline: [] });
    store.batches = [...uploads, ...body.assignments.filter(a => a.state !== 'rejected').map(card)];
    store.counts = body.counts; store.photos = body.photos ?? null; store.can = { batch: body.can_batch, upload: body.can_upload }; store.refused = body.refused;
    await loadClasses(store).catch(() => {});
  } catch (error) { store.error = error.message; }
  finally { store.loading = false; }
}

// Classes are supplied by the project API; a new project has no default vocabulary.
export function classesOf(rows) {
  return (rows || []).map(c => ({ name: c.name, color: c.color, description: c.description || '', trained: !!c.trained,
    ...(c.editable === undefined ? {} : { editable: c.editable }), ...(c.removable === undefined ? {} : { removable: c.removable }) }));
}
export async function loadClasses(store) {
  const body = await json(`${base(store.ref)}/classes/`);
  store.classes = classesOf(body.classes); store.canChangeClasses = !!body.can_change;
  return store.classes;
}

function keepImages(store, batchId, rows) {
  store.images = [...store.images.filter(i => i.batchId !== batchId), ...rows];
}

// The waiting photos of one Unassigned card.
export async function loadSource(store, batch) {
  const body = await json(`${base(store.ref)}/sources/${enc(batch.source)}/photos/`);
  keepImages(store, batch.id, body.photos.map(p => ({ id: p.id, batchId: batch.id, name: p.name, url: p.image, thumb: p.thumbnail || '', width: p.width, height: p.height,
    state: 'Unlabeled', tags: p.tags || [], shapes: [], noObjects: false, labelled: false })));
}

// One assignment: its photos with where each stands, its timeline, and what this person may do.
export async function loadAssignment(store, batch) {
  const body = await json(`${base(store.ref)}/assignments/${batch.number}/`);
  Object.assign(batch, card(body), {
    may: body.may, returnNote: body.return_note, sentBack: body.sent_back || '', waiting: body.waiting_for_approval, percent: body.percent,
    timeline: body.timeline.map(e => ({ text: `${e.by ? `${e.by}: ` : ''}${e.detail || e.kind}`, time: new Date(e.at).toLocaleString() })),
  });
  keepImages(store, batch.id, body.photos.map(p => ({ id: p.id, batchId: batch.id, name: p.name, url: p.image, thumb: p.thumbnail || '', width: p.width, height: p.height,
    state: photoState(p.state, p.label_state), label: p.label, labelled: p.state === 'labelled', fix: p.fix, tags: p.tags || [], shapes: [], noObjects: false })));
  return batch;
}

// What an assignment step answered: where the assignment stands now. Shown at once; what this person may do next
// comes with the full refresh that follows, so until then nothing is offered (a slow refresh once left "Submit for
// Review" on screen after the submit had been made).
export function applyStep(batch, row) {
  Object.assign(batch, { group: row.state_label, status: row.column, count: row.total, done: row.done, may: {} });
}

// The labels waiting for approval.
export async function loadReview(store) {
  const body = await json(`${base(store.ref)}/review/`);
  keepImages(store, 'review', body.photos.map(p => ({ id: p.id, batchId: 'review', name: p.name, url: p.image, thumb: p.thumbnail || '', width: p.width, height: p.height,
    state: 'In review', label: p.label, author: p.author, labelled: true, tags: p.tags || [], shapes: [], noObjects: false })));
  // Why approving is refused in this project ('' when it is not): "Approve selected" is off from the start (ADM-1210).
  store.approveRefused = typeof body.approve_refused === 'string' ? body.approve_refused : '';
}

// The body of an assignment's send-back: only the photos chosen, or (none chosen) every one not approved yet.
export function sendBackBody(reason, photos = []) {
  const chosen = [...new Set((photos || []).filter(Boolean).map(String))];
  return chosen.length ? { reason, photos: chosen } : { reason };
}

// What a bulk approval answered ({approved, refused: [{label, why}]}), in one sentence.
export function approvedWords({ approved = 0, refused = [] } = {}) {
  const n = Number(approved) || 0; const left = Array.isArray(refused) ? refused.length : 0;
  return `${n} label${n === 1 ? '' : 's'} approved.${left ? ` ${left} ${left === 1 ? 'was' : 'were'} not, and why is listed below.` : ''}`;
}

// What taking an approval back answered: the dataset versions that hold the photo keep the label they froze (D6).
export function takenBackWords({ affected_versions: versions = [], warning = '' } = {}) {
  const kept = warning || (versions.length ? `${versions.join(', ')} keep${versions.length === 1 ? 's' : ''} the label ${versions.length === 1 ? 'it' : 'they'} froze.` : '');
  return `The approval is taken back: the label waits for approval again.${kept ? ` ${kept}` : ''}`;
}

export async function loadLabellers(store) {
  if (!store.labellers) store.labellers = (await json(`${base(store.ref)}/labellers/`)).labellers;
  return store.labellers;
}
export async function loadRoles(store) {
  if (!store.roles) store.roles = (await json(`${base(store.ref)}/invite/`)).roles;
  return store.roles;
}

export const api = {
  createAssignment: (ref, body) => json(`${base(ref)}/assignments/`, 'POST', body),
  updateAssignment: (ref, number, body) => json(`${base(ref)}/assignments/${number}/`, 'PATCH', body),
  assignmentAction: (ref, number, action, body = {}) => json(`${base(ref)}/assignments/${number}/${action}/`, 'POST', body),
  renameUpload: (ref, id, name) => json(`${base(ref)}/uploads/${enc(id)}/`, 'PATCH', { name }),
  invite: (ref, body) => json(`${base(ref)}/invite/`, 'POST', body),
  editor: (ref, photo, review, start) => json(`${base(ref)}/photos/${enc(photo)}/editor/${review ? `?review=${enc(review)}` : start ? `?start=${enc(start)}` : ''}`),
  // One photo through a vision model and then SAM 3 takes longer than the usual 15 s (aadml.com, 2026-11-09: GPT-6.1
  // Terra + SAM 3 was cut off and the page said "took too long" while the server was still drawing). Under the site's
  // 300 s limit on a request; a model still being started answers "waiting" at once instead.
  // ``where``: '' runs the model where it runs; ``machine:<id>`` runs SAM 3 on that machine of the workspace.
  detect: (ref, photo, source, classes, where = '') => apiFetch(`${base(ref)}/photos/${enc(photo)}/detect/`,
    { method: 'POST', body: { source, ...(classes ? { classes } : {}), ...(where ? { where } : {}) }, timeoutMs: DETECT_MS }),
  detectPreference: (ref, detect, where = '') => json(`${base(ref)}/detect-preference/`, 'POST', { detect, where }),
  // Meta's SAM License, accepted once for the workspace before SAM 3 runs on any of its machines.
  acceptSamLicence: ref => json(`${base(ref)}/sam-licence/`, 'POST', { accept: true }),
  detectSources: ref => json(`${base(ref)}/detect-preference/`),
  addClass: (ref, body) => json(`${base(ref)}/classes/`, 'POST', body),
  segmentPoint: (ref, photo, name, points, where = '') => apiFetch(`${base(ref)}/photos/${enc(photo)}/segment-point/`,
    { method: 'POST', body: { class: name, points, where }, timeoutMs: DETECT_MS }),
  updateClass: (ref, name, body) => json(`${base(ref)}/classes/${enc(name)}/`, 'PATCH', body),
  removeClass: (ref, name) => json(`${base(ref)}/classes/${enc(name)}/`, 'DELETE'),
  saveLabel: (ref, photo, body) => json(`${base(ref)}/photos/${enc(photo)}/label/`, 'POST', body),
  sendBack: (ref, label, reason) => json(`${base(ref)}/labels/${enc(label)}/send-back/`, 'POST', { reason }),
  comments: (ref, photo) => json(`${base(ref)}/photos/${enc(photo)}/comments/`),
  comment: (ref, photo, text) => json(`${base(ref)}/photos/${enc(photo)}/comments/`, 'POST', { text }),
  tag: (ref, photo, body) => json(`${base(ref)}/photos/${enc(photo)}/tags/`, 'POST', body),
  // ADM-1210 §3.7, §3.10 (backend review_api.py). ``opts`` is for the tests (fetchImpl) only.
  takeBack: (ref, label, opts) => apiFetch(`${base(ref)}/labels/${enc(label)}/take-back/`, { ...opts, method: 'POST', body: {} }),
  reopen: (ref, number, photo, opts) => apiFetch(`${base(ref)}/assignments/${Number(number)}/photos/${enc(photo)}/reopen/`, { ...opts, method: 'POST', body: {} }),
  approveMany: (ref, labels, opts) => apiFetch(`${base(ref)}/review/approve/`, { timeoutMs: 120000, ...opts, method: 'POST', body: { labels } }),
};
