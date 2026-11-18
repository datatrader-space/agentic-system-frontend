// @vitest-environment jsdom
// "Add video source", Phone camera (CLOUD_STREAMING_PLAN.md §16): a name and the consent are enough; the answer's phone
// link is shown once, as a QR code and a link to copy with the three steps, and is gone when the dialog closes. "Scan
// from phone" points to the Phone camera tab, not to an app.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const SECRET = 'Abc_def-0123456789xyzABCDEFGHIJKLMNOPQRSTUV';
const LINK = `https://aadml.com/dashboard/training-data/#phonecam=${SECRET}`;
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
        return { said: 'Dock phone is saved. Open its phone link on the phone now: the link is not shown again.',
          source: { id: 14, name: 'Dock phone', kind: 'phone', phone: { url: LINK, available: true, expired: false,
            expires_at: '2026-11-25T12:00:00+00:00', link_set_at: '2026-11-18T12:00:00+00:00', lifetime_days: 7 } } };
      }),
    },
  };
});
vi.mock('../../../training-data/src/api/machines.js', async (real) => ({
  ...(await real()), machinesApi: { list: vi.fn(async () => ({ machines: [] })) },
}));
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const DialogStub = { props: ['open', 'title'], emits: ['close'], template: '<div v-if="open" class="dlg"><slot /></div>' };

describe('adding a phone camera', () => {
  it('sends only its name and consent, then shows its phone link once as a QR code with the steps', async () => {
    const w = mount(VideoSources, { global: { stubs: { UiDialog: DialogStub, LiveView: true, VideoSourcePage: true } } });
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    await w.find('#vs-way-phone').trigger('click');                         // Scan from phone: points to Phone camera
    expect(w.text()).toContain('To use your phone as a camera, add a Phone camera');
    expect(w.text()).not.toContain('Larix');
    await w.find('#vs-way-phonecam').trigger('click');
    expect(w.find('#vs-way-phonecam').text()).toBe('Phone camera');
    expect(w.find('#vs-address').exists()).toBe(false);                     // no address, user name or password
    expect(w.find('#vs-username').exists()).toBe(false);
    expect(w.text()).toContain('no app to install');
    await w.find('#vs-name').setValue('Dock phone');
    await w.find('#vs-consent').setValue(true);
    expect(w.find('button[type="submit"]').text()).toContain('Add phone camera');
    await w.find('form.vs-form').trigger('submit');
    await flushPromises();
    expect(added).toEqual([{ name: 'Dock phone', kind: 'phone', consent: true }]);
    expect(w.find('#vs-phone-url').element.value).toBe(LINK);
    expect(w.find('svg[aria-label="QR code of the phone link"] path').attributes('d')).toMatch(/^M/);
    const steps = w.findAll('.pl-steps li').map(li => li.text());
    expect(steps).toEqual(["Scan this with the phone's camera.", 'Tap Start and allow the camera.', 'Keep the page open while it sends.']);
    expect(w.text()).toContain('or until you make a new one');
    expect(w.find('.pl-warn').text()).toContain('Anyone who has this link');
    // Closing the dialog drops the link from the page.
    w.findAll('button').find(b => b.text().trim() === 'Done').trigger('click');
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    await w.find('#vs-way-phonecam').trigger('click');
    expect(w.find('#vs-phone-url').exists()).toBe(false);
    expect(w.html()).not.toContain(SECRET);
    w.unmount();
  });
});
