// The project's Classes & tags page (backend: training_models_data/app_api.py — classes-tags/, class-lock/,
// tags/<remove|rename>/; adding, changing and removing a class are the editor's own calls in api/annotate.js).
import { apiFetch } from './client.js';
import { api as annotateApi } from './annotate.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export const classesApi = {
  load: ref => apiFetch(`${base(ref)}/classes-tags/`, { timeoutMs: 60000 }),
  lock: (ref, locked) => apiFetch(`${base(ref)}/class-lock/`, { method: 'POST', body: { locked } }),
  tag: (ref, action, body) => apiFetch(`${base(ref)}/tags/${action}/`, { method: 'POST', body, timeoutMs: 60000 }),
  addClass: annotateApi.addClass,
  updateClass: annotateApi.updateClass,
  removeClass: annotateApi.removeClass,
};

// What the Usage column says for a class: shapes drawn, and for a class the project added, on how many labels.
export function usageText(row) {
  const shapes = `${row.shapes} shape${row.shapes === 1 ? '' : 's'}`;
  return row.labels === null || row.labels === undefined ? shapes : `${shapes} · on ${row.labels} label${row.labels === 1 ? '' : 's'}`;
}

// The rows of the table, filtered by the search box (by name, case-insensitive).
export const matching = (rows, words) => (rows || []).filter(row => row.name.toLowerCase().includes((words || '').trim().toLowerCase()));
