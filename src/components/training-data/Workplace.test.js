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
        staff_notice: 'Notice to staff ... Urdu ...', terms: { version: '2026-11-20', points: ['Only people who consented are matched.'] } } };
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
