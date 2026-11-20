// The workplace features (backend workplace_api.py; SMART_CAMERA_AI_PLAN.md Phase H): the Admin's switch and terms,
// people and their own consent links, attendance (and its CSV), desks now, space use, plates. The server enforces
// every rule (the terms first, Admins only for people and attendance); this page only offers and shows.
import { apiFetch } from './client.js';

const APP = '/api/training-data/app';
const SLOW = 60000;
const enc = value => encodeURIComponent(String(value));

export const workplaceApi = {
  settings: () => apiFetch(`${APP}/workspace/workplace/`),
  saveSettings: body => apiFetch(`${APP}/workspace/workplace/`, { method: 'POST', body, timeoutMs: SLOW }),
  people: () => apiFetch(`${APP}/workspace/workplace/people/`),
  addPerson: body => apiFetch(`${APP}/workspace/workplace/people/`, { method: 'POST', body, timeoutMs: SLOW }),
  changePerson: (id, body) => apiFetch(`${APP}/workspace/workplace/people/${enc(id)}/`, { method: 'PATCH', body, timeoutMs: SLOW }),
  removePerson: id => apiFetch(`${APP}/workspace/workplace/people/${enc(id)}/`, { method: 'DELETE', timeoutMs: SLOW }),
  newLink: id => apiFetch(`${APP}/workspace/workplace/people/${enc(id)}/link/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
  withdraw: id => apiFetch(`${APP}/workspace/workplace/people/${enc(id)}/withdraw/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
  attendance: ({ since, until }) => apiFetch(`${APP}/workspace/workplace/attendance/?${new URLSearchParams({ since, until })}`, { timeoutMs: SLOW }),
  attendanceCsvUrl: ({ since, until }) => `${APP}/workspace/workplace/attendance/?${new URLSearchParams({ since, until, download: 'csv' })}`,
  occupancy: () => apiFetch(`${APP}/workspace/workplace/occupancy/`),
  usage: ({ since, until }) => apiFetch(`${APP}/workspace/workplace/usage/?${new URLSearchParams({ since, until })}`),
  plates: () => apiFetch(`${APP}/workspace/workplace/plates/`),
  addPlate: body => apiFetch(`${APP}/workspace/workplace/plates/`, { method: 'POST', body, timeoutMs: SLOW }),
  removePlate: id => apiFetch(`${APP}/workspace/workplace/plates/${enc(id)}/`, { method: 'DELETE', timeoutMs: SLOW }),
  sightings: kind => apiFetch(`${APP}/workspace/workplace/sightings/${kind ? `?kind=${enc(kind)}` : ''}`),
  // Phase I (backend integrations_api.py): signed webhooks, a monitoring partner, device actions, sharing agreements.
  endpoints: () => apiFetch(`${APP}/workspace/camera-endpoints/`),
  addEndpoint: body => apiFetch(`${APP}/workspace/camera-endpoints/`, { method: 'POST', body, timeoutMs: SLOW }),
  removeEndpoint: id => apiFetch(`${APP}/workspace/camera-endpoints/${enc(id)}/`, { method: 'DELETE', timeoutMs: SLOW }),
  sharing: () => apiFetch(`${APP}/workspace/sharing/`),
  propose: (purpose, pictures) => apiFetch(`${APP}/workspace/sharing/`, { method: 'POST', body: { propose: { purpose, pictures: !!pictures } }, timeoutMs: SLOW }),
  accept: code => apiFetch(`${APP}/workspace/sharing/`, { method: 'POST', body: { accept: String(code).trim() }, timeoutMs: SLOW }),
  endAgreement: id => apiFetch(`${APP}/workspace/sharing/${enc(id)}/`, { method: 'DELETE', timeoutMs: SLOW }),
};

// A day as the server reads it (Pakistan time): YYYY-MM-DD, `days` before today.
export function pkDay(days = 0, now = new Date()) {
  const shifted = new Date(now.getTime() - days * 86400000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}
// A share 0..1 as "42%".
export function percent(share) { return `${Math.round((Number(share) || 0) * 100)}%`; }
