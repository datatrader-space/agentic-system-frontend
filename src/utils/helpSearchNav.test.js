import { describe, it, expect } from 'vitest'
import { resolveSearchDestination } from './helpSearchNav'

describe('resolveSearchDestination (Help Center smart-search submit)', () => {
  const Q = 'how to add new agent'

  it('routes to the top section article + anchor (the reported bug)', () => {
    const results = [
      {
        content_slug: 'create-your-first-agent',
        anchor: 'create-the-agent',
        route: '/dashboard/help-center/article/create-your-first-agent',
        url: '/dashboard/help-center/article/create-your-first-agent#create-the-agent',
      },
    ]
    expect(resolveSearchDestination(results, Q)).toEqual({
      path: '/dashboard/help-center/article/create-your-first-agent',
      hash: '#create-the-agent',
      query: { q: Q },
    })
  })

  it('does NOT use an app ACTION as the destination (only /help/search results are passed in)', () => {
    // /help/search never returns app actions; even if a result lacks an anchor it stays
    // an in-Help-Center article route, never /dashboard/agents/new.
    const results = [{ url: '/dashboard/help-center/article/x', route: '/dashboard/help-center/article/x' }]
    const dest = resolveSearchDestination(results, Q)
    expect(dest.path).toBe('/dashboard/help-center/article/x')
    expect(dest.hash).toBeUndefined()
    expect(dest.query).toEqual({ q: Q })
  })

  it('keeps no dangling hash for anchorless types (e.g. learning paths)', () => {
    const results = [{ url: '/dashboard/help-center/learning-path/getting-started', route: '/dashboard/help-center/learning-path/getting-started' }]
    expect(resolveSearchDestination(results, Q)).toEqual({
      path: '/dashboard/help-center/learning-path/getting-started',
      query: { q: Q },
    })
  })

  it('falls back to the documentation list (with ?q) on zero results', () => {
    expect(resolveSearchDestination([], Q)).toEqual({
      path: '/dashboard/help-center/docs',
      query: { q: Q },
    })
  })
})
