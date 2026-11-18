// @vitest-environment jsdom
// "Add video source", Connect a camera: the computer the cameras are near is added right here, with the one command
// (MachineConnection, as on the Machines page). Live, 2026-11-18: the owner could not find where that command was; the
// tab only said "the Machines page".
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

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
  ...(await real()), machinesApi: { list: vi.fn(async () => ({ machines: [], available: true, may_manage: true })) },
}));
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const DialogStub = { props: ['open', 'title'], emits: ['close'], template: '<div v-if="open" class="dlg"><slot /></div>' };
const ConnectionStub = { name: 'MachineConnection', props: ['continueLabel'], emits: ['cancel', 'connected'], template: '<div class="mc-stub">{{ continueLabel }}</div>' };

describe('connecting a camera on your own network', () => {
  it('offers the machine command in the dialog when the workspace has no machine yet', async () => {
    const w = mount(VideoSources, { global: { stubs: { UiDialog: DialogStub, LiveView: true, VideoSourcePage: true, MachineConnection: ConnectionStub } } });
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    await w.find('#vs-way-connector').trigger('click');
    await flushPromises();
    expect(w.find('.mc-stub').exists()).toBe(true);
    expect(w.find('.mc-stub').text()).toBe('Use it for the camera');
    expect(w.text()).toContain('run it once in a terminal on that computer');
    expect(w.text()).not.toContain('The Machines page gives the one command');
  });
});
