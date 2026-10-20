import test from 'node:test';
import assert from 'node:assert/strict';
import { turnsOf, fixableOf, withFixes, reviewColumn, csvHeader, csvColumns, query, pathName, findingText, NOT_FOR_LLM, LATER_FOR_LLM, trainingOverrides, lossPoints, configSummary, lossInWords, percent, tallyParts, tallyInWords, questionRows, questionCases, verdictLabel, verdictTone } from '../src/api/llm.js';

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
  assert.deepEqual(Object.keys(LATER_FOR_LLM).sort(), ['deploy']);
});

test('a training configuration reads as words, not JSON', () => {
  assert.equal(configSummary({ method: 'sft', epochs: 3, batch_size: 2, grad_accum_steps: 4, max_length: 1024, learning_rate: 0.0002, lora: { rank: 16 } }),
    '3 epochs · batch 2 × 4 · up to 1024 tokens · learning rate 0.0002 · LoRA rank 16');
  assert.equal(configSummary({ method: 'dpo', max_steps: 6, batch_size: 1, grad_accum_steps: 1, beta: 0.1 }), '6 steps · batch 1 · beta 0.1');
  assert.equal(configSummary({}), 'the defaults');
});

test('the Train page sends only the settings typed in, and a loss curve fits its box', () => {
  assert.deepEqual(trainingOverrides({ epochs: '2', max_steps: '', learning_rate: '', rank: '8' }), { epochs: 2, lora: { rank: 8, alpha: 16 } });
  assert.deepEqual(trainingOverrides({ epochs: '', max_steps: '', learning_rate: '', rank: '' }), {});
  assert.equal(lossPoints([{ step: 1, loss: 2 }, { step: 3, loss: 1 }], 'loss', 100, 10), '0.0,0.0 100.0,10.0');
  assert.equal(lossPoints([{ step: 1, loss: 2 }]), '');
  assert.equal(lossPoints([{ step: 1, eval_loss: 2 }, { step: 2, loss: 1 }]), '');
});

test('a loss curve can be read as words too', () => {
  assert.equal(lossInWords([{ step: 1, loss: 2.917 }, { step: 3 }, { step: 6, loss: 2.4 }]), 'from 2.92 at step 1 to 2.40 at step 6');
  assert.equal(lossInWords([{ step: 1, loss: 2 }]), '');
});

test('a marking reads as a stacked bar and as words, from the trained model’s side', () => {
  const tally = { marked: 4, trained_better: 2, base_better: 1, same: 1, both_wrong: 0, win_rate: 0.625 };
  assert.deepEqual(tallyParts(tally).map(p => [p.key, p.count, p.width]),
    [['trained_better', 2, 50], ['same', 1, 25], ['both_wrong', 0, 0], ['base_better', 1, 25]]);
  assert.deepEqual(tallyParts({ marked: 0 }), []);
  assert.equal(tallyInWords(tally), 'Of 4 marked: the trained model better 2, the same 1, both wrong 0, the base model better 1. Win rate 63%.');
  assert.equal(tallyInWords(null), 'Nothing was marked.');
  assert.equal(percent(0.5), '50%');
  assert.equal(percent(0.1234, 1), '12.3%');
  assert.equal(percent(null), '—');
  assert.deepEqual([verdictLabel('passed'), verdictTone('passed'), verdictLabel('inconclusive'), verdictLabel('')], ['Passed', 'green', 'Inconclusive', '—']);
});

test('test questions are edited as rows and sent back as conversations, empty rows dropped', () => {
  const cases = [{ messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Refund time?' }], expected: 'Five days.', rubric: '', tags: ['refunds'] }];
  const rows = questionRows(cases);
  assert.deepEqual(rows.map(r => [r.question, r.expected]), [['Refund time?', 'Five days.']]);
  rows.push({ question: '  ', expected: 'x', rubric: '', tags: [] });
  rows.push({ question: 'New one? ', expected: '', rubric: 'Polite.', tags: [] });
  assert.deepEqual(questionCases(rows), [
    { messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Refund time?' }], expected: 'Five days.', rubric: '', tags: ['refunds'] },
    { messages: [{ role: 'user', content: 'New one?' }], expected: '', rubric: 'Polite.', tags: [] },
  ]);
  rows[0].question = 'Changed?';
  assert.deepEqual(questionCases(rows)[0].messages, [{ role: 'user', content: 'Changed?' }]);
});
