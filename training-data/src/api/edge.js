// Edge Devices: an approved model run on one of the workspace's own machines, managed from the page (backend:
// training_models_data/edge.py, machines.py and machines_api.py — workspace/edge/, workspace/machines/<id>/serve/,
// workspace/machine-jobs/<id>/stop/). Nothing is downloaded and no command is run by hand: the machine takes the model
// at its next poll. Every rule is the backend's: which model may leave AADML, for which environment, on which machine.
import { apiFetch } from './client.js';

const APP = '/training-data/app';

export const edgeApi = {
  // The models this person sees, each with the environments it may run in; the machines; the models being served.
  list: () => apiFetch(`${APP}/workspace/edge/`),
  // Run a model on a machine. Recorded as a release of the model outside AADML.
  serve: (machineId, { project, model, environment, port }) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(machineId)}/serve/`, {
    method: 'POST', body: { project, model, environment, ...(port ? { port: Number(port) } : {}) },
  }),
  stop: jobId => apiFetch(`${APP}/workspace/machine-jobs/${encodeURIComponent(jobId)}/stop/`, { method: 'POST', body: {} }),
};

// One model of the list, as the select names it.
export const choiceKey = row => (row ? `${row.project?.ref}#${row.number}` : '');
export const modelLabel = row => (row ? `${row.name} ${row.version}` : '');

// The models that may run first, then the others, each group in the backend's order.
export function sortedChoices(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return [...list.filter(row => row?.may_serve), ...list.filter(row => !row?.may_serve)];
}

// Why a model cannot be chosen, as one sentence.
export const whyNot = row => (row?.may_serve ? '' : String(row?.why_not || row?.refusals?.[0]?.message || 'This model cannot leave AADML.'));

export const ENVIRONMENT_LABELS = { staging: 'Staging', production: 'Production' };

// The machines a model of ``projectId`` can be sent to now: online, and not limited to other projects.
export function machinesFor(machines, projectId) {
  return (Array.isArray(machines) ? machines : []).filter(m => m?.state === 'online'
    && (!(m.projects || []).length || m.projects.some(p => p?.id === projectId)));
}

// What is wrong with a port, or ''.
export function portProblem(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? '' : 'Choose a port from 1024 to 65535.';
}

// The address the model answers on, for a person on the machine's own network.
export const answerAt = port => `http://<machine address>:${Number(port) || 8080}/invocations`;
