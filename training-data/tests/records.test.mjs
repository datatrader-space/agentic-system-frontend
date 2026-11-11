import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOST_AT_ONCE, tooMany, toggled, refusalRows, RECORD_FILTERS, searchText, searchRefusal, recordsQuery, filtered,
  payloadPreview, pretty, sizeText, deletedWords, pathName, fieldsBody, fieldsRefusal, placedWords, focusSettings,
  takeSettingsFocus, recordsApi, exportUrl,
} from '../src/api/records.js';

// A fake fetch that records every request and answers ``reply`` (JSON) with ``status``.
function fake(reply = {}, status = 200) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, csrf: options.headers['X-CSRFToken'] });
    return { ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => reply };
  };
  return { asked, opts: { fetchImpl, store: null, cookies: 'csrftoken=tok' } };
}

test('only the filters that are set go to the server, the search as the server reads it', () => {
  assert.equal(recordsQuery(RECORD_FILTERS), '');
  assert.equal(recordsQuery({ ...RECORD_FILTERS, q: '  home   42 ', annotated: 'yes', has_file: 'no', from: '2026-11-01', to: '2026-11-11' }),
    '?q=home+42&annotated=yes&has_file=no&from=2026-11-01&to=2026-11-11');
  assert.equal(searchText(' a \n b  '), 'a b');
});

test('"assigned" is sent only for a person who may use it (the server refuses it otherwise)', () => {
  const f = { ...RECORD_FILTERS, assigned: 'yes' };
  assert.equal(recordsQuery(f), '');
  assert.equal(recordsQuery(f, { assigned: true }), '?assigned=yes');
  assert.equal(filtered(f), false);
  assert.equal(filtered(f, true), true);
});

test('the next page is asked for with the cursor the page before gave', () => {
  assert.equal(recordsQuery({ ...RECORD_FILTERS, annotated: 'no' }, { cursor: '1731300000000000.abc', limit: 50 }),
    '?annotated=no&cursor=1731300000000000.abc&limit=50');
});

test('a search longer than 200 characters is refused with the server\'s sentence, never cut', () => {
  assert.equal(searchRefusal('x'.repeat(200)), '');
  assert.equal(searchRefusal(`${'x'.repeat(150)}      ${'y'.repeat(50)}`), 'Search for at most 200 characters; this search has 201.');
  assert.equal(searchRefusal(''), '');
});

test('a payload is previewed in one short line: an object as its compact JSON, a text as itself', () => {
  assert.equal(payloadPreview({ kind: 'object', text: '2 keys', full: '{"home_id": "h1", "room": "kitchen"}' }), '{"home_id": "h1", "room": "kitchen"}');
  assert.equal(payloadPreview({ kind: 'text', text: 'hello\n  world', full: 'hello world' }), 'hello world');
  const long = payloadPreview({ kind: 'object', text: '9 keys', full: `{"a": "${'z'.repeat(300)}"}` }, 40);
  assert.equal(long.length, 40); assert.ok(long.endsWith('…'));
  assert.equal(payloadPreview({ kind: 'empty', text: '', full: 'Empty in this record' }), '(empty)');
  assert.equal(payloadPreview(null), '');
});

test('the record panel shows JSON formatted, and sizes in words', () => {
  assert.equal(pretty({ a: 1 }), '{\n  "a": 1\n}');
  assert.equal(pretty(null), '{}');
  assert.equal(sizeText(512), '512 B'); assert.equal(sizeText(2048), '2.0 KB'); assert.equal(sizeText(5 * 1024 * 1024), '5.0 MB'); assert.equal(sizeText(undefined), '');
});

test('more than 500 at once is refused with the same sentence as the server', () => {
  assert.equal(MOST_AT_ONCE, 500);
  assert.equal(tooMany(500, 'records'), '');
  assert.equal(tooMany(501, 'records'), 'Select at most 500 records at once; 501 were selected.');   // records_api.records_delete
  assert.equal(tooMany(600, 'photos'), 'Select at most 500 photos at once; 600 were selected.');    // app_api._picked
  assert.equal(tooMany(501, 'labels'), 'At most 500 labels are approved at once, and 501 were chosen. Approve them in parts.');   // review_api
  assert.equal(tooMany(502, 'examples'), 'At most 500 examples are approved at once, and 502 were chosen. Approve them in parts.');   // llm/review_api
});

test('the selection bar toggles one id, and every refused row is kept with its name and why', () => {
  assert.deepEqual(toggled(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggled(['a', 'b'], 'a'), ['b']);
  const rows = refusalRows([{ record: 'r1', why: 'No such record in this project.' }, { record: 'r2', why: 'It was deleted already.' }], 'record', id => (id === 'r1' ? 'The first' : undefined));
  assert.deepEqual(rows, [{ id: 'r1', name: 'The first', why: 'No such record in this project.' }, { id: 'r2', name: 'r2', why: 'It was deleted already.' }]);
  assert.deepEqual(refusalRows(undefined, 'record'), []);
  assert.deepEqual(refusalRows([{ item: 7, why: 'x' }], 'item').map(r => r.id), ['7']);
});

test('a deletion is said with what went with the records', () => {
  assert.equal(deletedWords({ deleted: 1, photos: 0, examples: 0 }), '1 record deleted.');
  assert.equal(deletedWords({ deleted: 3, photos: 1, examples: 4 }), '3 records deleted, with 1 training photo and 4 examples.');
  assert.equal(deletedWords({ deleted: 0, photos: 0, examples: 0, failed: [{}] }), '0 records deleted.');
});

test('the records list is asked at the project\'s address with its filters', async () => {
  const { asked, opts } = fake({ records: [], total: 0, matching: 0, next: null, may: {} });
  await recordsApi.list('walls', { ...RECORD_FILTERS, q: 'kitchen' }, { cursor: 'c1' }, opts);
  assert.deepEqual(asked, [{ url: '/api/training-data/app/projects/walls/records/?q=kitchen&cursor=c1', method: 'GET', body: undefined, csrf: undefined }]);
  await recordsApi.get('~12', '0b7e3c1a-0000-4000-8000-000000000001', opts);
  assert.equal(asked[1].url, '/api/training-data/app/projects/~12/records/0b7e3c1a-0000-4000-8000-000000000001/');
});

test('deleting records posts the ids and the reason, with the CSRF token', async () => {
  const { asked, opts } = fake({ deleted: 2, photos: 1, examples: 0, failed: [] });
  const answer = await recordsApi.remove('walls', ['a', 'b'], 'The customer asked for it.', opts);
  assert.equal(answer.deleted, 2);
  assert.deepEqual(asked, [{ url: '/api/training-data/app/projects/walls/records/delete/', method: 'POST', body: { records: ['a', 'b'], reason: 'The customer asked for it.' }, csrf: 'tok' }]);
});

test('a refusal comes back with the server\'s own sentence and code (400 too_many)', async () => {
  const { opts } = fake({ error: 'Select at most 500 records at once; 501 were selected.', code: 'too_many', field: 'records' }, 400);
  await assert.rejects(recordsApi.remove('walls', Array(501).fill('x'), 'r', opts),
    e => e.status === 400 && e.serverCode === 'too_many' && e.field === 'records' && e.message === 'Select at most 500 records at once; 501 were selected.');
});

test('record fields: read, and saved with PUT and the CSRF token; a 409 says why', async () => {
  const { asked, opts } = fake({ placed: 3, pool_left: 1 });
  await recordsApi.fields('walls', opts);
  await recordsApi.saveFields('walls', fieldsBody({ mode: 'keys', paths: [['payload', 'home_id']], consent: 'Given' }), opts);
  assert.deepEqual(asked, [
    { url: '/api/training-data/app/projects/walls/record-fields/', method: 'GET', body: undefined, csrf: undefined },
    { url: '/api/training-data/app/projects/walls/record-fields/', method: 'PUT', body: { group: { mode: 'keys', paths: [['payload', 'home_id']] }, consent: 'Given' }, csrf: 'tok' },
  ]);
  const refused = fake({ error: "Only a vision project reads a photo's group and consent from its records.", code: 'conflict' }, 409);
  await assert.rejects(recordsApi.fields('chat', refused.opts), e => e.status === 409 && /Only a vision project/.test(e.message));
});

test('record fields: the body the server reads, its refusals said first, and what a save did', () => {
  assert.deepEqual(fieldsBody({ mode: 'each_photo', paths: [['payload', 'x']], consent: '' }), { group: { mode: 'each_photo' }, consent: '' });
  assert.equal(fieldsRefusal({ mode: 'keys', paths: [], consent: '' }), 'Choose at least one key that names the home or group, or say that the sender names none.');
  assert.equal(fieldsRefusal({ mode: 'keys', paths: [['payload', 'a'], ['payload', 'b'], ['payload', 'c'], ['payload', 'd']] }), 'At most 3 keys can name the group; 4 were chosen.');
  assert.equal(fieldsRefusal({ mode: 'each_photo', consent: 'x'.repeat(301) }), 'The licence or consent is at most 300 characters; this one has 301.');
  assert.equal(fieldsRefusal({ mode: 'each_photo', consent: `${'x'.repeat(150)}     ${'y'.repeat(149)}` }), '');   // spaces count once, as the server counts
  assert.equal(fieldsRefusal({ mode: 'keys', paths: [['payload', 'home_id']] }), '');
  assert.equal(pathName(['payload', 'shop', 'id']), 'payload.shop.id');
  assert.equal(placedWords({ placed: 3, pool_left: 1 }), 'Saved. 3 photos left the unassigned pool; 1 photo is still in it.');
  assert.equal(placedWords({ placed: 0, pool_left: 0 }), 'Saved. No photo left the unassigned pool; it is empty now.');
});

test('the export is a plain download link of the project', () => {
  assert.equal(exportUrl('walls'), '/api/training-data/app/projects/walls/records/export/');
  assert.equal(exportUrl('~7'), '/api/training-data/app/projects/~7/records/export/');
});

test('a page that links to Settings names its section once', () => {
  focusSettings('record-fields');
  assert.equal(takeSettingsFocus(), 'record-fields');
  assert.equal(takeSettingsFocus(), '');
});

// ── every new delete, approve and take-back goes through a UiDialog ──
const source = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
function template(text) { return text.slice(text.indexOf('<template>'), text.lastIndexOf('</template>')); }
// The function a call stands in: the name after the last "function " before it.
function enclosing(text, call) {
  const at = text.indexOf(call);
  assert.ok(at >= 0, `${call} is used`);
  assert.equal(text.indexOf(call, at + 1), -1, `${call} is used once`);
  const before = text.slice(0, at);
  const match = [...before.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].at(-1);
  return match?.[1];
}
// Every click that runs ``fn`` sits inside a <UiDialog>…</UiDialog>, and there is one.
function onlyInDialogs(text, fn) {
  const t = template(text);
  const clicks = [...t.matchAll(new RegExp(`@click="${fn}"`, 'g'))].map(m => m.index);
  assert.ok(clicks.length > 0, `${fn} is run from the page`);
  const dialogs = [...t.matchAll(/<UiDialog\b[\s\S]*?<\/UiDialog>/g)].map(m => [m.index, m.index + m[0].length]);
  for (const at of clicks) assert.ok(dialogs.some(([a, b]) => at > a && at < b), `${fn} runs only from a dialog`);
}

for (const [file, call, fn] of [
  ['ProjectRecords.vue', 'recordsApi.remove(', 'confirmDelete'],
  ['ProjectStudio.vue', 'datasetApi.remove(', 'deleteTargets'],
  ['ProjectStudio.vue', 'liveApi.approveMany(', 'approvePicked'],
  ['ProjectStudio.vue', 'liveApi.takeBack(', 'confirmTakeBack'],
  ['AnnotationEditor.vue', 'liveApi.takeBack(', 'takeBackLive'],
  ['AnnotationJob.vue', 'api.reopen(', 'reopenNow'],
  ['LlmReview.vue', 'llmApi.decideMany(', 'approvePicked'],
  ['LlmReview.vue', 'llmApi.takeBack(', 'confirmTakeBack'],
  ['ProjectSettings.vue', 'recordsApi.saveFields(', 'saveFields'],
]) {
  test(`${file}: ${call.slice(0, -1)} runs only from a dialog`, () => {
    const text = source(file);
    assert.equal(enclosing(text, call), fn);
    if (fn === 'reopenNow') onlyInDialogs(text, 'save');            // the job's one dialog runs save(), which runs reopenNow()
    else onlyInDialogs(text, fn);
  });
}

test('no new screen uses a native dialog', () => {
  for (const file of ['ProjectRecords.vue', 'DeletedOnRequest.vue', 'ProjectStudio.vue', 'AnnotationEditor.vue', 'AnnotationJob.vue', 'LlmReview.vue', 'LlmExamples.vue', 'ProjectSettings.vue']) {
    assert.doesNotMatch(source(file), /(?<![.\w])(confirm|alert|prompt)\(|window\.(confirm|alert|prompt)\(/, file);   // a method of a part (picker.confirm) is not one
  }
});
