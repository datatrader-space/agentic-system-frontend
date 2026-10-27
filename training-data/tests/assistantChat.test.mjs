// The Agent page's chat (src/api/assistantChat.js): what the page shows, built from the frames AADML's chat sends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addUserMessage, applyEvent, emptyChat, fromHistory, stepLabel, titleFrom } from '../src/api/assistantChat.js';

const play = (state, ...frames) => frames.reduce((s, f) => applyEvent(s, f), state);

test('the answer streams in, a replacing chunk replaces it, and the last complete frame is the answer', () => {
  const state = addUserMessage(emptyChat(7), 'Which project is ready?');
  play(state, { type: 'assistant_message_chunk', chunk: 'Two ' }, { type: 'assistant_message_chunk', chunk: 'projects' });
  assert.equal(state.messages[1].text, 'Two projects');
  play(state, { type: 'assistant_message_chunk', chunk: 'Rewritten', replace: true });
  assert.equal(state.messages[1].text, 'Rewritten');
  play(state, { type: 'assistant_message_complete', full_message: 'First draft' },
       { type: 'assistant_message_complete', full_message: 'Two projects are ready.' });
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1].text, 'Two projects are ready.');
  assert.equal(state.running, true);                                   // complete is not the end of the turn
  play(state, { type: 'agent_session_complete' });
  assert.equal(state.running, false);
  assert.equal(state.messages[1].streaming, false);
});

test('each step shows while it runs and how it ended', () => {
  const state = play(emptyChat(7), { type: 'tool_call', tool: { name: 'TRAINING_STATUS' } },
                     { type: 'tool_call', tool: 'TRAINING_RUN_START' },
                     { type: 'tool_result', tool_name: 'TRAINING_STATUS', success: true },
                     { type: 'tool_result', tool_name: 'TRAINING_RUN_START', success: false, error: 'The cap is reached.' });
  const steps = state.messages[0].steps;
  assert.deepEqual(steps.map(s => [s.tool, s.state]), [['TRAINING_STATUS', 'done'], ['TRAINING_RUN_START', 'failed']]);
  assert.equal(steps[1].error, 'The cap is reached.');
  assert.equal(stepLabel('TRAINING_RUN_START'), 'Starting a training run');
  assert.equal(stepLabel('SOME_NEW_TOOL'), 'Using some new tool');
});

test('an approval waits until it is answered, and one for another conversation is not shown', () => {
  const state = play(emptyChat(7), { type: 'hitl_request', request_id: 'r1', conversation_id: 7, summary: 'Start a run' },
                     { type: 'hitl_request', request_id: 'r2', conversation_id: 99, summary: 'Another window' },
                     { type: 'hitl_request', request_id: 'r1', conversation_id: 7, summary: 'Start a run' });
  assert.deepEqual(state.approvals.map(a => a.request_id), ['r1']);
  play(state, { type: 'hitl_response_ack', request_id: 'r1' });
  assert.deepEqual(state.approvals, []);
});

test('a plan waits for a decision; an error ends the turn and is said; an unknown frame is harmless', () => {
  const state = addUserMessage(emptyChat(7), 'Go');
  play(state, { type: 'plan_approval_required', plan: { steps: [{ title: 'Freeze a version' }] } });
  assert.equal(state.plan.steps.length, 1);
  play(state, { type: 'plan_approved' });
  assert.equal(state.plan, null);
  play(state, { type: 'error', error: 'Unknown message type: agent_prewarm' });
  assert.equal(state.error, '');
  assert.equal(state.running, true);
  play(state, { type: 'error', message: 'The model provider did not answer.' });
  assert.equal(state.error, 'The model provider did not answer.');
  assert.equal(state.running, false);
});

test('a new conversation takes its id from the server, and an earlier one is shown from its stored messages', () => {
  const state = play(emptyChat(null), { type: 'conversation_created', conversation_id: 42 });
  assert.equal(state.conversationId, 42);
  const rows = [{ id: 1, role: 'user', content: 'Hello' }, { id: 2, role: 'tool', content: '{}' },
                { id: 3, role: 'assistant', content: 'Hi' }, { id: 4, role: 'assistant', content: '  ' }];
  assert.deepEqual(fromHistory(rows).map(m => [m.role, m.text]), [['user', 'Hello'], ['assistant', 'Hi']]);
});

test('a question keeps its choices and an empty answer, so the page can ask it as a question', () => {
  const state = play(emptyChat(7), { type: 'hitl_request', request_id: 'q1', conversation_id: 7, response_type: 'choice',
                                     summary: 'Which configuration?', options: [{ id: 'smoke-gpu', title: 'smoke-gpu' }] });
  assert.deepEqual([state.approvals[0].response_type, state.approvals[0].options[0].id, state.approvals[0].reply],
                   ['choice', 'smoke-gpu', '']);
});

test('a tool is named in words whatever its spelling', () => {
  assert.equal(stepLabel('toolsearch'), 'Looking up a tool');
  assert.equal(stepLabel('ToolSearch'), 'Looking up a tool');
  assert.equal(stepLabel('ask_user'), 'Asking you');
  assert.equal(stepLabel('ANALYZE_MEDIA'), 'Reading the photo');
  assert.equal(stepLabel('TRAINING_CHAT_STATUS'), 'Reading a chat project');
});

test('a new conversation is named after the first line of its first message, cut at a word', () => {
  assert.equal(titleFrom('  Which project is ready?\nMore detail here'), 'Which project is ready?');
  const long = 'Train a vision model on my photo project. Tell me which project is ready, the configuration you would use';
  const title = titleFrom(long);
  assert.ok(title.endsWith('…') && title.length <= 61, title);
  assert.equal(title, 'Train a vision model on my photo project. Tell me which…');
  assert.equal(titleFrom('x'.repeat(80)), `${'x'.repeat(60)}…`);
});

test('photos go with the message they were sent with, and come back with it from the history', () => {
  const state = addUserMessage(emptyChat(9), 'Detect walls', [{ url: 'blob:local-1', name: 'room.jpg' }]);
  assert.deepEqual(state.messages[0].images, [{ url: 'blob:local-1', name: 'room.jpg' }]);
  assert.deepEqual(addUserMessage(emptyChat(9), 'No photo').messages[0].images, []);
  const [user, answer] = fromHistory([
    { id: 1, role: 'user', content: 'Detect walls', attachments: [
      { isImage: true, url: '/media/chat/room.jpg', name: 'room.jpg' },
      { isImage: false, url: '/media/chat/notes.pdf', name: 'notes.pdf' },
      { isImage: true, url: '', name: 'lost.jpg' }] },
    { id: 2, role: 'assistant', content: 'Three walls.' }]);
  assert.deepEqual(user.images, [{ url: '/media/chat/room.jpg', name: 'room.jpg' }]);
  assert.deepEqual(answer.images, []);
});
