import test from 'node:test';
import assert from 'node:assert/strict';
import { turnsOf, fixableOf, withFixes, reviewColumn, csvHeader, csvColumns, query, pathName, findingText, NOT_FOR_LLM, LATER_FOR_LLM } from '../src/api/llm.js';

const CHAT = { kind: 'chat', system: 'You are the support agent.', weight_on: 'last_assistant',
  messages: [{ role: 'user', content: 'Where is order 42?' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'find_order', arguments: '{"id":"42"}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: '{"status":"shipped"}' },
    { role: 'assistant', content: 'It has shipped.' }] };

test('an example is shown turn by turn: system, user, a tool call, its result, the answer', () => {
  assert.deepEqual(turnsOf(CHAT).map(t => [t.role, t.text]), [
    ['system', 'You are the support agent.'], ['user', 'Where is order 42?'], ['assistant', 'find_order({"id":"42"})'],
    ['tool', '{"status":"shipped"}'], ['assistant', 'It has shipped.']]);
  assert.deepEqual(turnsOf({ kind: 'document', title: 'Manual', text: 'Step one.' }), [{ role: 'document', label: 'Manual', text: 'Step one.' }]);
  const pair = turnsOf({ kind: 'preference', messages: [{ role: 'user', content: 'Free delivery?' }], chosen: { content: 'Above 50 euros.' }, rejected: { content: 'No.' } });
  assert.deepEqual(pair.map(t => t.label), ['User', 'Better answer', 'Worse answer']);
});

test('a reviewer fixes the last answer only; everything else of the example stays', () => {
  assert.deepEqual(fixableOf(CHAT), { answer: 'It has shipped.' });
  const fixed = withFixes(CHAT, { answer: 'It shipped today and arrives tomorrow.' });
  assert.equal(fixed.messages[3].content, 'It shipped today and arrives tomorrow.');
  assert.deepEqual(fixed.messages.slice(0, 3), CHAT.messages.slice(0, 3));
  assert.equal(CHAT.messages[3].content, 'It has shipped.');                       // the original is not changed
  const pref = { kind: 'preference', messages: [], chosen: { role: 'assistant', content: 'A' }, rejected: { role: 'assistant', content: 'B' } };
  assert.deepEqual(fixableOf(pref), { chosen: 'A', rejected: 'B' });
  assert.equal(withFixes(pref, { rejected: 'C' }).rejected.content, 'C');
  assert.equal(withFixes({ kind: 'document', text: 'old' }, { text: 'new' }).text, 'new');
});

test('a review stands in the board column of its state', () => {
  assert.deepEqual(['sent', 'returned', 'accepted', undefined].map(s => reviewColumn({ state: s })), ['Reviewing', 'In review', 'Dataset', 'Unassigned']);
});

test('a CSV header is read with quoted names, and the chosen columns are what the upload sends', () => {
  assert.deepEqual(csvHeader('﻿question,"the, answer",lang\r\nhi,hello,en'), ['question', 'the, answer', 'lang']);
  assert.deepEqual(csvColumns('conversation', { user: 'q', assistant: 'a', system: '', group: 'id' }), { user: 'q', assistant: 'a', group: 'id' });
  assert.deepEqual(csvColumns('translation', { translate_from: 'en', translate_to: 'ur', from_language: 'English', to_language: 'Urdu', user: 'x' }),
    { translate_from: 'en', translate_to: 'ur', from_language: 'English', to_language: 'Urdu' });
});

test('filters become a query; empty ones are left out', () => {
  assert.equal(query({ kind: 'chat', state: '', page: 2 }), '?kind=chat&page=2');
  assert.equal(query({}), '');
  assert.equal(pathName(['payload', 'faq', 'question']), 'faq.question');
  assert.equal(findingText('near_duplicate'), 'Nearly the same as an earlier example');
  assert.equal(findingText('unknown_code'), 'unknown_code');
});

test('a language-model project hides the vision-only pages and names the phase of the pages still to build', () => {
  assert.deepEqual(NOT_FOR_LLM, ['classes', 'nas', 'active']);
  assert.deepEqual(Object.keys(LATER_FOR_LLM).sort(), ['analytics', 'deploy', 'models', 'test', 'train']);
});
