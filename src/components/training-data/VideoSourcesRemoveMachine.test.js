// @vitest-environment jsdom
// The Machines card on Cloud Streaming lists every machine of the workspace (one with no camera too) and an Admin can
// remove one from there, after confirming (live, 2026-11-18: the owner found no way to remove a connected machine).
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const removed = [];
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    videoSources: {
      ...actual.videoSources,
      list: vi.fn(async () => ({ sources: [], summary: {}, limits: { sources: 10, streams: 2 }, may: { add: true } })),
    },
  };
});
vi.mock('../../../training-data/src/api/machines.js', async (real) => ({
  ...(await real()),
  machinesApi: {
    list: vi.fn(async () => ({ machines: removed.length ? [] : [{ id: 3, name: 'cd2ccc296f7f', state: 'online', agent_version: '1.7.0' }],
      available: true, may_manage: true })),
    remove: vi.fn(async id => { removed.push(id); return {}; }),
  },
}));
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const DialogStub = { props: ['open', 'title'], emits: ['close'], template: '<div v-if="open" class="dlg"><h2>{{ title }}</h2><slot /></div>' };

describe('the Machines card', () => {
  it('lists a machine with no camera and removes it after asking', async () => {
    const w = mount(VideoSources, { props: { page: true }, global: { stubs: { UiDialog: DialogStub, LiveView: true, VideoSourcePage: true } } });
    await flushPromises();
    expect(w.text()).toContain('cd2ccc296f7f');
    expect(w.text()).toContain('0 cameras');
    await w.find('button[aria-label="Remove cd2ccc296f7f"]').trigger('click');
    await flushPromises();
    expect(w.find('.dlg h2').text()).toBe('Remove cd2ccc296f7f?');
    expect(w.text()).toContain('docker volume rm aadml-machine');
    expect(removed).toEqual([]);                                     // nothing before it is confirmed
    await w.findAll('button').find(b => b.text().includes('Remove machine')).trigger('click');
    await flushPromises();
    expect(removed.map(String)).toEqual(['3']);
  });
});
