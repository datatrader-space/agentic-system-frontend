// The Training Asset Library: the person's own photos and videos uploaded here. One AADML Library is shared by every
// origin and never mixed (backend agentic-docs/ASSET_LIBRARY_ORIGINS_PLAN.md): this page lists origin "training"
// only (GET /api/library/?origin=training), never Video Studio's or AADML's chats' files. Uploads go through
// training_models_data/app_api.py library/, and putting files into a project through photos/from-library/, where the
// backend checks again that each file is the person's own Training file.
import { apiFetch } from './client.js';
import { query } from './workspace.js';

export const LIBRARY_PAGE = 40;
export const libraryApi = {
  list: ({ type = 'image', q = '', page = 1 } = {}) =>
    apiFetch(`/library/?${query({ origin: 'training', type, q: q.trim(), page, limit: LIBRARY_PAGE })}`),
  upload: file => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiFetch('/training-data/app/library/', { method: 'POST', body: form, timeoutMs: 300000 });
  },
  addToProject: (ref, body) => apiFetch(`/training-data/app/projects/${encodeURIComponent(ref)}/photos/from-library/`,
    { method: 'POST', body, timeoutMs: 300000 }),
};

// A Library file's address on this site: the Library answers absolute addresses (AADML's own host); the path alone is
// asked from this page's origin, so the AADML sign-in cookie goes with it.
export function mediaPath(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://aadml.invalid');
    return /^\/media(-dl)?\//.test(parsed.pathname) ? `${parsed.pathname}${parsed.search}` : '';
  } catch { return ''; }
}

// What can go into a project: photos and videos (a video gives a photo every few seconds).
export const usable = item => item.media_type === 'image' || item.media_type === 'video';

export function sizeText(bytes) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// What adding did, in one sentence.
export function addedSaid(body, project) {
  const c = body.counts || {};
  const n = (k, word) => `${c[k]} ${word}${c[k] === 1 ? '' : 's'}`;
  let said = `${n('added', 'photo')} added to “${project}”`;
  if (c.already) said += `, ${c.already} already there`;
  if (c.stored) said += `, ${c.stored} kept as a record only (its data-use answers do not allow training)`;
  if (c.rejected) said += `, ${n('rejected', 'file')} not taken`;
  return `${said}.`;
}
