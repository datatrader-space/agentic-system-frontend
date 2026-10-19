// The language-model (LLM) forms of a project's pages (plan §2.1 of LLM_TRAINING_POC_PLAN.md): uploads, the key
// mapping, examples, preparation, review and dataset versions. Backend: training_models_data/llm/app_api.py, under
// the same /training-data/app/ prefix and rules as the vision routes.
import { apiFetch } from './client.js';

const BASE = '/training-data/app';
const enc = encodeURIComponent;
const llm = ref => `${BASE}/projects/${enc(ref)}/llm`;
const post = (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body });

export function query(params) {
  const parts = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${enc(k)}=${enc(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const llmApi = {
  sending: ref => apiFetch(`${llm(ref)}/sending/`),
  mapping: ref => apiFetch(`${llm(ref)}/mapping/`),
  saveMapping: (ref, body) => post(`${llm(ref)}/mapping/`, body),
  upload: (ref, files, columns) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (columns) form.append('columns', JSON.stringify(columns));
    return post(`${llm(ref)}/upload/`, form, { timeoutMs: 300000 });
  },
  examples: (ref, filters = {}) => apiFetch(`${llm(ref)}/examples/${query(filters)}`),
  example: (ref, id) => apiFetch(`${llm(ref)}/examples/${id}/`),
  deleteExample: (ref, id, reason) => post(`${llm(ref)}/examples/${id}/delete/`, { reason }),
  preparation: ref => apiFetch(`${llm(ref)}/preparation/`),
  saveSettings: (ref, body) => post(`${llm(ref)}/preparation/`, body),
  runPreparation: ref => post(`${llm(ref)}/preparation/runs/`, {}, { timeoutMs: 600000 }),
  run: (ref, number, filters = {}) => apiFetch(`${llm(ref)}/preparation/runs/${number}/${query(filters)}`),
  reviews: ref => apiFetch(`${llm(ref)}/reviews/`),
  review: (ref, number) => apiFetch(`${llm(ref)}/reviews/${number}/`),
  createReview: (ref, body) => post(`${llm(ref)}/reviews/`, body),
  decide: (ref, number, item, body) => post(`${llm(ref)}/reviews/${number}/items/${item}/`, body),
  comment: (ref, number, body) => post(`${llm(ref)}/reviews/${number}/comments/`, body),
  move: (ref, number, move, body = {}) => post(`${llm(ref)}/reviews/${number}/${move}/`, body),
  datasets: ref => apiFetch(`${llm(ref)}/datasets/`),
  publish: (ref, body) => post(`${llm(ref)}/datasets/`, body),
};

// The pages an LLM project shows its own form of, and the pages it does not show (plan §2.1).
export const LLM_PAGES = ['dataset', 'annotate', 'versions'];
export const NOT_FOR_LLM = ['classes', 'nas', 'active'];
// Pages whose LLM form is built in a later phase of the plan (Train, Models, Test, Evaluation, Deploy).
export const LATER_FOR_LLM = { train: 3, models: 3, test: 5, analytics: 4, deploy: 5 };

export const KIND_LABEL = { chat: 'Conversation', instruction: 'Question and answer', preference: 'Preference', document: 'Document' };
export const SOURCE_LABEL = { record: 'Sent by an app', upload: 'Uploaded', run_trace: 'An agent run', human: 'Written by a person', synthetic: 'Written by a model' };
export const STATE_LABEL = { new: 'New', flagged: 'Flagged', approved: 'Approved', rejected: 'Rejected' };
export const SPLIT_LABEL = { train: 'Training', val: 'Validation', test: 'Test' };
export const ACTION_LABEL = { kept: 'Kept', redacted: 'Redacted', flagged: 'Flagged for review', left_out: 'Left out' };

// What a finding's code means, in words a person reads.
export const FINDING = {
  empty_document: 'The document holds no text',
  prompt_not_user: 'The prompt does not end with the user',
  empty_answer: 'An answer is empty',
  same_answers: 'The better and the worse answer are the same',
  no_user_turn: 'No user message',
  empty_turn: 'An empty message',
  last_turn_not_an_answer: 'The last message is not the assistant’s answer',
  tool_without_call: 'A tool result without the call before it',
  tool_call_invalid: 'A tool call that is not valid JSON',
  tool_unknown: 'A call to a tool that is not listed',
  tool_schema_invalid: 'A tool’s schema is not valid',
  tool_arguments_invalid: 'Tool arguments do not match the tool’s schema',
  translation_languages_missing: 'A translation without both languages',
  template_refused: 'The base model’s chat template refused it',
  secret: 'A key, token or password',
  personal_data: 'Personal data',
  exact_duplicate: 'An exact copy of an earlier example',
  near_duplicate: 'Nearly the same as an earlier example',
  short_answer: 'A very short answer',
  repetitive: 'The answer repeats itself',
  boilerplate: 'Filler or placeholder text',
  language_mismatch: 'The answer is in another language than the question',
  too_long: 'Longer than the longest example allowed',
  cut_into_pieces: 'Cut into pieces that fit the model',
  split_corrected: 'Its side was put right',
  shares_words_with_test: 'Shares 13 words in a row with a test example',
};
export const findingText = code => FINDING[code] || code;

// The turns an example shows, in order: the system message, the conversation, then a preference's answers or a
// document's text. Each is {role, label, text}.
export function turnsOf(content) {
  if (!content) return [];
  const out = [];
  if (content.kind === 'document') return [{ role: 'document', label: content.title || 'Document', text: content.text || '' }];
  if (content.system) out.push({ role: 'system', label: 'System', text: content.system });
  for (const m of content.messages || []) {
    const calls = (m.tool_calls || []).map(c => `${c?.function?.name || 'tool'}(${typeof c?.function?.arguments === 'string' ? c.function.arguments : JSON.stringify(c?.function?.arguments ?? {})})`);
    out.push({ role: m.role, label: { user: 'User', assistant: 'Assistant', tool: 'Tool result' }[m.role] || m.role, text: [m.content || '', ...calls].filter(Boolean).join('\n') });
  }
  if (content.chosen) out.push({ role: 'chosen', label: 'Better answer', text: content.chosen.content || '' });
  if (content.rejected) out.push({ role: 'rejected', label: 'Worse answer', text: content.rejected.content || '' });
  if (content.answer) out.push({ role: content.label === 'good' ? 'chosen' : 'rejected', label: content.label === 'good' ? 'Good answer' : 'Bad answer', text: content.answer.content || '' });
  return out;
}

// The parts of an example a reviewer may fix: the last assistant answer of a conversation, a preference's answers,
// a document's text. {field: text}.
export function fixableOf(content) {
  if (!content) return {};
  if (content.kind === 'document') return { text: content.text || '' };
  if (content.kind === 'preference') {
    const out = {};
    for (const k of ['chosen', 'rejected', 'answer']) if (content[k]) out[k] = content[k].content || '';
    return out;
  }
  const messages = content.messages || [];
  const last = [...messages.keys()].reverse().find(i => messages[i].role === 'assistant');
  return last === undefined ? {} : { answer: messages[last].content || '' };
}

// The example with the reviewer's fixes put in (fixableOf's fields), as the backend takes a fix.
export function withFixes(content, fixes) {
  const out = JSON.parse(JSON.stringify(content));
  if (out.kind === 'document') { if ('text' in fixes) out.text = fixes.text; return out; }
  if (out.kind === 'preference') {
    for (const k of ['chosen', 'rejected', 'answer']) if (out[k] && k in fixes) out[k] = { ...out[k], content: fixes[k] };
    return out;
  }
  const messages = out.messages || [];
  const last = [...messages.keys()].reverse().find(i => messages[i].role === 'assistant');
  if (last !== undefined && 'answer' in fixes) messages[last] = { ...messages[last], content: fixes.answer };
  return out;
}

// Which board column a review batch stands in (plan §2.1: Unassigned → Reviewing → In review → Dataset).
export const REVIEW_COLUMNS = ['Unassigned', 'Reviewing', 'In review', 'Dataset'];
export function reviewColumn(batch) {
  return { sent: 'Reviewing', returned: 'In review', accepted: 'Dataset' }[batch?.state] || 'Unassigned';
}

// The header of a CSV file, as its columns are named (quoted names allowed), for the column choice of an upload.
export function csvHeader(text) {
  const line = String(text || '').replace(/^﻿/, '').split(/\r?\n/, 1)[0] || '';
  const out = []; let cell = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cell.trim()); cell = ''; }
    else cell += ch;
  }
  out.push(cell.trim());
  return out.filter(Boolean);
}

// The columns an upload sends for CSV files: conversation columns, or translation columns; null when none apply.
export function csvColumns(mode, chosen) {
  if (mode === 'translation') {
    const { translate_from, translate_to, from_language, to_language } = chosen;
    return { translate_from, translate_to, from_language, to_language };
  }
  const out = { user: chosen.user, assistant: chosen.assistant };
  if (chosen.system) out.system = chosen.system;
  if (chosen.group) out.group = chosen.group;
  return out;
}

// A key path such as ["payload", "question"] as people read it: question.
export const pathName = path => (path || []).slice(1).join('.') || '';
