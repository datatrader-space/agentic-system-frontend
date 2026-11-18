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
export const FRAME_EVERY = [1, 2, 5, 10, 30];

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
  if (!response.ok) throw new ApiError(response.status, data?.code || 'refused', typeof data?.error === 'string' ? data.error.slice(0, 300) : 'The link was refused.');
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

// A phone camera's own page (backend phone_camera.py): the camera's name, when its link ends and where it sends.
export const phoneCameraApi = {
  info: (secret, opts) => phoneFetch('phone-camera/', secret, { timeoutMs: 30000, ...opts }),
};

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
