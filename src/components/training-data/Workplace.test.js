// @vitest-environment jsdom
// Phase H of the smart camera (SMART_CAMERA_AI_PLAN.md; backend workplace_api.py): the Workplace view (the Admin's
// terms, people and their links, attendance) and a person's own consent page (their link as the only authority).
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
vi.mock('../../../training-data/src/api/client.js', async (real) => {
  const actual = await real();
  return { ...actual, apiFetch: vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if (url.endsWith('/workspace/workplace/') && (init.method || 'GET') === 'GET') {
      return { settings: { accepted: false, faces_on: false, plates_on: false, notice_confirmed_at: null, day_start: null, day_end: null,
        staff_notice: 'Notice to staff ... Urdu ...', terms: { version: '2026-11-20', points: ['Only people who consented are matched.'] },
        face_model: '', search_model: '',
        models: { faces: [{ key: 'yunet-sface', name: 'YuNet and SFace', price: '$0.001 an image' }],
                  search: [{ key: 'bge-small-en', name: 'BGE small', price: '$0.0005 an image' }] } } };
    }
    if (url.endsWith('/workspace/workplace/') && init.method === 'POST') {
      return { settings: { accepted: true, faces_on: true, plates_on: false, notice_confirmed_at: '2026-11-20T05:00:00Z', staff_notice: '', terms: { version: '2026-11-20', points: [] } } };
    }
    return {};
  }) };
});
import WorkplaceTab from '../../../training-data/src/components/WorkplaceTab.vue';
import WorkplaceConsent from '../../../training-data/src/components/WorkplaceConsent.vue';
import { consentSecret, workplaceMeApi } from '../../../training-data/src/api/phone.js';
import { percent, pkDay, workplaceApi } from '../../../training-data/src/api/workplace.js';

const STUBS = { UiButton: { template: '<button v-bind="$attrs"><slot/></button>' } };
const SECRET = 'a'.repeat(43);

describe('the workplace helpers', () => {
  it('reads a consent link from the address, a Pakistan day, a share, and the CSV address', () => {
    expect(consentSecret(`?consent=${SECRET}`)).toBe(SECRET);
    expect(consentSecret('?consent=short')).toBe('');
    expect(pkDay(0, new Date('2026-11-19T20:30:00Z'))).toBe('2026-11-20');          // already the 20th in Karachi
    expect(percent(0.426)).toBe('43%');
    expect(workplaceApi.attendanceCsvUrl({ since: '2026-11-14', until: '2026-11-20' })).toContain('download=csv');
  });
});

describe('the Workplace view', () => {
  beforeEach(() => { calls.length = 0; });
  it('accepts the terms and the notice, and switches face recognition on in one save', async () => {
    const w = mount(WorkplaceTab, { global: { stubs: STUBS } });
    await flushPromises();
    expect(w.text()).toContain('Only people who consented are matched.');
    const boxes = w.findAll('input[type="checkbox"]');
    await boxes[0].setValue(true); await boxes[1].setValue(true); await boxes[2].setValue(true);
    await w.findAll('button').find(b => b.text() === 'Save').trigger('click');
    await flushPromises();
    const saved = calls.find(c => c.method === 'POST');
    expect(saved.body).toMatchObject({ accept: '2026-11-20', notice_confirmed: true, faces_on: true });
  });

  it('offers the hosted face and search models that run, with their price, and saves the ones chosen', async () => {
    const w = mount(WorkplaceTab, { global: { stubs: STUBS } });
    await flushPromises();
    const face = w.get('[data-test="wp-face-model"]');
    expect(face.findAll('option').map(o => o.text())).toEqual(['The first that runs', 'YuNet and SFace · $0.001 an image']);
    await face.setValue('yunet-sface');
    await w.get('[data-test="wp-search-model"]').setValue('bge-small-en');
    await w.findAll('button').find(b => b.text() === 'Save').trigger('click');
    await flushPromises();
    const saved = calls.find(c => c.method === 'POST');
    expect(saved.body).toMatchObject({ face_model: 'yunet-sface', search_model: 'bge-small-en' });
    expect(w.text()).toContain("never on AADML's server");
  });
});

describe("a person's own consent page", () => {
  it('sends the photo only when they agree, with their link as the Bearer credential', async () => {
    const sent = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      sent.push({ url, init });
      const body = { name: 'Ali Khan', workplace: 'Office', state: url.includes('consent') ? 'consented' : 'invited', faces_on: true,
        points: ['Only people who consented are matched.'], notice: 'Notice', attendance: [], consent_at: null, link_ends: null };
      return { ok: true, status: 200, json: async () => body };
    });
    globalThis.URL.createObjectURL = () => 'blob:me';
    const w = mount(WorkplaceConsent, { props: { secret: SECRET } });
    await flushPromises();
    expect(w.text()).toContain('Hello Ali Khan');
    const agree = () => w.findAll('button').find(b => b.text().includes('Agree'));
    expect(agree().attributes('disabled')).toBeDefined();                       // no photo, not ticked
    expect(w.find('input[type="file"]').attributes('capture')).toBeUndefined();   // choosing is choosing; the selfie is its own
    const input = w.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] });
    await input.trigger('change');
    await w.find('input[type="checkbox"]').setValue(true);
    await agree().trigger('click');
    await flushPromises();
    const post = sent.find(s => s.url.endsWith('/workplace/me/consent/'));
    expect(post.init.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(post.init.credentials).toBe('omit');
    expect(post.init.body.get('agree')).toBe('true');
    expect(w.text()).toContain('Withdraw my consent');
    expect(workplaceMeApi.erase).toBeTypeOf('function');
  });
});

describe('Phase I: outside AADML', () => {
  beforeEach(() => { calls.length = 0; });
  it('proposes and accepts a sharing agreement, and sends a device and share on a rule', async () => {
    await workplaceApi.propose('Banned visitors', true);
    await workplaceApi.accept(' code-123 ');
    expect(calls.map(c => c.body)).toEqual([{ propose: { purpose: 'Banned visitors', pictures: true } }, { accept: 'code-123' }]);
    const { ruleBody, ruleForm } = await import('../../../training-data/src/api/streaming.js');
    expect(ruleBody({ ...ruleForm(['person']), device: '5', share: true })).toMatchObject({ device: 5, share: true });
  });
});

describe('the addresses asked', () => {
  beforeEach(() => { calls.length = 0; });
  it('are /training-data/app/... for apiFetch (which adds /api) and /api/... for the CSV link', async () => {
    await workplaceApi.settings(); await workplaceApi.endpoints(); await workplaceApi.sharing();
    expect(calls.map(c => c.url)).toEqual(['/training-data/app/workspace/workplace/', '/training-data/app/workspace/camera-endpoints/',
      '/training-data/app/workspace/sharing/']);
    expect(workplaceApi.attendanceCsvUrl({ since: '2026-11-14', until: '2026-11-20' }))
      .toBe('/api/training-data/app/workspace/workplace/attendance/?since=2026-11-14&until=2026-11-20&download=csv');
  });

  it('takes a selfie with the front camera on the page, lets it be retaken, and lets the camera go', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ name: 'Ali Khan', workplace: 'Office',
      state: 'invited', faces_on: true, points: [], notice: '', attendance: [], consent_at: null, link_ends: null }) }));
    globalThis.URL.createObjectURL = () => 'blob:selfie';
    globalThis.URL.revokeObjectURL = () => {};
    const stopped = [];
    const track = { stop: () => stopped.push('camera') };
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
    Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
    window.HTMLCanvasElement.prototype.toBlob = function (done) { done(new Blob(['jpeg'], { type: 'image/jpeg' })); };
    const w = mount(WorkplaceConsent, { props: { secret: SECRET } });
    await flushPromises();
    await w.get('[data-test="wc-selfie"]').trigger('click');
    await flushPromises();
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toEqual({ ideal: 'user' });   // the front camera
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
    expect(w.find('[data-test="wc-camera"] video').exists()).toBe(true);
    await w.get('[data-test="wc-snap"]').trigger('click');
    await flushPromises();
    expect(stopped).toEqual(['camera']);                                        // let go at once
    expect(w.find('img.wc-preview').attributes('src')).toBe('blob:selfie');
    expect(w.find('[data-test="wc-camera"]').exists()).toBe(false);
    await w.get('[data-test="wc-retake"]').trigger('click');
    await flushPromises();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(w.find('img.wc-preview').exists()).toBe(false);
    w.unmount();
    expect(stopped).toEqual(['camera', 'camera']);                              // and when the page goes
  });

  it('says plainly when the camera is not allowed, and choosing a photo still works', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ name: 'Ali Khan', workplace: 'Office',
      state: 'invited', faces_on: true, points: [], notice: '', attendance: [], consent_at: null, link_ends: null }) }));
    const refused = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => { throw refused; }) }, configurable: true });
    const w = mount(WorkplaceConsent, { props: { secret: SECRET } });
    await flushPromises();
    await w.get('[data-test="wc-selfie"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="wc-camera-error"]').text()).toContain('not allowed to use the camera');
    expect(w.find('[data-test="wc-file"]').exists()).toBe(true);
    w.unmount();
  });
});

