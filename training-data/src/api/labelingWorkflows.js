import { apiFetch } from './client.js';
const base = project => `/training-data/app/projects/${encodeURIComponent(project)}/labeling-workflows/`;
export const labelingWorkflows = {
  list: project => apiFetch(base(project)),
  save: (project, name, definition, row) => apiFetch(`${base(project)}${row ? `${row.id}/` : ''}`, {
    method: row ? 'PUT' : 'POST', body: { name, definition, ...(row ? { revision: row.revision } : {}) },
  }),
  use: (project, row) => apiFetch(`${base(project)}${row.id}/use/`, { method: 'POST', body: { revision: row.revision } }),
};
