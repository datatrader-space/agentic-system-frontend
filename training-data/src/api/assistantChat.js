// The Training Assistant's chat on the Agent page (agentic-docs/TRAINING_DATA_AGENT_CHAT_PLAN.md): the same AADML chat
// as everywhere, spoken from this app. The socket is AADML's own ChatConnection (one copy of the protocol); this file
// keeps what the page shows, built from the frames the server sends (applyEvent, a pure function the tests drive).
import { ChatConnection } from '../../../src/services/chatService.js';
import { apiFetch } from './client.js';

// What the page shows: the conversation's messages, whether a turn is running, the approvals waiting, and an error.
// A message is {id, role: 'user' | 'assistant', text, steps: [{tool, state, error}], streaming}.
export function emptyChat(conversationId = null) {
  return { conversationId, messages: [], running: false, approvals: [], plan: null, error: '', connection: 'connecting' };
}

let nextId = 0;
const localId = prefix => `${prefix}-${Date.now()}-${(nextId += 1)}`;

function lastAssistant(state) {
  const last = state.messages[state.messages.length - 1];
  if (last && last.role === 'assistant' && last.streaming) return last;
  const fresh = { id: localId('a'), role: 'assistant', text: '', steps: [], streaming: true };
  state.messages.push(fresh);
  return fresh;
}

// Each of the assistant's tools as a person reads it (training_models_data/assistant.py TOOL_NAMES).
const STEP_LABELS = {
  ToolSearch: 'Looking up a tool',
  TRAINING_PROJECTS: 'Finding your projects', TRAINING_STATUS: 'Reading a photo project',
  TRAINING_BATCH_CREATE: 'Giving photos to a labeller', TRAINING_DATASET_PUBLISH: 'Freezing a dataset version',
  TRAINING_RUN_START: 'Starting a training run', TRAINING_RUN_CONTROL: 'Changing a run',
  TRAINING_EVALUATION_START: 'Starting an evaluation', TRAINING_MODEL_APPROVE: 'Approving a model',
  TRAINING_DEPLOY: 'Deploying a model',
  TRAINING_CHAT_STATUS: 'Reading a chat project', TRAINING_CHAT_PREPARE: 'Preparing the chat examples',
  TRAINING_CHAT_DATASET_PUBLISH: 'Freezing a chat dataset version', TRAINING_CHAT_RUN_START: 'Starting a chat model training run',
  TRAINING_CHAT_RUN_CONTROL: 'Changing a chat model run', TRAINING_CHAT_EVALUATION_START: 'Starting a chat model evaluation',
  TRAINING_CHAT_MODEL_APPROVE: 'Approving a chat model', TRAINING_CHAT_DEPLOY: 'Deploying a chat model',
};
// Tool names reach the page in more than one spelling (ToolSearch, toolsearch, ASK_USER): compared without case or _.
const squash = name => String(name || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const LABELS = Object.fromEntries(Object.entries({ ...STEP_LABELS, ASK_USER: 'Asking you' }).map(([k, v]) => [squash(k), v]));
export const stepLabel = tool => LABELS[squash(tool)] || (tool ? `Using ${String(tool).toLowerCase().replace(/_/g, ' ')}` : 'Working');

// The person's own message, shown at once (before the server has it).
export function addUserMessage(state, text) {
  state.messages.push({ id: localId('u'), role: 'user', text, steps: [], streaming: false });
  state.running = true;
  state.error = '';
  return state;
}

// One frame from the server. Returns the same state, changed. Frames for another conversation (approvals are sent to
// every window of the person) are left alone.
export function applyEvent(state, evt) {
  if (!evt || !evt.type) return state;
  const cid = evt.conversation_id ?? evt.payload?.conversation_id;
  if (cid && state.conversationId && String(cid) !== String(state.conversationId)) return state;
  switch (evt.type) {
    case 'conversation_created':
      state.conversationId = evt.conversation_id ?? state.conversationId;
      break;
    case 'assistant_message_chunk': {
      const message = lastAssistant(state);
      const chunk = String(evt.chunk ?? evt.content ?? '');
      message.text = evt.replace ? chunk : message.text + chunk;
      state.running = true;
      break;
    }
    case 'assistant_message_complete': {
      // It can come more than once in a turn; the last one is the answer (AADML's chat store does the same).
      const message = lastAssistant(state);
      if (typeof evt.full_message === 'string' && evt.full_message) message.text = evt.full_message;
      break;
    }
    case 'chat_response': case 'assistant': case 'assistant_message': {
      const message = lastAssistant(state);
      const text = evt.content ?? evt.message ?? '';
      if (typeof text === 'string' && text) message.text = text;
      break;
    }
    case 'tool_call': {
      // `tool` is the tool's name (chat_events.tool_call); a frame without one (a thinking step) shows its label, or
      // nothing: a step called only "Working" tells the person nothing.
      const tool = String((typeof evt.tool === 'object' ? evt.tool?.name : evt.tool) ?? evt.tool_name ?? '');
      state.running = true;
      if (!tool && !evt.label) break;
      lastAssistant(state).steps.push({ tool, label: tool ? '' : String(evt.label), state: 'running', error: '' });
      break;
    }
    case 'tool_result': {
      const steps = lastAssistant(state).steps;
      const step = [...steps].reverse().find(s => s.state === 'running' && (!evt.tool_name || s.tool === evt.tool_name));
      if (step) { step.state = evt.success === false ? 'failed' : 'done'; step.error = evt.success === false ? String(evt.error || '') : ''; }
      break;
    }
    case 'hitl_request':
      if (!state.approvals.some(a => a.request_id === evt.request_id)) {
        state.approvals.push({ request_id: evt.request_id, summary: evt.summary || '', payload: evt.payload || {},
                               response_type: evt.response_type || 'binary', options: evt.options || [],
                               reply: '', answering: false });
      }
      break;
    case 'hitl_response_ack': case 'hitl_resolved':
      state.approvals = state.approvals.filter(a => a.request_id !== evt.request_id);
      break;
    case 'plan_approval_required':
      state.plan = evt.plan || {};
      break;
    case 'plan_approved': case 'plan_rejected': case 'plan_revise': case 'plan_resume_refused':
      state.plan = null;
      break;
    case 'agent_session_complete': case 'agent_session_stopped': case 'stop_acknowledged': case 'run_finished':
    case 'turn_not_running':
      endTurn(state);
      break;
    case 'agent_session_error':
      endTurn(state);
      state.error = String(evt.error || evt.message || 'The assistant stopped with an error.');
      break;
    case 'error': {
      const text = String(evt.error || evt.message || '');
      if (/unknown message type/i.test(text)) break;               // a frame this server does not know: harmless
      endTurn(state);
      state.error = text || 'Something went wrong. Try again.';
      break;
    }
    case 'turn_resumed':
      state.running = true;
      break;
    default:
      break;
  }
  return state;
}

function endTurn(state) {
  state.running = false;
  for (const message of state.messages) {
    if (message.streaming) {
      message.streaming = false;
      for (const step of message.steps) if (step.state === 'running') step.state = 'done';
    }
  }
}

// The stored messages of an earlier conversation, as the page shows them.
export function fromHistory(rows) {
  return (rows || []).filter(r => r && (r.role === 'user' || r.role === 'assistant') && String(r.content || '').trim())
    .map(r => ({ id: `h-${r.id}`, role: r.role, text: String(r.content), steps: [], streaming: false }));
}

const listOf = body => (Array.isArray(body) ? body : body?.results || []);

export const assistantChat = {
  start: agentId => apiFetch(`/agents/${encodeURIComponent(agentId)}/chat/`, { method: 'POST', body: {} }),
  conversations: agentId => apiFetch(`/conversations/?agent_profile_id=${encodeURIComponent(agentId)}`).then(listOf),
  messages: id => apiFetch(`/conversations/${encodeURIComponent(id)}/messages/`).then(listOf),
  // The socket: AADML's ChatConnection, signed in by the session cookie; the server acts with the person's own role.
  connect(conversationId, handlers) {
    const connection = new ChatConnection(conversationId, handlers);
    connection.connect();
    return connection;
  },
};
