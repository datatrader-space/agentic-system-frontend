// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ updateOnboarding: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  localStorage.clear()
})

async function fresh() {
  const mod = await import('./useOnboarding')
  return mod.useOnboarding()
}

describe('useOnboarding — a dismissal survives a failed PATCH', () => {
  it('keeps the welcome dismissed for this user when the backend still says not completed', async () => {
    api.updateOnboarding.mockRejectedValueOnce(new Error('500'))
    const ob = await fresh()
    ob.hydrateFromUser({ id: 5, onboarding_completed: false })
    expect(ob.isTourCompleted()).toBe(false)
    ob.endTour(true)
    await Promise.resolve(); await Promise.resolve()

    // Next page load: a fresh module, /auth/me still says false because the PATCH never landed.
    vi.resetModules()
    api.updateOnboarding.mockResolvedValueOnce({})
    const ob2 = await fresh()
    ob2.hydrateFromUser({ id: 5, onboarding_completed: false })
    expect(ob2.isTourCompleted()).toBe(true)
    // ...and the PATCH is retried.
    expect(api.updateOnboarding).toHaveBeenLastCalledWith({ onboarding_completed: true })
  })

  it('does not apply one user\'s pending dismissal to another user', async () => {
    api.updateOnboarding.mockRejectedValueOnce(new Error('500'))
    const ob = await fresh()
    ob.hydrateFromUser({ id: 5, onboarding_completed: false })
    ob.endTour(true)
    await Promise.resolve()
    vi.resetModules()
    const ob2 = await fresh()
    ob2.hydrateFromUser({ id: 9, onboarding_completed: false })
    expect(ob2.isTourCompleted()).toBe(false)
  })

  it('follows the backend once the PATCH succeeded', async () => {
    api.updateOnboarding.mockResolvedValue({})
    const ob = await fresh()
    ob.hydrateFromUser({ id: 5, onboarding_completed: false })
    ob.endTour(true)
    await Promise.resolve(); await Promise.resolve()
    vi.resetModules()
    const ob2 = await fresh()
    // e.g. reset from another device: the backend is the truth again.
    ob2.hydrateFromUser({ id: 5, onboarding_completed: false })
    expect(ob2.isTourCompleted()).toBe(false)
  })
})
