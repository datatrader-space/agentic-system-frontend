// The workspace Deployments page's Cloud Streaming tab (backend: training_models_data/streaming_api.py —
// workspace/streams/, workspace/streams/<id>/, …/stop/, …/results/). A photo model answers the frames of a video: an
// uploaded file or a stream address. Every rule is the backend's; the checks here only say early what it would say.
import { activeWorkspace, ApiError, apiFetch } from './client.js';

const APP = '/training-data/app';
const enc = encodeURIComponent;
// A start may carry a video of up to 100 MB: its upload gets far longer than a page read.
const UPLOAD_MS = 15 * 60 * 1000;
const SLOW = 60000;
// While a stream is queued or running, its view is read again this often.
export const POLL_MS = 2000;

export const streamingApi = {
  list: () => apiFetch(`${APP}/workspace/streams/`, { timeoutMs: SLOW }),
  get: id => apiFetch(`${APP}/workspace/streams/${enc(id)}/`),
  // An address goes as JSON; a video as multipart, with the same fields.
  start: ({ project, model, fps, address, file }) => {
    if (file) {
      const body = new FormData();
      body.append('project', project); body.append('model', String(model)); body.append('fps', String(fps));
      body.append('file', file, file.name);
      return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body, timeoutMs: UPLOAD_MS });
    }
    return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body: { project, model, fps, address }, timeoutMs: SLOW });
  },
  stop: id => apiFetch(`${APP}/workspace/streams/${enc(id)}/stop/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
};

// The results file is read with the workspace header (a plain link would not carry it) and handed to the browser.
export async function downloadResults(id, { fetchImpl = fetch, store, doc = globalThis.document } = {}) {
  const headers = { Accept: 'application/x-ndjson' };
  const workspace = activeWorkspace(store);
  if (workspace) headers['X-Workspace-ID'] = workspace.id;
  let response;
  try {
    response = await fetchImpl(`/api${APP}/workspace/streams/${enc(id)}/results/`, { headers, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  } catch { throw new ApiError(0, 'network', 'Could not reach AADML. Check your connection and try again.'); }
  if (!response.ok) {
    let message = 'The results could not be downloaded.';
    try { const data = await response.json(); if (typeof data?.error === 'string') message = data.error.slice(0, 300); } catch { /* not JSON */ }
    throw new ApiError(response.status, 'server', message);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = doc.createElement('a');
  link.href = url; link.download = `stream-${id}-results.jsonl`;
  doc.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── what a person types or picks ─────────────────────────────────────────────────────────────────
export const SCHEMES = ['rtsp', 'rtsps', 'https'];
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];
// The backend's own sentences (streaming.py), so a refusal reads the same wherever it is made.
export const SCHEMES_HELP = 'A stream address starts with rtsp://, rtsps:// or https:// (an HLS .m3u8 playlist or an .mp4, .webm or .mov file).';
export const NOT_PUBLIC = 'That address does not lead to a public server on the internet, so AADML does not open it.';
export const ADDRESS_LIMIT = 2000;

function parse(text) {
  try { return new URL(text); } catch { return null; }
}

// An address that names a machine of its own network outright. The server checks every address its name resolves
// to as well; this only says it before the form is sent.
export function privateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', '0.0.0.0', '::', '::1'].includes(h)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return /^(f[cd]|fe[89ab])/.test(h) || h.startsWith('::ffff:');
  return false;
}

// 'rtsp' (rtsp:// or rtsps://), 'hls' (an https .m3u8 playlist) or 'file' (an https video file); '' when unknown.
export function addressKind(text) {
  const url = parse(String(text || '').trim());
  if (!url) return '';
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (scheme === 'rtsp' || scheme === 'rtsps') return 'rtsp';
  if (scheme !== 'https') return '';
  return url.pathname.toLowerCase().endsWith('.m3u8') ? 'hls' : 'file';
}

// '' when the address may be sent, else what is wrong with it.
export function addressProblem(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return 'Enter the stream address.';
  // eslint-disable-next-line no-control-regex
  if (text.length > ADDRESS_LIMIT || /[\s\u0000-\u001f\u007f]/.test(text)) return `A stream address is one line of at most ${ADDRESS_LIMIT} characters.`;
  const scheme = (text.match(/^([a-z][a-z0-9+.-]*):/i)?.[1] || '').toLowerCase();
  if (!SCHEMES.includes(scheme)) return SCHEMES_HELP;
  const url = parse(text);
  if (!url) return 'That is not a stream address.';
  if (!url.hostname) return 'A stream address names its server: rtsp://camera.example.com/live';
  if (scheme === 'https' && !/\.(m3u8|mp4|webm|mov)$/i.test(url.pathname)) return 'An https address is an HLS playlist (.m3u8) or a video file (.mp4, .webm or .mov).';
  if (privateHost(url.hostname)) return NOT_PUBLIC;
  return '';
}

// What is shown of an address: its scheme and host, never its path or a password in it.
export function addressShown(raw) {
  const url = parse(String(raw || '').trim());
  if (!url || !url.hostname) return '';
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
}

export function megabytes(bytes) { return Math.round(Number(bytes || 0) / (1024 * 1024)); }

// '' when the file may be uploaded, else what is wrong with it.
export function fileProblem(file, { bytes = 200 * 1024 * 1024, extensions = VIDEO_EXTENSIONS } = {}) {
  if (!file) return 'Choose a video.';
  const extension = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  if (!extensions.includes(extension)) return 'Choose an MP4, WebM or MOV video.';
  if (!file.size) return 'That file is empty.';
  if (file.size > bytes) return `That video is larger than ${megabytes(bytes)} MB.`;
  return '';
}

// ── what a stream shows ──────────────────────────────────────────────────────────────────────────
export const isActive = stream => stream?.state === 'queued' || stream?.state === 'running';
export const anyActive = streams => (streams || []).some(isActive);

export function streamState(stream) {
  switch (stream?.state) {
    case 'queued': return ['purple', 'Queued'];
    case 'running': return ['purple', 'Running'];
    case 'done': return ['green', 'Done'];
    case 'failed': return ['red', 'Failed'];
    case 'cancelled': return ['neutral', 'Stopped'];
    default: return ['neutral', stream?.state_label || 'Unknown'];
  }
}

// Seconds into a video, as a clock: 0:07, 4:32, 1:02:03.
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// How far a stream is toward its cap, 0 to 1.
export function progressOf(stream) {
  const most = Number(stream?.max_frames) || 0;
  if (!most) return 0;
  return Math.min(1, Math.max(0, (Number(stream?.frames) || 0) / most));
}

// The cap of one stream at a frame rate: the frames run out first at 2 a second.
export function capText(cap, fps = 1) {
  if (!cap) return '';
  const seconds = Math.min(Number(cap.seconds) || 0, Math.floor((Number(cap.frames) || 0) / (Number(fps) || 1)));
  const minutes = seconds / 60;
  const time = Number.isInteger(minutes) ? `${minutes} minute${minutes === 1 ? '' : 's'}` : clockText(seconds);
  return `At ${fps} frame${Number(fps) === 1 ? '' : 's'} a second, a stream reads at most ${time} of video (${cap.frames} frames).`;
}

const plural = (n, one, many) => (n === 0 ? `no ${many}` : `${n} ${n === 1 ? one : many}`);

// One frame's answer read out: "Frame 12 at 0:12: 2 walls, 1 window, no doors."
export function countsSaid(last) {
  if (!last) return '';
  const where = `Frame ${Number(last.frame) + 1} at ${clockText(last.t)}`;
  if (last.error) return `${where}: no answer. ${last.error}`;
  const c = last.counts || {};
  return `${where}: ${plural(c.walls || 0, 'wall', 'walls')}, ${plural(c.windows || 0, 'window', 'windows')}, ${plural(c.doors || 0, 'door', 'doors')}.`;
}

// Why a stream that ended, ended.
export function endedText(stream) {
  if (!stream || isActive(stream)) return '';
  if (stream.state === 'failed') return stream.error || 'The stream stopped on an error.';
  if (stream.state === 'cancelled') return 'Stopped before the video ended. Its answers so far are kept.';
  if (stream.ended_because === 'cap') return `Reached the cap of ${stream.max_frames} frames.`;
  return 'The video ended.';
}

// The bars of the newest frames: the walls each found, scaled to the most of them; a frame without an answer is marked.
export function recentBars(recent, height = 32) {
  const rows = recent || [];
  const most = Math.max(1, ...rows.map(r => r?.counts?.walls || 0));
  return rows.map(r => ({ frame: r.frame, failed: !!r.error, h: r.error ? height : Math.max(2, Math.round(((r.counts?.walls || 0) / most) * height)) }));
}
