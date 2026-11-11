import test from 'node:test';
import assert from 'node:assert/strict';
import { inParts, folderOf, dataUseAnswers, dataUseForm, toCard, ago, TYPE_KIND } from '../src/api/training.js';

test('an upload goes in parts of at most 20 files, in order', () => {
  const files = Array.from({ length: 45 }, (_, i) => i);
  const parts = inParts(files);
  assert.deepEqual(parts.map(p => p.length), [20, 20, 5]);
  assert.deepEqual(parts.flat(), files);
  assert.deepEqual(inParts([]), []);
});

test('a file chosen in a folder is grouped by its folder; a file chosen alone by nothing', () => {
  assert.equal(folderOf('homes/home-12/kitchen.jpg'), 'homes/home-12');
  assert.equal(folderOf('kitchen.jpg'), '');
  assert.equal(folderOf(''), '');
});

test('the data policy step becomes the five data-use answers', () => {
  assert.deepEqual(dataUseAnswers({ training: 'Only this project’s own models', retention: '90 days', access: 'People I invite to the project', aws: true, local: false, deletion: true }),
    { training: 'project', viewers: 'invited', retention: 90, allow_aws: true, allow_own_machine: false, allow_ai_provider: false,
      deletion_rule_confirmed: true });
  const strict = dataUseAnswers({ training: 'No', retention: 'Until I delete it', access: 'Only me', deletion: false });
  assert.deepEqual([strict.training, strict.viewers, strict.retention, strict.deletion_rule_confirmed], ['no', 'me', 'forever', false]);
  // Photos go to an outside AI provider only when the Owner ticked it (2026-10-27): left out, it is No.
  assert.equal(strict.allow_ai_provider, false);
  assert.equal(dataUseAnswers({ training: 'No', retention: '30 days', access: 'Only me', ai: true, deletion: true }).allow_ai_provider, true);
  assert.equal(dataUseForm({ allow_ai_provider: true }).ai, true);
  assert.equal(dataUseForm({}).ai, false);
});

test('every project type the New project screen offers has a kind, except face recognition', () => {
  assert.equal(TYPE_KIND['Instance Segmentation'], 'instance_segmentation');
  assert.equal(TYPE_KIND['Data Collection'], 'data_only');
  assert.equal(TYPE_KIND['Face Recognition'], undefined);
});

test('a project row becomes a card; a Labeller sees no numbers, shown as 0', () => {
  const card = toCard({ ref: '~4', name: 'Walls', task_label: 'Find the walls', photos: null, models: null, visibility: 'shared',
    rights: ['label', 'view'], folder: { id: 2, name: 'Pilots' }, created_at: '2026-10-15T10:00:00Z' });
  assert.equal(card.id, '~4'); assert.equal(card.images, 0); assert.equal(card.folder, 'Pilots'); assert.equal(card.folderId, 2);
  assert.equal(card.details.visibility, 'Shared');
  assert.equal(card.thumbnail, '');                                                    // a Labeller's card has no photo of the whole project
  assert.equal(toCard({ ref: 'leads', thumbnail: '/api/training-data/app/projects/leads/thumbnail/?p=1' }).thumbnail, '/api/training-data/app/projects/leads/thumbnail/?p=1');
  assert.equal(ago('2026-10-15T10:00:00Z', Date.parse('2026-10-15T12:00:00Z')), '2 hours ago');
  assert.equal(ago('2026-10-15T11:59:40Z', Date.parse('2026-10-15T12:00:00Z')), 'Just now');
});

test('a card counts photos, or the examples of a language-model project', () => {
  assert.equal(toCard({ ref: 'leads', photos: 1, examples: 0 }).data, '1 Image');
  assert.equal(toCard({ ref: 'leads', family: 'vision', photos: 14 }).data, '14 Images');
  assert.equal(toCard({ ref: 'bot', family: 'llm', photos: 0, examples: 32, models: 1 }).data, '32 Examples');
  assert.equal(toCard({ ref: 'bot', family: 'llm', examples: 1 }).data, '1 Example');
  assert.equal(toCard({ ref: '~4', family: 'llm', examples: null }).data, '0 Examples');      // a Labeller sees no numbers
});

test('a language-model project names its kind, and its three extra answers go to the backend', async () => {
  const { llmDataUseAnswers } = await import('../src/api/training.js');
  assert.deepEqual(['Chat assistant', 'Questions and answers', 'Document knowledge', 'Preference'].map(name => TYPE_KIND[name]),
    ['llm_chat_assistant', 'llm_qa', 'llm_documents', 'llm_preference']);
  assert.deepEqual(llmDataUseAnswers({ personal: 'drop', source: '  Our support chats ', right: true, judge: false }),
    { personal_data: 'drop', source: 'Our support chats', right_confirmed: true, judge_allowed: false });
  assert.deepEqual(llmDataUseAnswers({}), { personal_data: 'redact', source: '', right_confirmed: false, judge_allowed: false });
});

test('what a copy did is said in one sentence', async () => {
  const { copySaid } = await import('../src/api/training.js');
  assert.equal(copySaid({ copied: 3, already: 0, labels: 2, left_out: 0, reasons: [] }, 'Target'),
    '3 photos copied into “Target”; 2 accepted labels came along as your drafts, to check there.');
  assert.equal(copySaid({ copied: 1, already: 2, labels: 0, left_out: 1, reasons: [{ reason: 'deleted from the target on request', photos: 1 }] }, 'T'),
    '1 photo copied into “T”, 2 photos already there. 1 photo left out: deleted from the target on request (1)');
});

// A fake fetch that records every request and answers ``reply`` (JSON) with ``status``; 204 answers nothing.
function fake(reply = {}, status = 200) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, csrf: options.headers['X-CSRFToken'] });
    return { ok: status < 400, status, headers: { get: () => (status === 204 ? '' : 'application/json') }, json: async () => reply };
  };
  return { asked, opts: { fetchImpl, store: null, cookies: 'csrftoken=tok' } };
}

test('a folder is renamed and deleted by its id', async () => {
  const { renameFolder, deleteFolder } = await import('../src/api/training.js');
  const { asked, opts } = fake({ id: 5, name: 'Pilots 2', projects: 3, can_arrange: true });
  assert.deepEqual(await renameFolder(5, 'Pilots 2', opts), { id: 5, name: 'Pilots 2', projects: 3, can_arrange: true });
  const gone = fake({}, 204);
  assert.equal(await deleteFolder(5, gone.opts), null);
  assert.deepEqual(asked, [{ url: '/api/training-data/app/folders/5/', method: 'PATCH', body: { name: 'Pilots 2' }, csrf: 'tok' }]);
  assert.deepEqual(gone.asked, [{ url: '/api/training-data/app/folders/5/', method: 'DELETE', body: undefined, csrf: 'tok' }]);
  const clash = fake({ error: 'This workspace already has a folder named “Pilots”.', code: 'taken', field: 'name' }, 409);
  await assert.rejects(renameFolder(5, 'Pilots', clash.opts), { status: 409, field: 'name', serverCode: 'taken' });
});

test('the folder filter is a folder\'s id, so a renamed folder keeps its projects; a deleted one resets it', async () => {
  const { inFolder, filterAfterDelete, folderRows } = await import('../src/api/training.js');
  const cards = [toCard({ ref: 'a', folder: { id: 2, name: 'Pilots' } }), toCard({ ref: 'b', folder: { id: 3, name: 'Pilots' } }), toCard({ ref: 'c' })];
  assert.deepEqual(cards.filter(c => inFolder(c, '')).map(c => c.ref), ['a', 'b', 'c']);
  assert.deepEqual(cards.filter(c => inFolder(c, '2')).map(c => c.ref), ['a']);          // two folders of one name stay apart
  assert.deepEqual(cards.filter(c => inFolder(c, 3)).map(c => c.ref), ['b']);
  // A rename changes the name only: the same id still finds the project.
  const renamed = toCard({ ref: 'a', folder: { id: 2, name: 'Pilots, autumn' } });
  assert.equal(inFolder(renamed, '2'), true);
  assert.equal(filterAfterDelete('2', 2), '');
  assert.equal(filterAfterDelete('3', 2), '3');
  assert.equal(filterAfterDelete('', 2), '');
  assert.deepEqual(folderRows([{ id: 2, name: 'Pilots', projects: 4, can_arrange: true }, { id: 3, name: 'Old', projects: null, can_arrange: false }], cards),
    [{ id: 2, name: 'Pilots', can_arrange: true, projects: 4 }, { id: 3, name: 'Old', can_arrange: false, projects: 1 }]);
  assert.deepEqual(folderRows(undefined), []);
});
