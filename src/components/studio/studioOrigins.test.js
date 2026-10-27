// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest'
import { rememberStudioOrigin, studioOrigin } from '../../services/studioOrigins'
import { studioFeatures } from '../../services/studioFeatures'
beforeEach(() => localStorage.clear())
it('keeps page origins scoped to the person and rejects unknown or unavailable target pages', () => {
  rememberStudioOrigin('one','conversation','42','image')
  expect(studioOrigin('one','conversation','42').id).toBe('image')
  expect(studioOrigin('two','conversation','42')).toBeNull()
  rememberStudioOrigin('one','attachment','43','https://external.invalid')
  expect(studioOrigin('one','attachment','43')).toBeNull()
  // A page the server reports as not available yet is never offered as an origin.
  const before = studioFeatures.value
  studioFeatures.value = before.map(f => f.id === 'motion' ? { ...f, status: 'soon' } : f)
  rememberStudioOrigin('one','attachment','44','motion')
  expect(studioOrigin('one','attachment','44')).toBeNull()
  studioFeatures.value = before
  expect(studioOrigin('one','attachment','44').id).toBe('motion')
})
it('stores only the opaque ID and feature ID, and tolerates blocked storage', () => {
  rememberStudioOrigin('one','attachment','result-1','enhance')
  expect(JSON.parse(localStorage.getItem('aadml.studio.origins.one'))).toEqual({'attachment:result-1':'enhance'})
  const blocked = vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(studioOrigin('one','attachment','result-1')).toBeNull()
  blocked.mockRestore()
})
