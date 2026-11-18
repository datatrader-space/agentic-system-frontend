// The workspace Deployments page's Cloud Streaming tab (backend: training_models_data/streaming_api.py —
// workspace/streams/, workspace/streams/<id>/, …/stop/, …/results/, and workspace/video-sources/ for the saved cameras,
// CLOUD_STREAMING_PLAN.md section 7). A photo model answers the frames of a video: an uploaded file, a stream address
// or a saved video source. Every rule is the backend's; the checks here only say early what it would say.
import { activeWorkspace, ApiError, apiFetch } from './client.js';
import { timeAgo, usdText } from './workspace.js';

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
  // An address or a saved source goes as JSON; a video as multipart, with the same fields. Only a saved source may run
  // continuously (until it is stopped, the balance runs out or the camera stops answering). `readCodes`: read the
  // barcodes of each frame too, or alone when there is no `model` (null: none is sent).
  start: ({ project, model, fps, address, file, source, continuous, readCodes, recording }) => {
    const noModel = model === null || model === undefined || model === '';
    const extra = { ...(readCodes ? { read_codes: true } : {}) };
    const head = noModel ? { project } : { project, model };
    // A kept recording ("Use in project", CLOUD_STREAMING_PLAN.md §3.5): read in place, never continuous.
    if (recording !== undefined && recording !== null && recording !== '') {
      return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body: { ...head, fps, recording, ...extra }, timeoutMs: SLOW });
    }
    if (source !== undefined && source !== null && source !== '') {
      return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body: { ...head, fps, source, continuous: !!continuous, ...extra }, timeoutMs: SLOW });
    }
    if (file) {
      const body = new FormData();
      body.append('project', project); if (!noModel) body.append('model', String(model)); body.append('fps', String(fps));
      if (readCodes) body.append('read_codes', 'true');
      body.append('file', file, file.name);
      return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body, timeoutMs: UPLOAD_MS });
    }
    return apiFetch(`${APP}/workspace/streams/`, { method: 'POST', body: { ...head, fps, address, ...extra }, timeoutMs: SLOW });
  },
  stop: id => apiFetch(`${APP}/workspace/streams/${enc(id)}/stop/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
};

// The workspace's saved cameras. Seeing them needs Overview in the workspace; adding, changing, checking and removing
// need Manage. The server seals the address and the credentials; an answer carries only the address's scheme and host.
const SOURCES = `${APP}/workspace/video-sources/`;
export const videoSources = {
  list: ({ state = '', q = '' } = {}) => {
    const query = new URLSearchParams();
    if (state) query.set('state', state);
    if (String(q).trim()) query.set('q', String(q).trim());
    const text = query.toString();
    return apiFetch(`${SOURCES}${text ? `?${text}` : ''}`, { timeoutMs: SLOW });
  },
  add: body => apiFetch(SOURCES, { method: 'POST', body, timeoutMs: SLOW }),
  get: id => apiFetch(`${SOURCES}${enc(id)}/`),
  update: (id, body) => apiFetch(`${SOURCES}${enc(id)}/`, { method: 'PATCH', body, timeoutMs: SLOW }),
  // Connects once and takes a frame: it may take as long as the camera does to answer.
  check: id => apiFetch(`${SOURCES}${enc(id)}/check/`, { method: 'POST', body: {}, timeoutMs: SLOW }),
  // ``recordings``: 'keep' (the server's default: kept until their days are over) or 'delete' (deleted now).
  remove: (id, { recordings = 'keep' } = {}) => apiFetch(`${SOURCES}${enc(id)}/${recordings === 'delete' ? '?recordings=delete' : ''}`, { method: 'DELETE', timeoutMs: SLOW }),
  // A short-lived token for the camera's live view through AADML's media relay: {playlist, token, expires_in,
  // renew_after}. Anyone who may see the source may watch it.
  // ``job``: a connector camera's live job the page follows (CLOUD_STREAMING_PLAN.md §12): its failure is said, not retried.
  live: (id, job) => apiFetch(`${SOURCES}${enc(id)}/live/${job ? `?job=${enc(job)}` : ''}`, { timeoutMs: SLOW }),
  // Cloud recording (CLOUD_STREAMING_PLAN.md §9): {on, days?, consent?}; an Admin of the workspace, rtsp:// cameras.
  recording: (id, body) => apiFetch(`${SOURCES}${enc(id)}/recording/`, { method: 'POST', body, timeoutMs: SLOW }),
};

// "Scan from phone" in the Add video source dialog (backend camera_pairing.py): a one-time pairing code an Admin shows
// as a QR code; the phone sends what it scanned, and the dialog is given it once (state waiting | scanned | ended).
const PAIRING = `${APP}/workspace/camera-pairing/`;
export const pairingApi = {
  make: () => apiFetch(PAIRING, { method: 'POST', body: {}, timeoutMs: SLOW }),
  get: id => apiFetch(`${PAIRING}${enc(id)}/`),
};
// How often the dialog asks whether the phone has sent.
export const PAIRING_POLL_MS = 2000;

// What a phone scanned from a camera's label, as the Add form's fields. A camera address fills the address, its user
// name and password (taken out of the address: the form sends them on their own, and the server seals them); anything
// else (a serial, a model number) becomes the name, to change if needed. The value is untrusted text: one line, cut.
export function formFromScan(raw) {
  // eslint-disable-next-line no-control-regex
  const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, ADDRESS_LIMIT);
  if (!text) return {};
  if (/^(rtsps?|https):\/\//i.test(text)) {
    const url = parse(text);
    if (url && url.hostname) {
      const username = decodeURIComponent(url.username || ''); const password = decodeURIComponent(url.password || '');
      url.username = ''; url.password = '';
      return { address: url.toString(), ...(username ? { username: username.slice(0, CREDENTIAL_LIMIT) } : {}),
        ...(password ? { password: password.slice(0, CREDENTIAL_LIMIT) } : {}) };
    }
  }
  return { name: text.slice(0, SOURCE_NAME_LIMIT) };
}

// The workspace's kept recordings, newest first, each with signed links to play and download it (15 minutes).
const RECORDINGS = `${APP}/workspace/recordings/`;
export const recordingsApi = {
  list: ({ source = '', from = '', to = '', limit = 100 } = {}) => {
    const query = new URLSearchParams();
    if (source !== '' && source !== null && source !== undefined) query.set('source', String(source));
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (limit) query.set('limit', String(limit));
    return apiFetch(`${RECORDINGS}?${query.toString()}`, { timeoutMs: SLOW });
  },
  remove: id => apiFetch(`${RECORDINGS}${enc(id)}/`, { method: 'DELETE', timeoutMs: SLOW }),
};

// The UTC day [from, to) a date picker's YYYY-MM-DD names, as the recordings list takes it; '' for no day.
export function dayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return { from: '', to: '' };
  const start = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return { from: '', to: '' };
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const iso = d => d.toISOString().replace('.000Z', 'Z');
  return { from: iso(start), to: iso(end) };
}

// "10:05 to 10:10 UTC" for a recording's window, and a size in MB or GB.
export function windowText(recording) {
  const t = iso => (iso ? new Date(iso).toISOString().slice(11, 16) : '');
  return `${t(recording?.started_at)} to ${t(recording?.ended_at)} UTC`;
}
export function sizeText(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(0.1, n / 1024 ** 2).toFixed(1)} MB`;
}
// What keeping a camera's recordings costs, as the page says it.
export function dayPriceText(state) {
  const usd = Number(state?.day_price_usd) || 0;
  const per = Number(state?.per_gb_month_usd) || 0;
  const now = usd > 0 ? `about $${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)} a day for what is kept now` : 'nothing kept yet';
  return per ? `$${per.toFixed(3)} per GB a month, charged a day ahead (${now})` : `Charged per GB kept, a day ahead (${now})`;
}

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

// A frame's answer as the model's own classes: [[name, count], …] in the model's order. `classes` is the answer of any
// photo model; `counts` is the older FitMyWall-only answer (walls, windows, doors), read the same way.
export function classesOf(answer) {
  const found = answer?.classes && typeof answer.classes === 'object' ? answer.classes
    : answer?.counts && typeof answer.counts === 'object' ? answer.counts : {};
  return Object.entries(found)
    .filter(([name, count]) => String(name).trim() && count !== null && count !== '' && Number.isFinite(Number(count)) && Number(count) >= 0)
    .map(([name, count]) => [String(name).slice(0, 60), Math.floor(Number(count))]);
}

// Everything a frame found, all classes together.
export const totalOf = answer => classesOf(answer).reduce((sum, [, count]) => sum + count, 0);

// The classes a stream has shown so far (its newest frames, then the newest answer), each once, in the order first
// seen, so a class keeps its place while the counts change; at most `most` of them.
export function classNames(stream, most = 8) {
  const names = [];
  for (const answer of [...(stream?.recent || []), stream?.last]) {
    for (const [name] of classesOf(answer)) if (!names.includes(name)) names.push(name);
  }
  return names.slice(0, most);
}

// A class's count in one answer; 0 when the answer does not name it.
export const countOf = (answer, name) => classesOf(answer).find(([n]) => n === name)?.[1] ?? 0;

// "walls 2, windows 1, doors 0"; "nothing found" when the model found nothing.
export function classesText(answer) {
  const rows = classesOf(answer);
  return rows.length ? rows.map(([name, count]) => `${name} ${count}`).join(', ') : 'nothing found';
}

// One frame's answer read out: "Frame 12 at 0:12: walls 2, windows 1, doors 0."
export function countsSaid(last) {
  if (!last) return '';
  const where = `Frame ${Number(last.frame) + 1} at ${clockText(last.t)}`;
  if (last.error) return `${where}: no answer. ${last.error}`;
  // A frame read for barcodes says what it read; a frame of the barcode reader alone has no classes.
  const codes = frameCodesText(last);
  if (codes && !last.classes && !last.counts) return `${where}: ${codes}.`;
  return `${where}: ${classesText(last)}${codes ? `; barcodes: ${codes}` : ''}.`;
}

// ── barcodes (backend barcodes.py) ───────────────────────────────────────────────────────────────
// What runs on each frame of a stream: "walls 1.0.0", "walls 1.0.0 and the barcode reader", or "Barcode reader".
export function streamWhat(stream) {
  const model = stream?.model ? `${stream.model.name} ${stream.model.version}` : '';
  if (!stream?.read_codes) return model;
  return model ? `${model} and the barcode reader` : 'Barcode reader';
}

// The codes a stream read, newest first, as the page lists them: [{ key, type, value, frame, t }]. The server gives
// them newest first (`codes`); a value is untrusted text, shown as text only and cut to its limit.
export const CODE_VALUE_LIMIT = 512;
export function codesRead(stream, most = 50) {
  const rows = Array.isArray(stream?.codes) ? stream.codes : [];
  return rows.filter(c => c && typeof c.value === 'string' && c.value)
    .slice(0, most)
    .map((c, i) => ({ key: `${c.frame}-${i}`, type: String(c.type || 'Barcode').slice(0, 40), value: c.value.slice(0, CODE_VALUE_LIMIT),
      frame: Number(c.frame) || 0, t: Number(c.t) || 0 }));
}

// One frame's codes in words: "QR Code SN-1; EAN-13 4006381333931", "no code", or why it was not read.
export function frameCodesText(answer) {
  if (!answer) return '';
  if (answer.codes_error) return `Not read for barcodes: ${answer.codes_error}`;
  if (!Array.isArray(answer.codes)) return '';
  return answer.codes.length ? answer.codes.map(c => `${c.type} ${c.value}`).join('; ') : 'no code';
}

// Why a stream that ended, ended.
export function endedText(stream) {
  if (!stream || isActive(stream)) return '';
  if (stream.state === 'failed') return stream.error || 'The stream stopped on an error.';
  if (stream.state === 'cancelled') return 'Stopped before the video ended. Its answers so far are kept.';
  if (stream.ended_because === 'cap') return `Reached the cap of ${stream.max_frames} frames.`;
  return stream.continuous ? 'The stream ended. Its answers are kept.' : 'The video ended.';
}

// The bars of the newest frames: everything each found, scaled to the most of them; a frame without an answer is marked.
export function recentBars(recent, height = 32) {
  const rows = recent || [];
  const most = Math.max(1, ...rows.map(r => totalOf(r)));
  return rows.map(r => ({ frame: r.frame, failed: !!r.error, h: r.error ? height : Math.max(2, Math.round((totalOf(r) / most) * height)) }));
}

// ── video sources ────────────────────────────────────────────────────────────────────────────────
export const SOURCE_KINDS = { url: 'Camera URL', connector: 'Connected camera', rtmp: 'RTMP stream', verkada: 'Verkada camera' };
// The chips above the list. "Public" is a camera AADML publishes for every workspace to try (read-only), whatever its
// state; the others are states. A source that needs attention or was never checked is counted in All only.
export const SOURCE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'no_connector', label: 'No connector' },
  { value: 'public', label: 'Public' },
];
// The server's own wording (video_sources.CONSENT) is shown when the page has it: this is only its fallback.
export const CONSENT_TEXT = 'I own this camera or have permission to connect to it, and the people it films are informed as the law where it is requires.';
export const SOURCE_NAME_LIMIT = 120;
export const CREDENTIAL_LIMIT = 256;
export const SOURCE_SCHEMES_HELP = 'A camera address starts with rtsp:// or rtsps://, or is an HLS playlist: https://…/live.m3u8';

// The state a source is in: online, offline, no_connector (a connector camera whose connector is not running),
// needs_attention, or new (saved, never checked: never shown as Offline, since nothing is known yet).
export function sourceStateKey(source) {
  const state = String(source?.state || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (state === 'online') return 'online';
  if (state === 'new') return 'new';
  if (state === 'no_connector') return 'no_connector';
  if (state === 'needs_attention' || state === 'attention' || state === 'error') return 'needs_attention';
  return 'offline';
}

export function sourceState(source) {
  switch (sourceStateKey(source)) {
    case 'online': return ['green', 'Live'];
    case 'new': return ['neutral', 'Not checked yet'];
    case 'no_connector': return ['neutral', 'No connector'];
    case 'needs_attention': return ['amber', 'Needs attention'];
    default: return ['neutral', 'Offline'];
  }
}

// A camera AADML publishes for everyone to try: read-only, shared with every workspace. Only an explicit `true` counts.
export const isPublic = source => source?.public === true;

// How many sources each chip holds: { '': all, online, offline, no_connector, public } and, for the Summary,
// needs_attention and new.
export function sourceCounts(sources) {
  const counts = { '': 0, online: 0, offline: 0, no_connector: 0, public: 0, needs_attention: 0, new: 0 };
  for (const source of sources || []) {
    counts[''] += 1; counts[sourceStateKey(source)] += 1;
    if (isPublic(source)) counts.public += 1;
  }
  return counts;
}

// What is shown of a source's address: its scheme and host only, whatever the answer carries.
export function sourceShown(source) {
  return addressShown(source?.shown_address || source?.address_shown || source?.address || '');
}

export function filterSources(sources, { state = '', q = '' } = {}) {
  const words = String(q || '').trim().toLowerCase();
  return (sources || []).filter(s => (!state || (state === 'public' ? isPublic(s) : sourceStateKey(s) === state))
    && (!words || [s.name, sourceShown(s), s.project?.name].join(' ').toLowerCase().includes(words)));
}

// "RTSP camera" or "HLS stream" for a camera address, else the kind's own name.
export function sourceKindLabel(source) {
  if (!source?.kind || source.kind === 'url') {
    const shown = sourceShown(source);
    if (/^rtsps?:/i.test(shown)) return 'RTSP camera';
    if (/^https:/i.test(shown)) return 'HLS stream';
  }
  return SOURCE_KINDS[source?.kind] || source?.kind_label || 'Camera URL';
}

// The line under a source's name: "RTSP camera · Public · Shared with you" for a public camera (whose address is not
// shown), else "RTSP camera · rtsp://door.example.com".
export function sourceLine(source) {
  const parts = [sourceKindLabel(source)];
  if (isPublic(source)) {
    parts.push('Public');
    if (source.shared !== false) parts.push('Shared with you');
  } else if (sourceShown(source)) parts.push(sourceShown(source));
  return parts.join(' · ');
}

// The Workflows column until workflows run on sources: the streams running on it, or a dash.
export function runningText(source) {
  const n = Number(source?.streams_running ?? source?.active_streams) || 0;
  return n ? `${n} stream${n === 1 ? '' : 's'} running` : '—';
}

// A thumbnail link is used only when it is an https address (the API's signed link) or a path of this site.
export function thumbnailOf(source) {
  const link = String(source?.thumbnail_url || source?.thumbnail || '');
  return /^(https:\/\/|\/(?!\/))/i.test(link) ? link : '';
}

export function lastFrameText(source, now = Date.now()) {
  return source?.last_frame_at ? `Last frame ${timeAgo(source.last_frame_at, now)}` : 'No frame yet';
}

// "3 of 10 sources"; "3 sources" when there is no limit.
export function limitText(used, most, one = 'source', many = 'sources') {
  const n = Number(used) || 0;
  if (!most) return `${n} ${n === 1 ? one : many}`;
  return `${n} of ${most} ${Number(most) === 1 ? one : many}`;
}

// The Summary card, from the list answer's `summary` and `limits`.
export function summaryItems(summary, limits) {
  const s = summary || {}; const l = limits || {};
  const n = value => Number(value) || 0;
  return [
    { key: 'sources', label: 'Video sources', value: n(s.sources), hint: l.sources ? `of ${l.sources} you may save` : 'saved' },
    { key: 'online', label: 'Online now', value: n(s.online), hint: 'answered their last check' },
    { key: 'streams', label: 'Active workflows', value: n(s.streams_running), hint: l.streams ? `streams running, of ${l.streams} at once` : 'streams running' },
    { key: 'attention', label: 'Need attention', value: n(s.need_attention), hint: n(s.need_attention) ? 'check their address or password' : 'none' },
    { key: 'frames', label: 'Frames processed', value: n(s.frames_answered_month).toLocaleString('en-US'), hint: 'answered this month' },
    { key: 'spend', label: 'Credits used', value: usdText(n(s.spend_month_usd)) || '$0.00', hint: 'spent this month' },
  ];
}

// '' when the address may be saved as a camera, else what is wrong with it: rtsp://, rtsps:// or an HLS playlist.
export function sourceAddressProblem(raw) {
  const problem = addressProblem(raw);
  if (problem === SCHEMES_HELP) return SOURCE_SCHEMES_HELP;
  if (problem === 'Enter the stream address.') return 'Enter the camera address.';
  if (problem) return problem;
  return addressKind(raw) === 'file' ? SOURCE_SCHEMES_HELP : '';
}

// The empty form, or a source's own values to edit (its address and password are never sent back, so they start blank).
export function sourceForm(source = null) {
  const project = source?.project;
  return {
    name: source?.name || '', address: '', username: source?.username || '', password: '',
    project: (project && typeof project === 'object' ? project.ref : project) || '', consent: false,
    machine: source?.machine?.id ? String(source.machine.id) : '',
  };
}

// The form's problems by field; an empty object when it may be sent. Editing, a blank address or password keeps the
// saved one, and the consent was given when the source was added.
// A camera on one of the person's machines (a connector camera): an rtsp:// or rtsps:// address on that machine's own
// network, a private address expected (AADML never opens it; the machine does).
export const CONNECTOR_ADDRESS_HELP = "A camera on your machine's network has an rtsp:// or rtsps:// address, as its own settings or the recorder show it (for example rtsp://192.168.1.20:554/stream1).";
export function connectorAddressProblem(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'Enter the camera address.';
  if (text.length > 2000 || /\s/.test(text)) return CONNECTOR_ADDRESS_HELP;
  let url;
  try { url = new URL(text); } catch { return CONNECTOR_ADDRESS_HELP; }
  return ['rtsp:', 'rtsps:'].includes(url.protocol) && url.hostname ? '' : CONNECTOR_ADDRESS_HELP;
}

export function sourceFormProblems(form, { editing = false, connector = false } = {}) {
  const f = form || {};
  const problems = {};
  const name = String(f.name || '').trim();
  if (!name) problems.name = 'Give the source a name.';
  else if (name.length > SOURCE_NAME_LIMIT) problems.name = `A name is at most ${SOURCE_NAME_LIMIT} characters.`;
  const address = String(f.address || '').trim();
  if (!editing || address) {
    const problem = connector ? connectorAddressProblem(address) : sourceAddressProblem(address);
    if (problem) problems.address = problem;
  }
  if (connector && !editing && !f.machine) problems.machine = 'Choose the machine the camera is on.';
  if (String(f.username || '').length > CREDENTIAL_LIMIT) problems.username = `A user name is at most ${CREDENTIAL_LIMIT} characters.`;
  if (String(f.password || '').length > CREDENTIAL_LIMIT) problems.password = `A password is at most ${CREDENTIAL_LIMIT} characters.`;
  if (!editing && f.consent !== true) problems.consent = 'Confirm you own this camera or have permission to connect to it.';
  return problems;
}

// What is sent: on add, every field the person filled and the consent; on edit, only what changes (a blank address or
// password keeps the saved one; `project: null` clears the default project).
export function sourceBody(form, { editing = false, original = null } = {}) {
  const f = form || {};
  const name = String(f.name || '').trim();
  const address = String(f.address || '').trim();
  const username = String(f.username || '').trim();
  const password = String(f.password || '');
  if (!editing) {
    return {
      name, kind: f.machine ? 'connector' : 'url', address, ...(f.machine ? { machine: String(f.machine) } : {}),
      ...(username ? { username } : {}), ...(password ? { password } : {}), ...(f.project ? { project: f.project } : {}),
      consent: f.consent === true,
    };
  }
  const was = sourceForm(original);
  const body = {};
  if (name !== was.name) body.name = name;
  if ((f.project || '') !== was.project) body.project = f.project || null;
  if (address) body.address = address;
  if (username !== was.username) body.username = username;
  if (password) body.password = password;
  return body;
}

// ── live view ────────────────────────────────────────────────────────────────────────────────────
// Live view goes through AADML's media relay, which reads rtsp:// and rtsps:// cameras only for now.
// A connector camera is read by its machine, not by AADML's relay: no live view of it yet (CLOUD_STREAMING_PLAN.md §11).
// A camera address the relay pulls, or a connector camera its machine sends to the relay (§12).
export const canWatch = source => /^rtsps?:\/\//i.test(sourceShown(source));

export const LIVE_NOT_LIVE = 'Live view works for rtsp:// and rtsps:// cameras only for now.';
export const LIVE_UNAVAILABLE = 'Live view is not available right now. Try again in a few minutes.';
export const LIVE_GONE = 'This camera is not in this workspace any more.';
export const LIVE_NO_ANSWER = 'The camera did not answer.';
// The relay reached the camera and served its playlist, and the video still could not be played (live, 2026-11-17: an
// RTSP feed with H.264 B-frames, which the relay's live muxer cannot carry yet). Not "did not answer": it did.
export const LIVE_NOT_PLAYABLE = 'The camera answered, but its video could not be played live here: live view does not support its video encoding yet. Checks and streams still read it.';
// The page's own words when a refusal carried none of the server's (client.js apiFetch).
const GENERIC = ['AADML did not answer just now. Try again in a moment.', 'The request was refused.'];

// The live answer, checked: the playlist must be a path of this site, so the token is never sent to another server.
// A new token is asked for at `renew_after` seconds (else at four fifths of `expires_in`), never later than the
// token lasts and never sooner than 5 seconds. null when the answer cannot be used.
export function liveAnswer(body) {
  const playlist = typeof body?.playlist === 'string' ? body.playlist.trim() : '';
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!/^\/(?![/\\])/.test(playlist) || /[\s\\]/.test(playlist) || !token) return null;
  const lasts = Number(body.expires_in) > 0 ? Number(body.expires_in) : 300;
  const renew = Number(body.renew_after) > 0 ? Number(body.renew_after) : lasts * 0.8;
  const seconds = Math.max(5, Math.min(renew, Math.max(5, lasts - 5)));
  // A connector camera (§12): ``ready`` false until its machine's video reaches the relay, ``job`` the live job to
  // follow, ``said`` what is happening meanwhile. A camera address is always ready.
  const job = Number.isInteger(body.job) && body.job > 0 ? body.job : null;
  const said = typeof body.said === 'string' ? body.said.trim().slice(0, 300) : '';
  return { playlist, token, renewInMs: Math.round(seconds * 1000), ready: body.ready !== false, job, said };
}

// Why live view did not start, in words: the server's own sentence where it gave one.
export function liveErrorText(error) {
  const own = typeof error?.message === 'string' && error.message && !GENERIC.includes(error.message) ? error.message : '';
  if (error?.serverCode === 'not_live') return own || LIVE_NOT_LIVE;
  if (error?.serverCode === 'relay_unavailable') return own || LIVE_UNAVAILABLE;
  if (error?.status === 404) return LIVE_GONE;
  return own || LIVE_UNAVAILABLE;
}

// ── camera management (CLOUD_STREAMING_PLAN.md §3.6; streaming_api._source_detail ``history`` and ``spend_month``) ──
const CAUSES = { check: 'Found by a check', machine: 'Found by its machine', stream: 'Found by a stream on it', change: 'Its address or sign-in was changed' };

// A camera's state changes, newest first, as the page lists them: when, the state as a badge, the reason and what
// found it; ``told`` when the workspace's Admins were sent a notice about it.
export function historyRows(history, now = Date.now()) {
  return (Array.isArray(history) ? history : []).filter(e => e && e.at).map((e, i) => ({
    key: `${e.at}-${i}`, at: e.at, when: timeAgo(e.at, now), badge: sourceState({ state: e.state }),
    reason: typeof e.reason === 'string' ? e.reason : '', cause: CAUSES[e.cause] || e.cause_label || '',
    told: e.notice === 'offline' ? 'Admins were told it went offline.' : e.notice === 'online' ? 'Admins were told it is back.' : '',
  }));
}

// "November 2026" for the answer's "2026-11"; '' when it cannot be read.
export function monthText(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// What the camera cost this workspace this month: its streams' answered frames, its kept recordings, and the total.
export function spendItems(spend) {
  if (!spend || typeof spend !== 'object') return [];
  const money = v => usdText(Number(v) || 0) || '$0.00';
  const frames = Number(spend.frames) || 0; const days = Number(spend.recording_days) || 0;
  return [
    { key: 'frames', label: 'Frames answered', value: money(spend.frames_usd), hint: `${frames.toLocaleString('en-US')} frame${frames === 1 ? '' : 's'}` },
    { key: 'recording', label: 'Recording storage', value: money(spend.recording_usd), hint: `${days} day${days === 1 ? '' : 's'} charged` },
    { key: 'total', label: 'Total', value: money(spend.total_usd), hint: '' },
  ];
}

// The Connectors card: the workspace's machines that have cameras (the sources' ``machine``), with what the machines
// list says of each (its state and agent version) and how many cameras it has. A removed machine is said as removed.
export function connectorRows(machines, sources) {
  const cameras = new Map(); const named = new Map();
  for (const s of sources || []) {
    const m = s && s.kind === 'connector' && !isPublic(s) ? s.machine : null;
    if (!m || m.id === undefined || m.id === null) continue;
    const id = String(m.id);
    cameras.set(id, (cameras.get(id) || 0) + 1);
    if (!named.has(id)) named.set(id, m);
  }
  const known = new Map((machines || []).filter(m => m && m.id !== undefined && m.id !== null).map(m => [String(m.id), m]));
  return [...cameras.keys()].map(id => {
    const m = known.get(id) || named.get(id) || {};
    const state = m.state === 'online' ? 'online' : m.state === 'removed' ? 'removed' : 'offline';
    return { id, name: m.name || 'A machine', state, badge: state === 'online' ? ['green', 'Online'] : ['neutral', state === 'removed' ? 'Removed' : 'Offline'],
      agent: typeof m.agent_version === 'string' ? m.agent_version : '', cameras: cameras.get(id) };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function connectorLine(row) {
  const n = Number(row?.cameras) || 0;
  return [`${n} camera${n === 1 ? '' : 's'}`, row?.agent ? `agent ${row.agent}` : ''].filter(Boolean).join(' · ');
}

// ── a camera's rules and events (stream_events_api.py; CLOUD_STREAMING_PLAN.md §3.5, phase 6) ─────────────────────
// Rules are listed by anyone who may see the workspace's cameras and changed by its camera managers; only the
// workspace's own cameras have them. Events are newest first, each with a 15-minute link to its snapshot.
export const streamRules = {
  list: source => apiFetch(`${SOURCES}${enc(source)}/rules/`),
  add: (source, body) => apiFetch(`${SOURCES}${enc(source)}/rules/`, { method: 'POST', body, timeoutMs: SLOW }),
  update: (source, rule, body) => apiFetch(`${SOURCES}${enc(source)}/rules/${enc(rule)}/`, { method: 'PATCH', body, timeoutMs: SLOW }),
  remove: (source, rule) => apiFetch(`${SOURCES}${enc(source)}/rules/${enc(rule)}/`, { method: 'DELETE', timeoutMs: SLOW }),
};
export const streamEvents = {
  list: (source, { page = 1, limit = 20 } = {}) => {
    const query = new URLSearchParams({ page: String(Math.max(1, Number(page) || 1)), limit: String(Math.max(1, Number(limit) || 20)) });
    return apiFetch(`${SOURCES}${enc(source)}/events/?${query.toString()}`);
  },
};

// The server's own limits, as it says them when it is not asked (stream_events.py).
export const COOLDOWN_MIN = 10;
export const COOLDOWN_DEFAULT = 60;
export const RULE_CLASS_LIMIT = 64;

// "person seen", "person at least 3": how a rule reads.
export function ruleText(rule) {
  const count = Math.max(1, Math.floor(Number(rule?.min_count) || 1));
  const name = String(rule?.class_name || '').trim();
  return count === 1 ? `${name} seen` : `${name} at least ${count}`;
}

// "1 minute", "45 seconds", "2 hours": a cooldown in words.
export function cooldownText(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const [n, unit] = s % 3600 === 0 && s >= 3600 ? [s / 3600, 'hour'] : s % 60 === 0 && s >= 60 ? [s / 60, 'minute'] : [s, 'second'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

// A new rule's form, and what is wrong with it before it is sent (the server decides; this only says it early).
export function ruleForm(classes = []) {
  return { class_name: classes[0] || '', min_count: 1, cooldown_seconds: COOLDOWN_DEFAULT };
}
export function ruleProblems(form, limits = {}) {
  const problems = {};
  const name = String(form?.class_name || '').trim();
  if (!name) problems.class_name = 'Choose the class the rule looks for.';
  else if (name.length > RULE_CLASS_LIMIT) problems.class_name = `A class name is at most ${RULE_CLASS_LIMIT} characters.`;
  const count = Number(form?.min_count);
  const most = Number(limits.count_max) || 1000;
  if (!Number.isInteger(count) || count < 1 || count > most) problems.min_count = `The count is a whole number from 1 to ${most}.`;
  const low = Number(limits.cooldown_min) || COOLDOWN_MIN;
  const high = Number(limits.cooldown_max) || 86400;
  const cooldown = Number(form?.cooldown_seconds);
  if (!Number.isInteger(cooldown) || cooldown < low || cooldown > high) problems.cooldown_seconds = `The cooldown is ${low} to ${high} seconds.`;
  return problems;
}
export function ruleBody(form) {
  return { class_name: String(form.class_name || '').trim(), min_count: Number(form.min_count), cooldown_seconds: Number(form.cooldown_seconds) };
}

// The classes a rule may look for: the ones the camera's stream showed, then the ones the server saw, each once.
export function ruleClasses(stream, seen = []) {
  const names = classNames(stream, 50);
  for (const name of seen || []) if (name && !names.includes(name)) names.push(name);
  return names;
}

// What an event found: "wall 2" (what made its rule match), and when, in UTC.
export function matchedText(event) {
  const found = Object.entries(event?.matched || {}).map(([name, count]) => `${name} ${count}`);
  return found.join(', ');
}
export function eventTime(event) {
  const iso = event?.frame_at || event?.at;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`;
}

// The Workflow Builder, opened with a camera-event trigger of this camera (and rule) already on the canvas
// (WorkflowsList.vue reads these; src/utils/cameraWorkflow.js makes the canvas).
export const CAMERA_TRIGGER = 'training.stream_event';
export function workflowFromCamera(source, rule = null) {
  const query = new URLSearchParams({ trigger: CAMERA_TRIGGER, source: String(source?.id ?? '') });
  if (source?.name) query.set('camera', String(source.name).slice(0, 80));
  if (rule?.id) query.set('rule', String(rule.id));
  return `/dashboard/workflow-builder?${query.toString()}`;
}
