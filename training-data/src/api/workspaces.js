// The workspaces this person can open, and creating one (backend: training_models_data/app_api.py — workspaces/).
// The choice is the AADML dashboard's own (localStorage activeWorkspaceId / activeWorkspace / activeOrg, as
// src/composables/useWorkspace.js keeps it), so both apps work in the same workspace.
import { apiFetch } from './client.js';

export const workspaces = {
  list: () => apiFetch('/training-data/app/workspaces/'),
  create: body => apiFetch('/training-data/app/workspaces/', { method: 'POST', body }),
};

// Write the selection as the AADML dashboard does; `reload` opens the page again in it (on the project list).
export function selectWorkspace(workspace, store = globalThis.localStorage) {
  const org = workspace.organization || {};
  store.setItem('activeWorkspace', JSON.stringify({ id: workspace.id, name: workspace.name, slug: workspace.slug || '' }));
  store.setItem('activeOrg', JSON.stringify({ slug: org.slug || '', name: org.name || '' }));
  store.setItem('activeWorkspaceId', String(workspace.id));
}
export function chooseWorkspace(workspace) {
  selectWorkspace(workspace);
  globalThis.location.hash = '#projects';
  globalThis.location.reload();
}
