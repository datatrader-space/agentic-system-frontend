// The Training Data API (backend: training_models_data/app_api.py, /api/training-data/app/). Every call goes
// through apiFetch: the AADML session cookie, the CSRF token on writes, and the workspace selected in AADML.
import { apiFetch } from './client.js';

const BASE = '/training-data/app';
const enc = encodeURIComponent;

export const listProjects = (params = {}, opts) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return apiFetch(`${BASE}/projects/${query ? `?${query}` : ''}`, opts);
};
export const getProject = (ref, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/`, opts);
export const renameProject = (ref, name, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/`, { ...opts, method: 'PATCH', body: { name } });
export const createProject = (body, opts) => apiFetch(`${BASE}/projects/`, { ...opts, method: 'POST', body });
export const moveProject = (ref, folder, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/move/`, { ...opts, method: 'POST', body: { folder } });
export const listKinds = opts => apiFetch(`${BASE}/kinds/`, opts);
export const createFolder = (name, opts) => apiFetch(`${BASE}/folders/`, { ...opts, method: 'POST', body: { name } });
export const saveDataUse = (ref, answers, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/data-use/`, { ...opts, method: 'POST', body: answers });
export const getDataUse = (ref, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/data-use/`, opts);
export const deleteProject = (ref, confirm, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/delete/`, { ...opts, method: 'POST', body: { confirm } });
export const listKeys = (ref, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/keys/`, opts);
export const createKey = (ref, name, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/keys/`, { ...opts, method: 'POST', body: { name } });
export const rotateKey = (ref, id, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/keys/${enc(id)}/rotate/`, { ...opts, method: 'POST' });
export const revokeKey = (ref, id, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/keys/${enc(id)}/revoke/`, { ...opts, method: 'POST' });
export const sendingGuide = (ref, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/sending/`, opts);
// Uploads carry files: a longer wait than a plain read.
const SLOW = 180000;
export const uploadPhotos = (ref, form, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/photos/upload/`, { timeoutMs: SLOW, ...opts, method: 'POST', body: form });
export const listLabellers = (ref, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/labellers/`, opts);
export const assignUpload = (ref, id, labeller, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/uploads/${enc(id)}/assign/`, { ...opts, method: 'POST', body: { labeller } });
export const importClasses = (ref, form, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/photos/import/classes/`, { timeoutMs: SLOW, ...opts, method: 'POST', body: form });
export const importLabelled = (ref, form, opts) => apiFetch(`${BASE}/projects/${enc(ref)}/photos/import/`, { timeoutMs: SLOW, ...opts, method: 'POST', body: form });

// The parts an upload is sent in: at most ``size`` files each, so no request is too large for the server.
export function inParts(items, size = 20) {
  const parts = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

// "Group by selected folder": a file's group is the folder it was chosen in ('' for a file chosen alone).
export function folderOf(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

// The New project screen names its project types; the backend names kinds (families.KINDS). A type with no kind,
// or a kind with no trainable task yet, cannot be created.
export const TYPE_KIND = {
  'Object Detection': 'object_detection', Classification: 'classification', 'Instance Segmentation': 'instance_segmentation',
  'Action Recognition': 'action_recognition', 'Keypoint Detection': 'keypoint_detection', Multimodal: 'multimodal',
  'Semantic Segmentation': 'semantic_segmentation', 'Data Collection': 'data_only',
};

// The New project screen's data policy, as the five data-use answers the backend stores (policy.read_form).
// The saved answers (data-use/ GET values) as the form's choices, the way back from dataUseAnswers.
export function dataUseForm(values) {
  const training = { no: 'No', project: 'Only this project’s own models', shared: 'Also AADML’s shared models' }[values.training] || 'Only this project’s own models';
  const access = { me: 'Only me', invited: 'People I invite to the project', vendor: 'Also an outside labeling vendor' }[values.viewers] || 'People I invite to the project';
  const retention = values.retention === 'forever' || values.retention == null ? 'Until I delete it' : `${values.retention} days`;
  return { training, access, retention, aws: !!values.allow_aws, local: !!values.allow_own_machine, deletion: !!values.deletion_rule_confirmed };
}

export function dataUseAnswers(form) {
  const training = { No: 'no', 'Only this project’s own models': 'project', 'Also AADML’s shared models': 'shared' }[form.training];
  const viewers = { 'Only me': 'me', 'People I invite to the project': 'invited', 'Also an outside labeling vendor': 'vendor' }[form.access];
  const days = /^(\d+) days$/.exec(form.retention || '');
  return {
    training, viewers, retention: days ? Number(days[1]) : 'forever',
    allow_aws: !!form.aws, allow_own_machine: !!form.local, deletion_rule_confirmed: !!form.deletion,
  };
}

// "2 hours ago", as the project cards say it.
export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

// A project row from the API as the project cards read it. ``id`` is the project's address (``ref``).
export function toCard(row, index = 0) {
  return {
    id: row.ref, ref: row.ref, serverId: row.id, name: row.name, description: row.description, type: row.task_label,
    images: row.photos ?? 0, models: row.models ?? 0, ready: 0, variant: index % 3,
    date: ago(row.last_activity || row.created_at), folder: row.folder?.name, folderId: row.folder?.id ?? null,
    role: row.role, rights: row.rights || [], details: { visibility: row.visibility === 'shared' ? 'Shared' : 'Private' },
  };
}
