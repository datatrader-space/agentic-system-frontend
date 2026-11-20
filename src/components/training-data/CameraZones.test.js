// @vitest-environment jsdom
// Phase A of the smart camera (SMART_CAMERA_AI_PLAN.md; backend camera_zones_api.py, ready_detector.py): drawing a
// camera's zones and privacy masks, a rule of one zone, and what a stream of the ready detector or of SAM 3 sends.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
vi.mock('../../../training-data/src/api/client.js', async (real) => {
  const actual = await real();
  return { ...actual, apiFetch: vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if (url.endsWith('/zones/') && (init.method || 'GET') === 'GET') {
      return { zones: [{ id: 4, name: 'Desk 1', kind: 'zone', kind_label: 'Zone', anchor: 'center', points: [[0, 0], [0.5, 0], [0.5, 0.5]] }],
        may: { change: true }, anchors: [{ key: 'bottom', label: 'Where it stands' }, { key: 'center', label: 'Its middle' }] };
    }
    if (url.endsWith('/zones/') && init.method === 'POST') {
      return { said: 'Privacy mask "Privacy mask 1" is saved.', zones: [], may: { change: true } };
    }
    return {};
  }) };
});
import CameraZones from '../../../training-data/src/components/CameraZones.vue';
import { chargeText, matchedText, ruleBody, ruleForm, ruleProblems, streamingApi, streamWhat, zonePoint, zoneProblems, zoneSvgPoints } from '../../../training-data/src/api/streaming.js';

const SOURCE = { id: 7, name: 'Office', thumbnail_url: '' };

describe('the zone helpers', () => {
  it('keep a clicked point inside the picture, as fractions', () => {
    expect(zonePoint(50, 25, 200, 100)).toEqual([0.25, 0.25]);
    expect(zonePoint(-5, 130, 200, 100)).toEqual([0, 1]);
    expect(zoneSvgPoints([[0.25, 0.5], [1, 0]])).toBe('250,500 1000,0');
  });
  it('say what a shape lacks before it is saved', () => {
    expect(zoneProblems({ name: '', kind: 'zone', points: [] })).toEqual({ name: 'Name the shape.', points: 'Click at least three points on the picture.' });
    expect(zoneProblems({ name: 'Door', kind: 'line', points: [[0, 0]] }).points).toMatch(/two points/);
    expect(zoneProblems({ name: 'Desk', kind: 'zone', points: [[0, 0], [1, 0], [1, 1]] })).toEqual({});
  });
  it('send a rule of one zone and say where an event matched', () => {
    expect(ruleBody({ class_name: ' person ', min_count: 1, cooldown_seconds: 60, zone: '4' })).toEqual({ class_name: 'person', min_count: 1, cooldown_seconds: 60, zone: 4, alert: 'managers' });
    expect(ruleBody({ class_name: 'person', min_count: 1, cooldown_seconds: 60, zone: '' })).not.toHaveProperty('zone');
    expect(matchedText({ matched: { person: 1, zone: 'Desk 1' } })).toBe('person 1 in Desk 1');
    expect(matchedText({ matched: { wall: 2 } })).toBe('wall 2');
  });
});

describe('a stream of the ready detector or of SAM 3', () => {
  beforeEach(() => { calls.length = 0; });
  it('sends no model, the detector or the names, and skip_still', async () => {
    await streamingApi.start({ project: 'leads', model: null, fps: 1, source: 3, detector: 'rfdetr-nano', skipStill: true });
    expect(calls[0].body).toEqual({ project: 'leads', fps: 1, source: 3, continuous: false, detector: 'rfdetr-nano', skip_still: true });
    await streamingApi.start({ project: 'leads', model: null, fps: 1, source: 3, find: 'person, red helmet' });
    expect(calls[1].body).toEqual({ project: 'leads', fps: 1, source: 3, continuous: false, find: 'person, red helmet' });
  });
  it('names what runs and what it costs', () => {
    expect(streamWhat({ detector: { key: 'rfdetr-nano', name: 'Ready detector (fast)' } })).toBe('Ready detector (fast)');
    expect(streamWhat({ find: ['person', 'forklift'] })).toBe('Finding person, forklift');
    expect(chargeText({ detector: true, codes: { photo_calls_a_read: '0.1' }, fps: 1 }))
      .toBe('Each frame the ready detector answers costs a tenth of a photo call from your balance: at 1 a second, 360 photo calls an hour.');
    expect(chargeText({ find: true, fps: 2 })).toMatch(/^Each frame is one SAM 3 image.*7,200 images an hour/);
  });
});

describe('the Zones tab', () => {
  beforeEach(() => { calls.length = 0; });
  it('lists the shapes and draws a privacy mask from three clicks', async () => {
    const w = mount(CameraZones, { props: { source: SOURCE }, global: { stubs: { UiButton: { template: '<button v-bind="$attrs"><slot/></button>' } } } });
    await flushPromises();
    expect(w.find('.cz-list').text()).toContain('Desk 1');
    await w.findAll('button').find(b => b.text().includes('Privacy mask')).trigger('click');
    const board = w.find('.cz-board');
    board.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    for (const [x, y] of [[10, 10], [90, 10], [90, 90]]) await board.trigger('click', { clientX: x, clientY: y });
    expect(w.text()).toContain('3 points');
    await w.find('form.cz-form').trigger('submit');
    await flushPromises();
    const added = calls.find(c => c.method === 'POST');
    expect(added.url).toMatch(/video-sources\/7\/zones\/$/);
    expect(added.body).toEqual({ name: 'Privacy mask 1', kind: 'mask', points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9]] });
  });
  it('does not save a zone of two points', async () => {
    const w = mount(CameraZones, { props: { source: SOURCE }, global: { stubs: { UiButton: { template: '<button v-bind="$attrs"><slot/></button>' } } } });
    await flushPromises();
    await w.findAll('button').find(b => b.text().trim() === 'Zone').trigger('click');
    const board = w.find('.cz-board');
    board.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    await board.trigger('click', { clientX: 10, clientY: 10 });
    await board.trigger('click', { clientX: 50, clientY: 10 });
    await w.find('form.cz-form').trigger('submit');
    await flushPromises();
    expect(calls.some(c => c.method === 'POST')).toBe(false);
    expect(w.text()).toContain('Click at least three points');
  });
});

describe('the Phase B rule form', () => {
  it('sends an empty-desk rule with its minutes and its office hours in Pakistan time', () => {
    const form = { ...ruleForm(['person']), kind: 'absent', minutes: 15, zone: '4', scheduled: true, days: [4, 0, 1, 2, 3] };
    expect(ruleProblems(form, {})).toEqual({});
    expect(ruleBody(form)).toEqual({ class_name: 'person', min_count: 1, cooldown_seconds: 60, zone: 4, kind: 'absent', seconds: 900,
      schedule: { days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00', tz: 'Asia/Karachi' }, alert: 'managers' });
    expect(ruleBody({ ...form, alert: '', critical: false }).alert).toBe('');
    expect(ruleBody({ ...form, alert: 'everyone', critical: true })).toMatchObject({ alert: 'everyone', critical: true });
  });
  it('sends a line rule, one event for each person, and refuses one without its line', () => {
    const form = { ...ruleForm(['person']), kind: 'cross', line: '9', direction: 'in', once_per_object: true };
    expect(ruleBody(form)).toEqual({ class_name: 'person', min_count: 1, cooldown_seconds: 60, kind: 'cross', line: 9, direction: 'in', once_per_object: true, alert: 'managers' });
    expect(ruleProblems({ ...form, line: '' }, {}).line).toMatch(/Choose the line/);
    expect(ruleProblems({ ...ruleForm(['person']), kind: 'stays', minutes: 0 }, {}).minutes).toBeTruthy();
    expect(ruleProblems({ ...ruleForm(['person']), scheduled: true, start: '09:00', end: '09:00' }, {}).schedule).toMatch(/different/);
  });
  it('says what a timed or a line event matched', () => {
    expect(matchedText({ matched: { person: 0, zone: 'Desk 1', seconds: 600 } })).toBe('person 0 in Desk 1 for 10 min');
    expect(matchedText({ matched: { person: 1, line: 'Door', direction: 'in', track: 3 } })).toBe('person 1 across Door (in)');
  });
});

describe('the rule form lets the browser submit what it offers', () => {
  it('takes any number of minutes (found live 2026-11-20: step 0.5 from 0.2 made 15 minutes invalid, so Save did nothing)', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('training-data/src/components/VideoSourcePage.vue', 'utf8');   // vitest runs at the repo root
    const minutes = page.match(/<input v-model\.number="draft\.minutes"[^>]*>/)[0];
    expect(minutes).toContain('step="any"');
  });
});

describe('the Phase D rule form', () => {
  it('sends the AI, the rule in words, the model and the approval only when chosen', () => {
    const base = { ...ruleForm(['person']) };
    expect(ruleBody(base)).not.toHaveProperty('ai');
    expect(ruleBody({ ...base, ai: 'verify', ai_question: '  Is the door open? ', ai_model: 'google/gemini-4-argon', approve_actions: true }))
      .toMatchObject({ ai: 'verify', ai_question: 'Is the door open?', ai_model: 'google/gemini-4-argon', approve_actions: true });
    expect(ruleBody({ ...base, ai: 'describe', ai_question: ' ' })).not.toHaveProperty('ai_question');
  });
});
