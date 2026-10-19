// The Annotate screens' data, from the backend (training_models_data/app_api.py), in the shape the board, the
// labelling choices, the job view and the editor read (the same fields previewState.js gives the sample screens).
// ``live: true`` tells those components to read and write through the API.
import { reactive } from 'vue';
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;
const json = (path, method = 'GET', body) => apiFetch(path, method === 'GET' ? {} : { method, body });

// The kinds the backend's labels hold (labels.py: wall, window, door), coloured as the sample classes were.
export const CLASSES = [{ name: 'wall', color: '#8b5cf6' }, { name: 'window', color: '#10b981' }, { name: 'door', color: '#f59e0b' }];
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
    live: true, ref, loading: true, error: '', batches: [], images: [], classes: CLASSES, tags: [], selectedImage: null,
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
    store.counts = body.counts; store.can = { batch: body.can_batch, upload: body.can_upload }; store.refused = body.refused;
    await loadClasses(store).catch(() => {});
  } catch (error) { store.error = error.message; }
  finally { store.loading = false; }
}

// The project's classes (label_classes.py): wall, window and door, which a walls model learns, then the classes the
// project added, which are label-only. `trained` says which is which.
export function classesOf(rows) {
  return (rows || []).map(c => ({ name: c.name, color: c.color, description: c.description || '', trained: !!c.trained }));
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
  keepImages(store, batch.id, body.photos.map(p => ({ id: p.id, batchId: batch.id, name: p.name, url: p.image, width: p.width, height: p.height,
    state: 'Unlabeled', tags: p.tags || [], shapes: [], noObjects: false, labelled: false })));
}

// One assignment: its photos with where each stands, its timeline, and what this person may do.
export async function loadAssignment(store, batch) {
  const body = await json(`${base(store.ref)}/assignments/${batch.number}/`);
  Object.assign(batch, card(body), {
    may: body.may, returnNote: body.return_note, sentBack: body.sent_back || '', waiting: body.waiting_for_approval, percent: body.percent,
    timeline: body.timeline.map(e => ({ text: `${e.by ? `${e.by}: ` : ''}${e.detail || e.kind}`, time: new Date(e.at).toLocaleString() })),
  });
  keepImages(store, batch.id, body.photos.map(p => ({ id: p.id, batchId: batch.id, name: p.name, url: p.image, width: p.width, height: p.height,
    state: photoState(p.state, p.label_state), label: p.label, labelled: p.state === 'labelled', fix: p.fix, tags: p.tags || [], shapes: [], noObjects: false })));
  return batch;
}

// The labels waiting for approval.
export async function loadReview(store) {
  const body = await json(`${base(store.ref)}/review/`);
  keepImages(store, 'review', body.photos.map(p => ({ id: p.id, batchId: 'review', name: p.name, url: p.image, width: p.width, height: p.height,
    state: 'In review', label: p.label, author: p.author, labelled: true, tags: p.tags || [], shapes: [], noObjects: false })));
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
  detect: (ref, photo, source) => json(`${base(ref)}/photos/${enc(photo)}/detect/`, 'POST', { source }),
  detectPreference: (ref, detect) => json(`${base(ref)}/detect-preference/`, 'POST', { detect }),
  detectSources: ref => json(`${base(ref)}/detect-preference/`),
  addClass: (ref, body) => json(`${base(ref)}/classes/`, 'POST', body),
  updateClass: (ref, name, body) => json(`${base(ref)}/classes/${enc(name)}/`, 'PATCH', body),
  removeClass: (ref, name) => json(`${base(ref)}/classes/${enc(name)}/`, 'DELETE'),
  saveLabel: (ref, photo, body) => json(`${base(ref)}/photos/${enc(photo)}/label/`, 'POST', body),
  sendBack: (ref, label, reason) => json(`${base(ref)}/labels/${enc(label)}/send-back/`, 'POST', { reason }),
  comments: (ref, photo) => json(`${base(ref)}/photos/${enc(photo)}/comments/`),
  comment: (ref, photo, text) => json(`${base(ref)}/photos/${enc(photo)}/comments/`, 'POST', { text }),
  tag: (ref, photo, body) => json(`${base(ref)}/photos/${enc(photo)}/tags/`, 'POST', body),
};
