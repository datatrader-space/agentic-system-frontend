// @vitest-environment jsdom
// A phone camera's own page (CLOUD_STREAMING_PLAN.md §16): it names the camera, Start opens the back camera and sends it
// to the WHIP address the server gave with the link's secret, Live is said once the connection is up, Stop ends the
// session and the camera, and a refused link is said and not retried.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'Abc_def-0123456789xyzABCDEFGHIJKLMNOPQRSTUV';
const calls = { publish: [], stop: 0 };
let refuse = false; let lastOnState = null; let linkGone = false;
vi.mock('../../../training-data/src/api/phone.js', async (real) => ({
  ...(await real()),
  phoneCameraApi: { info: vi.fn(async () => {
    if (linkGone) throw Object.assign(new Error('This phone link has ended. Make a new one on the camera page in AADML.'), { status: 403 });
    return { name: 'Dock phone', expires_at: '2026-11-25T12:00:00+00:00', whip: '/live-publish/src14/whip' };
  }) },
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
      return { pc: { connectionState: 'connecting' }, sender: { replaceTrack: vi.fn() }, codec: 'H264', stop: () => { calls.stop += 1; } };
    }),
  };
});
import PhoneCameraSend from '../../../training-data/src/components/PhoneCameraSend.vue';

function phoneBrowser() {
  const stopped = [];
  const track = { readyState: 'live', stop: () => { stopped.push(track); }, addEventListener: () => {} };
  const getUserMedia = vi.fn(async () => ({ getVideoTracks: () => [track], getTracks: () => [track] }));
  globalThis.RTCPeerConnection = function RTCPeerConnection() {};
  Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
  return { getUserMedia, stopped };
}

afterEach(() => { calls.publish = []; calls.stop = 0; refuse = false; lastOnState = null; linkGone = false; });

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
});
