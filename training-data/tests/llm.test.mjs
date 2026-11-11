import test from 'node:test';
import assert from 'node:assert/strict';
import { turnsOf, fixableOf, withFixes, reviewColumn, csvHeader, csvColumns, query, pathName, findingText, NOT_FOR_LLM, LATER_FOR_LLM, trainingOverrides, lossPoints, configSummary, lossInWords, percent, tallyParts, tallyInWords, questionRows, questionCases, verdictLabel, verdictTone, chatSnippet, chatLiveTag, downloadUrl, cardFacts } from '../src/api/llm.js';

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

test('a language-model project hides the vision-only pages and has no page left to build', () => {
  assert.deepEqual(NOT_FOR_LLM, ['classes', 'nas', 'active']);
  assert.deepEqual(LATER_FOR_LLM, {});
});

const CHAT_URL = 'https://aadml.example/api/training-data/v1/projects/7/environments/{environment}/v1/chat/completions';

test('the chat call names the real address for the chosen environment, and never a key', () => {
  for (const language of ['Python', 'JavaScript', 'HTTP / cURL']) {
    const code = chatSnippet(language, CHAT_URL, 'production');
    assert.ok(code.includes('/projects/7/environments/production/v1'), language);
    assert.ok(!code.includes('{environment}') && !code.includes('/staging/'), language);
    assert.ok(code.includes("<the app's key>"), language);
  }
  // The OpenAI client is given the base address: it adds /chat/completions itself.
  assert.ok(chatSnippet('Python', CHAT_URL, 'staging').includes('base_url="https://aadml.example/api/training-data/v1/projects/7/environments/staging/v1"'));
  assert.ok(chatSnippet('HTTP / cURL', CHAT_URL, 'staging').includes('"stream": true'));
});

test('a chat deployment says whether it answers, and that it is starting', () => {
  assert.deepEqual(chatLiveTag({ live: null, starting: null }), ['neutral', 'Nothing deployed']);
  assert.deepEqual(chatLiveTag({ live: null, starting: { number: 1 } }), ['purple', 'Starting']);
  assert.deepEqual(chatLiveTag({ live: { healthy: true } }), ['green', 'Live']);
  assert.deepEqual(chatLiveTag({ live: { healthy: false } }), ['amber', 'Live · not answering']);
});

test('a download is a plain address the session cookie reaches', () => {
  assert.equal(downloadUrl('~7', 2, 'merged'), '/api/training-data/app/projects/~7/llm/models/2/download/merged/');
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

test('a model card reads as facts, with the licence use in words', () => {
  const facts = Object.fromEntries(cardFacts({ model: { kind: 'lora-adapter', lora: { rank: 4 }, method: 'sft', parent: null,
    base_model: { repo: 'HuggingFaceTB/SmolLM2-135M-Instruct', licence: 'Apache 2.0', use: 'paid' } },
    dataset: { version: 'llm-v1', rows: { train: 18, validation: 3 } }, metrics: { steps: 8, train_loss: 3.7386, eval_loss: 3.7069 },
    runtime: { device: 'cpu', instance_type: 'local-cpu' } }));
  assert.equal(facts['Base model'], 'HuggingFaceTB/SmolLM2-135M-Instruct (Apache 2.0: commercial use allowed)');
  assert.equal(facts.Method, 'SFT, LoRA rank 4');
  assert.equal(facts['Started from'], 'the base model');
  assert.equal(facts.Dataset, 'llm-v1: 18 training and 3 validation rows');
  assert.equal(facts.Result, '8 steps, training loss 3.739, validation loss 3.707');
  assert.equal(cardFacts(null)[0][1], '—');
  assert.equal(Object.fromEntries(cardFacts({ model: { parent: { model_version: 'chat-v1', run: 1, method: 'sft' } } }))['Started from'], 'model chat-v1 (SFT)');
});

// ── ADM-1210 phase C: the reviewer approves several, a send-back of some examples, take back, deletions ──
function fakeFetch(reply = {}, status = 200) {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, csrf: options.headers['X-CSRFToken'] });
    return { ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => reply };
  };
  return { asked, opts: { fetchImpl, store: null, cookies: 'csrftoken=tok' } };
}

test('only waiting examples preparation did not flag are approved together; flagged ones are left out', async () => {
  const { approvable, leftOut } = await import('../src/api/llm.js');
  const items = [{ id: 1, decision: 'waiting', why: 'sample' }, { id: 2, decision: 'waiting', why: 'flagged' }, { id: 3, decision: 'approved', why: 'sample' }, { id: 4, decision: 'waiting', why: 'sample' }];
  assert.deepEqual(approvable(items).map(i => i.id), [1, 4]);
  assert.deepEqual(leftOut(items).map(i => i.id), [2]);
  assert.deepEqual(approvable(undefined), []);
});

test('an approval is taken back only from an accepted review, for an approved or fixed example', async () => {
  const { mayTakeBack } = await import('../src/api/llm.js');
  assert.equal(mayTakeBack({ state: 'accepted' }, { decision: 'approved' }), true);
  assert.equal(mayTakeBack({ state: 'accepted' }, { decision: 'fixed' }), true);
  assert.equal(mayTakeBack({ state: 'accepted' }, { decision: 'rejected' }), false);
  assert.equal(mayTakeBack({ state: 'returned' }, { decision: 'approved' }), false);
});

test('a review\'s send-back names only the examples chosen (their positions), or every one', async () => {
  const { reviewSendBackBody } = await import('../src/api/llm.js');
  assert.deepEqual(reviewSendBackBody('Read again'), { reason: 'Read again' });
  assert.deepEqual(reviewSendBackBody('Read again', [3, '1', 3, 0, 'x']), { reason: 'Read again', positions: [3, 1] });
});

test('approve several, take back and the deletions list ask their addresses; writes carry the CSRF token', async () => {
  const { llmApi } = await import('../src/api/llm.js');
  const { asked, opts } = fakeFetch({});
  await llmApi.decideMany('chat', 2, [11, 12], opts);
  await llmApi.takeBack('chat', 2, 11, opts);
  await llmApi.deletions('chat', null, opts);
  await llmApi.deletions('chat', { before: '2026-11-10T09:00:00Z', before_id: 9 }, opts);
  assert.deepEqual(asked, [
    { url: '/api/training-data/app/projects/chat/llm/reviews/2/items/decide/', method: 'POST', body: { items: [11, 12], decision: 'approved' }, csrf: 'tok' },
    { url: '/api/training-data/app/projects/chat/llm/reviews/2/items/11/take-back/', method: 'POST', body: {}, csrf: 'tok' },
    { url: '/api/training-data/app/projects/chat/llm/deletions/', method: 'GET', body: undefined, csrf: undefined },
    { url: '/api/training-data/app/projects/chat/llm/deletions/?before=2026-11-10T09%3A00%3A00Z&before_id=9', method: 'GET', body: undefined, csrf: undefined },
  ]);
});

test('more than 500 examples at once is refused with the server\'s sentence (400 too_many)', async () => {
  const { llmApi } = await import('../src/api/llm.js');
  const { opts } = fakeFetch({ error: 'At most 500 examples are approved at once, and 501 were chosen. Approve them in parts.', code: 'too_many', field: 'items' }, 400);
  await assert.rejects(llmApi.decideMany('chat', 2, Array.from({ length: 501 }, (_, i) => i + 1), opts),
    e => e.status === 400 && e.serverCode === 'too_many' && e.message === 'At most 500 examples are approved at once, and 501 were chosen. Approve them in parts.');
});
