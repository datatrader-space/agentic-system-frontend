import { describe, it, expect } from 'vitest'
import { fileLinkPayload } from './fileLinks'

const a = (href, text) => ({ getAttribute: (k) => (k === 'href' ? href : null), textContent: text })

describe('fileLinkPayload', () => {
  it('a workspace file opens with its token URL, inline for viewing', () => {
    expect(fileLinkPayload(a('/api/workspace/files/download/?t=abc', 'report.md'))).toEqual({
      path: 'report.md', download_url: '/api/workspace/files/download/?t=abc',
      view_url: '/api/workspace/files/download/?t=abc&inline=1',
    })
  })

  it('prod conv 1608: an agent document opens in the viewer as markdown, whatever the link text', () => {
    const p = fileLinkPayload(a('/api/documents/redis-and-sqlite/download/?format=markdown', 'Download the .md file'))
    expect(p).toEqual({ path: 'redis-and-sqlite.md', download_url: '/api/documents/redis-and-sqlite/download/?format=markdown',
                        view_url: '/api/documents/redis-and-sqlite/download/?format=markdown' })
  })

  it('keeps a filename link text', () => {
    expect(fileLinkPayload(a('/api/documents/x/download/?format=pdf', 'x.pdf')).path).toBe('x.pdf')
  })

  it('anything else is not a file link', () => {
    expect(fileLinkPayload(a('https://redis.io/downloads', 'redis.io'))).toBe(null)
    expect(fileLinkPayload(a('documents/x.md', 'x.md'))).toBe(null)
    expect(fileLinkPayload(null)).toBe(null)
  })
})
