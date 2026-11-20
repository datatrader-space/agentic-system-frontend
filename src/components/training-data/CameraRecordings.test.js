// @vitest-environment jsdom
// The Deployments page's Recordings tab (the owner, 2026-11-18): every kept recording, a removed camera's too, with a
// camera filter; Play asks for new links when the list is older than 10 minutes; a recording the browser cannot play
// says so with its download; an Admin deletes one after confirming.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REC = (id, source, removed = false, minute = 10) => ({
  id, source: { id: source, name: source === 4 ? 'Gate' : 'Dock', removed },
  started_at: `2026-11-18T14:${minute}:00+00:00`, ended_at: `2026-11-18T14:${minute + 5}:00+00:00`, seconds: 300,
  bytes: 80 * 1024 ** 2, kept_until: '2026-11-25T14:10:00+00:00',
  play_url: `https://bucket.example/rec-${id}.mp4?sig=${calls.list.length}`, download_url: `https://bucket.example/rec-${id}.mp4?dl=1`,
});
const calls = { list: [], removed: [], restored: [] };
let mayDelete = true;
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return { ...actual, recordingsApi: {
    list: vi.fn(async options => {
      calls.list.push(options);
      const all = [REC(3, 9, false, 20), REC(2, 4, true, 15), REC(1, 4, true, 10)].map(r => (
        calls.removed.includes(r.id) && !calls.restored.includes(r.id)
          ? { ...r, deletion: { on: '2026-12-03T08:00:00+00:00', since: '2026-11-19T08:00:00+00:00', reason: 'deleted' } } : { ...r, deletion: null }));
      let rows = options.source ? all.filter(r => String(r.source.id) === String(options.source)) : all;
      if (options.state === 'scheduled') rows = rows.filter(r => r.deletion);
      return { recordings: rows, count: rows.length, offset: 0, stored_bytes: 240 * 1024 ** 2, limit_bytes: 50 * 1024 ** 3,
        grace_days: 14, scheduled: all.filter(r => r.deletion).length,
        cameras: [{ id: 9, name: 'Dock', removed: false, recordings: 1, bytes: 1 }, { id: 4, name: 'Gate', removed: true, recordings: 2, bytes: 2 }],
        may: { delete: mayDelete } };
    }),
    remove: vi.fn(async id => { calls.removed.push(id); return { deleted: id, said: 'The recording is deleted on 03 Dec 2026. Until then it can be restored.' }; }),
    restore: vi.fn(async id => { calls.restored.push(id); return { said: 'The recording is restored.' }; }),
  } };
});
import CameraRecordings from '../../../training-data/src/components/CameraRecordings.vue';

const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));

describe('the Recordings tab', () => {
  beforeEach(() => { calls.list = []; calls.removed = []; calls.restored = []; mayDelete = true; });
  afterEach(() => { vi.useRealTimers(); });

  it("lists every recording, a removed camera's marked, and filters by camera", async () => {
    const w = mount(CameraRecordings);
    await flushPromises();
    const items = w.findAll('.recs-list li');
    expect(items).toHaveLength(3);
    expect(items[1].text()).toContain('Gate');
    expect(items[1].text()).toContain('Removed');
    expect(items[0].text()).not.toContain('Removed');
    expect(items[0].text()).toContain('18 Nov 2026, 14:20 to 14:25 UTC');
    expect(items[0].text()).toContain('Kept until 25 Nov 2026');
    expect(w.text()).toContain('240.0 MB of 50.0 GB kept');
    const options = w.findAll('select')[0].findAll('option').map(o => o.text());
    expect(options).toEqual(['All cameras', 'Dock: 1 recording', 'Gate (removed): 2 recordings']);
    await w.find('select').setValue('4');
    await flushPromises();
    expect(calls.list.at(-1).source).toBe('4');
    expect(w.findAll('.recs-list li')).toHaveLength(2);
  });

  it('plays with the links it has, and asks for new ones when the list is older than 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T07:00:00Z'));
    const w = mount(CameraRecordings);
    await flushPromises();
    await button(w, 'Play').trigger('click');
    await flushPromises();
    expect(calls.list).toHaveLength(1);
    expect(w.find('video').attributes('src')).toBe('https://bucket.example/rec-3.mp4?sig=1');
    vi.setSystemTime(new Date('2026-11-19T07:11:00Z'));                     // 11 minutes later
    await button(w, 'Play').trigger('click');
    await flushPromises();
    expect(calls.list).toHaveLength(2);                                     // new links first
    expect(w.find('video').attributes('src')).toBe('https://bucket.example/rec-3.mp4?sig=2');
  });

  it('says a recording the browser cannot play, with its download', async () => {
    const w = mount(CameraRecordings);
    await flushPromises();
    await button(w, 'Play').trigger('click');
    await flushPromises();
    await w.find('video').trigger('error');
    expect(w.text()).toContain('could not be played in this browser');
    expect(w.find('.recs-player a').attributes('href')).toBe('https://bucket.example/rec-3.mp4?dl=1');
  });

  it('an Admin deletes one after confirming: it stays listed 14 days, free, and Cancel deletion restores it', async () => {
    const w = mount(CameraRecordings);
    await flushPromises();
    expect(w.text()).toContain('kept 14 more days, free, and can be restored');
    const del = () => w.findAll('.recs-danger')[0];
    await del().trigger('click');
    expect(calls.removed).toEqual([]);                                      // asks first
    expect(del().text()).toContain('Delete? Kept 14 days first');
    await del().trigger('click');
    await flushPromises();
    expect(calls.removed).toEqual([3]);
    expect(w.text()).toContain('Until then it can be restored');
    const items = w.findAll('.recs-list li');
    expect(items).toHaveLength(3);                                          // still listed
    expect(items[0].classes()).toContain('waiting');
    expect(items[0].text()).toContain('Deletes on 3 Dec 2026');
    expect(items[0].text()).toContain('Scheduled for deletion: deleted by a person');
    expect(items[0].find('.recs-danger').exists()).toBe(false);
    await w.findAll('select')[1].setValue('scheduled');
    await flushPromises();
    expect(calls.list.at(-1).state).toBe('scheduled');
    expect(w.findAll('.recs-list li')).toHaveLength(1);
    await w.find('.recs-restore').trigger('click');
    await flushPromises();
    expect(calls.restored).toEqual([3]);
    expect(w.text()).toContain('The recording is restored.');
    mayDelete = false;
    const other = mount(CameraRecordings);
    await flushPromises();
    expect(other.findAll('.recs-danger')).toHaveLength(0);
  });
});
