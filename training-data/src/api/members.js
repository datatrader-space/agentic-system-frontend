// The Members and Roles page and invite links (backend: training_models_data/app_api.py — members/…, join/;
// training_models_data/invite_links.py). The token of a link travels in request bodies only.
import { apiFetch } from './client.js';

const base = '/training-data/app/members';
export const members = {
  load: () => apiFetch(`${base}/`),
  invite: body => apiFetch(`${base}/invite/`, { method: 'POST', body }),
  invitation: (id, action) => apiFetch(`${base}/invitations/${encodeURIComponent(id)}/${action}/`, { method: 'POST', body: {} }),
  setRole: (userId, projectId, role) => apiFetch(`${base}/${encodeURIComponent(userId)}/projects/${encodeURIComponent(projectId)}/`, { method: 'POST', body: { role } }),
  removeRole: (userId, projectId) => apiFetch(`${base}/${encodeURIComponent(userId)}/projects/${encodeURIComponent(projectId)}/`, { method: 'DELETE' }),
  makeLink: body => apiFetch(`${base}/links/`, { method: 'POST', body }),
  link: (id, action) => apiFetch(`${base}/links/${encodeURIComponent(id)}/${action}/`, { method: 'POST', body: {} }),
};
export const joinLink = {
  look: token => apiFetch('/training-data/app/join/', { method: 'POST', body: { token } }),
  join: token => apiFetch('/training-data/app/join/', { method: 'POST', body: { token, join: true } }),
};

// The invite token an address carries (`?join=…`), or ''.
export function joinToken(search = globalThis.location?.search || '') {
  const token = new URLSearchParams(search).get('join') || '';
  return /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : '';
}

// "a@x.com, b@y.com; c@z.com" -> ['a@x.com', 'b@y.com', 'c@z.com'] (spaces, commas, semicolons and new lines split).
export function emailsOf(text) {
  return String(text || '').split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
}
