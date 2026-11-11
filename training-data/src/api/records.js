// The Records page and a vision project's record fields (ADM-1210 §3.2, §3.3, §3.5). Backend:
// training_models_data/records_api.py, under /training-data/app/projects/<ref>/ — every right and every limit is checked
// there; this module only builds the requests and says the answers in words. It also holds what the selection bars of
// the Records page, the Dataset tab, the review queue and an LLM review share: the 500 limit and the refusal lists.
import { apiFetch } from './client.js';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

// ── what every selection bar shares ──
// The most ids one request takes (records_api.BULK_RECORDS, app_api.BULK_PHOTOS, review_api / llm review_api
// MOST_AT_ONCE). More is refused with a sentence, never trimmed: the page says the same sentence before it asks.
export const MOST_AT_ONCE = 500;

// The sentence the server answers to too many at once ('' when the count is allowed).
export function tooMany(count, what = 'records') {
  if (!(count > MOST_AT_ONCE)) return '';
  if (what === 'labels' || what === 'examples') {
    return `At most ${MOST_AT_ONCE} ${what} are approved at once, and ${count} were chosen. Approve them in parts.`;
  }
  return `Select at most ${MOST_AT_ONCE} ${what} at once; ${count} were selected.`;
}

// A selection after a click on one box: the id is added, or taken out when it was in.
export function toggled(selection, id) {
  return selection.includes(id) ? selection.filter(x => x !== id) : [...selection, id];
}

// The rows an answer refused (``failed: [{record|photo, why}]``, ``refused: [{label|item, why}]``), each with the name
// the page shows for it (``nameOf(id)``; the id itself when the page does not know it). Every row is kept.
export function refusalRows(rows, key, nameOf = id => id) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const id = row?.[key] ?? '';
    return { id: String(id), name: String(nameOf(id) ?? id), why: String(row?.why ?? '') };
  });
}

// ── the list ──
export const SEARCH_CHARS = 200;
export const RECORD_FILTERS = { q: '', annotated: '', has_file: '', assigned: '', from: '', to: '' };

// A search as the server reads it: its runs of spaces made one.
export const searchText = q => String(q ?? '').split(/\s+/).filter(Boolean).join(' ');

// The server's sentence for a search that is too long ('' when it is not): the page says it and does not ask.
export function searchRefusal(q) {
  const text = searchText(q);
  return text.length > SEARCH_CHARS ? `Search for at most ${SEARCH_CHARS} characters; this search has ${text.length}.` : '';
}

// The query string of one page of the list: only the filters that are set, ``assigned`` only for a person who may use
// it (the server refuses it otherwise), then the page's cursor and size.
export function recordsQuery(filters = RECORD_FILTERS, { cursor = '', limit = 0, assigned = false } = {}) {
  const params = new URLSearchParams();
  for (const name of Object.keys(RECORD_FILTERS)) {
    if (name === 'assigned' && !assigned) continue;
    const value = name === 'q' ? searchText(filters[name]) : String(filters[name] ?? '').trim();
    if (value) params.set(name, value);
  }
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const q = params.toString();
  return q ? `?${q}` : '';
}

// Whether any filter is set (the empty state says "No record matches these filters" then).
export const filtered = (filters, assigned = false) => recordsQuery(filters, { assigned }) !== '';

// A record's payload in one short line, from the cell the server made of it (record_table.show: {kind, text, full}):
// an object or a list shows its compact JSON, anything else its text. Cut at ``max`` characters with "…".
export function payloadPreview(cell, max = 120) {
  if (!cell || typeof cell !== 'object') return '';
  const raw = ['object', 'list'].includes(cell.kind) ? (cell.full || cell.text) : cell.text;
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return cell.kind === 'empty' ? '(empty)' : '';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// A value as formatted JSON for the record panel (read only, decision D2).
export const pretty = value => JSON.stringify(value ?? {}, null, 2);

// A size in bytes, in words.
export function sizeText(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n / 1024; let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

// ── deleting ──
// What a deletion answered ({deleted, photos, examples, failed}), in one sentence.
export function deletedWords({ deleted = 0, photos = 0, examples = 0 } = {}) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const parts = [];
  if (photos) parts.push(plural(photos, 'training photo', 'training photos'));
  if (examples) parts.push(plural(examples, 'example', 'examples'));
  return `${plural(deleted, 'record', 'records')} deleted${parts.length ? `, with ${parts.join(' and ')}` : ''}.`;
}

// ── record fields (a vision project) ──
export const pathName = path => (Array.isArray(path) ? path.join('.') : '');

// What the section saves, as records_api.record_fields_view takes it.
export function fieldsBody({ mode, paths = [], consent = '' }) {
  return { group: mode === 'each_photo' ? { mode: 'each_photo' } : { mode: 'keys', paths: paths.map(p => [...p]) }, consent: String(consent ?? '') };
}

// What the server would refuse in the section ('' when nothing): the same sentences as record_fields.posted.
export function fieldsRefusal({ mode, paths = [], consent = '' }, { keys = 3, consent_chars: chars = 300 } = {}) {
  if (mode !== 'keys' && mode !== 'each_photo') return 'Choose how a photo gets its group: from keys of its record, or every photo is a group of its own.';
  if (mode === 'keys' && !paths.length) return 'Choose at least one key that names the home or group, or say that the sender names none.';
  if (mode === 'keys' && paths.length > keys) return `At most ${keys} keys can name the group; ${paths.length} were chosen.`;
  const length = String(consent ?? '').split(/\s+/).filter(Boolean).join(' ').length;
  if (length > chars) return `The licence or consent is at most ${chars} characters; this one has ${length}.`;
  return '';
}

// What a save answered ({placed, pool_left}), in one sentence.
export function placedWords({ placed = 0, pool_left: left = 0 } = {}) {
  const photos = n => `${n} photo${n === 1 ? '' : 's'}`;
  return `Saved. ${placed ? `${photos(placed)} left the unassigned pool` : 'No photo left the unassigned pool'}; ${left ? `${photos(left)} ${left === 1 ? 'is' : 'are'} still in it` : 'it is empty now'}.`;
}

// The Settings page opened from another page at one of its sections ("From a record to a training photo"): the page that
// links there names the section, and Settings scrolls to it once.
let settingsFocus = '';
export function focusSettings(section) { settingsFocus = section; }
export function takeSettingsFocus() { const section = settingsFocus; settingsFocus = ''; return section; }

// ── the requests ──
export const recordsApi = {
  list: (ref, filters, page = {}, opts) => apiFetch(`${base(ref)}/records/${recordsQuery(filters, page)}`, opts),
  get: (ref, id, opts) => apiFetch(`${base(ref)}/records/${enc(id)}/`, opts),
  // One record or several, each on request with the reason (decision D1). At most MOST_AT_ONCE ids.
  remove: (ref, records, reason, opts) => apiFetch(`${base(ref)}/records/delete/`, { timeoutMs: 120000, ...opts, method: 'POST', body: { records, reason } }),
  fields: (ref, opts) => apiFetch(`${base(ref)}/record-fields/`, opts),
  saveFields: (ref, body, opts) => apiFetch(`${base(ref)}/record-fields/`, { timeoutMs: 120000, ...opts, method: 'PUT', body }),
};

// The export is a download the browser makes itself (streamed, every record): a link, never read into the page.
export const exportUrl = ref => `/api${base(ref)}/records/export/`;
