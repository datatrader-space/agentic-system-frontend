// @vitest-environment jsdom
// A stream's annotated video (VISION_WORKFLOWS_PLAN.md 5.3, ADM-1351 phase 3): "Making the annotated video…" while it
// is made, the error in words when it failed, and when it is ready a player that asks AADML for its link only when the
// person opens it (never in the row), with preload="none", a download link, and a new link once the old one is over.
// A failed ask is shown with Try again.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const asked = [];
const state = { answer: null, fail: null };
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    streamingApi: {
      ...actual.streamingApi,
      video: vi.fn(async id => {
        asked.push(id);
        if (state.fail) { const e = state.fail; state.fail = null; throw e; }
        return state.answer;
      }),
    },
  };
});
import AnnotatedVideo from '../../../training-data/src/components/AnnotatedVideo.vue';

const stream = video => ({ id: 41, source: 'yard.mp4', annotated_video: video });

describe('the annotated video of a stream', () => {
  beforeEach(() => { asked.length = 0; state.answer = { url: 'https://aadml.example/media/v/41.mp4?sig=a', expires_in: 900 }; state.fail = null; });
  afterEach(() => { vi.useRealTimers(); });

  it('shows nothing for a stream that makes none', () => {
    const w = mount(AnnotatedVideo, { props: { stream: stream(null) } });
    expect(w.find('[data-test="annotated-video"]').exists()).toBe(false);
  });

  it('says it is being made while the stream runs, and asks for nothing', () => {
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'making', frames: 0, error: '' }) } });
    expect(w.text()).toContain('Making the annotated video…');
    expect(w.find('[role="status"]').exists()).toBe(true);
    expect(w.find('video').exists()).toBe(false);
    expect(asked).toEqual([]);
  });

  it('says why it could not be made, in words', () => {
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'failed', frames: 0, error: 'The video could not be encoded.' }) } });
    expect(w.text()).toContain('The annotated video could not be made: The video could not be encoded.');
    expect(w.find('video').exists()).toBe(false);
  });

  it('when ready, asks for the link only when opened, then plays it with preload none and offers the download', async () => {
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'ready', frames: 60, error: '' }) } });
    expect(w.text()).toContain('Annotated video ready, 60 frames.');
    expect(w.text()).toContain('no sound and no captions');
    expect(asked).toEqual([]);
    await w.find('[data-test="av-open"]').trigger('click');
    await flushPromises();
    expect(asked).toEqual([41]);
    const video = w.find('[data-test="av-player"]');
    expect(video.attributes('src')).toBe('https://aadml.example/media/v/41.mp4?sig=a');
    expect(video.attributes('preload')).toBe('none');
    expect(video.attributes('controls')).toBeDefined();
    expect(video.attributes('aria-label')).toContain('yard.mp4');
    const link = w.find('[data-test="av-download"]');
    expect(link.attributes('href')).toBe('https://aadml.example/media/v/41.mp4?sig=a');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.attributes('download')).toBeDefined();
  });

  it('asks for a new link once the old one is over, before a play', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'ready', frames: 60, error: '' }) } });
    await w.find('[data-test="av-open"]').trigger('click');
    await flushPromises();
    vi.advanceTimersByTime(15 * 60 * 1000);
    await flushPromises();
    expect(w.find('[data-test="av-download"]').exists()).toBe(false);          // an over link is never offered
    expect(w.text()).toContain('The link is over');
    state.answer = { url: 'https://aadml.example/media/v/41.mp4?sig=b', expires_in: 900 };
    const el = w.find('video').element;
    el.pause = vi.fn(); el.load = vi.fn();
    await w.find('video').trigger('play');
    await flushPromises();
    expect(asked).toEqual([41, 41]);
    expect(el.pause).toHaveBeenCalled();
    expect(w.find('video').attributes('src')).toBe('https://aadml.example/media/v/41.mp4?sig=b');
    expect(w.find('[data-test="av-download"]').attributes('href')).toBe('https://aadml.example/media/v/41.mp4?sig=b');
  });

  it('shows a failed ask with Try again, which asks again', async () => {
    state.fail = Object.assign(new Error('This stream has no annotated video.'), { status: 404 });
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'ready', frames: 60, error: '' }) } });
    await w.find('[data-test="av-open"]').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toContain('This stream has no annotated video.');
    expect(w.find('video').exists()).toBe(false);
    await w.find('[data-test="av-retry"]').trigger('click');
    await flushPromises();
    expect(asked).toEqual([41, 41]);
    expect(w.find('[data-test="av-player"]').exists()).toBe(true);
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });

  it('refuses a link that is not a web address', async () => {
    state.answer = { url: 'javascript:alert(1)', expires_in: 900 };
    const w = mount(AnnotatedVideo, { props: { stream: stream({ state: 'ready', frames: 2, error: '' }) } });
    await w.find('[data-test="av-open"]').trigger('click');
    await flushPromises();
    expect(w.find('video').exists()).toBe(false);
    expect(w.find('[role="alert"]').text()).toContain('did not send a link');
  });
});
