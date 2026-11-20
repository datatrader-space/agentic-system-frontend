// @vitest-environment jsdom
// "Add video source", RTMP stream (CLOUD_STREAMING_PLAN.md §14): a name and the consent are enough; the answer's server
// and stream key are shown once, with copy buttons and a plain warning to keep the key secret, and are gone when the
// dialog closes.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const KEY = 'src12?user=src12&pass=Abc_def-0123456789xyzABCDEFGHIJKLMNOPQRST';
const added = [];
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    videoSources: {
      ...actual.videoSources,
      list: vi.fn(async () => ({ sources: [], summary: {}, limits: { sources: 10, streams: 2 }, may: { add: true } })),
      add: vi.fn(async body => {
        added.push(body);
        return { said: 'Drone is saved. Copy its server and stream key into your camera or encoder now: the key is not shown again.',
          source: { id: 12, name: 'Drone', kind: 'rtmp', push: { server: 'rtmps://ingest.aadml.com:1936/', path: 'src12',
            available: true, stream_key: KEY, url: `rtmps://ingest.aadml.com:1936/${KEY}` } } };
      }),
    },
  };
});
vi.mock('../../../training-data/src/api/machines.js', async (real) => ({
  ...(await real()), machinesApi: { list: vi.fn(async () => ({ machines: [] })) },
}));
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const DialogStub = { props: ['open', 'title'], emits: ['close'], template: '<div v-if="open" class="dlg"><slot /></div>' };

describe('adding an RTMP stream', () => {
  it('sends only its name, project and consent, then shows its server and key once', async () => {
    const w = mount(VideoSources, { global: { stubs: { UiDialog: DialogStub, LiveView: true, VideoSourcePage: true } } });
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    await w.find('#vs-way-rtmp').trigger('click');
    expect(w.find('#vs-address').exists()).toBe(false);                     // no address, user name or password
    expect(w.find('#vs-username').exists()).toBe(false);
    expect(w.text()).toContain('Plain RTMP without encryption is not accepted');
    expect(w.text()).not.toMatch(/Coming soon|Pilot/);
    await w.find('#vs-name').setValue('Drone');
    await w.find('#vs-consent').setValue(true);
    await w.find('form.vs-form').trigger('submit');
    await flushPromises();
    expect(added).toEqual([{ name: 'Drone', kind: 'rtmp', consent: true }]);
    expect(w.find('#vs-push-server').element.value).toBe('rtmps://ingest.aadml.com:1936/');
    expect(w.find('#vs-push-key').element.value).toBe(KEY);
    expect(w.find('#vs-push-url').element.value).toBe(`rtmps://ingest.aadml.com:1936/${KEY}`);
    expect(w.find('.pd-warn').text()).toContain('Keep the stream key secret');
    expect(w.findAll('button[aria-label^="Copy the"]').length).toBe(3);
    // Closing the dialog drops the key from the page.
    w.findAll('button').find(b => b.text().trim() === 'Done').trigger('click');
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    await w.find('#vs-way-rtmp').trigger('click');
    expect(w.find('#vs-push-key').exists()).toBe(false);
    expect(w.html()).not.toContain('Abc_def-0123456789');
    w.unmount();
  });
});
