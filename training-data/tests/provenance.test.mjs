// What a run or an evaluation used and what it cost (api/provenance.js, ADM-1210 §3.9): the groups of the
// "What this run used" block, the Cost line and the attempts table's cells, for vision and language-model jobs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shortSha, usedGroups, configPart, runtimeRows, costText, attemptCost, attemptRow, attemptWhen, providerText } from '../src/api/provenance.js';

const SHA = 'a'.repeat(52) + '0123456789ab';
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const shared = {
  code_commit: COMMIT, code_dirty: false, code_tree_sha256: SHA, image_digest: `sha256:${SHA}`, image_kind: 'runpod',
  provider: 'runpod', instance_type: 'NVIDIA L4', placement: { kind: 'gpu', gpu_name: 'L4', memory_gb: 24, data_center: 'EU-RO-1', soc2: true },
  max_runtime_seconds: 3600, own_machines: [],
};
const group = (groups, key) => groups.find(g => g.key === key);
const row = (groups, key, label) => group(groups, key)?.rows.find(r => r.label === label);

test('a sha is shown by its first 12 characters; a short or missing value as it is', () => {
  assert.equal(shortSha(SHA), 'aaaaaaaaaaaa');
  assert.equal(shortSha(COMMIT), '0123456789ab');
  assert.equal(shortSha('abc'), 'abc');
  assert.equal(shortSha(null), '');
});

test('a vision run: data, started from, code, image, machine, runtime and what it made', () => {
  const used = { ...shared, dataset_version: 'v3', dataset_manifest_sha256: SHA, config_name: 'default', config: { epochs: 20 },
    config_resolved: true, config_sha256: SHA, seed: 7, continues_run: 2, runtime: { python: '3.11.9', device: 'cuda', packages: { torch: '2.4.1' } },
    model: { artifact_sha256: SHA, onnx_sha256: SHA } };
  const groups = usedGroups(used, 'run');
  assert.deepEqual(groups.map(g => g.key), ['data', 'start', 'code', 'image', 'machine', 'runtime', 'made']);
  assert.deepEqual(row(groups, 'data', 'Dataset version'), { label: 'Dataset version', text: 'v3', sha: '' });
  assert.equal(row(groups, 'data', 'Dataset files').sha, SHA, 'the full value is kept for the title and the copy');
  assert.equal(row(groups, 'start', 'Continues run').text, 'Run 2');
  assert.equal(row(groups, 'code', 'Commit').text, '', 'a clean commit says nothing more');
  assert.equal(row(groups, 'machine', 'Provider').text, 'RunPod');
  assert.equal(row(groups, 'machine', 'GPU').text, 'L4');
  assert.equal(row(groups, 'machine', 'Memory').text, '24 GB');
  assert.equal(row(groups, 'machine', 'SOC 2 data center').text, 'Yes');
  assert.equal(row(groups, 'machine', 'Longest it may run').text, '1 h');
  assert.equal(row(groups, 'machine', 'vCPUs'), undefined, 'a value the job did not have is left out');
  assert.deepEqual(group(groups, 'runtime').rows.map(r => [r.label, r.text]),
    [['python', '3.11.9'], ['device', 'cuda'], ['packages torch', '2.4.1']]);
  assert.equal(row(groups, 'made', 'ONNX file').sha, SHA);
  assert.equal(group(groups, 'start').rows.some(r => r.label === 'Method'), false, 'no language-model field on a vision run');
  const config = configPart(used);
  assert.deepEqual({ ...config, text: undefined }, { name: 'default', source: 'Resolved by the job', sha: SHA, seed: '7', text: undefined });
  assert.equal(config.text, JSON.stringify({ epochs: 20 }, null, 2));
});

test('empty values are hidden, and a group with nothing in it is left out', () => {
  const groups = usedGroups({ dataset_version: '', dataset_manifest_sha256: '', code_commit: '', code_tree_sha256: null, image_digest: '',
    image_kind: '', provider: '', instance_type: '', placement: {}, runtime: {}, model: null, continues_run: null, seed: null,
    config: {}, config_name: '', config_sha256: '', own_machines: [] }, 'run');
  assert.deepEqual(groups, []);
  assert.equal(configPart({ config: {}, config_name: '', config_sha256: '', seed: null }), null);
  assert.deepEqual(usedGroups(null), []);
  assert.deepEqual(runtimeRows({ python: '', packages: {}, gpus: [] }), []);
  const soc2No = usedGroups({ placement: { soc2: false } }, 'evaluation');
  assert.equal(row(soc2No, 'machine', 'SOC 2 data center').text, 'No', 'false is a value, not an empty one');
});

test('a commit with local changes says so, and the values the job was started with are named so', () => {
  const groups = usedGroups({ ...shared, code_dirty: true }, 'evaluation');
  assert.deepEqual(row(groups, 'code', 'Commit'), { label: 'Commit', text: 'with local changes', sha: COMMIT });
  assert.equal(configPart({ config_name: 'small', config: { rank: 8 }, config_resolved: false }).source, 'As started');
  assert.equal(configPart({ config_name: 'small', config: null }).source, '', 'no values, no word about them');
});

test('a language-model run: the method, the base model with its revision and files, the model it continues', () => {
  const used = { ...shared, dataset_version: 'v2', dataset_manifest_sha256: SHA, method: 'dpo', base_model: 'qwen3-8b', base_model_revision: COMMIT,
    base_manifest_sha256: SHA, continues_model: 4, config_name: 'lora', config: { rank: 16 }, config_resolved: false, config_sha256: SHA,
    runtime: { transformers: '4.46.0' }, model: { artifact_sha256: SHA } };
  const groups = usedGroups(used, 'run');
  assert.equal(row(groups, 'start', 'Method').text, 'DPO');
  assert.equal(row(groups, 'start', 'Base model').text, 'qwen3-8b');
  assert.equal(row(groups, 'start', 'Base model revision').sha, COMMIT);
  assert.equal(row(groups, 'start', 'Continues model').text, '4');
  assert.equal(row(groups, 'made', 'Model file').sha, SHA);
  assert.equal(row(groups, 'made', 'ONNX file'), undefined, 'a language model has no ONNX file');
  assert.equal(group(groups, 'start').rows.some(r => r.label === 'Continues run'), false);
  assert.equal(configPart(used).seed, '', 'no seed on a language-model run');
});

test('a vision evaluation: what it compared, with every sha, and nothing of a run', () => {
  const used = { ...shared, model: { version: 'v5', onnx_sha256: SHA }, previous: { version: 'v4', onnx_sha256: SHA },
    test_version: 'test-1', test_manifest_sha256: SHA, golden_version: 'golden-1', golden_manifest_sha256: SHA,
    evaluator_version: '2026.11', report_sha256: SHA };
  const groups = usedGroups(used, 'evaluation');
  assert.deepEqual(groups.map(g => g.key), ['code', 'image', 'machine', 'compared']);
  assert.deepEqual(row(groups, 'compared', 'Model'), { label: 'Model', text: 'v5', sha: SHA });
  assert.deepEqual(row(groups, 'compared', 'Previous model'), { label: 'Previous model', text: 'v4', sha: SHA });
  assert.deepEqual(row(groups, 'compared', 'Test photos'), { label: 'Test photos', text: 'test-1', sha: SHA });
  assert.equal(row(groups, 'compared', 'Golden photos').text, 'golden-1');
  assert.equal(row(groups, 'compared', 'Evaluator version').text, '2026.11');
  assert.equal(row(groups, 'compared', 'Report').sha, SHA);
  assert.equal(configPart(used), null, 'a vision evaluation has no configuration');
  const first = usedGroups({ ...used, previous: null, golden_version: '', golden_manifest_sha256: '', report_sha256: '' }, 'evaluation');
  assert.deepEqual(group(first, 'compared').rows.map(r => r.label), ['Model', 'Test photos', 'Evaluator version']);
});

test('a language-model evaluation: the model with its file, the questions and the marking, and its configuration as started', () => {
  const used = { ...shared, model: { version: 3, artifact_sha256: SHA }, suite: 'questions v2', marking: 'both', config: { max_items: 50 } };
  const groups = usedGroups(used, 'evaluation');
  assert.deepEqual(group(groups, 'compared').rows.map(r => [r.label, r.text]), [['Model', '3'], ['Questions', 'questions v2'], ['Marked by', 'People and AI judge']]);
  assert.equal(row(groups, 'compared', 'Previous model'), undefined);
  assert.equal(configPart(used).source, 'As started');
});

test('the machine names the person\'s own machine, and a provider by its own name', () => {
  const groups = usedGroups({ provider: 'machine', own_machines: ['Office PC'], placement: {} }, 'run');
  assert.equal(row(groups, 'machine', 'Provider').text, 'Your own machine');
  assert.equal(row(groups, 'machine', 'Your machine').text, 'Office PC');
  assert.equal(providerText('local'), "AADML's own computer");
  assert.equal(providerText('something-new'), 'something-new', 'an unknown provider is shown as the backend names it');
});

test('the Cost line: no AADML machine cost when unpaid, else the total and the part still held', () => {
  assert.equal(costText({ paid: false, settled: '0.00', held: '0.00', total: '0.00' }), 'No AADML machine cost.');
  assert.equal(costText({ paid: false, settled: '0.00', held: '0.00', total: '0.00' }, ['Office PC']),
    'No AADML machine cost: it ran on your machine Office PC.');
  assert.equal(costText({ paid: true, settled: '0.84', held: '0.00', total: '0.84' }), '$0.84 charged.');
  assert.equal(costText({ paid: true, settled: '0.00', held: '0.00', total: '0.00' }), '$0.00 charged.');
  assert.equal(costText({ paid: true, settled: '0.30', held: '1.20', total: '1.50' }),
    '$1.50 at most: $0.30 charged and $1.20 held while it runs, the most the rest can cost.');
  assert.equal(costText(null), '');
});

test('an attempt\'s cells: machine time, its cost or a dash, its own machine, its job name and what happened', () => {
  assert.deepEqual(attemptCost({ cost: { settled: '0.20', held: '0.00', total: '0.20' } }), { text: '$0.20', note: '' });
  assert.deepEqual(attemptCost({ cost: { settled: '0.00', held: '0.50', total: '0.50' } }), { text: '$0.50', note: '$0.50 of it held while it runs' });
  assert.deepEqual(attemptCost({ cost: null }), { text: '—', note: '' });
  assert.deepEqual(attemptCost({ cost: null, own_machine: 'Office PC' }), { text: 'No AADML cost', note: 'Ran on Office PC' });
  const vision = attemptRow({ number: 2, state: 'failed', reason: 'no GPU in time', retry_of: 1, on_demand: true, billable_seconds: 725,
    job_name: 'aadml-run-41-2', log: '/log/2', cost: null, own_machine: '' });
  assert.equal(vision.what, 'no GPU in time');
  assert.equal(vision.stateLabel, 'Failed');
  assert.equal(vision.machineTime, '12 min 5 s');
  assert.equal(vision.job, 'aadml-run-41-2');
  assert.equal(vision.retryOf, 1);
  assert.equal(vision.onDemand, true);
  const llm = attemptRow({ number: 1, state: 'failed', failure: 'out of memory', exit_code: 137, billable_seconds: null, job_name: '' });
  assert.equal(llm.what, 'out of memory', 'a language-model row says its failure');
  assert.equal(llm.exit, 137);
  assert.equal(llm.machineTime, '—');
  assert.equal(llm.log, '');
  assert.equal(attemptRow({ number: 1, state: 'running' }).what, 'Running');
  const at = iso => iso.slice(11, 16);
  assert.equal(attemptWhen({ started_at: '2026-11-11T10:02:00Z', finished_at: '2026-11-11T10:40:00Z' }, at), 'Started 10:02, ended 10:40');
  assert.equal(attemptWhen({ started_at: '2026-11-11T10:02:00Z', finished_at: null }, at), 'Started 10:02');
  assert.equal(attemptWhen({ started_at: null }, at), '');
});

test('the four views show the block and the one attempts table; the block starts closed', async () => {
  const read = name => readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
  const block = await read('RunProvenance.vue');
  assert.ok(block.includes('<details v-if="groups.length || config" class="provenance-used">'), 'a details element without open');
  assert.ok(!/<details[^>]*\sopen\b/.test(block), 'nothing is open at first');
  assert.ok(block.includes(":title=\"r.sha\"") && block.includes('shortSha(r.sha)'), 'short sha, full value in its title');
  for (const [name, what] of [['ProjectStudio.vue', 'run'], ['LlmTrain.vue', 'run'], ['ModelEvaluations.vue', 'evaluation'], ['LlmAnalytics.vue', 'evaluation']]) {
    const page = await read(name);
    assert.ok(page.includes(`what="${what}"/>`) && page.includes('<RunProvenance :used='), `${name}: the block`);
    assert.ok(page.includes('<AttemptsTable :attempts='), `${name}: the attempts table`);
  }
  const table = await read('AttemptsTable.vue');
  for (const column of ['Machine time', 'Cost', 'Log']) assert.ok(table.includes(`data-label="${column}"`), column);
  assert.ok(table.includes(':title="a.job"'), 'the job name has its full value in a title');
});
