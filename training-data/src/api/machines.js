// Your machines: machines the person owns, managed by AADML (backend: training_models_data/machines.py and machines_api.py —
// workspace/machines/, workspace/machines/<id>/remove/, .../projects/, .../serve/, .../discover/,
// workspace/machine-jobs/<id>/stop/).
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
  // Look for cameras on the machine's network (an Admin; agent 1.6.0): one search a machine at a time, then its answer.
  discover: id => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/discover/`, { method: 'POST', body: {} }),
  discovery: (id, job) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/discover/${encodeURIComponent(job)}/`),
  // The machine agent's own log (an Admin; agent 1.9.3): {id, name, lines, total, updated_at, agent_version}.
  log: (id, lines = AGENT_LOG_LINES) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/log/?lines=${encodeURIComponent(lines)}`),
  // Machine diagnostics (an Admin; agent 1.9.7, ADM-1394): one fixed read-only look, answered by the machine.
  // POST -> 202 {request_id, request}; GET -> {request: {id, action, arguments, state, said, answer, ...}}.
  diagnose: (id, action, args = {}) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/diagnose/`, { method: 'POST', body: { action, arguments: args } }),
  diagnosis: (id, requestId) => apiFetch(`${APP}/workspace/machines/${encodeURIComponent(id)}/diagnose/${encodeURIComponent(requestId)}/`),
};

// ── the agent's own log (backend: machines.agent_log; agent 1.9.3 sends it with each heartbeat) ──────────────────
export const AGENT_LOG_AGENT = '1.9.3';
// How many of its newest lines the page asks for, and how often it reads them again while the fold is open.
export const AGENT_LOG_LINES = 300;
export const AGENT_LOG_REFRESH_MS = 10000;
// What the fold says when the machine has sent no line ('' when it has some).
export function agentLogEmpty(answer, machine) {
  if (answer?.lines?.length) return '';
  if (!agentAtLeast(machine?.agent_version || answer?.agent_version, AGENT_LOG_AGENT)) {
    return `This machine sends its log from agent ${AGENT_LOG_AGENT}. It runs ${machine?.agent_version || answer?.agent_version || 'an older agent'}; it updates itself when it is idle.`;
  }
  return "No line of the agent's log has come yet. It comes with the machine's next heartbeat (every 30 seconds).";
}
// "Updated 2 minutes ago" for the log's newest heartbeat, or '' when none came.
export function agentLogUpdated(iso, now = Date.now()) {
  if (Number.isNaN(Date.parse(iso || ''))) return '';
  return lastSeen(iso, now).replace(/^Seen/, 'Updated');
}

// ── finding cameras on a machine's network (backend: machines.camera_discover, discovery_row) ───────────────────────
// The agent that looks for cameras (machines.CAMERA_DISCOVER_AGENT).
export const DISCOVER_AGENT = '1.6.0';
const versionParts = v => String(v || '').split('.').slice(0, 3).map(n => (/^\d+$/.test(n) ? Number(n) : NaN));
export function agentAtLeast(have, wanted) {
  const a = versionParts(have); const b = versionParts(wanted);
  if (a.length < 3 || a.some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
// Why the machine cannot look for cameras now, in words ('' when it can). The server decides again on every search.
export function discoverWhy(machine) {
  if (!machine) return '';
  if (machine.state !== 'online') return `${machine.name} is offline: start it, then look for cameras.`;
  if (!agentAtLeast(machine.agent_version, DISCOVER_AGENT)) {
    return `${machine.name} runs agent ${machine.agent_version || 'of an older release'}: looking for cameras needs ${DISCOVER_AGENT} or later. It updates itself when it is idle; meanwhile, type the camera's address.`;
  }
  return '';
}
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const plainHost = host => {
  const text = String(host || '').trim();
  if (IPV4.test(text)) return text;
  return HOSTNAME.test(text) && !/^[\d.]+$/.test(text) ? text.toLowerCase() : '';
};
// The address a found camera is added with: its host on RTSP's port. The person completes its stream path and
// credentials (a camera's ONVIF answer does not say them); '' for a host that is not one.
export function foundAddress(camera) {
  const host = plainHost(camera?.host);
  return host ? `rtsp://${host}:554/` : '';
}
// A found camera in one line: its name and model when it gave them, and its address on the network.
export function foundLine(camera) {
  const host = plainHost(camera?.host);
  const parts = [camera?.name, camera?.hardware].map(v => String(v || '').trim()).filter(Boolean);
  return parts.length ? `${parts.join(' · ')} (${host})` : host;
}
export const FOUND_NEXT = "Complete the camera's stream path (as its settings or recorder show it, for example /stream1) and its user name and password.";

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

// The terminals the command is shown for. Git Bash on Windows (MSYS) rewrites every argument that looks like a Unix
// path into a Windows one, so `-v /var/run/docker.sock:/var/run/docker.sock` reached Docker as a path under Git's own
// folder and the agent found no Docker socket and restarted forever (2026-11-10). MSYS_NO_PATHCONV=1 stops that for the
// one command; PowerShell, cmd, Linux and macOS pass the paths as written, and in PowerShell the prefix is an error.
// Checked on Windows 2026-11-10 by printing what each terminal hands to the program: cmd, PowerShell (and the Docker
// Desktop terminal, which opens one of them) pass the paths as written; Git Bash rewrites them unless the prefix is
// there, and in cmd or PowerShell the prefix itself is an error ("not recognized"). Linux and Mac shells pass them
// as written.
export const SHELLS = [
  { value: 'powershell', label: 'PowerShell', hint: 'Windows' },
  { value: 'cmd', label: 'Command Prompt (cmd)', hint: 'Windows' },
  { value: 'docker', label: 'Docker Desktop terminal', hint: 'Windows or Mac' },
  { value: 'gitbash', label: 'Git Bash', hint: 'Windows' },
  { value: 'unix', label: 'Terminal', hint: 'Linux or Mac' },
];
export function commandForShell(command, shell) {
  const text = String(command || '').trim();
  if (!text) return '';
  return shell === 'gitbash' ? `MSYS_NO_PATHCONV=1 ${text}` : text;
}
// The terminal to start on: PowerShell on Windows, the usual terminal elsewhere. The person can change it.
export function defaultShell(platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '') {
  return /win/i.test(String(platform)) ? 'powershell' : 'unix';
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

// What a machine needs, in words, on both the Your machines page and the Edge Devices tab. Each line is a fact of the
// backend or the images: the agent speaks Docker Engine API 1.43 (Docker 24); the images are built for linux/amd64; a
// model runs with 4 GB of memory and 2 processors (machines.payload); training is offered on 8 GB and 30 GB free disk
// (machines.FIT_MEMORY_GB, FIT_DISK_GB); the GPU is given to a job through NVIDIA's container runtime.
export const MACHINE_NEEDS = [
  { id: 'docker', title: 'Linux, Windows or an Intel Mac, with Docker 24 or newer', text: 'Linux: Docker Engine. Windows 10 or 11, or a Mac with an Intel processor: Docker Desktop (Linux containers). docker run must work in a terminal on the machine. Docker Desktop gives its Linux VM part of the memory: give it 8 GB or more to train.' },
  { id: 'cpu', title: 'A 64-bit Intel or AMD processor (x86-64)', text: 'ARM machines, such as a Raspberry Pi or an Apple silicon Mac, cannot run the images yet.' },
  { id: 'memory', title: '4 GB of free memory to run a model', text: 'To train on the machine as well: 8 GB of memory and 30 GB of free disk.' },
  { id: 'gpu', title: 'An NVIDIA GPU for training, if you have one', text: 'Optional. It needs the NVIDIA driver and the NVIDIA Container Toolkit. Running a model needs no GPU.' },
];

// The checks a person runs on the machine when something is wrong. The GPU check pulls from public.ecr.aws, a host the
// machine already reaches, not Docker Hub. Each one only reads, except ``clean``, which removes
// the agent, its volume (and the machine key in it) and the job containers it started. The agent's container is
// aadml-machine, or aadml-machine-<digest> once it has updated itself (ml/machine_agent/agent.py update), so it is found
// by that part of its name; the job containers carry the label aadml.job (ml/machine_agent/jobs.py).
export const MACHINE_COMMANDS = {
  docker: 'docker info --format "{{.ServerVersion}} {{.Architecture}}"',
  logs: 'docker logs --tail 50 $(docker ps -aq --filter name=aadml-machine | head -n 1)',
  gpu: 'docker run --rm --gpus all public.ecr.aws/ubuntu/ubuntu:24.04 nvidia-smi',
  clean: 'docker rm -f $(docker ps -aq --filter name=aadml-machine) $(docker ps -aq --filter label=aadml.job); docker volume rm aadml-machine',
};

// The command that checks the machine reaches one host over HTTPS: it prints the HTTP status only (any number means
// the host was reached; 000 means it was not).
export const reachCommand = host => (/^[A-Za-z0-9.-]{1,253}$/.test(String(host || '')) ? `curl -sS -o /dev/null -w "%{http_code}\\n" https://${host}/` : '');

// The machines in one line for the Edge tab's first step: [tone, words].
export function machinesLine(machines) {
  const list = (Array.isArray(machines) ? machines : []).filter(m => m && m.state !== 'removed');
  const online = list.filter(m => m.state === 'online');
  if (!list.length) return ['waiting', 'No machine yet.'];
  if (online.length === list.length) return ['done', list.length === 1 ? `${online[0].name} is online.` : `${online.length} machines are online.`];
  if (online.length) return ['done', `${online.length} of ${list.length} machines are online.`];
  return ['attention', list.length === 1 ? `${list[0].name} is offline.` : `${list.length} machines, all offline.`];
}

// ── machine diagnostics (backend: machine_diagnostics.py; agent 1.9.7: ml/machine_agent/diagnose.py) ─────────────
// A FIXED read-only set: the machine's AADML containers, one's log tail, how one ended, the machine's figures, the
// agent's own log. The backend checks every request again; these helpers only pick what to show and put it in words.
export const DIAGNOSE_AGENT = '1.9.7';
export const DIAGNOSE_LINES = [50, 200, 500, 2000];
export const DIAGNOSE_DEFAULT_LINES = 200;
// How often a request is read again while the machine answers, and how many times before the page stops waiting.
export const DIAGNOSE_POLL_MS = 1000;
export const DIAGNOSE_TRIES = 30;
// Why the machine cannot be asked now, in words ('' when it can).
export function diagnoseWhy(machine) {
  if (!machine) return '';
  if (machine.state !== 'online') return `${machine.name} is offline. Diagnostics work once it is back online.`;
  if (!(machine.diagnostics ?? agentAtLeast(machine.agent_version, DIAGNOSE_AGENT))) {
    const needs = machine.diagnostics_agent || DIAGNOSE_AGENT;
    return `Diagnostics need agent ${needs}. ${machine.name} runs ${machine.agent_version || 'an older agent'}; it updates itself when it is idle.`;
  }
  return '';
}
// Ask the machine and wait for its answer: the request as the backend last said it (answered, refused, expired, or
// still pending once the tries are used up). `sleep` is passed in so a test needs no clock.
export async function runDiagnostic(api, machineId, action, args = {}, { sleep = ms => new Promise(r => setTimeout(r, ms)), tries = DIAGNOSE_TRIES, isGone = () => false } = {}) {
  const made = await api.diagnose(machineId, action, args);
  let request = made?.request || { id: made?.request_id, state: 'pending' };
  for (let i = 0; i < tries && request?.state === 'pending' && !isGone(); i += 1) {
    await sleep(DIAGNOSE_POLL_MS);
    if (isGone()) break;
    request = (await api.diagnosis(machineId, made.request_id))?.request || request;
  }
  return request;
}
// What a request that gave no answer says ('' once answered).
export function diagnosticWords(request) {
  if (!request || request.state === 'answered') return '';
  if (request.state === 'pending') return 'The machine has not answered yet. It may be busy or its connection slow; try again.';
  return String(request.said || (request.state === 'expired' ? 'The machine did not answer in time.' : 'The machine refused it.'));
}
// A container's state as a badge: [tone, words].
export function containerState(container) {
  const state = String(container?.state || '');
  if (state === 'running') return ['green', 'Running'];
  if (state === 'restarting') return ['purple', 'Restarting'];
  if (state === 'exited' || state === 'dead') {
    if (container?.oom_killed) return ['neutral', 'Out of memory'];
    return ['neutral', Number.isInteger(container?.exit_code) ? `Exited (${container.exit_code})` : 'Exited'];
  }
  return ['neutral', state ? state[0].toUpperCase() + state.slice(1) : 'Unknown'];
}
// What a container is for, from the labels the agent set: "Model server, job 292".
const KIND_WORDS = { try: 'Model server', serve: 'Served model', train: 'Training job', camera: 'Camera job', platform: 'Platform step', agent: 'Agent' };
export function containerWhat(container) {
  const labels = container?.labels || {};
  const kind = KIND_WORDS[labels['aadml.kind']] || 'AADML container';
  return labels['aadml.job'] ? `${kind}, job ${labels['aadml.job']}` : kind;
}
// How a container ended, in one line.
export function endedLine(answer) {
  const c = answer?.container || {};
  if (answer?.said) return String(answer.said);
  if (c.oom_killed) return 'The machine ran out of memory, so Docker stopped it.';
  if (Number.isInteger(c.exit_code)) return c.exit_code === 0 ? 'It ended normally (exit code 0).' : `It ended with exit code ${c.exit_code}.`;
  return 'Docker did not say how it ended.';
}
// The machine's figures in lines: GPUs, disk, memory, CPUs, the agent and Docker.
export function systemLines(answer) {
  if (!answer) return [];
  const lines = [];
  const gpus = Array.isArray(answer.gpus) ? answer.gpus : [];
  if (!gpus.length) lines.push(['GPU', 'None the agent can use']);
  gpus.forEach((g, i) => {
    const parts = [g?.name || 'GPU'];
    if (gb(g?.free_gb) && gb(g?.memory_gb)) parts.push(`${gb(g.free_gb)} free of ${gb(g.memory_gb)}`);
    else if (gb(g?.memory_gb)) parts.push(gb(g.memory_gb));
    if (Number.isInteger(g?.utilization_percent)) parts.push(`${g.utilization_percent}% busy`);
    lines.push([gpus.length > 1 ? `GPU ${i + 1}` : 'GPU', parts.join(', ')]);
  });
  if (gb(answer.disk?.free_gb)) lines.push(['Disk', `${gb(answer.disk.free_gb)} free${gb(answer.disk?.total_gb) ? ` of ${gb(answer.disk.total_gb)}` : ''}`]);
  if (gb(answer.memory?.total_gb)) lines.push(['Memory', `${gb(answer.memory.available_gb) || '0 GB'} available of ${gb(answer.memory.total_gb)}`]);
  if (answer.cpus) lines.push(['CPUs', String(answer.cpus)]);
  if (answer.agent?.version) lines.push(['Agent', answer.agent.version]);
  const docker = answer.docker || {};
  lines.push(['Docker', docker.answers ? `Answers, version ${docker.version?.Version || docker.info?.ServerVersion || 'unknown'}${docker.info?.OperatingSystem ? ` on ${docker.info.OperatingSystem}` : ''}` : `Does not answer${docker.error ? `: ${docker.error}` : ''}`]);
  return lines;
}
