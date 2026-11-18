// @vitest-environment jsdom
// A phone camera's own page (CLOUD_STREAMING_PLAN.md §16): it names the camera, Start opens the back camera and sends it
// to the WHIP address the server gave with the link's secret, Live is said once the connection is up, Stop ends the
// session and the camera, and a refused link is said and not retried.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'Abc_def-0123456789xyzABCDEFGHIJKLMNOPQRSTUV';
const calls = { publish: [], stop: 0, record: [], replaced: [] };
let refuse = false; let lastOnState = null; let linkGone = false; let recording = null; let recordRefusal = null;
vi.mock('../../../training-data/src/api/phone.js', async (real) => ({
  ...(await real()),
  phoneCameraApi: {
    info: vi.fn(async () => {
      if (linkGone) throw Object.assign(new Error('This phone link has ended. Make a new one on the camera page in AADML.'), { status: 403 });
      return { name: 'Dock phone', expires_at: '2026-11-25T12:00:00+00:00', whip: '/live-publish/src14/whip', ...(recording ? { recording } : {}) };
    }),
    record: vi.fn(async (secret, on) => {
      calls.record.push([secret, on]);
      if (recordRefusal) throw recordRefusal;
      recording = { ...recording, on, since: on ? '2026-11-18T10:00:00+00:00' : null, seconds: on ? 0 : null, said: '' };
      return { said: on ? 'Recording.' : 'Recording stopped.', recording };
    }),
  },
}));
vi.mock('../../../training-data/src/api/phoneCamera.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    publish: vi.fn(async options => {
      calls.publish.push(options);
      lastOnState = options.onState;
      if (refuse === 'relay') throw new actual.PublishError('relay', actual.RELAY_TEXT, 400);
      if (refuse) throw new actual.PublishError('refused', actual.REFUSED_TEXT);
      return { pc: { connectionState: 'connecting' }, sender: { track: options.stream.getVideoTracks()[0], replaceTrack: vi.fn(async t => { calls.replaced.push(t); }) }, codec: 'H264', stop: () => { calls.stop += 1; } };
    }),
  };
});
import PhoneCameraSend from '../../../training-data/src/components/PhoneCameraSend.vue';

// A phone that opens one camera at a time, as phones do: a second one asked for while one is open is "in use".
function phoneBrowser({ noFront = false } = {}) {
  const stopped = []; const open = new Set(); const asked = [];
  const getUserMedia = vi.fn(async constraints => {
    const facing = constraints.video.facingMode.ideal;
    asked.push([facing, open.size]);
    if (open.size) throw Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
    if (noFront && facing === 'user') throw Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
    const track = { facing, readyState: 'live', stop: () => { open.delete(track); stopped.push(track); }, addEventListener: () => {} };
    open.add(track);
    return { getVideoTracks: () => [track], getTracks: () => [track] };
  });
  globalThis.RTCPeerConnection = function RTCPeerConnection() {};
  Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
  return { getUserMedia, stopped, open, asked };
}
const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));

afterEach(() => {
  calls.publish = []; calls.stop = 0; calls.record = []; calls.replaced = [];
  refuse = false; lastOnState = null; linkGone = false; recording = null; recordRefusal = null;
  sessionStorage.clear();
});

describe('the phone camera page', () => {
  it('sends the back camera to its WHIP address with the link, says Live, and Stop ends it', async () => {
    const { getUserMedia, stopped } = phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(w.find('h1').text()).toBe('Dock phone');
    expect(w.find('[role="status"]').text()).toContain('Not sending');
    await w.findAll('button').find(b => b.text().includes('Start')).trigger('click');
    await flushPromises();
    expect(getUserMedia.mock.calls[0][0]).toEqual({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 25 } }, audio: false });
    expect(calls.publish).toHaveLength(1);
    expect([calls.publish[0].whipUrl, calls.publish[0].secret]).toEqual(['/live-publish/src14/whip', SECRET]);
    expect(w.find('[role="status"]').text()).toContain('Connecting');
    lastOnState('connected');
    await flushPromises();
    expect(w.find('[role="status"]').text()).toContain('Live: sending to AADML');
    expect(w.text()).toContain('Front camera');
    await w.findAll('button').find(b => b.text().includes('Stop')).trigger('click');
    await flushPromises();
    expect(calls.stop).toBe(1);
    expect(stopped).toHaveLength(1);                                          // the camera is let go
    expect(w.find('[role="status"]').text()).toContain('Stopped');
    w.unmount();
  });

  it('says a refused link plainly and does not try again', async () => {
    phoneBrowser();
    refuse = true;
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await w.findAll('button').find(b => b.text().includes('Start')).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('AADML refused this phone link');
    expect(w.find('[role="status"]').text()).toContain('This link no longer works');
    expect(w.findAll('button').some(b => b.text().includes('Start'))).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls.publish).toHaveLength(1);
    w.unmount();
  });

  it('asks AADML about its link when the relay answers 400, and says an ended link instead of trying again', async () => {
    phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    refuse = 'relay'; linkGone = true;                                       // replaced or ended after the page opened
    await w.findAll('button').find(b => b.text().includes('Start')).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('This phone link has ended');
    expect(w.find('[role="status"]').text()).toContain('This link no longer works');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls.publish).toHaveLength(1);
    w.unmount();
  });

  it('lets the person choose the front camera before Start, and keeps it when they Start again', async () => {
    const { getUserMedia } = phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await button(w, 'Front camera').trigger('click');
    expect(button(w, 'Front camera').attributes('aria-pressed')).toBe('true');
    expect(getUserMedia).not.toHaveBeenCalled();                            // the choice only: Start opens it
    await button(w, 'Start').trigger('click');
    await flushPromises();
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toEqual({ ideal: 'user' });
    await button(w, 'Stop sending').trigger('click');
    await flushPromises();
    expect(button(w, 'Start again')).toBeTruthy();
    expect(button(w, 'Front camera').attributes('aria-pressed')).toBe('true');
    await button(w, 'Start again').trigger('click');
    await flushPromises();
    expect(getUserMedia.mock.calls[1][0].video.facingMode).toEqual({ ideal: 'user' });
    w.unmount();
  });

  it('switches camera while sending by letting the open one go first, on the same session', async () => {
    const { getUserMedia, asked, open } = phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await button(w, 'Start').trigger('click');
    await flushPromises();
    lastOnState('connected');
    await flushPromises();
    await button(w, 'Front camera').trigger('click');
    await flushPromises();
    expect(asked).toEqual([['environment', 0], ['user', 0]]);              // nothing open when the front one is asked for
    expect(w.text()).not.toContain('in use by another app');
    expect(calls.replaced.map(t => t.facing)).toEqual(['user']);           // the new track on the sender already sending
    expect(calls.publish).toHaveLength(1);                                  // no new WHIP session
    expect([...open].map(t => t.facing)).toEqual(['user']);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    w.unmount();
  });

  it('brings the camera that was open back when the other one cannot be opened, and says why', async () => {
    phoneBrowser({ noFront: true });
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await button(w, 'Start').trigger('click');
    await flushPromises();
    await button(w, 'Front camera').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('This phone has no such camera');
    expect(calls.replaced.map(t => t.facing)).toEqual(['environment']);    // the back one sends again
    expect(button(w, 'Back camera').attributes('aria-pressed')).toBe('true');
    w.unmount();
  });

  it('shows Record beside Stop sending, asks the server, and shows Recording with its time', async () => {
    phoneBrowser();
    recording = { on: false, unpaid: false, since: null, seconds: null, may: true, said: '', days: 7 };
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(button(w, 'Record')).toBeTruthy();                              // before Start too
    await button(w, 'Start').trigger('click');
    await flushPromises();
    expect(button(w, 'Record')).toBeTruthy();
    expect(button(w, 'Stop sending')).toBeTruthy();
    await button(w, 'Record').trigger('click');
    await flushPromises();
    expect(calls.record).toEqual([[SECRET, true]]);
    expect(w.text()).toMatch(/Recording 0:0\d/);
    await button(w, 'Stop recording').trigger('click');
    await flushPromises();
    expect(calls.record[1]).toEqual([SECRET, false]);
    expect(w.text()).not.toMatch(/Recording 0:/);
    expect(button(w, 'Record')).toBeTruthy();
    w.unmount();
  });

  it("says the server's reason when recording is refused, and shows no Record for a server that does not say", async () => {
    phoneBrowser();
    const off = 'Recording is off for this camera: an Admin turns it on in Cloud Streaming.';
    recording = { on: false, unpaid: false, since: null, seconds: null, may: false, said: off, days: 30 };
    recordRefusal = Object.assign(new Error(off), { status: 403, code: 'recording_off', recording });
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await button(w, 'Record').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toContain(off);
    expect(w.text()).not.toMatch(/Recording \d/);
    w.unmount();
    recording = null;
    const old = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(button(old, 'Record')).toBeUndefined();
    old.unmount();
  });

  it('starts sending again by itself after a reload of a tab that was sending, with its camera, and shows the recording', async () => {
    const { getUserMedia } = phoneBrowser();
    sessionStorage.setItem('tmd.phonecam.state', JSON.stringify({ facing: 'user', sending: true, at: Date.now() }));
    recording = { on: true, unpaid: false, since: '2026-11-18T10:00:00+00:00', seconds: 125, may: true, said: '', days: 30 };
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(getUserMedia).toHaveBeenCalledTimes(1);                         // no tap
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toEqual({ ideal: 'user' });
    expect(calls.publish).toHaveLength(1);
    lastOnState('connected');
    await flushPromises();
    expect(w.find('[role="status"]').text()).toContain('Live');
    expect(w.text()).toMatch(/Recording 2:0\d/);                            // the server's time, after the reload
    expect(button(w, 'Stop recording')).toBeTruthy();
    w.unmount();
  });

  it('never starts by itself after Stop, nor from an old tab', async () => {
    const { getUserMedia } = phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    await button(w, 'Start').trigger('click');
    await flushPromises();
    expect(JSON.parse(sessionStorage.getItem('tmd.phonecam.state')).sending).toBe(true);
    await button(w, 'Stop sending').trigger('click');
    await flushPromises();
    expect(JSON.parse(sessionStorage.getItem('tmd.phonecam.state')).sending).toBe(false);
    w.unmount();
    const again = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(getUserMedia).toHaveBeenCalledTimes(1);                          // the reload after Stop opens nothing
    expect(button(again, 'Start')).toBeTruthy();
    again.unmount();
    sessionStorage.setItem('tmd.phonecam.state', JSON.stringify({ facing: 'environment', sending: true, at: Date.now() - 3 * 60 * 1000 }));
    const old = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(getUserMedia).toHaveBeenCalledTimes(1);                          // said too long ago: a restored tab waits
    old.unmount();
  });

  it('says to tap Start when the browser does not open the camera by itself after a reload', async () => {
    const { getUserMedia } = phoneBrowser();
    getUserMedia.mockImplementationOnce(async () => { throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }); });
    sessionStorage.setItem('tmd.phonecam.state', JSON.stringify({ facing: 'environment', sending: true, at: Date.now() }));
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    expect(w.text()).toContain('Tap Start to send again.');
    expect(button(w, 'Start')).toBeTruthy();
    expect(calls.publish).toHaveLength(0);
    expect(JSON.parse(sessionStorage.getItem('tmd.phonecam.state')).sending).toBe(false);
    await button(w, 'Start').trigger('click');
    await flushPromises();
    expect(calls.publish).toHaveLength(1);
    w.unmount();
  });

  it('sends again in the new shape when the phone turns, on the same camera', async () => {
    phoneBrowser();
    const w = mount(PhoneCameraSend, { props: { secret: SECRET } });
    await flushPromises();
    const video = w.find('video').element;
    const turn = (width, height) => {
      Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
    };
    turn(720, 1280);
    await button(w, 'Start').trigger('click');
    await flushPromises();
    lastOnState('connected');
    await w.find('video').trigger('resize');
    expect(w.text()).toContain('Sending a portrait picture (720 × 1280)');
    turn(1280, 720);
    await w.find('video').trigger('resize');
    await new Promise(resolve => setTimeout(resolve, 900));
    await flushPromises();
    expect(calls.stop).toBe(1);                                             // the old session went first
    expect(calls.publish).toHaveLength(2);
    expect(w.text()).toContain('Sending a landscape picture (1280 × 720)');
    w.unmount();
  });
});
