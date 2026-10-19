import test from 'node:test';
import assert from 'node:assert/strict';
import { inParts, folderOf, dataUseAnswers, toCard, ago, TYPE_KIND } from '../src/api/training.js';

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
    { training: 'project', viewers: 'invited', retention: 90, allow_aws: true, allow_own_machine: false, deletion_rule_confirmed: true });
  const strict = dataUseAnswers({ training: 'No', retention: 'Until I delete it', access: 'Only me', deletion: false });
  assert.deepEqual([strict.training, strict.viewers, strict.retention, strict.deletion_rule_confirmed], ['no', 'me', 'forever', false]);
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
  assert.equal(ago('2026-10-15T10:00:00Z', Date.parse('2026-10-15T12:00:00Z')), '2 hours ago');
  assert.equal(ago('2026-10-15T11:59:40Z', Date.parse('2026-10-15T12:00:00Z')), 'Just now');
});

test('a language-model project names its kind, and its three extra answers go to the backend', async () => {
  const { llmDataUseAnswers } = await import('../src/api/training.js');
  assert.deepEqual(['Chat assistant', 'Questions and answers', 'Document knowledge', 'Preference'].map(name => TYPE_KIND[name]),
    ['llm_chat_assistant', 'llm_qa', 'llm_documents', 'llm_preference']);
  assert.deepEqual(llmDataUseAnswers({ personal: 'drop', source: '  Our support chats ', right: true, judge: false }),
    { personal_data: 'drop', source: 'Our support chats', right_confirmed: true, judge_allowed: false });
  assert.deepEqual(llmDataUseAnswers({}), { personal_data: 'redact', source: '', right_confirmed: false, judge_allowed: false });
});
