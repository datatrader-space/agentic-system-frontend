// @vitest-environment jsdom
// A saved camera's own page (owner, 2026-11-17, a reference screenshot): the source on the left, what runs on it under
// it, its results on the right; AADML's words. Clicking a source opened a small dialog before.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return { ...actual, streamingApi: { ...actual.streamingApi, get: vi.fn(async id => ({ stream: { ...RUNNING, id } })) } };
});
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
    expect(w.findAll('.sp-card-title').map(h => h.text())).toEqual(['Source', 'Model', 'Results']);
    expect(w.text()).toContain('Choose a model to run on this camera.');
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
    const workflow = w.findAll('button').find(b => b.text().includes('Build a workflow'));
    expect(workflow.attributes('disabled')).toBeDefined();                // workflows on cameras come later
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
