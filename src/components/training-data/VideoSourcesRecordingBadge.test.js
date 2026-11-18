// @vitest-environment jsdom
// Cloud Streaming after a reload (live, 2026-11-18): a camera that records says so in the list ("● Recording"), and the
// camera that was open in this tab opens again, so its card shows "Stop recording" instead of looking as if nothing
// happened.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROW = { id: 9, name: 'sajidphone', kind: 'phone', kind_label: 'Phone camera', state: 'online', state_label: 'Online',
  address: '', public: false, shared: false, recording_on: true, may: { change: true, remove: true, check: true } };
const get = vi.fn(async () => ({ source: { ...ROW, recording: { on: true, days: 1, stored_bytes: 10, consent_text: '' }, streams: [] } }));
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return { ...actual, videoSources: { ...actual.videoSources,
    list: vi.fn(async () => ({ sources: [ROW, { ...ROW, id: 10, name: 'Gate', recording_on: false }], summary: {},
      limits: { sources: 10, streams: 2 }, may: { add: true } })),
    get: (...a) => get(...a) } };
});
vi.mock('../../../training-data/src/api/machines.js', async (real) => ({
  ...(await real()), machinesApi: { list: vi.fn(async () => ({ machines: [], available: true, may_manage: true })) },
}));
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const STUBS = { UiDialog: true, LiveView: true, VideoSourcePage: { props: ['source'], template: '<div class="page-stub">{{ source.name }}</div>' } };

describe('a recording camera after a reload', () => {
  beforeEach(() => { get.mockClear(); sessionStorage.clear(); });

  it('shows Recording on its row only', async () => {
    const w = mount(VideoSources, { global: { stubs: STUBS } });
    await flushPromises();
    const badges = w.findAll('.vs-recording-badge');
    expect(badges.length).toBe(1);
    expect(badges[0].text()).toBe('● Recording');
  });

  it('opens again the camera that was open in this tab, and forgets it once closed', async () => {
    sessionStorage.setItem('tmd.videoSources.open', '9');
    const w = mount(VideoSources, { global: { stubs: STUBS } });
    await flushPromises();
    expect(get).toHaveBeenCalledWith(9);
    expect(w.find('.page-stub').text()).toBe('sajidphone');
    w.vm.closeDetail();
    expect(sessionStorage.getItem('tmd.videoSources.open')).toBeNull();
  });

  it('a camera no longer in the list is forgotten, not opened', async () => {
    sessionStorage.setItem('tmd.videoSources.open', '99');
    mount(VideoSources, { global: { stubs: STUBS } });
    await flushPromises();
    expect(get).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('tmd.videoSources.open')).toBeNull();
  });
});
