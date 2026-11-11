import { describe, it, expect } from 'vitest'
import { cloneRequest } from './cloneByUrl'

describe('cloneRequest', () => {
  it('a GitHub address, with a branch only when one is named', () => {
    expect(cloneRequest(' https://github.com/acme/shop ', '')).toEqual({ body: { github_url: 'https://github.com/acme/shop' } })
    expect(cloneRequest('https://github.com/acme/shop.git', 'feature/login'))
      .toEqual({ body: { github_url: 'https://github.com/acme/shop.git', branch: 'feature/login' } })
  })
  it('anything else is said, nothing is sent', () => {
    for (const url of ['', 'github.com/acme/shop', 'http://github.com/acme/shop', 'https://gitlab.com/acme/shop',
      'https://github.com/acme', 'https://github.com/acme/shop/tree/main', 'https://github.com/acme/sh op']) {
      expect(cloneRequest(url, '').error, url).toContain('GitHub address')
    }
    for (const branch of ['a..b', '/x', 'x/', 'x.lock', 'with space']) {
      expect(cloneRequest('https://github.com/acme/shop', branch).error, branch).toBe('That branch name cannot be used.')
    }
  })
})
