// @vitest-environment jsdom
// A saved camera's own page (owner, 2026-11-17, a reference screenshot): the source on the left, what runs on it under
// it, its results on the right; AADML's words. Clicking a source opened a small dialog before.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const calls = [];
// What the page reads when it reads its stream again (a test may set its own).
const read = { stream: null };
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    streamingApi: { ...actual.streamingApi, get: vi.fn(async id => ({ stream: { ...(read.stream || RUNNING), id } })) },
    videoSources: {
      ...actual.videoSources,
      recording: vi.fn(async (id, body) => { calls.push(['recording', id, body]); return { said: 'ok' }; }),
      rotateKey: vi.fn(async id => { calls.push(['rotate', id]); return { said: 'Drone has a new stream key.', source: { id, push: { ...PUSH, stream_key: NEW_KEY, url: `${PUSH.server}${NEW_KEY}` } } }; }),
    },
    // The camera's rules (ADM-1351 phase 2: the "time in a zone" kind).
    streamRules: {
      ...actual.streamRules,
      list: vi.fn(async () => RULES_PAGE),
      presets: vi.fn(async () => ({ presets: [] })),
      add: vi.fn(async (id, body) => { calls.push(['addRule', id, body]); return { ...RULES_PAGE, said: 'Rule added.' }; }),
    },
    recordingsApi: {
      list: vi.fn(async query => { calls.push(['list', query]); return { recordings: [REC], may: { delete: true }, live: making ? [making] : [], recording_cameras: making ? 1 : 0 }; }),
      remove: vi.fn(async id => { calls.push(['remove', id]); return {}; }),
    },
  };
});
let making = null;                                          // the recording being made (``live``), if any
const PUSH = { server: 'rtmps://ingest.aadml.com:1936/', path: 'src3', available: true, key_set_at: '2026-11-18T09:00:00+00:00' };
const NEW_KEY = 'src3?user=src3&pass=NewKey_0123456789abcdefghijklmnopqrstuvw';
const REC = { id: 5, source: { id: 1, name: 'Gate' }, started_at: '2026-11-17T10:05:00+00:00', ended_at: '2026-11-17T10:10:00+00:00',
  bytes: 52428800, play_url: 'https://bucket.example/r.mp4?sig=1', download_url: 'https://bucket.example/r.mp4?sig=2',
  seconds: 300, motion: true, thumbnail_url: 'https://bucket.example/r.jpg?sig=3' };
const RECORDING_OFF = { on: false, days: 30, max_days: 30, unpaid: false, stored_bytes: 0, day_price_usd: '0',
  per_gb_month_usd: '0.0312', consent_text: 'I may record this camera.', rtsp_only: true };
const RULES_PAGE = { rules: [], classes: ['person'], detector_classes: [], zones: [{ id: 4, name: 'Desk 1' }], lines: [],
  kinds: [{ key: 'seen', label: 'Seen' }, { key: 'dwell', label: 'Each one stays in a zone (time in zone, one event per object)' }],
  timed: { min: 10, max: 86400 }, alerts: [], vision_models: [], devices: [],
  limits: { rules: 20, cooldown_min: 10, cooldown_default: 60, cooldown_max: 86400, count_max: 1000 }, may: { change: true } };
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
    // Events, Rules and Zones on the camera's own page (phase 6, SMART_CAMERA_AI_PLAN Phase A); Recordings only where it can record
    expect(w.findAll('[role="tab"]').map(t => t.text())).toEqual(['Results', 'Events', 'Rules', 'Zones']);
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

  it('records only when there is motion, with its sensitivity and quiet seconds (ADM-1350)', async () => {
    const MOTION = { mode: 'always', modes: [{ value: 'always', label: 'All the time' }, { value: 'motion', label: 'Only when there is motion' }],
      sensitivity: 'medium', sensitivities: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }],
      quiet_seconds: 30, quiet_min: 10, quiet_max: 300, pre_roll: 5, moving: false };
    const rtsp = { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, motion: MOTION }, may: { record: true } };
    const w = page({ source: rtsp });
    await w.findAll('button').find(b => b.text().includes('Record to the cloud')).trigger('click');
    expect(w.find('[data-test="sp-rec-sens"]').exists()).toBe(false);        // all the time: nothing of motion
    await w.find('[data-test="sp-rec-mode-motion"]').setValue(true);
    expect(w.find('.sp-rec-form').text()).toContain('5 seconds before it starts');
    await w.find('[data-test="sp-rec-sens"]').setValue('high');
    await w.find('[data-test="sp-rec-quiet"]').setValue(60);
    await w.find('.sp-rec-consent input').setValue(true);
    await w.find('.sp-rec-form').trigger('submit');
    await flushPromises();
    expect(calls.at(-1)).toEqual(['recording', 1, { on: true, days: 30, consent: true, mode: 'motion', sensitivity: 'high', quiet_seconds: 60 }]);
    const on = page({ source: { ...rtsp, recording: { ...RECORDING_OFF, on: true, motion: { ...MOTION, mode: 'motion', moving: true } } } });
    expect(on.find('.sp-rec-line').text()).toMatch(/^Recording to the cloud when there is motion \(motion now\)\./);
    await on.findAll('button').find(b => b.text() === 'Recording settings').trigger('click');
    await on.find('[data-test="sp-rec-mode-always"]').setValue(true);
    await on.find('.sp-rec-form').trigger('submit');
    await flushPromises();
    expect(calls.at(-1)).toEqual(['recording', 1, { days: 30, mode: 'always' }]);
    w.unmount(); on.unmount();
  });

  it('lists a day of recordings, plays one and deletes one', async () => {
    const fresh = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true, days: 1 } } });
    expect(fresh.find('.sp-rec-line').text()).toMatch(/^Recording to the cloud\. Kept 1 day, nothing kept yet/);   // was "0.1 MB kept"
    const w = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true, stored_bytes: 52428800 } } });
    await w.findAll('[role="tab"]').find(t => t.text() === 'Recordings').trigger('click');
    await flushPromises();
    expect(calls.find(c => c[0] === 'list')[1]).toMatchObject({ source: 1 });
    expect(w.find('.sp-rec-cards').text()).toContain('10:05 to 10:10 UTC');
    expect(w.find('.sp-rec-cards').text()).toContain('50.0 MB');
    // A video card as Cloud Streaming's Recordings (2026-11-23): its picture, its length, Motion when it is a burst.
    const card = w.find('[data-test="sp-rec-card-5"]');
    expect(card.find('[data-test="rec-picture"]').attributes('src')).toBe(REC.thumbnail_url);
    expect(card.find('[data-test="rec-length"]').text()).toBe('5:00');
    expect(card.text()).toContain('Motion');
    await w.findAll('button').find(b => b.text().includes('Play')).trigger('click');
    expect(w.find('video.sp-player').attributes('src')).toBe(REC.play_url);
    await w.find('[aria-label^="Delete the recording"]').trigger('click');
    await flushPromises();
    expect(calls.some(c => c[0] === 'remove' && c[1] === 5)).toBe(true);
    w.unmount();
  });

  it("says what the camera sends, and a phone camera's quality and frames a second are chosen in its recording settings", async () => {
    const QUALITY = { choosable: true, sends_text: '1280x720 (0.9 MP), 25 frames a second, H264, 2.4 Mbit/s',
      can_text: '1920x1080 (2.1 MP) at 30 frames a second', quality: '720p', fps: 25,
      qualities: [{ value: '480p', label: '480p (854x480, 0.4 MP)' }, { value: '720p', label: '720p (1280x720, 0.9 MP)' }, { value: '1080p', label: '1080p (1920x1080, 2.1 MP)' }],
      fps_choices: [5, 10, 15, 20, 25, 30] };
    const phone = { ...HLS, kind: 'phone', shown_address: 'Phone browser (WebRTC)', recording: { ...RECORDING_OFF, on: true, quality: QUALITY }, may: { record: true } };
    const w = page({ source: phone });
    expect(w.get('[data-test="sp-rec-sends"]').text()).toBe('Sends 1280x720 (0.9 MP), 25 frames a second, H264, 2.4 Mbit/s. Its camera can send up to 1920x1080 (2.1 MP) at 30 frames a second.');
    await w.findAll('button').find(b => b.text() === 'Recording settings').trigger('click');
    expect(w.get('[data-test="sp-rec-q"]').element.value).toBe('720p');
    await w.get('[data-test="sp-rec-q"]').setValue('1080p');
    await w.get('[data-test="sp-rec-fps"]').setValue(30);
    await w.find('.sp-rec-form').trigger('submit');
    await flushPromises();
    expect(calls.at(-1)).toEqual(['recording', 1, { days: 30, quality: '1080p', video_fps: 30 }]);
    // A camera address: what it sends, and where to choose less; nothing to choose here.
    const camera = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true,
      quality: { choosable: false, sends_text: '2560x1440 (3.7 MP), 15 frames a second, H265, 4.1 Mbit/s', note: "Recorded as the camera sends it. Choose less in the camera's own settings." } } } });
    expect(camera.get('[data-test="sp-rec-sends"]').text()).toContain('2560x1440 (3.7 MP)');
    await camera.findAll('button').find(b => b.text() === 'Recording settings').trigger('click');
    expect(camera.find('[data-test="sp-rec-q"]').exists()).toBe(false);
    expect(camera.find('.sp-rec-form').text()).toContain("camera's own settings");
    w.unmount(); camera.unmount();
  });

  it('lists the recording being made first, growing, playable, and asks again while the camera records', async () => {
    vi.useFakeTimers();
    making = { id: 'live-1', live: true, source: { id: 1, name: 'Gate' }, started_at: '2026-11-24T06:40:00+00:00',
      ended_at: '2026-11-24T06:40:15+00:00', seconds: 15, motion: true, deletion: null, thumbnail_url: null,
      play_url: '/api/training-data/app/workspace/recordings/live/t1/' };
    const w = page({ source: { ...HLS, shown_address: 'rtsp://cam.example.com', recording: { ...RECORDING_OFF, on: true, stored_bytes: 1 } } });
    await w.findAll('[role="tab"]').find(t => t.text() === 'Recordings').trigger('click');
    await flushPromises();
    const cards = w.findAll('.sp-rec-cards li');
    expect(cards.map(c => c.attributes('data-test'))).toEqual(['sp-rec-card-live-1', 'sp-rec-card-5']);
    expect(cards[0].get('[data-test="rec-live"]').text()).toBe('Recording');
    expect(cards[0].get('[data-test="rec-length"]').text()).toBe('0:15');
    expect(cards[0].text()).toContain('06:40 UTC to now');
    expect(cards[0].find('[aria-label^="Delete the recording"]').exists()).toBe(false);
    making = { ...making, seconds: 25 };
    const asked = calls.filter(c => c[0] === 'list').length;
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(calls.filter(c => c[0] === 'list').length).toBe(asked + 1);
    expect(w.get('[data-test="sp-rec-card-live-1"] [data-test="rec-length"]').text()).toBe('0:25');
    await w.get('[data-test="sp-rec-card-live-1"] button.recs-thumb').trigger('click');
    expect(w.get('video.sp-player').attributes('src')).toBe(making.play_url);
    making = null;
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(w.find('[data-test="sp-rec-card-live-1"]').exists()).toBe(false);
    expect(w.find('video.sp-player').exists()).toBe(true);          // what was being played keeps playing
    w.unmount();
    vi.useRealTimers();
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
  it('shows a stream a workflow answers: "Workflow: <name> v<version>" and its counts, as for a detector (ADM-1351)', async () => {
    const byWorkflow = { ...RUNNING, model: null, workflow: { id: 12, name: 'Desk watch', version: 3 },
      last: { frame: 11, t: 11, objects: [{ class: 'person', score: 0.9, box: [0.1, 0.2, 0.3, 0.4] }], classes: { person: 2 } } };
    read.stream = byWorkflow;
    const w = page({ streams: [byWorkflow] });
    await flushPromises();
    read.stream = null;
    expect(w.find('.sp-model-name').text()).toBe('Workflow: Desk watch v3');
    const counts = Object.fromEntries(w.findAll('.sp-count').map(c => [c.find('.sp-what').text(), c.find('.sp-num').text()]));
    expect(counts).toMatchObject({ person: '2' });
    w.unmount();
  });

  it('adds a "time in a zone" rule: seconds and a zone, no count; the zone is asked for first (ADM-1351)', async () => {
    calls.length = 0;
    const w = page();
    await w.findAll('[role="tab"]').find(t => t.text() === 'Rules').trigger('click');
    await flushPromises();
    await w.findAll('button').find(b => b.text().includes('Add a rule')).trigger('click');
    const form = w.find('form.sp-rule-form');
    const kind = form.find('select');
    expect(kind.findAll('option').map(o => o.text())).toEqual(['Seen', 'Time in a zone']);
    await kind.setValue('dwell');
    const labels = form.findAll('.sp-rule-fields label').map(l => l.text());
    expect(labels.some(t => t.startsWith('At least (seconds)'))).toBe(true);
    // No count: a dwell rule follows each object on its own.
    expect(form.find('input[type="number"][min="1"]').exists()).toBe(false);
    const zone = form.findAll('select').find(sel => sel.findAll('option').some(o => o.text() === 'In Desk 1'));
    expect(zone.findAll('option').map(o => o.text())).toEqual(['Choose a zone', 'In Desk 1']);
    expect(zone.attributes('aria-required')).toBe('true');
    await form.trigger('submit');
    await flushPromises();
    expect(form.text()).toContain('Choose the zone each object stays in.');
    expect(calls.filter(c => c[0] === 'addRule')).toHaveLength(0);
    await zone.setValue('4');
    await form.find('input[type="number"][max="86400"]').setValue('45');
    await form.trigger('submit');
    await flushPromises();
    expect(calls.find(c => c[0] === 'addRule')).toEqual(['addRule', 1, { class_name: 'person', cooldown_seconds: 60, zone: 4, kind: 'dwell', seconds: 45, alert: 'managers' }]);
    w.unmount();
  });

  it('shows where an RTMP stream sends, never its key, and rotates the key only after asking', async () => {
    const source = { id: 3, name: 'Drone', kind: 'rtmp', state: 'offline', shown_address: 'rtmps://ingest.aadml.com:1936',
      push: PUSH, may: { change: true, rotate: true }, recording: RECORDING_OFF };
    const w = page({ source, may: { change: true, rotate: true } });
    expect(w.find('.sp-kind').text()).toContain('RTMP stream');
    expect(w.findComponent({ name: 'LiveView' }).exists()).toBe(true);            // the relay plays a push
    const push = w.find('.sp-push');
    expect(push.text()).toContain('Send to AADML');
    expect(push.find('#sp-push-server').element.value).toBe('rtmps://ingest.aadml.com:1936/');
    expect(push.find('#sp-push-key').exists()).toBe(false);                        // shown once, never again
    expect(push.text()).toContain('shown once');
    await push.findAll('button').find(b => b.text().includes('Rotate key')).trigger('click');
    expect(calls.some(c => c[0] === 'rotate')).toBe(false);                        // asked first
    expect(w.find('.sp-rotate-ask').text()).toContain('stops working now');
    await w.find('.sp-rotate-ask').findAll('button').find(b => b.text().includes('Rotate key')).trigger('click');
    await flushPromises();
    expect(calls).toContainEqual(['rotate', 3]);
    expect(w.find('#sp-push-key').element.value).toBe(NEW_KEY);
    expect(w.find('#sp-push-url').element.value).toBe(`rtmps://ingest.aadml.com:1936/${NEW_KEY}`);
    expect(w.find('.pd-warn').text()).toContain('Keep the stream key secret');
    expect(w.emitted('refresh')).toBeTruthy();
    w.unmount();
  });

  it('offers no key rotation to someone who may not change the camera', () => {
    const source = { id: 3, name: 'Drone', kind: 'rtmp', state: 'online', push: PUSH, may: { change: false, rotate: false } };
    const w = page({ source, may: { change: false, rotate: false } });
    expect(w.find('.sp-push').exists()).toBe(true);
    expect(w.find('.sp-push').findAll('button').some(b => b.text().includes('Rotate key'))).toBe(false);
    w.unmount();
  });
});
