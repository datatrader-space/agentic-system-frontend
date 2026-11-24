// Phone upload links and photos from a video or a PDF (backend: training_models_data/app_api.py phone-links/ and
// photos/extract/, phone_links.py, media_import.py), and the phone's own side of a link (the machine API's phone/ and
// phone/photos/, where the link's secret is the Bearer credential and nobody needs to be signed in).
import { apiFetch, ApiError } from './client.js';
import { encode } from 'uqr';

const enc = encodeURIComponent;
const base = ref => `/training-data/app/projects/${enc(ref)}`;

export const phoneLinksApi = {
  list: ref => apiFetch(`${base(ref)}/phone-links/`),
  make: (ref, body) => apiFetch(`${base(ref)}/phone-links/`, { method: 'POST', body }),
  stop: (ref, id) => apiFetch(`${base(ref)}/phone-links/${enc(id)}/stop/`, { method: 'POST', body: {} }),
};

// A video or a PDF can take minutes to read on the server.
export const extractPhotos = (ref, form) => apiFetch(`${base(ref)}/photos/extract/`, { method: 'POST', body: form, timeoutMs: 300000 });
// A photo every this many seconds of a video (backend media_import.EVERY_CHOICES); 0.5 is two a second (the owner,
// 2026-11-24: "we need 2 frames per second as well").
export const FRAME_EVERY = [0.5, 1, 2, 5, 10, 30];
export const everyText = n => (n === 0.5 ? 'half second (2 a second)' : `${n} second${n === 1 ? '' : 's'}`);

// The QR code of an address, as one SVG path (drawn here: the address never goes to an outside QR service).
export function qrOf(text) {
  if (!text) return null;
  try {
    const { size, data } = encode(text, { border: 2, ecc: 'M' });
    let path = '';
    data.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z`; }));
    return { size, path };
  } catch { return null; }
}

// The secret of a phone link in this page's address (``?phone=``), when it looks like one.
export function phoneSecret(search = globalThis.location?.search || '') {
  const raw = new URLSearchParams(search).get('phone') || '';
  return /^[A-Za-z0-9_-]{30,64}$/.test(raw) ? raw : '';
}

// The secret of a camera pairing code in this page's address (``?camera=``, "Scan from phone" in the Add video source
// dialog), when it looks like one.
export function cameraSecret(search = globalThis.location?.search || '') {
  const raw = new URLSearchParams(search).get('camera') || '';
  return /^[A-Za-z0-9_-]{30,64}$/.test(raw) ? raw : '';
}

// The secret of a phone camera's link in this page's address, when it looks like one. It is in the fragment
// (``#phonecam=<secret>``, backend phone_camera.PAGE), which a browser never sends to a server, so no server on the way
// can log it.
export function phoneCamSecret(hash = globalThis.location?.hash || '') {
  const found = /^#phonecam=([A-Za-z0-9_-]{30,100})$/.exec(String(hash));
  return found ? found[1] : '';
}

// The phone's calls: the secret is sent as the Bearer credential, never in the address. A `json` body goes as JSON.
async function phoneFetch(path, secret, { method = 'GET', body, json, fetchImpl = fetch, timeoutMs = 120000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json', Authorization: `Bearer ${secret}` };
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  let response;
  try {
    response = await fetchImpl(`/api/training-data/v1/${path}`, {
      method, body, headers,
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted ? new ApiError(0, 'timeout', json !== undefined ? 'Sending took too long. Try again.' : 'Sending took too long. Try fewer photos at a time.')
      : new ApiError(0, 'network', 'Could not reach AADML. Check the connection and try again.');
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const error = new ApiError(response.status, data?.code || 'refused', typeof data?.error === 'string' ? data.error.slice(0, 300) : 'The link was refused.', data?.field);
    if (data?.recording && typeof data.recording === 'object') error.recording = data.recording;   // a refused Record still says where it stands
    throw error;
  }
  return data;
}

export const phoneApi = {
  info: (secret, opts) => phoneFetch('phone/', secret, opts),
  send: (secret, files, opts) => {
    const form = new FormData();
    files.forEach(file => form.append('photos', file, file.name));
    return phoneFetch('phone/photos/', secret, { ...opts, method: 'POST', body: form });
  },
};

// A phone camera's own page (backend phone_camera.py): the camera's name, when its link ends, where it sends and its
// recording (``recording``: absent from a server older than the Record button, which then is not shown). ``record``
// asks the server to start or stop the camera's cloud recording (recordings.phone_record): it decides, with every
// check of turning recording on; this page only asks and shows the answer or the refusal's reason.
export const phoneCameraApi = {
  info: (secret, opts) => phoneFetch('phone-camera/', secret, { timeoutMs: 30000, ...opts }),
  record: (secret, on, opts) => phoneFetch('phone-camera/recording/', secret, { timeoutMs: 30000, ...opts, method: 'POST', json: { on: on === true } }),
  // Whether this phone has a microphone it may use; with one, the answer says where to send its sound (sound_whip).
  sound: (secret, microphone, opts) => phoneFetch('phone-camera/sound/', secret, { timeoutMs: 30000, ...opts, method: 'POST', json: { microphone: microphone === true } }),
  // What the open camera sends and the most it can (backend camera_quality.report_phone); the answer's ``video`` is
  // what this phone is asked to send.
  video: (secret, track, opts) => phoneFetch('phone-camera/video/', secret, { timeoutMs: 30000, ...opts, method: 'POST', json: cameraReport(track) }),
};

// A camera track's report: its settings (width, height, frameRate) and the most it can (getCapabilities: absent in
// some browsers), numbers only.
export function cameraReport(track) {
  const pick = (o, names) => Object.fromEntries(names.filter(n => Number.isFinite(o?.[n])).map(n => [n, o[n]]));
  let settings = {}; let caps = {};
  try { settings = pick(track?.getSettings?.() || {}, ['width', 'height', 'frameRate']); } catch { settings = {}; }
  try {
    const c = track?.getCapabilities?.() || {};
    caps = Object.fromEntries(['width', 'height', 'frameRate'].filter(n => Number.isFinite(c?.[n]?.max)).map(n => [n, { max: c[n].max }]));
  } catch { caps = {}; }
  return { settings, capabilities: caps };
}

// What the phone's Record button shows of a ``recording`` answer: null when the server said nothing of it (an older
// server); else whether it is on (and paid), whether this phone may start and stop it, the server's own words, and the
// seconds it has run by the server's clock (counted on from ``at``, this page's own clock, so the phone's time of day
// never matters).
export function recordingOf(answer, at = Date.now()) {
  const r = answer && typeof answer === 'object' ? answer : null;
  if (!r || typeof r.on !== 'boolean') return null;
  const seconds = Number.isFinite(r.seconds) && r.seconds >= 0 ? r.seconds : 0;
  return { on: r.on, unpaid: r.unpaid === true, may: r.may === true, said: typeof r.said === 'string' ? r.said.slice(0, 300) : '',
    days: Number.isFinite(r.days) ? r.days : null, seconds, at };
}

// "4:05" or "1:02:09" for a recording that has run `seconds`.
export function elapsedText(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const two = n => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

// A phone pairing with the Add video source dialog (backend camera_pairing.py): what it pairs with, and the one value
// it sends (what it scanned from the camera's label, or what the person typed).
export const cameraPhoneApi = {
  info: (secret, opts) => phoneFetch('camera-pairing/', secret, opts),
  send: (secret, value, opts) => phoneFetch('camera-pairing/', secret, { ...opts, method: 'POST', json: { value }, timeoutMs: 30000 }),
};

// The codes the browser's own reader (BarcodeDetector) is asked for, of those it says it reads; [] when it reads none
// or has no reader at all (the phone then says so, and the person types what the label says).
export const SCAN_FORMATS = ['qr_code', 'data_matrix', 'aztec', 'pdf417', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar'];
export async function scanFormats(Detector = globalThis.BarcodeDetector) {
  if (typeof Detector !== 'function') return [];
  try {
    const supported = typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : SCAN_FORMATS;
    return SCAN_FORMATS.filter(f => supported.includes(f));
  } catch { return []; }
}

// The photos in parts the server takes at once (at most 20 a request).
export function inBatches(files, size = 10) {
  const parts = [];
  for (let i = 0; i < files.length; i += size) parts.push(files.slice(i, i + size));
  return parts;
}

// What this tab keeps of a phone camera's page across a reload (sessionStorage, beside the link's own `tmd.phonecam`,
// main.js): the camera chosen, and whether it was sending, with when that was last said. A reload ends the WebRTC
// session, so a tab that was sending starts again by itself (live, 2026-11-18: a reload left a recording camera with
// nothing sent and the page showing Start). Never after Stop: Stop clears it. Kept only while said in the last
// RESUME_MS (the page says it again every 30 seconds while it sends), so a tab restored hours later does not open the
// camera by itself.
export const CAMERA_STATE_KEY = 'tmd.phonecam.state';
export const RESUME_MS = 2 * 60 * 1000;
function store() { try { return globalThis.sessionStorage || null; } catch { return null; } }
export function cameraMemory(storage = store(), now = Date.now()) {
  let kept = {};
  try { kept = JSON.parse(storage?.getItem(CAMERA_STATE_KEY) || '{}') || {}; } catch { kept = {}; }
  const facing = kept.facing === 'user' ? 'user' : 'environment';
  const at = Number(kept.at) || 0;
  return { facing, resume: kept.sending === true && at <= now && now - at < RESUME_MS };
}
export function rememberCamera({ facing, sending }, storage = store(), now = Date.now()) {
  try {
    const was = JSON.parse(storage?.getItem(CAMERA_STATE_KEY) || '{}') || {};
    const next = { facing: (facing ?? was.facing) === 'user' ? 'user' : 'environment', sending: sending ?? was.sending === true, at: now };
    storage?.setItem(CAMERA_STATE_KEY, JSON.stringify(next));
  } catch { /* no storage here: a reload shows Start */ }
}

// A person's own workplace link (backend workplace_api.py, ``?consent=<secret>``): what is done and why, their consent
// with their own photo, their own attendance, withdraw and erase. The link is the only authority; nobody signs in.
export function consentSecret(search = globalThis.location?.search || '') {
  const raw = new URLSearchParams(search).get('consent') || '';
  return /^[A-Za-z0-9_-]{30,100}$/.test(raw) ? raw : '';
}
export const workplaceMeApi = {
  get: (secret, opts) => phoneFetch('workplace/me/', secret, opts),
  consent: (secret, photo, opts) => {
    const form = new FormData();
    form.append('agree', 'true');
    form.append('photo', photo, photo.name || 'me.jpg');
    return phoneFetch('workplace/me/consent/', secret, { ...opts, method: 'POST', body: form });
  },
  withdraw: (secret, opts) => phoneFetch('workplace/me/withdraw/', secret, { ...opts, method: 'POST', json: {} }),
  erase: (secret, opts) => phoneFetch('workplace/me/erase/', secret, { ...opts, method: 'POST', json: {} }),
};
