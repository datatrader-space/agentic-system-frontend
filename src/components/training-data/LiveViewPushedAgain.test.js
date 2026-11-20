// @vitest-environment jsdom
// A pushed camera's live view (LiveView.vue; CLOUD_STREAMING_PLAN.md §16.1): when its stream ends while it plays (a
// phone turned and sent again in its new shape, or its sender reconnected), the player waits for the video again by
// itself instead of stopping on "Try again"; a camera address still fails as before.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const players = [];
vi.mock('hls.js', () => {
  class Hls {
    static isSupported() { return true; }
    constructor() { this.handlers = {}; players.push(this); }
    on(name, fn) { this.handlers[name] = fn; }
    loadSource() {}
    attachMedia() {}
    destroy() { this.destroyed = true; }
  }
  Hls.Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'error', LEVEL_LOADED: 'levelLoaded' };
  return { default: Hls };
});
const live = vi.fn(async () => ({ playlist: '/live/src9/index.m3u8', token: 'view-token', expires_in: 300, ready: true }));
vi.mock('../../../training-data/src/api/streaming.js', async (real) => ({ ...(await real()), videoSources: { live: (...args) => live(...args) } }));
import LiveView from '../../../training-data/src/components/LiveView.vue';

afterEach(() => { players.length = 0; live.mockClear(); vi.useRealTimers(); });

async function playThenEnd(kind) {
  window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
  window.HTMLMediaElement.prototype.pause = vi.fn();
  const w = mount(LiveView, { props: { source: { id: 9, name: 'Dock phone', kind, address: 'rtsp://cam.example.com/x' }, inline: true } });
  await flushPromises();
  expect(players).toHaveLength(1);
  players[0].handlers.manifestParsed();
  players[0].handlers.error(null, { fatal: true, type: 'networkError', details: 'levelLoadError' });
  await flushPromises();
  return w;
}

describe('a pushed camera whose stream ends while it plays', () => {
  it('is waited for again by itself, with a new player', async () => {
    vi.useFakeTimers();
    const w = await playThenEnd('phone');
    expect(w.text()).toContain('The phone turned or reconnected: waiting for its video');
    expect(w.text()).not.toContain('Try again');
    expect(players[0].destroyed).toBe(true);
    await vi.advanceTimersByTimeAsync(2100);
    await flushPromises();
    expect(live).toHaveBeenCalledTimes(2);
    expect(players).toHaveLength(2);
    w.unmount();
  });

  it('still fails with Try again for a camera address', async () => {
    const w = await playThenEnd('url');
    expect(w.text()).toContain('Try again');
    w.unmount();
  });

  it('plays again when the relay gives a new init segment (a new stream after the phone turned)', async () => {
    vi.useFakeTimers();
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
    window.HTMLMediaElement.prototype.pause = vi.fn();
    const w = mount(LiveView, { props: { source: { id: 9, name: 'Dock phone', kind: 'phone' }, inline: true } });
    await flushPromises();
    const level = name => ({ details: { fragments: [{ initSegment: { relurl: name } }] } });
    players[0].handlers.manifestParsed();
    players[0].handlers.levelLoaded(null, level('aa_video1_init.mp4'));
    players[0].handlers.levelLoaded(null, level('aa_video1_init.mp4'));
    await flushPromises();
    expect(players[0].destroyed).toBeUndefined();                          // the same stream: nothing happens
    players[0].handlers.levelLoaded(null, level('bb_video1_init.mp4'));
    await flushPromises();
    expect(players[0].destroyed).toBe(true);
    await vi.advanceTimersByTimeAsync(2100);
    await flushPromises();
    expect(players).toHaveLength(2);
    w.unmount();
  });
});
