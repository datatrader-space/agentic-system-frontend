// "Workflows apps can call" (api/workflowApps.js; VISION_WORKFLOWS_PLAN.md 5.3, ADM-1351 phase 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pageOf, workflowLabel, appLabel, emptyReason, giveProblem, inferPathOf, curlExample, grantedText, KEY_PLACEHOLDER,
  NO_APPS, NO_FRAME_WORKFLOWS,
} from '../src/api/workflowApps.js';

const body = {
  apps: [{ id: 3, name: 'Yard server', disabled: false }, { id: 4, name: 'Old kiosk', disabled: true }],
  workflows: [{ id: 12, name: 'Desk check', published_version: 3, path: '/api/training-data/v1/workflows/12/infer' },
    { id: 14, name: 'Door count', published_version: null }],
  grants: [{ id: 70, app: { id: 3, name: 'Yard server' }, workflow: { id: 12, name: 'Desk check' }, by: 'Sajid', created_at: '2026-11-23T10:00:00Z', may: { revoke: true } }],
  infer: { path: '/api/training-data/v1/workflows/{id}/infer', note: 'Send one image.' },
};

test('the page is read defensively: a missing list is empty', () => {
  assert.deepEqual(pageOf(null), { apps: [], workflows: [], grants: [], infer: { path: '', note: '' } });
  const page = pageOf({ ...body, grants: [null, ...body.grants] });
  assert.equal(page.grants.length, 1);
  assert.equal(page.infer.note, 'Send one image.');
});

test('apps and workflows are labelled as the form lists them', () => {
  assert.equal(workflowLabel(body.workflows[0]), 'Desk check, version 3');
  assert.equal(workflowLabel(body.workflows[1]), 'Door count, not published yet');
  assert.equal(appLabel(body.apps[1]), 'Old kiosk (turned off)');
  assert.equal(appLabel(body.apps[0]), 'Yard server');
});

test('an empty page says why: no app first, then no frame workflow', () => {
  assert.deepEqual(emptyReason(pageOf({ ...body, apps: [] })), { kind: 'apps', text: NO_APPS });
  assert.deepEqual(emptyReason(pageOf({ ...body, workflows: [] })), { kind: 'workflows', text: NO_FRAME_WORKFLOWS });
  assert.equal(emptyReason(pageOf(body)), null);
  assert.match(NO_APPS, /Deployments page/);
  assert.match(NO_FRAME_WORKFLOWS, /"Each camera frame"/);
});

test('why Give access is off, in the order a person fixes it', () => {
  const page = pageOf(body);
  assert.equal(giveProblem(page, { app: '', workflow: '12' }), 'Choose the app.');
  assert.equal(giveProblem(page, { app: '99', workflow: '12' }), 'Choose the app.');
  assert.equal(giveProblem(page, { app: '3', workflow: '' }), 'Choose the workflow.');
  assert.equal(giveProblem(page, { app: '3', workflow: '12' }), 'Yard server may already call Desk check.');
  assert.equal(giveProblem(page, { app: '3', workflow: '14' }), '');
  assert.equal(giveProblem(page, { app: 4, workflow: 12 }), '');
  assert.equal(giveProblem(pageOf({ ...body, apps: [] }), { app: '3', workflow: '12' }), NO_APPS);
});

test('the address of a workflow is its own path, else the pattern with its id', () => {
  const page = pageOf(body);
  assert.equal(inferPathOf(page, 12), '/api/training-data/v1/workflows/12/infer');
  assert.equal(inferPathOf(page, '14'), '/api/training-data/v1/workflows/14/infer');
  assert.equal(inferPathOf(page, ''), '/api/training-data/v1/workflows/{id}/infer');
});

test('the curl example never carries a real key', () => {
  assert.equal(KEY_PLACEHOLDER, 'aadml_app_…');
  assert.equal(curlExample('https://aadml.com/', '/api/training-data/v1/workflows/12/infer'),
    'curl -X POST https://aadml.com/api/training-data/v1/workflows/12/infer -H "Authorization: Bearer aadml_app_…" -F file=@photo.jpg');
});

test('a grant says by whom and when', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  assert.equal(grantedText(body.grants[0], now), 'by Sajid, 2 hours ago');
  assert.equal(grantedText({ created_at: '2026-11-23T11:59:30Z' }, now), 'just now');
  assert.equal(grantedText({}, now), '');
});
