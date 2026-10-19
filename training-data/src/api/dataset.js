// The Dataset and Versions pages' data (backend: training_models_data/app_api.py). Photos go into the same live
// store the editor reads (api/annotate.js), under ``batchId: 'dataset'``, so a photo opens in the real editor.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;
const post = (path, body) => apiFetch(path, { method: 'POST', body });

export const FILTERS = { split: '', group: '', origin: '', golden: '', tag: '' };

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
    id: p.id, batchId: 'dataset', name: p.name, url: p.image, width: p.width, height: p.height, state: p.status,
    labels: p.labels, label: p.label, golden: p.golden, split: p.split, group: p.group, origin: p.origin,
    tags: p.tags || [], shapes: [], noObjects: false, labelled: p.label_state === 'done',
  }))];
  store.dataset = { total: body.total, page: body.page, pages: body.pages, splitCounts: body.split_counts, may: body.may };
  // The editor asks the store what this person may do; the Dataset page knows it from the same rights.
  store.can = { ...(store.can || {}), batch: !!body.may?.golden, upload: !!body.may?.delete };
  return store.dataset;
}

export async function loadVersions(store) {
  const body = await apiFetch(`${base(store.ref)}/versions/`);
  store.versions = body.versions;
  store.versionMeta = { kinds: body.kinds, sizes: body.sizes, canPublish: body.can_publish, refused: body.refused, withoutWalls: body.without_walls };
  return body;
}

export const datasetApi = {
  tag: (ref, photos, body) => post(`${base(ref)}/photos/tags/`, { photos, ...body }),
  golden: (ref, photo, golden) => post(`${base(ref)}/photos/${enc(photo)}/golden/`, { golden }),
  remove: (ref, photos, reason) => post(`${base(ref)}/photos/delete/`, { photos, reason }),
  preview: (ref, kind) => apiFetch(`${base(ref)}/versions/preview/${query({ kind })}`),
  publish: (ref, body) => post(`${base(ref)}/versions/`, body),
  version: (ref, name) => apiFetch(`${base(ref)}/versions/${enc(name)}/`),
};

// The recipe a version is frozen with, from the builder's steps 3 and 4.
export function recipeOf({ resize, dimension, augmentation }) {
  return { resize: resize ? Number(dimension) : null, augment: !!augmentation };
}
