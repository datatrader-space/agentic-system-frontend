import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workspaceApi, DEDICATED_NAME_RULE, dedicatedNameProblem, usdText, machineCost, dedicatedCostSummary, dedicatedModels,
  missingApproval, dedicatedState, anyStarting, DEDICATED_HOST, DEDICATED_LANGUAGES, DEDICATED_INSTALL, dedicatedSnippet,
} from '../src/api/workspace.js';

test('a name is 5 to 30 lowercase letters, digits and hyphens, starting with a letter', () => {
  for (const good of ['walls', 'room-walls-2', 'a1234', `a${'b'.repeat(29)}`]) assert.equal(dedicatedNameProblem(good), '', good);
  assert.equal(dedicatedNameProblem(''), 'Enter a name.');
  assert.equal(dedicatedNameProblem('   '), 'Enter a name.');
  assert.equal(dedicatedNameProblem(undefined), 'Enter a name.');
  for (const bad of ['wall', `a${'b'.repeat(30)}`, '1walls', '-walls', 'Walls', 'room_walls', 'room walls', 'rööm-walls']) {
    assert.equal(dedicatedNameProblem(bad), `Use ${DEDICATED_NAME_RULE}`, bad);
  }
});

test('prices read in dollars: an hour to three decimals at most, a month in whole dollars', () => {
  assert.equal(usdText(0.119), '$0.119');
  assert.equal(usdText(0.24), '$0.24');
  assert.equal(usdText(0.1), '$0.10');
  assert.equal(usdText(1.5), '$1.50');
  assert.equal(usdText(85.68, true), '$86');
  assert.equal(usdText(1234.4), '$1,234');
  assert.equal(usdText(null), '');
  assert.equal(usdText(''), '');
  const machine = { instance_type: 'ml.c5.large', usd_per_hour: 0.119, usd_per_month: 85.68, cpus: 2 };
  assert.equal(machineCost(machine), '$0.119 an hour, about $86 a month');
  assert.equal(machineCost(null), '');
  // What the person is charged (the hosting price x the markup) is what is shown, when the backend gives it.
  const charged = { ...machine, charged_usd_per_hour: '0.1428', charged_usd_per_month: '102.82' };
  assert.equal(machineCost(charged), '$0.143 an hour, about $103 a month');
});

test('the cost line says when each type stops and that it is billed from the balance', () => {
  const machine = { instance_type: 'ml.c5.xlarge', usd_per_hour: '0.204000', usd_per_month: '146.88',
                    charged_usd_per_hour: '0.2448', charged_usd_per_month: '176.26', cpus: 4 };
  assert.equal(dedicatedCostSummary(machine, 'development', 60), 'ml.c5.xlarge costs $0.245 an hour while it is on, billed by the second from your balance. It stops itself after 60 minutes without a call.');
  assert.equal(dedicatedCostSummary(machine, 'production'), 'ml.c5.xlarge costs $0.245 an hour, about $176 a month, billed by the second from your balance until you stop it.');
  assert.equal(dedicatedCostSummary(null, 'production'), '');
});

test('only a model with the approval the type needs can be chosen, and a missing one is named', () => {
  const project = { ref: '~5', name: 'Walls', models: [
    { number: 1, name: 'walls', version: 'v1', approved: { development: true, production: false } },
    { number: 2, name: 'walls', version: 'v2', approved: { development: true, production: true } },
    { number: 3, name: 'walls', version: 'v3' },
  ] };
  assert.deepEqual(dedicatedModels(project, 'development').map(m => m.number), [1, 2]);
  assert.deepEqual(dedicatedModels(project, 'production').map(m => m.number), [2]);
  assert.deepEqual(dedicatedModels(null, 'production'), []);
  const none = { ref: '~6', name: 'Doors', models: [{ number: 1, approved: { development: false, production: false } }] };
  assert.match(missingApproval(none, 'development'), /approved for staging, which a Development deployment needs/);
  assert.match(missingApproval(none, 'production'), /approved for production, which a Production deployment needs/);
  assert.equal(missingApproval({ name: 'Empty', models: [] }, 'development'), 'Empty has no trained model yet.');
  assert.equal(missingApproval(null, 'development'), 'Choose a project first.');
});

test('a state reads as the backend says it, with its tone; a starting one keeps the list reloading', () => {
  assert.deepEqual(dedicatedState({ state: 'live', state_label: 'Live' }), ['green', 'Live']);
  assert.deepEqual(dedicatedState({ state: 'starting', state_label: 'Starting' }), ['purple', 'Starting']);
  assert.deepEqual(dedicatedState({ state: 'stopped' }), ['neutral', 'Stopped']);
  assert.deepEqual(dedicatedState({ state: 'failed', state_label: 'Failed' }), ['red', 'Failed']);
  assert.equal(anyStarting([{ state: 'live' }, { state: 'starting' }]), true);
  assert.equal(anyStarting([{ state: 'live' }, { state: 'stopped' }]), false);
  assert.equal(anyStarting(undefined), false);
});

test('the call code uses the SDK in Python, by name; the address elsewhere; never a real key', () => {
  const url = `${DEDICATED_HOST}/api/training-data/v1/dedicated/room-walls/predict`;
  assert.equal(DEDICATED_HOST, 'https://aadml.com');
  assert.deepEqual(DEDICATED_LANGUAGES, ['Python SDK', 'JavaScript', 'cURL']);
  assert.equal(DEDICATED_INSTALL, 'pip install "aadml-training>=0.3"');
  const python = dedicatedSnippet('Python SDK', url, 'room-walls');
  assert.ok(python.includes('from aadml_training import Client') && python.includes('client.dedicated("room-walls", "room.jpg")'));
  assert.ok(!python.includes('requests'));
  assert.ok(python.includes('<your app key>'));
  for (const language of DEDICATED_LANGUAGES.slice(1)) {
    const code = dedicatedSnippet(language, url, 'room-walls');
    assert.ok(code.includes(url), language);
    assert.ok(code.includes('Bearer <your app key>'), language);
    // Every Bearer in the code is followed by the placeholder, never a value.
    assert.deepEqual([...code.matchAll(/Bearer (\S+)/g)].map(m => m[1]), ['<your'], language);
    assert.ok(!/(sk|ak|key)_[A-Za-z0-9]{8,}/.test(code), language);
  }
});

test('the tab asks the backend for the list, a start and a stop at their addresses', async () => {
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    asked.push([init.method || 'GET', url, init.body ? JSON.parse(init.body) : null]);
    return new Response('{"deployments":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await workspaceApi.dedicated();
    await workspaceApi.startDedicated({ name: 'room-walls', project: '~5', model: 2, instance_type: 'ml.c5.large', kind: 'development', extra: 'dropped' });
    await workspaceApi.stopDedicated(7);
  } finally { globalThis.fetch = original; }
  assert.deepEqual(asked, [
    ['GET', '/api/training-data/app/workspace/dedicated/', null],
    ['POST', '/api/training-data/app/workspace/dedicated/', { name: 'room-walls', project: '~5', model: 2, instance_type: 'ml.c5.large', kind: 'development' }],
    ['POST', '/api/training-data/app/workspace/dedicated/7/stop/', {}],
  ]);
});

// ── an open model as is (TRAINING_OPEN_MODELS_PLAN.md section 4) ──
import {
  DEDICATED_SOURCES, deployableOpenModels, dedicatedMachinesFor, machineKind, openModelTask, openModelLine, missingOpenModel,
  dedicatedSource, DEDICATED_CHAT_LANGUAGES, DEDICATED_CHAT_INSTALL, chatBaseUrl, dedicatedChatSnippet, useLanguages,
  useInstall, usesInstall, useSnippet,
} from '../src/api/workspace.js';

const OPEN = [
  { id: 4, repo: 'nvidia/segformer-b0', name: 'segformer-b0', kind: 'photo', task: 'image-segmentation', size: '3.7M', licence: 'apache-2.0', licence_name: 'Apache 2.0', deployable: true, why_not: '', machines: ['ml.c5.large', 'ml.c5.xlarge'] },
  { id: 5, repo: 'Qwen/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5-0.5B-Instruct', kind: 'chat', task: 'text-generation', size: '494M', licence: 'apache-2.0', licence_name: 'Apache 2.0', deployable: true, why_not: '', machines: ['ml.g5.xlarge'] },
  { id: 6, repo: 'someone/huge', name: 'huge', kind: 'chat', task: 'text-generation', deployable: false, why_not: 'someone/huge is too large for the machines an open model runs on.', machines: [] },
];
const OPTIONS = {
  machines: [{ instance_type: 'ml.c5.large', cpus: 2, gpu: false }, { instance_type: 'ml.c5.xlarge', cpus: 4, gpu: false }],
  open_machines: [{ instance_type: 'ml.c5.large', cpus: 2, gpu: false }, { instance_type: 'ml.c5.xlarge', cpus: 4, gpu: false },
    { instance_type: 'ml.g5.xlarge', cpus: 4, gpu: true }],
};

test('the source is a trained model or an open model, and only deployable open models are offered', () => {
  assert.deepEqual(DEDICATED_SOURCES.map(s => [s.value, s.label]), [['model', 'Your trained model'], ['open_model', 'Open model']]);
  assert.deepEqual(deployableOpenModels(OPEN).map(m => m.id), [4, 5]);
  assert.deepEqual(deployableOpenModels(undefined), []);
  assert.equal(missingOpenModel([]), 'Your workspace has no ready open model. Add one from Hugging Face on the Models page.');
  assert.equal(missingOpenModel([OPEN[2]]), OPEN[2].why_not);
  assert.equal(missingOpenModel(OPEN), '');
});

test('the machines offered are those that hold the chosen model', () => {
  assert.deepEqual(dedicatedMachinesFor(OPTIONS, 'model', null).map(m => m.instance_type), ['ml.c5.large', 'ml.c5.xlarge']);
  assert.deepEqual(dedicatedMachinesFor(OPTIONS, 'open_model', OPEN[0]).map(m => m.instance_type), ['ml.c5.large', 'ml.c5.xlarge']);
  assert.deepEqual(dedicatedMachinesFor(OPTIONS, 'open_model', OPEN[1]).map(m => m.instance_type), ['ml.g5.xlarge']);
  assert.deepEqual(dedicatedMachinesFor(OPTIONS, 'open_model', null), []);
  assert.deepEqual(dedicatedMachinesFor({}, 'open_model', OPEN[1]), []);
  assert.equal(machineKind(OPTIONS.open_machines[2]), '4 CPUs, 1 GPU');
  assert.equal(machineKind(OPTIONS.machines[0]), '2 CPUs');
  assert.equal(machineKind(null), '');
});

test('an open model and a deployment source read in plain words', () => {
  assert.equal(openModelTask(OPEN[0]), 'finds regions in a photo');
  assert.equal(openModelTask({ task: 'something-new' }), 'something-new');
  assert.equal(openModelLine(OPEN[1]), 'Qwen/Qwen2.5-0.5B-Instruct, answers chat messages, 494M, Apache 2.0');
  assert.equal(openModelLine(null), '');
  assert.deepEqual(dedicatedSource({ source: 'open_model', open_model: { repo: 'nvidia/segformer-b0', name: 'segformer-b0' } }),
    { label: 'Open model', title: 'segformer-b0', detail: 'nvidia/segformer-b0' });
  assert.deepEqual(dedicatedSource({ source: 'model', project: { name: 'Leads' }, model: { name: 'walls', version: 'v2' } }),
    { label: 'Trained model', title: 'Leads', detail: 'walls v2' });
});

test('a chat deployment is called with OpenAI\'s client at its base URL; a photo one with the SDK; never a real key', () => {
  const url = `${DEDICATED_HOST}/api/training-data/v1/dedicated/qwen-chat/v1/chat/completions`;
  assert.equal(chatBaseUrl(url), `${DEDICATED_HOST}/api/training-data/v1/dedicated/qwen-chat/v1`);
  const chat = { name: 'qwen-chat', call: 'chat', path: '/api/training-data/v1/dedicated/qwen-chat/v1/chat/completions' };
  const photo = { name: 'room-walls', call: 'photo' };
  assert.deepEqual(useLanguages(chat), DEDICATED_CHAT_LANGUAGES);
  assert.deepEqual(useLanguages(photo), DEDICATED_LANGUAGES);
  assert.equal(useInstall(chat), DEDICATED_CHAT_INSTALL);
  assert.equal(useInstall(photo), DEDICATED_INSTALL);
  assert.equal(usesInstall(chat, 'Python'), true);
  assert.equal(usesInstall(photo, 'Python SDK'), true);
  assert.equal(usesInstall(photo, 'cURL'), false);
  const python = useSnippet(chat, 'Python', url);
  assert.ok(python.includes('from openai import OpenAI'));
  assert.ok(python.includes(`base_url="${DEDICATED_HOST}/api/training-data/v1/dedicated/qwen-chat/v1"`));
  assert.ok(python.includes('model="qwen-chat"') && python.includes('api_key="<your app key>"'));
  for (const language of DEDICATED_CHAT_LANGUAGES.slice(1)) {
    const code = dedicatedChatSnippet(language, url, 'qwen-chat');
    assert.ok(code.includes(url) && code.includes('"stream"') === false, language);
    assert.deepEqual([...code.matchAll(/Bearer (\S+)/g)].map(m => m[1]), ['<your'], language);
  }
  assert.ok(useSnippet(photo, 'Python SDK', 'x').includes('client.dedicated("room-walls", "room.jpg")'));
  assert.equal(useSnippet(null, 'Python', url), '');
});

test('starting an open model sends its id and source, and nothing of a project', async () => {
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    asked.push([init.method || 'GET', url, init.body ? JSON.parse(init.body) : null]);
    return new Response('{"deployments":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await workspaceApi.startDedicated({ source: 'open_model', open_model: 5, project: '~5', model: 2, name: 'qwen-chat', instance_type: 'ml.g5.xlarge', kind: 'development' });
    await workspaceApi.startDedicated({ source: 'model', open_model: 5, project: '~5', model: 2, name: 'room-walls', instance_type: 'ml.c5.large', kind: 'development' });
  } finally { globalThis.fetch = original; }
  assert.deepEqual(asked, [
    ['POST', '/api/training-data/app/workspace/dedicated/', { source: 'open_model', open_model: 5, name: 'qwen-chat', instance_type: 'ml.g5.xlarge', kind: 'development' }],
    ['POST', '/api/training-data/app/workspace/dedicated/', { name: 'room-walls', project: '~5', model: 2, instance_type: 'ml.c5.large', kind: 'development' }],
  ]);
});
