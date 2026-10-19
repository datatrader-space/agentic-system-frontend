// This person's Training notifications (backend: training_models_data/app_api.py — notifications/, notifications/read/,
// notifications/<id>/read/). The same rows as the AADML bell: assignments given, returned, approved, sent back.
import { apiFetch } from './client.js';

export const listNotifications = () => apiFetch('/training-data/app/notifications/');
export const readNotification = id => apiFetch(`/training-data/app/notifications/${encodeURIComponent(id)}/read/`, { method: 'POST', body: {} });
export const readAllNotifications = () => apiFetch('/training-data/app/notifications/read/', { method: 'POST', body: {} });

// A deep link of this UI ("#project/<ref>/<page>[/<assignment>]") read into its parts; null for any other hash.
export function readDeepLink(hash) {
  const found = /^#?project\/([^/]+)\/([a-z]+)(?:\/([0-9]+))?$/.exec(hash || '');
  if (!found) return null;
  return { ref: decodeURIComponent(found[1]), page: found[2], assignment: found[3] ? Number(found[3]) : null };
}

// The project a deep link names: by its own address (a slug or "~<id>"), or by "~<id>" when the person addresses it
// by its slug (their own project).
export function findProject(projects, ref) {
  return (projects || []).find(p => p.ref === ref || (p.serverId != null && `~${p.serverId}` === ref)) || null;
}
