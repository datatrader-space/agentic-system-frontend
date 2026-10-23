// @vitest-environment jsdom
// The Help Center used to read onboarding, popular searches, tutorials and topics one after another.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {}, params: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))
const never = () => new Promise(() => {})
const api = vi.hoisted(() => ({
  getOnboardingStatus: vi.fn(), getPopularSearches: vi.fn(), getTutorials: vi.fn(), getHelpTopics: vi.fn(),
  helpSuggest: vi.fn(), helpSearch: vi.fn(), logHelpSearch: vi.fn(() => Promise.resolve()),
}))
vi.mock('../services/api', () => ({ default: api }))

import HelpCenter from './HelpCenter.vue'

describe('HelpCenter — first load', () => {
  it('starts all four reads at once', async () => {
    api.getOnboardingStatus.mockReturnValue(never())   // the first one never answers
    api.getPopularSearches.mockReturnValue(never())
    api.getTutorials.mockReturnValue(never())
    api.getHelpTopics.mockReturnValue(never())
    const w = mount(HelpCenter, { global: { stubs: { Icon: true, RouterLink: true, 'router-link': true } } })
    await flushPromises()
    expect(api.getOnboardingStatus).toHaveBeenCalled()
    expect(api.getPopularSearches).toHaveBeenCalled()
    expect(api.getTutorials).toHaveBeenCalled()
    expect(api.getHelpTopics).toHaveBeenCalled()
    w.unmount()
  })
})
