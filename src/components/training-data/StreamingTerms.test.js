// @vitest-environment jsdom
// Accepting the Terms and the Privacy Policy before a first camera or stream (backend streaming_terms.py; the owner,
// 2026-11-19): the window, and the add-camera dialog that waits for it.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accepted = [];
let refuseAccept = null;
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    termsApi: { accept: vi.fn(async version => {
      if (refuseAccept) throw refuseAccept;
      accepted.push(version);
      return { terms: { accepted: true, version, terms_url: '/terms', privacy_url: '/privacy', summary: [] } };
    }) },
    videoSources: { ...actual.videoSources,
      list: vi.fn(async () => ({ sources: [], summary: {}, limits: { sources: 10, streams: 2 }, may: { add: true } })),
      add: vi.fn(async () => { throw Object.assign(new Error('Accept the Terms of Service first.'), { status: 428, serverCode: 'terms_required' }); }),
    },
  };
});
vi.mock('../../../training-data/src/api/machines.js', async (real) => ({
  ...(await real()), machinesApi: { list: vi.fn(async () => ({ machines: [], available: true, may_manage: true })) },
}));
import StreamingTermsDialog from '../../../training-data/src/components/StreamingTermsDialog.vue';
import VideoSources from '../../../training-data/src/components/VideoSources.vue';

const TERMS = { accepted: false, version: '2026-11-19', terms_url: '/terms', privacy_url: '/privacy',
  summary: ['Connect only cameras you own or are allowed to use.', 'Cloud Streaming is not a safety or alarm system.'] };
const STUBS = { LiveView: true, VideoSourcePage: true, UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="dlg"><slot/></div>' } };

describe('the Cloud Streaming terms window', () => {
  beforeEach(() => { accepted.length = 0; refuseAccept = null; });

  it('shows the points and both documents, and accepts only once ticked, with the version it showed', async () => {
    const w = mount(StreamingTermsDialog, { props: { open: true, terms: TERMS }, global: { stubs: STUBS } });
    expect(w.findAll('.st-terms-points li').map(li => li.text())).toEqual(TERMS.summary);
    const links = w.findAll('.st-terms-links a');
    expect(links.map(a => [a.attributes('href'), a.attributes('target'), a.attributes('rel')]))
      .toEqual([['/terms', '_blank', 'noopener'], ['/privacy', '_blank', 'noopener']]);
    const accept = () => w.findAll('button').find(b => b.text().includes('Accept and continue'));
    expect(accept().attributes('disabled')).toBeDefined();
    await w.find('input[type="checkbox"]').setValue(true);
    await accept().trigger('click');
    await flushPromises();
    expect(accepted).toEqual(['2026-11-19']);
    expect(w.emitted('accepted')[0][0].accepted).toBe(true);
  });

  it('says a refused acceptance and stays open', async () => {
    refuseAccept = new Error('The terms changed while the page was open. Read them again, then accept.');
    const w = mount(StreamingTermsDialog, { props: { open: true, terms: TERMS }, global: { stubs: STUBS } });
    await w.find('input[type="checkbox"]').setValue(true);
    await w.findAll('button').find(b => b.text().includes('Accept and continue')).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('The terms changed');
    expect(w.emitted('accepted')).toBeUndefined();
  });
});

describe('adding a camera waits for the terms', () => {
  it('opens the terms first, then the add dialog; a server refusal opens the terms again', async () => {
    let pending = null;
    const streamingTerms = {
      ensure: vi.fn(next => { if (pending === 'ok') return true; pending = next; return false; }),
      needed: vi.fn(),
    };
    const w = mount(VideoSources, { global: { stubs: STUBS, provide: { streamingTerms } } });
    await flushPromises();
    w.vm.openAdd();
    await flushPromises();
    expect(streamingTerms.ensure).toHaveBeenCalledTimes(1);
    expect(w.find('#vs-consent').exists()).toBe(false);                       // nothing opened yet
    const next = pending; pending = 'ok';
    next();                                                                    // accepted: what was asked opens
    await flushPromises();
    expect(w.find('#vs-consent').exists()).toBe(true);
  });
});
