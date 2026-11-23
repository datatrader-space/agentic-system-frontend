// "Workflows apps can call" on the Workflows page (VISION_WORKFLOWS_PLAN.md 5.3): which of the workspace's connected
// apps may call which workflow at its endpoint, with the app's own key (aadml_app_). A workflow answers an image sent
// to it only when its trigger is "Each camera frame".
// Backend: training_models_data/workflow_apps_api.py
//   GET  workspace/workflow-apps/                   {apps, workflows, grants, infer: {path, note}}
//   POST workspace/workflow-apps/                   {app, workflow} -> 201 {said, ...the same body}
//   POST workspace/workflow-apps/<grant id>/revoke/  -> {said, ...the same body}
// Every rule is the backend's: who may give access (the app's manager who may also edit the workflow), and what is of
// the selected workspace. A key is never fetched or shown here: the example always says aadml_app_….
import { apiFetch } from './client.js';
import { timeAgo } from './workspace.js';

const BASE = '/training-data/app/workspace/workflow-apps/';
const enc = encodeURIComponent;
const SLOW = 30000;

export const workflowAppsApi = {
  load: () => apiFetch(BASE, { timeoutMs: SLOW }),
  give: ({ app, workflow }) => apiFetch(BASE, { method: 'POST', body: { app: Number(app), workflow: Number(workflow) }, timeoutMs: SLOW }),
  revoke: id => apiFetch(`${BASE}${enc(id)}/revoke/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
};

// The page's lists, read defensively: a missing list is an empty one.
export function pageOf(body) {
  const list = key => (Array.isArray(body?.[key]) ? body[key].filter(Boolean) : []);
  return {
    apps: list('apps'), workflows: list('workflows'), grants: list('grants'),
    infer: { path: String(body?.infer?.path || ''), note: String(body?.infer?.note || '') },
  };
}

// A workflow as the form lists it: "Desk check, version 3", or "Desk check, not published yet".
export function workflowLabel(w) {
  const name = String(w?.name || `Workflow ${w?.id ?? ''}`).trim();
  return w?.published_version ? `${name}, version ${w.published_version}` : `${name}, not published yet`;
}
export const appLabel = a => `${String(a?.name || `App ${a?.id ?? ''}`).trim()}${a?.disabled ? ' (turned off)' : ''}`;

// Why there is nothing to give, with what to do; '' when the form can be used.
export const NO_APPS = 'There is no app here you may manage. An app is made on a project\'s Deployments page, under "Apps that may call the model"; its key starts with aadml_app_.';
export const NO_FRAME_WORKFLOWS = 'There is no workflow you may edit that answers an image. In the Workflow Builder, make one that starts with "Each camera frame", then publish it.';
export function emptyReason(page) {
  if (!page.apps.length) return { kind: 'apps', text: NO_APPS };
  if (!page.workflows.length) return { kind: 'workflows', text: NO_FRAME_WORKFLOWS };
  return null;
}

// Why "Give access" is off, in the order a person fixes it; '' when it can be sent.
export function giveProblem(page, { app, workflow } = {}) {
  const reason = emptyReason(page);
  if (reason) return reason.text;
  if (!page.apps.some(a => String(a.id) === String(app))) return 'Choose the app.';
  const chosen = page.workflows.find(w => String(w.id) === String(workflow));
  if (!chosen) return 'Choose the workflow.';
  if (page.grants.some(g => String(g.app?.id) === String(app) && String(g.workflow?.id) === String(workflow))) {
    return `${appLabel(page.apps.find(a => String(a.id) === String(app)))} may already call ${chosen.name}.`;
  }
  return '';
}

// Where a workflow is called: its own path when the server gave one, else the endpoint's pattern with its id.
export function inferPathOf(page, workflowId) {
  const w = page.workflows.find(x => String(x.id) === String(workflowId));
  if (w?.path) return w.path;
  const pattern = page.infer.path || '';
  return workflowId !== undefined && workflowId !== null && workflowId !== '' ? pattern.replace('{id}', String(workflowId)) : pattern;
}

// The example call. The key is NEVER filled in: an app's key is shown once, when it is made.
export const KEY_PLACEHOLDER = 'aadml_app_…';
export function curlExample(origin, path) {
  return `curl -X POST ${String(origin || '').replace(/\/+$/, '')}${path} -H "Authorization: Bearer ${KEY_PLACEHOLDER}" -F file=@photo.jpg`;
}

// "by Sajid, 2 hours ago" for a grant.
export function grantedText(grant, now = Date.now()) {
  const when = timeAgo(grant?.created_at, now);
  return [grant?.by ? `by ${grant.by}` : '', when].filter(Boolean).join(', ');
}
