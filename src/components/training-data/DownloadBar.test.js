// @vitest-environment jsdom
// The download bar on the Try pages (owner, 2026-11-11: "add real progress so user can know"; backend
// machines.download_progress): a bar while the total is known, nothing while it is not (the words say "so far").
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DownloadBar from '../../../training-data/src/components/DownloadBar.vue';

describe('DownloadBar', () => {
  it('shows the percent as a bar and a number while the total is known', () => {
    const wrapper = mount(DownloadBar, { props: { download: { part: 'files', done_bytes: 1.2e9, total_bytes: 3.4e9, percent: 35 } } });
    const bar = wrapper.find('progress');
    expect(bar.attributes('value')).toBe('35');
    expect(bar.attributes('max')).toBe('100');
    expect(bar.attributes('aria-label')).toBe('Downloaded: 35%');
    expect(wrapper.text()).toContain('35%');
  });

  it('shows nothing while the total is not known, or when there is no download', () => {
    expect(mount(DownloadBar, { props: { download: { part: 'files', done_bytes: 5e6, total_bytes: 0, percent: null } } })
      .find('progress').exists()).toBe(false);
    expect(mount(DownloadBar, { props: { download: null } }).find('progress').exists()).toBe(false);
  });
});
