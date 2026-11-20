// The Dataset and Versions pages' data (backend: training_models_data/app_api.py). Photos go into the same live
// store the editor reads (api/annotate.js), under ``batchId: 'dataset'``, so a photo opens in the real editor.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;
const post = (path, body) => apiFetch(path, { method: 'POST', body });

export const FILTERS = { split: '', group: '', origin: '', golden: '', tag: '' };
// The name a new version gets when the person types none: the next number of its purpose, as datasets.publish numbers
// it (live, 2026-11-18: train_val-v2 was offered "Version 1" and listed as a second "Version 1").
export function nextVersionTitle(versions, kind) {
  const top = (Array.isArray(versions) ? versions : []).filter(v => v && v.kind === kind)
    .reduce((n, v) => Math.max(n, Number(v.number) || 0), 0);
  return `Version ${top + 1}`;
}

export function query(params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'All')).toString();
  return q ? `?${q}` : '';
}

// One page of the project's photos, with the filters of the Dataset page. Fills ``store.images`` and ``store.dataset``.
export async function loadDataset(store, { q = '', status = 'All', filters = FILTERS, page = 1 } = {}) {
  // Only the newest request fills the page: a slower answer to an earlier filter never replaces a newer one.
  const asked = (store.datasetAsked = (store.datasetAsked || 0) + 1);
  const body = await apiFetch(`${base(store.ref)}/photos/${query({ q, status, page, ...filters })}`);
  if (asked !== store.datasetAsked) return store.dataset;
  store.images = [...store.images.filter(i => i.batchId !== 'dataset'), ...body.photos.map(p => ({
    id: p.id, batchId: 'dataset', name: p.name, url: p.image, thumb: p.thumbnail || '', width: p.width, height: p.height, state: p.status,
    labels: p.labels, label: p.label, golden: p.golden, split: p.split, group: p.group, origin: p.origin,
    tags: p.tags || [], shapes: [], noObjects: false, labelled: p.label_state === 'done', labelState: p.label_state || '',
  }))];
  // ``waiting``: records sent by the project's app that are not training photos yet (0 for who may not take them in).
  store.dataset = { total: body.total, page: body.page, pages: body.pages, splitCounts: body.split_counts, may: body.may, waiting: Number(body.waiting) || 0 };
  // The editor asks the store what this person may do; the Dataset page knows it from the same rights.
  store.can = { ...(store.can || {}), batch: !!body.may?.golden, upload: !!body.may?.delete };
  return store.dataset;
}

export async function loadVersions(store) {
  const body = await apiFetch(`${base(store.ref)}/versions/`);
  store.versions = body.versions;
  store.versionMeta = { kinds: body.kinds, sizes: body.sizes, canPublish: body.can_publish, refused: body.refused };
  return body;
}

// What a version is for, in the words the new-version form's "Version purpose" shows.
export const PURPOSES = { train_val: 'Training / validation', test: 'Test evaluation only', golden: 'Golden evaluation only', smoke: 'Smoke check' };
const EVALUATION_ONLY = ['test', 'golden'];

// Whether a version can be trained on, so its card offers "Use for training": never a test or golden version (they are
// for evaluation only; live, 2026-11-17: a test version still offered it), else as the server's kinds say.
export function forTraining(version, kinds) {
  if (!version || EVALUATION_ONLY.includes(version.kind)) return false;
  return !!(kinds || []).find(k => k.value === version.kind)?.training;
}

// The Source step's line: how many photos can go into a version of THIS purpose (the preview is asked per purpose;
// live, 2026-11-17: it said 9 for a test version that held 3). null while the count for this purpose is not in.
export function sourceLine(preview, purpose) {
  if (!preview || (preview.kind && preview.kind !== purpose)) return null;
  const words = PURPOSES[purpose] || purpose;
  const n = Number(preview.photos) || 0;
  return `${n} photo${n === 1 ? '' : 's'} with an approved label can go into a ${words} version (${Number(preview.new) || 0} new since ${preview.latest || 'the start'}).`;
}

export const datasetApi = {
  tag: (ref, photos, body) => post(`${base(ref)}/photos/tags/`, { photos, ...body }),
  golden: (ref, photo, golden) => post(`${base(ref)}/photos/${enc(photo)}/golden/`, { golden }),
  remove: (ref, photos, reason) => post(`${base(ref)}/photos/delete/`, { photos, reason }),
  preview: (ref, kind) => apiFetch(`${base(ref)}/versions/preview/${query({ kind })}`),
  publish: (ref, body) => post(`${base(ref)}/versions/`, body),
  version: (ref, name) => apiFetch(`${base(ref)}/versions/${enc(name)}/`),
  // At most 200 waiting records become training photos a call: {added, handled, left}.
  takeIn: (ref, opts) => apiFetch(`${base(ref)}/photos/take-in/`, { timeoutMs: 120000, ...opts, method: 'POST', body: {} }),
  // The photos deleted on request, newest first, a page at a time (review_api.deletions; OVERVIEW).
  deletions: (ref, page, opts) => apiFetch(`${base(ref)}/deletions/${pageQuery(page)}`, opts),
};

// The address of the next page of a list read in steps (``next: {before, before_id}``); '' for the first page.
export function pageQuery(page) {
  if (!page?.before) return '';
  return query({ before: page.before, before_id: page.before_id ?? '' });
}

// A sha256 as the list shows it: its first 12 characters (the whole value goes in the cell's title).
export const shortSha = sha => (typeof sha === 'string' && sha.length > 12 ? `${sha.slice(0, 12)}…` : String(sha ?? ''));

// One row of a "Deleted on request" list, for a photo (vision) or an example (language model), in one shape.
export function deletionRow(row, kind = 'photo') {
  const llm = kind === 'example';
  return {
    id: row.id, at: (llm ? row.at : row.deleted_at) || '', by: row.by || 'A person who left', reason: row.reason || '',
    versions: Array.isArray(row.versions) ? row.versions : [],
    what: llm ? `Example ${row.example_ref}` : shortSha(row.sha256),
    full: llm ? (row.record_ref ? `From record ${row.record_ref}` : `Example ${row.example_ref}`) : String(row.sha256 || ''),
  };
}

// What deleting photos answered ({deleted, affected_versions, failed}), in one sentence. The failed rows are listed apart.
export function photosDeletedWords({ deleted = 0, affected_versions: versions = [], failed = [] } = {}) {
  const n = Number(deleted) || 0; const left = Array.isArray(failed) ? failed.length : 0;
  return `${n} photo${n === 1 ? '' : 's'} deleted`
    + (versions.length ? `; the versions that held them keep them: ${versions.join(', ')}` : '')
    + (left ? `. ${left} could not be deleted, and why is listed below.` : '.');
}

// "Take in": call again while records are left, telling ``progress`` after each call ({added, left}: photos taken in so
// far, records still waiting). It stops on a refusal (thrown, with what was taken in before it as ``error.added``) and
// when a call takes nothing in, so records that cannot be taken in never keep it calling. ``stuck``: records left so.
export async function takeInAll(ref, progress = () => {}, call = datasetApi.takeIn) {
  let added = 0; let before = Infinity;
  for (;;) {
    let body;
    try { body = await call(ref); } catch (error) { error.added = added; throw error; }
    added += Number(body.added) || 0;
    const left = Math.max(0, Number(body.left) || 0);
    progress({ added, left });
    if (!left) return { added, left, stuck: 0 };
    if (!(Number(body.handled) > 0) || left >= before) return { added, left, stuck: left };
    before = left;
  }
}

// What the progress line says while taking in, and after.
export function takeInText({ added, left }) {
  const photos = `${added} photo${added === 1 ? '' : 's'}`;
  return `Taken in ${photos}, ${left} record${left === 1 ? '' : 's'} left.`;
}

// The recipe a version is frozen with, from the builder's steps 3 and 4.
export function recipeOf({ resize, dimension, augmentation }) {
  return { resize: resize ? Number(dimension) : null, augment: !!augmentation };
}
