// A project's Deploy page, its Developer Quick Start (DeployPage.vue, api/deploy.js DEPLOY_OPTIONS). Owner, 2026-11-18:
// "User should be able to deploy the trained or open model on his machine as well. Why still showing Coming soon? Make
// them functional and available." Dedicated Deployment and Batch Processing are the workspace Deployments page's own tabs
// (DedicatedDeployments.vue, BatchTab.vue) shown for this project; Cloud Streaming is linked there; MCP says what exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPLOY_OPTIONS } from '../src/api/deploy.js';
import { dedicatedOfProject, projectStartProblem, PROJECT_NOT_STARTABLE } from '../src/api/workspace.js';
import { batchesOfProject, batchProjectProblem, BATCH_PROJECT_NOT_LISTED } from '../src/api/batch.js';

const read = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
const page = read('DeployPage.vue');
const dedicatedTab = read('DedicatedDeployments.vue');
const workspacePage = read('WorkspaceDeployments.vue');
const batchTab = read('BatchTab.vue');

test('every deploy option works here, is linked where it works, or says what exists: none is "Coming soon"', () => {
  assert.deepEqual(DEPLOY_OPTIONS.map(o => o.id), ['cloud', 'streaming', 'mcp', 'batch', 'dedicated']);
  for (const option of DEPLOY_OPTIONS) {
    assert.equal(option.soon, undefined, option.id);
    assert.equal([option.here === true, !!option.elsewhere, Array.isArray(option.note)].filter(Boolean).length, 1, option.id);
  }
  assert.deepEqual(DEPLOY_OPTIONS.filter(o => o.here).map(o => o.id), ['cloud', 'batch', 'dedicated']);
  assert.equal(DEPLOY_OPTIONS.find(o => o.id === 'streaming').tab, 'streaming');
  assert.ok(!/coming soon/i.test(page.replace(/^\/\/.*$/gm, '')), 'the page shows no "Coming soon"');
  assert.ok(!page.includes('It is not available in AADML yet'));
});

test('MCP says plainly that the agent can use the model and that the MCP connection cannot ask it, and offers both ways', () => {
  const mcp = DEPLOY_OPTIONS.find(o => o.id === 'mcp');
  const text = mcp.note.join(' ');
  assert.match(text, /AADML agent/);
  assert.match(text, /none of them sends a photo to the model/);
  assert.match(text, /Cloud API/);
  assert.match(page, /<p v-for="line in chosenOption\.note" :key="line">\{\{ line \}\}<\/p>/);
  assert.match(page, /:href="chatUrl" target="_blank" rel="noopener"><MessageSquare :size="15"\/> Open the AADML agent<\/a>/);
});

test('Batch Processing and Dedicated Deployment are the workspace tabs, shown for this project', () => {
  assert.match(page, /import BatchTab from '\.\/BatchTab\.vue';/);
  assert.match(page, /import DedicatedDeployments from '\.\/DedicatedDeployments\.vue';/);
  assert.match(page, /<BatchTab :project-ref="projectRef"\/>/);
  assert.match(page, /<DedicatedDeployments :project-ref="projectRef" @navigate=/);
  // The workspace page shows the same tab: one start form, one stop, one Use, in one place.
  assert.match(workspacePage, /<DedicatedDeployments id="deployment-panel-dedicated" v-else-if="tab==='dedicated'"/);
  assert.ok(!workspacePage.includes('startDedicated') && !workspacePage.includes('stopDedicated'));
  assert.ok(dedicatedTab.includes('workspaceApi.startDedicated(') && dedicatedTab.includes('workspaceApi.stopDedicated('));
});

test('a dedicated deployment can go on one of the workspace\'s own machines or on a GPU AADML rents', () => {
  // The picker lists the rented machines and the workspace's own (machine:<id>, with why one cannot hold the model).
  assert.match(dedicatedTab, /<MachinePicker ref="dedPicker" v-model="form\.instance_type" :load="loadDedMachines"/);
  assert.match(dedicatedTab, /\}\)\)\.concat\(ownMachines\.value\);/);
  assert.match(dedicatedTab, /form\.value\.source === 'open_model' \? chosenOpen\.value\?\.own_machines : chosenProject\.value\?\.own_machines/);
  // An open model of the workspace is offered only with the Train right in the workspace (the backend's may).
  assert.match(dedicatedTab, /const mayOpen = computed\(\(\) => dedMay\.value\.start_open_model === true\);/);
  // Its state, how to call it, and Stop, confirmed first.
  assert.match(dedicatedTab, /v-if="d\.state==='live'" class="small" :aria-label="`Use \$\{d\.name\}`"/);
  assert.match(dedicatedTab, /v-if="d\.state==='live' \|\| d\.state==='starting'" class="small" :aria-label="`Stop \$\{d\.name\}`" @click="askStop\(d\)"/);
});

test("a project's page lists its own deployments and the workspace's open models', never another project's", () => {
  const rows = [
    { id: 1, source: 'model', project: { ref: 'walls' } },
    { id: 2, source: 'model', project: { ref: '~9' } },
    { id: 3, source: 'open_model', project: null, open_model: { id: 4 } },
  ];
  assert.deepEqual(dedicatedOfProject(rows, 'walls').map(r => r.id), [1, 3]);
  assert.deepEqual(dedicatedOfProject(rows, '~9').map(r => r.id), [2, 3]);
  assert.deepEqual(dedicatedOfProject(rows, '').map(r => r.id), [1, 2, 3]);       // the workspace page: all of them
  assert.deepEqual(dedicatedOfProject(null, 'walls'), []);
});

test("a project not offered for a start (no Train right, another workspace) is refused in words, before the backend's own check", () => {
  const options = { projects: [{ ref: 'walls', name: 'Walls' }] };
  assert.equal(projectStartProblem(options, 'walls'), '');
  assert.equal(projectStartProblem(options, '~9'), PROJECT_NOT_STARTABLE);
  assert.equal(projectStartProblem({}, 'walls'), PROJECT_NOT_STARTABLE);
  assert.equal(projectStartProblem(options, ''), '');                           // the workspace page chooses a project
  assert.match(PROJECT_NOT_STARTABLE, /Train right/);
  // The start form on a project's page shows the project as fixed text, never a choice of other projects.
  assert.match(dedicatedTab, /<div v-if="projectRef" class="ded-field">/);
  assert.match(dedicatedTab, /if \(projectProblem\.value\) return projectProblem\.value;/);
});

test("a project's batches only, and a start for that project only", () => {
  const rows = [{ id: 1, project: { ref: 'walls' } }, { id: 2, project: { ref: '~9' } }];
  assert.deepEqual(batchesOfProject(rows, 'walls').map(r => r.id), [1]);
  assert.deepEqual(batchesOfProject(rows, '').map(r => r.id), [1, 2]);
  assert.equal(batchProjectProblem({ projects: [{ ref: 'walls' }] }, 'walls'), '');
  assert.equal(batchProjectProblem({ projects: [{ ref: 'walls' }] }, '~9'), BATCH_PROJECT_NOT_LISTED);
  assert.equal(batchProjectProblem(undefined, ''), '');
  assert.match(batchTab, /const props = defineProps\(\{ projectRef: \{ type: String, default: '' \} \}\);/);
  assert.match(batchTab, /const why = computed\(\(\) => projectProblem\.value \|\| startProblem\(/);
  assert.match(batchTab, /<div v-if="projectRef" class="bt-field">/);
});

test('Dependent Workflows says what starts a workflow today, without a Coming soon badge or a claim it did not check', () => {
  assert.ok(!page.includes('No workflows depend on this project yet'));
  assert.match(page, /trigger is "Camera event"/);
  assert.match(page, /no workflow starts on an answer of the Cloud API/);
});
