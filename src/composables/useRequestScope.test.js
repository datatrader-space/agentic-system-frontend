import { describe, it, expect } from 'vitest'
import { effectScope } from 'vue'
import { useRequestScope } from './useRequestScope'

describe('useRequestScope', () => {
  it('a new load aborts the previous one (stale response guard)', () => {
    const scope = useRequestScope()
    const a = scope.next()
    const b = scope.next()
    expect(a.aborted).toBe(true)
    expect(b.aborted).toBe(false)
  })

  it('everything in flight is aborted when the component goes away', () => {
    const es = effectScope()
    const scope = es.run(() => useRequestScope())
    const s = scope.next()
    es.stop()
    expect(s.aborted).toBe(true)
    expect(scope.next().aborted).toBe(true)     // nothing new can start after unmount
  })
})
