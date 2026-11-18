// @vitest-environment jsdom
// A project's Test page: a start the server refuses is said under the Start button (live, 2026-11-18: "The
// vision-serve image of this code is not built yet" was only at the top of the page, so Start seemed to do nothing).
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const REFUSAL = 'The vision-serve image of this code is not built yet.';
vi.mock('../../../training-data/src/api/trial.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    trialApi: {
      ...actual.trialApi,
      models: vi.fn(async () => ({ models: [{ number: 2, name: 'fmw-walls', version: '2.0.0' }] })),
      state: vi.fn(async () => ({ phase: 'off', may: { start: true }, idle_minutes: 15, trial: null })),
      machines: vi.fn(async () => ({ machines: [] })),
      act: vi.fn(async () => { const e = new Error(REFUSAL); e.status = 409; throw e; }),
    },
  };
});
import TestPage from '../../../training-data/src/components/TestPage.vue';

describe('the Test page', () => {
  it('says a refused start under the Start button, not only at the top of the page', async () => {
    const w = mount(TestPage, {
      props: { projectRef: 'vision-pipeline-test' },
      global: { stubs: { MachinePicker: { template: '<div/>', props: ['modelValue'], emits: ['update:modelValue'],
        created() { this.$emit('update:modelValue', 'machine:3'); }, methods: { confirm(go) { return go(); } } } } },
    });
    await flushPromises();
    const start = w.findAll('button').find(b => b.text().includes('Start test server'));
    expect(start).toBeTruthy();
    await start.trigger('click');
    await flushPromises();
    const alerts = w.findAll('.test-error[role="alert"]').map(a => a.text());
    expect(alerts).toContain(REFUSAL);
  });
});
