// A reasoning model's thinking is folded away in the chat (ADM-1365, the owner, 2026-11-26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitThinking } from '../src/api/assistantChat.js';

test('the thinking between think tags is set apart from the answer', () => {
  assert.deepEqual(splitThinking('<think>\nThe user greets me.\n</think>\n\nHi! How can I help?'),
    { thinking: 'The user greets me.', answer: 'Hi! How can I help?' });
  assert.deepEqual(splitThinking('Hello there'), { thinking: '', answer: 'Hello there' });
  assert.deepEqual(splitThinking('<THINK>still going'), { thinking: 'still going', answer: '' });
  assert.deepEqual(splitThinking(''), { thinking: '', answer: '' });
  assert.deepEqual(splitThinking(null), { thinking: '', answer: '' });
});
