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
  const fresh = { id: localId('a'), role: 'assistant', text: '', steps: [], cards: [], streaming: true };
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
  TRAINING_LABEL: 'Drawing first labels', TRAINING_LABEL_SOURCES: 'Listing the models that can label',
  TRAINING_LABEL_VIEW: 'Looking at a drawing', TRAINING_LABEL_FIX: 'Fixing a drawing',
  TRAINING_LABEL_SUBMIT: 'Sending the labels to review', TRAINING_LABEL_REVIEW: 'Reading the labels waiting for review',
  TRAINING_CHAT_STATUS: 'Reading a chat project', TRAINING_CHAT_PREPARE: 'Preparing the chat examples',
  TRAINING_CHAT_DATASET_PUBLISH: 'Freezing a chat dataset version', TRAINING_CHAT_RUN_START: 'Starting a chat model training run',
  TRAINING_CHAT_RUN_CONTROL: 'Changing a chat model run', TRAINING_CHAT_EVALUATION_START: 'Starting a chat model evaluation',
  TRAINING_CHAT_MODEL_APPROVE: 'Approving a chat model', TRAINING_CHAT_DEPLOY: 'Deploying a chat model',
  // Every other Training tool, named in words (live test 2026-11-09: "Using training data use", "Using training
  // library"). A tool added later and not named here still reads "Using <its name>".
  TRAINING_DATA_USE: 'Reading what the project data may be used for', TRAINING_LIBRARY: 'Looking in your Training library',
  TRAINING_PHOTOS_ADD: 'Adding photos to a project', TRAINING_AUDIT: 'Reading the activity log',
  TRAINING_BATCH_LIST: 'Listing the batch processing jobs', TRAINING_BATCH_START: 'Running a model over the photos',
  TRAINING_BATCH_CANCEL: 'Cancelling a batch processing job', TRAINING_LABEL_ACCEPT: 'Accepting labels',
  TRAINING_LABEL_SEND_BACK: 'Sending labels back', TRAINING_CONNECTED_APPS: 'Reading the connected apps',
  TRAINING_COSTS: 'Reading the costs', TRAINING_COST_BENCHMARK: 'Estimating what calls would cost',
  TRAINING_DEDICATED_LIST: 'Listing the dedicated deployments', TRAINING_DEDICATED_START: 'Starting a dedicated deployment',
  TRAINING_DEDICATED_STOP: 'Stopping a dedicated deployment', TRAINING_DEPLOYMENTS: 'Reading the deployments',
  TRAINING_EDGE_SERVE: 'Running a model on your machine', TRAINING_MACHINES_LIST: 'Listing your machines',
  TRAINING_MACHINE_JOB_STOP: 'Stopping a job on your machine', TRAINING_MEMBERS: 'Reading the workspace members',
  TRAINING_MODELS_CATALOG: 'Reading the model catalogue', TRAINING_NOTIFICATIONS: 'Reading your notifications',
  TRAINING_OPEN_MODELS: 'Listing your open models', TRAINING_OPEN_MODEL_SEARCH: 'Searching Hugging Face',
  TRAINING_OPEN_MODEL_ADD: 'Adding an open model', TRAINING_OPEN_MODEL_REMOVE: 'Removing an open model',
  TRAINING_PROJECT_CREATE: 'Creating a project', TRAINING_PROJECT_DUPLICATE: 'Copying a project',
  TRAINING_PROJECT_RENAME: 'Renaming a project', TRAINING_PROJECT_TRASH: 'Moving a project to the trash',
  TRAINING_TRASH: 'Reading the trash', TRAINING_TRASH_RESTORE: 'Restoring from the trash',
  TRAINING_STREAM_LIST: 'Listing the video streams', TRAINING_STREAM_START: 'Running a model on a video',
  TRAINING_STREAM_STOP: 'Stopping a video stream', TRAINING_TRY: 'Trying a model on a photo',
  TRAINING_VISION_EVENTS: 'Reading the vision events',
};
// Tool names reach the page in more than one spelling (ToolSearch, toolsearch, ASK_USER): compared without case or _.
const squash = name => String(name || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const LABELS = Object.fromEntries(Object.entries({ ...STEP_LABELS, ASK_USER: 'Asking you', ANALYZE_MEDIA: 'Reading the photo',
  // As the main chat names them (agent/services/streaming/labels.py); live test 2026-11-09 showed "Using use skill".
  USE_SKILL: 'Loading a skill', LIST_SKILLS: 'Looking at its skills', LOAD_TOOL_RESULT_REF: 'Reading an earlier result',
  MEMORY_READ: 'Reading its notes', MEMORY_WRITE: 'Saving a note', MEMORY_EDIT: 'Changing a note',
  SEARCH_CONVERSATIONS: 'Searching your earlier chats' }).map(([k, v]) => [squash(k), v]));
export const stepLabel = tool => LABELS[squash(tool)] || (tool ? `Using ${String(tool).toLowerCase().replace(/_/g, ' ')}` : 'Working');

// A "labels" card as the page shows it: the labels drawn over their photos (each picture from the project's signed-in
// preview address) and the assignment to open on the Annotate page. Anything else (another kind of action) is null.
export function labelsCard(action) {
  if (!action || action.kind !== 'training_labels' || !action.project) return null;
  const project = String(action.project);
  const enc = encodeURIComponent;
  return {
    key: String(action.target_id || ''), project, assignment: action.assignment ?? null, stage: String(action.stage || ''),
    title: String(action.title || 'Labels'),
    labels: (action.labels || []).filter(l => l && l.label).map(l => ({
      id: String(l.label), file: String(l.file || ''), faults: (l.faults || []).map(String),
      image: `/api/training-data/app/projects/${enc(project)}/labels/${enc(String(l.label))}/preview/` })),
    review: `#project/${enc(project)}/annotate${action.assignment ? `/${action.assignment}` : ''}`,
  };
}

// The person's own message, shown at once (before the server has it).
// images: the photos sent with it, each { url, name } (a local preview while it is sent, the stored copy after).
export function addUserMessage(state, text, images = []) {
  state.messages.push({ id: localId('u'), role: 'user', text, images, steps: [], streaming: false });
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
    case 'chat_action': {
      // A card the assistant's tool made for the person: the labels it drew (training_models_data agent_labelling.card).
      const card = labelsCard(evt.action);
      if (!card) break;
      const message = lastAssistant(state);
      message.cards = [...(message.cards || []).filter(c => c.key !== card.key), card];
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
    .map(r => ({ id: `h-${r.id}`, role: r.role, text: String(r.content), steps: [], streaming: false,
                 images: (r.attachments || []).filter(a => a && a.isImage && a.url).map(a => ({ url: a.url, name: a.name || '' })),
                 // The cards kept with the answer (the server saves the turn's chat actions in model_info).
                 cards: ((r.model_info || {}).chat_actions || []).map(labelsCard).filter(Boolean) }));
}

const listOf = body => (Array.isArray(body) ? body : body?.results || []);

// A new conversation is named after the person's first message, as AADML's chat lets a person rename one: the first
// line, cut at a word near 60 characters.
export function titleFrom(text) {
  const line = String(text || '').trim().split(/\r?\n/)[0].replace(/\s+/g, ' ');
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

export const assistantChat = {
  start: agentId => apiFetch(`/agents/${encodeURIComponent(agentId)}/chat/`, { method: 'POST', body: {} }),
  conversations: agentId => apiFetch(`/conversations/?agent_profile_id=${encodeURIComponent(agentId)}`).then(listOf),
  messages: id => apiFetch(`/conversations/${encodeURIComponent(id)}/messages/`).then(listOf),
  rename: (id, title) => apiFetch(`/conversations/${encodeURIComponent(id)}/`, { method: 'PATCH', body: { title } }),
  // A photo for the next message, stored in the person's own conversation as AADML's chat stores one; the message
  // then names it by its attachment id, so the server binds exactly these photos to it.
  upload(id, file) {
    const form = new FormData();
    form.append('file', file);
    return apiFetch(`/conversations/${encodeURIComponent(id)}/files/`, { method: 'POST', body: form, timeoutMs: 120000 })
      .then(body => {
        if (!body?.attachment_id) throw new Error(`${file.name} could not be attached. Try again.`);
        return body.attachment_id;
      });
  },
  // The socket: AADML's ChatConnection, signed in by the session cookie; the server acts with the person's own role.
  connect(conversationId, handlers) {
    const connection = new ChatConnection(conversationId, handlers);
    connection.connect();
    return connection;
  },
};
