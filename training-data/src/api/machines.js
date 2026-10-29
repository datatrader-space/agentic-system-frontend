// Your machines: machines the person owns, managed by AADML (backend: training_models_data/machines.py and machines_api.py —
// workspace/machines/, workspace/machines/<id>/remove/, .../projects/, .../serve/, workspace/machine-jobs/<id>/stop/).
// Every rule is the backend's: who may add or remove a machine, the join code (shown once, 10 minutes), which jobs a
// machine is given. These helpers only pick what to show and put it in words.
import { apiFetch } from './client.js';

const APP = '/training-data/app';

export const machinesApi = {
  list: () => apiFetch(`${APP}/workspace/machines/`),
  // A join code and the one command that holds it. Shown once: the page keeps it only while the panel is open.
  add: ({ projects = [] } = {}) => apiFetch(`${APP}/workspace/machines/`, { method: 'POST', body: { projects } }),
  remove: id => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/remove/`, { method: 'POST', body: {} }),
  setProjects: (id, projects) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/projects/`, { method: 'POST', body: { projects } }),
};

// A machine's state as a badge: [tone, words].
export function machineState(machine) {
  if (machine?.state === 'online') return ['green', 'Online'];
  if (machine?.state === 'offline') return ['neutral', 'Offline'];
  return ['neutral', 'Removed'];
}

const gb = value => (Number.isFinite(Number(value)) && Number(value) > 0 ? `${Number(value) % 1 ? Number(value).toFixed(1) : Number(value)} GB` : '');

// What the machine has, in words: "8 CPUs, 32 GB memory, 200 GB free disk" and its GPUs (or "no GPU").
export function capabilityLine(capabilities) {
  const c = capabilities || {};
  const parts = [];
  if (c.cpus) parts.push(`${c.cpus} CPU${Number(c.cpus) === 1 ? '' : 's'}`);
  if (gb(c.memory_gb)) parts.push(`${gb(c.memory_gb)} memory`);
  if (gb(c.disk_gb)) parts.push(`${gb(c.disk_gb)} free disk`);
  const gpus = Array.isArray(c.gpus) ? c.gpus : [];
  parts.push(gpus.length ? gpus.map(g => (gb(g?.memory_gb) ? `${g?.name || 'GPU'} (${gb(g.memory_gb)})` : g?.name || 'GPU')).join(', ') : 'no GPU');
  return parts.join(', ');
}

// When the machine last sent its heartbeat.
export function lastSeen(iso, now = Date.now()) {
  const at = Date.parse(iso || '');
  if (Number.isNaN(at)) return 'Not seen yet';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'Seen just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Seen ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Seen ${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `Seen ${Math.round(hours / 24)} days ago`;
}

// Whole seconds a join code still works, 0 once it has expired or when the time cannot be read.
export function secondsLeft(expiresAt, now = Date.now()) {
  const end = Date.parse(expiresAt || '');
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - now) / 1000));
}

// The line under the command.
export function expiryLine(expiresAt, now = Date.now()) {
  const left = secondsLeft(expiresAt, now);
  if (!left) return 'This code has expired. Make a new one to add the machine.';
  const minutes = Math.ceil(left / 60);
  return minutes <= 1 ? 'This code works for less than a minute more, once.' : `This code works for ${minutes} more minutes, once.`;
}

// A machine key, an app key, an authorization header or a cloud key would make a command a secret. The command only
// ever holds the join code, which works once and for 10 minutes; anything else in it is never shown.
const SECRET = [/\baadml_mk_/, /\baadml_job_/, /\baadml_app_/, /\btmd_[A-Za-z0-9]/, /authorization\s*:/i, /\bbearer\s+\S/i,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, /X-Amz-(?:Signature|Credential|Security-Token)/i];
export const containsSecret = text => SECRET.some(pattern => pattern.test(String(text ?? '')));

// The command to show for this machine (with or without its NVIDIA GPU), or '' when there is none or it is not safe.
export function commandFor(added, gpu = true) {
  const text = String((gpu ? added?.command : added?.command_cpu) || '').trim();
  if (!text.startsWith('docker run ') || !/-e AADML_JOIN=aadml_join_/.test(text) || containsSecret(text)) return '';
  return text;
}

// The projects a machine works for, in words.
export function projectsLine(machine) {
  const names = (machine?.projects || []).map(p => p?.name).filter(Boolean);
  return names.length ? `Only ${names.join(', ')}` : 'Every project';
}

// A job's state as a badge: [tone, words].
export function jobState(job) {
  if (job?.stopping) return ['neutral', 'Stopping'];
  if (job?.state === 'running') return job.kind === 'serve' && job.health?.ok === false ? ['neutral', 'Not answering'] : ['green', job.kind === 'serve' ? 'Running' : 'Training'];
  if (job?.state === 'queued') return ['purple', 'Waiting for the machine'];
  if (job?.state === 'uploaded') return ['purple', 'Checking the result'];
  if (job?.state === 'failed') return ['neutral', 'Failed'];
  if (job?.state === 'stopped') return ['neutral', 'Stopped'];
  return ['green', 'Done'];
}

export const isActive = job => ['queued', 'running', 'uploaded'].includes(job?.state);
