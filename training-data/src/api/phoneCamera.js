// A phone's own camera sent to AADML from its browser, no app (CLOUD_STREAMING_PLAN.md §16; backend phone_camera.py):
// WebRTC with WHIP. The phone page (PhoneCameraSend.vue) opens the camera with getUserMedia, makes one send-only
// RTCPeerConnection, POSTs its SDP offer to the camera's WHIP address (/live-publish/src<id>/whip, which nginx passes to
// AADML's media relay) with the phone link's secret as the Bearer credential, and sets the relay's answer. Stopping
// DELETEs the session the relay answered with. H.264 is asked for first (the relay's live view and recordings play it
// in every browser), then VP9 and AV1; a phone with none of them sends what its browser offers.
//
// This file imports nothing, so the same code runs in the phone page and, unchanged, in the local WebRTC test page.

// What the phone's camera is asked for: the back camera by default, 1280x720 at 25 frames a second where it can.
export function cameraConstraints(facing = 'environment') {
  return {
    video: { facingMode: { ideal: facing === 'user' ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 25 } },
    audio: false,
  };
}

// The codecs the relay's live view and recordings can carry (MediaMTX 1.15.4's HLS muxer takes AV1, VP9, H265 and
// H264, never VP8: "the stream doesn't contain any supported codec", seen in the local test with a browser that had no
// H.264 encoder), in the order they are asked for: H.264 first (every browser plays it), then VP9 and AV1.
const WANTED = ['video/h264', 'video/vp9', 'video/av1'];

// The browser's video codecs in that order (H.264 with packetization-mode 1 before 0, as the relay prefers), the others
// after in the browser's own order; the list as it was when it has none of them.
export function codecOrder(codecs) {
  const list = Array.isArray(codecs) ? codecs.filter(c => c && typeof c.mimeType === 'string') : [];
  const rank = c => { const i = WANTED.indexOf(c.mimeType.toLowerCase()); return i < 0 ? WANTED.length : i; };
  const mode1 = c => /packetization-mode=1/.test(c.sdpFmtpLine || '');
  return list.map((c, i) => [c, i]).sort(([a, i], [b, j]) => (rank(a) - rank(b)) || (Number(mode1(b)) - Number(mode1(a))) || (i - j))
    .map(([c]) => c);
}

// Ask for that order on a transceiver when the browser lets a page choose (setCodecPreferences); returns the codec now
// asked for first ('H264', 'VP9', 'AV1'), or '' when the browser's own order is kept.
export function preferCodecs(transceiver, Sender = globalThis.RTCRtpSender) {
  try {
    const codecs = Sender?.getCapabilities?.('video')?.codecs;
    if (!codecs?.length || typeof transceiver?.setCodecPreferences !== 'function') return '';
    const ordered = codecOrder(codecs);
    const first = ordered[0]?.mimeType.toLowerCase();
    if (!WANTED.includes(first)) return '';
    transceiver.setCodecPreferences(ordered);
    return first.slice('video/'.length).toUpperCase();
  } catch { return ''; }
}

// The session's own address, from the relay's Location answer: always under /live-publish/ on this site (the relay
// says /src<id>/whip/<session>; AADML's nginx already gives it back under /live-publish/). '' when it is not one.
export function sessionUrlOf(location, whipUrl) {
  const raw = String(location || '').trim();
  const path = raw.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
  const m = /^(?:\/live-publish)?\/(src[1-9][0-9]{0,11})\/whip\/([0-9a-fA-F-]{36})$/.exec(path);
  const whip = /^(?:https?:\/\/[^/]+)?\/live-publish\/(src[1-9][0-9]{0,11})\/whip$/.exec(String(whipUrl || ''));
  if (!m || !whip || m[1] !== whip[1]) return '';
  return `/live-publish/${m[1]}/whip/${m[2]}`;
}

// The WHIP address the phone page was told (GET phone-camera/): this site's /live-publish/src<id>/whip only.
export function whipUrlOk(url) {
  return /^\/live-publish\/src[1-9][0-9]{0,11}\/whip$/.test(String(url || ''));
}

export class PublishError extends Error {
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}

export const REFUSED_TEXT = 'AADML refused this phone link. It may have been replaced by a new one or ended: open the new link from the camera\'s page.';
export const RELAY_TEXT = 'AADML could not take the video right now. It tries again by itself.';
export const NETWORK_TEXT = 'Could not reach AADML. Check the phone\'s connection; it tries again by itself.';

// Wait until the browser has gathered its candidates (the whole offer goes in one POST), at most `ms`.
export function gathered(pc, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); pc.removeEventListener?.('icegatheringstatechange', check); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, ms);
    pc.addEventListener?.('icegatheringstatechange', check);
  });
}

// Send `stream`'s video to `whipUrl` with `secret`. Returns { pc, sender, sessionUrl, codec, stop() }; throws a
// PublishError: 'refused' (the link is not taken: do not try again), 'relay' or 'network' (try again later). MediaMTX
// 1.15.4 answers an offer its auth hook refused with 400, not 401 (internal/servers/webrtc/http_server.go tests the
// wrong error), so a 'relay' failure can be a refused link too: the phone page asks AADML about its link before it
// tries again (PhoneCameraSend.vue).
// `onState(state)` hears the connection's state: 'connecting', 'connected', 'disconnected', 'failed', 'closed'.
export async function publish({ whipUrl, secret, stream, onState = () => {}, fetchImpl = globalThis.fetch, PeerConnection = globalThis.RTCPeerConnection, Sender = globalThis.RTCRtpSender, gatherMs = 2500 } = {}) {
  if (!whipUrlOk(whipUrl)) throw new PublishError('refused', 'This phone link does not lead to an AADML camera.');
  const track = stream?.getVideoTracks?.()[0];
  if (!track) throw new PublishError('camera', 'The camera gave no video.');
  const pc = new PeerConnection({ bundlePolicy: 'max-bundle' });
  let closed = false;
  const close = () => { if (!closed) { closed = true; try { pc.close(); } catch { /* already closed */ } } };
  pc.addEventListener?.('connectionstatechange', () => onState(pc.connectionState));
  try {
    const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
    const asked = preferCodecs(transceiver, Sender);
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc, gatherMs);
    let response;
    try {
      response = await fetchImpl(whipUrl, {
        method: 'POST', body: pc.localDescription.sdp,
        headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${secret}` },
        credentials: 'omit', cache: 'no-store', redirect: 'error',
      });
    } catch { throw new PublishError('network', NETWORK_TEXT); }
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new PublishError('refused', REFUSED_TEXT, response.status);
    if (response.status !== 201) throw new PublishError('relay', RELAY_TEXT, response.status);
    const answer = await response.text();
    const sessionUrl = sessionUrlOf(response.headers.get('Location'), whipUrl);
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    const codec = (/a=rtpmap:\d+ (H264|VP8|VP9|AV1|H265)\//i.exec(answer) || [])[1] || '';
    return {
      pc, sender: transceiver.sender, sessionUrl, codec: codec.toUpperCase(), asked,
      // Tell the relay the phone stopped (so the camera goes offline at once), then close. `keepalive` lets it leave
      // while the page itself is closing.
      stop: async () => {
        close();
        if (!sessionUrl) return;
        try { await fetchImpl(sessionUrl, { method: 'DELETE', credentials: 'omit', cache: 'no-store', keepalive: true }); } catch { /* the relay ends it by itself */ }
      },
    };
  } catch (e) {
    close();
    throw e instanceof PublishError ? e : new PublishError('relay', RELAY_TEXT);
  }
}

// How long to wait before trying again after the n-th failure in a row: 2, 4, 8, then 15 seconds.
export const retryDelay = n => Math.min(15000, 2000 * 2 ** Math.max(0, Math.min(3, n - 1)));
