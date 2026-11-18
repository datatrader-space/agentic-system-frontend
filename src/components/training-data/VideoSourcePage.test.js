// @vitest-environment jsdom
// A saved camera's own page (owner, 2026-11-17, a reference screenshot): the source on the left, what runs on it under
// it, its results on the right; AADML's words. Clicking a source opened a small dialog before.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const calls = [];
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    streamingApi: { ...actual.streamingApi, get: vi.fn(async id => ({ stream: { ...RUNNING, id } })) },
    videoSources: { ...actual.videoSources, recording: vi.fn(async (id, body) => { calls.push(['recording', id, body]); return { said: 'ok' }; }) },
    recordingsApi: {
      list: vi.fn(async query => { calls.push(['list', query]); return { recordings: [REC], may: { delete: true } }; }),
      remove: vi.fn(async id => { calls.push(['remove', id]); return {}; }),
    },
  };
});
const REC = { id: 5, source: { id: 1, name: 'Gate' }, started_at: '2026-11-17T10:05:00+00:00', ended_at: '2026-11-17T10:10:00+00:00',
  bytes: 52428800, play_url: 'https://bucket.example/r.mp4?sig=1', download_url: 'https://bucket.example/r.mp4?sig=2' };
const RECORDING_OFF = { on: false, days: 30, max_days: 30, unpaid: false, stored_bytes: 0, day_price_usd: '0',
  per_gb_month_usd: '0.0312', consent_text: 'I may record this camera.', rtsp_only: true };
import VideoSourcePage from '../../../training-data/src/components/VideoSourcePage.vue';

const HLS = { id: 1, name: 'Test stream (Mux)', kind: 'url', state: 'online', shown_address: 'https://test-streams.mux.dev',
  last_frame_at: new Date().toISOString(), may: {} };
const RUNNING = { id: 9, state: 'running', model: { name: 'fmw-walls', version: '1.0.0' }, project: { name: 'Vision test' },
  fps: 1, frames: 12, frames_failed: 0, max_frames: 0, continuous: true, has_results: true, may: { stop: true },
  last: { frame: 11, t: 11, classes: { walls: 3, doors: 1 } }, recent: [] };

function page(props = {}) {
  return mount(VideoSourcePage, { props: { source: HLS, streamsLoaded: true, ...props }, global: { stubs: { LiveView: true } } });
}

describe('a video source page', () => {
  it('reads like the reference: breadcrumb, name and kind, Source, Model and Results', () => {
    const w = page();
    expect(w.find('.sp-crumbs').text()).toContain('Deployments');
    expect(w.find('.sp-crumbs').text()).toContain('Cloud Streaming');
    expect(w.find('h2').text()).toBe('Test stream (Mux)');
    expect(w.find('.sp-kind').text()).toContain('HLS stream');
    expect(w.findAll('.sp-card-title').map(h => h.text())).toEqual(['Source', 'Model']);
    // Events and Rules on the camera's own page (phase 6); Recordings only where it can record
    expect(w.findAll('[role="tab"]').map(t => t.text())).toEqual(['Results', 'Events', 'Rules']);
    expect(w.text()).toContain('Choose a model to run on this camera, or read its barcodes.');
    expect(w.text()).toContain('Results appear here');
    expect(w.text()).not.toMatch(/Roboflow|Workflow to run/);
  });

  it('plays an RTSP camera inline and shows an HLS one as its newest frame', () => {
    expect(page().findComponent({ name: 'LiveView' }).exists()).toBe(false);
    const rtsp = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com' } });
    expect(rtsp.findComponent({ name: 'LiveView' }).exists()).toBe(true);
    expect(rtsp.find('.sp-kind').text()).toContain('RTSP camera');
  });

  it('runs a model from the page and goes back by the breadcrumb', async () => {
    const w = page();
    const run = w.findAll('button').find(b => b.text().includes('Run a model'));
    await run.trigger('click');
    expect(w.emitted('start')).toHaveLength(1);
    await w.find('.sp-back').trigger('click');
    expect(w.emitted('back')).toHaveLength(1);
    // Phase 6: it opens the Workflow Builder with this camera's events as the trigger (a link, not a disabled button)
    const workflow = w.findAll('a').find(a => a.text().includes('Build a workflow'));
    expect(workflow.attributes('href')).toContain('training.stream_event');
    // It names the camera's own workspace, so the workflow is made there (the owner's decision, 2026-11-18).
    const inWorkspace = page({ source: { ...HLS, workspace: { id: 7, name: 'Site' } } });
    const link = inWorkspace.findAll('a').find(a => a.text().includes('Build a workflow'));
    expect(link.attributes('href')).toContain('workspace=7');
  });

  it('turns cloud recording on only with its consent, for an RTSP camera', async () => {
    const rtsp = { ...HLS, shown_address: 'rtsp://cam.example.com', recording: RECORDING_OFF, may: { record: true } };
    const w = page({ source: rtsp });
    expect(w.find('.sp-rec-line').text()).toBe('Not recording.');
    await w.findAll('button').find(b => b.text().includes('Record to the cloud')).trigger('click');
    expect(w.find('.sp-rec-form').text()).toContain('per GB a month');
    const turnOn = () => w.findAll('button').find(b => b.text() === 'Turn on');
    expect(turnOn().attributes('disabled')).toBeDefined();                // not without the consent
    await w.find('.sp-rec-consent input').setValue(true);
    await w.find('.sp-rec-form select').setValue(7);
    await w.find('.sp-rec-form').trigger('submit');
    await flushPromises();
    expect(calls.at(-1)).toEqual(['recording', 1, { on: true, days: 7, consent: true }]);
    expect(w.emitted('refresh')).toHaveLength(1);
    // an HLS camera cannot be recorded (the relay plays rtsp:// only)
    const hls = page({ source: { ...HLS, recording: RECORDING_OFF, may: { record: true } } });
    expect(hls.findAll('button').find(b => b.text().includes('Record to the cloud')).attributes('disabled')).toBeDefined();
  });

  it('lists a day of recordings, plays one and deletes one', async () => {
    const fresh = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true, days: 1 } } });
    expect(fresh.find('.sp-rec-line').text()).toMatch(/^Recording to the cloud\. Kept 1 day, nothing kept yet/);   // was "0.1 MB kept"
    const w = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true, stored_bytes: 52428800 } } });
    await w.findAll('[role="tab"]').find(t => t.text() === 'Recordings').trigger('click');
    await flushPromises();
    expect(calls.find(c => c[0] === 'list')[1]).toMatchObject({ source: 1 });
    expect(w.find('.sp-rec-list').text()).toContain('10:05 to 10:10 UTC');
    expect(w.find('.sp-rec-list').text()).toContain('50.0 MB');
    await w.findAll('button').find(b => b.text().includes('Play')).trigger('click');
    expect(w.find('video.sp-player').attributes('src')).toBe(REC.play_url);
    await w.find('[aria-label^="Delete the recording"]').trigger('click');
    await flushPromises();
    expect(calls.some(c => c[0] === 'remove' && c[1] === 5)).toBe(true);
    w.unmount();
  });

  it('shows the running stream: its model, the newest counts by class, and Stop', async () => {
    const w = page({ streams: [RUNNING] });
    await flushPromises();
    expect(w.text()).toContain('fmw-walls');
    expect(w.text()).toContain('Frame 12');
    const counts = Object.fromEntries(w.findAll('.sp-count').map(c => [c.find('.sp-what').text(), c.find('.sp-num').text()]));
    expect(counts).toMatchObject({ walls: '3', doors: '1' });
    const stop = w.findAll('button').find(b => b.text().trim() === 'Stop');
    await stop.trigger('click');
    expect(w.emitted('stop-stream')[0][0].id).toBe(9);
    expect(w.findAll('button').some(b => b.text().includes('Run a model'))).toBe(false);
    w.unmount();
  });
});
