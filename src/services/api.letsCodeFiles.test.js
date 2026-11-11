// @vitest-environment jsdom
// The Let's Code explorer's file calls (ADM-1205) as they leave the browser. Live on 2026-11-11 an upload went out as
// application/json (the instance's default) and the server read no files: "Choose files to upload."
import { describe, it, expect, beforeEach, vi } from 'vitest'

// api.js wraps instance.post (cache invalidation), so the spy is held apart from the instance.
const h = vi.hoisted(() => ({ instance: null, rawPost: null }))

vi.mock('axios', () => {
  h.rawPost = vi.fn(() => Promise.resolve({ data: {} }))
  h.instance = {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: h.rawPost,
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { withCredentials: true },
  }
  return { default: { create: () => h.instance, defaults: {} } }
})

import api, { clearApiCache } from './api'

beforeEach(() => {
  clearApiCache()
  h.rawPost.mockClear()
})

describe('uploadRepositoryFiles', () => {
  it('is sent as multipart, with each file, its path in the folder, and overwrite only when asked', async () => {
    const a = new File(['1'], 'index.html')
    const b = new File(['2'], 'main.css')
    await api.uploadRepositoryFiles(5, 4, 'site', [{ file: a, path: 'index.html' }, { file: b, path: 'css/main.css' }])
    const [url, form, config] = h.rawPost.mock.calls[0]
    expect(url).toBe('/systems/5/repositories/4/files/upload/')
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('folder')).toBe('site')
    expect(form.getAll('files').map((f) => f.name)).toEqual(['index.html', 'main.css'])
    expect(form.getAll('paths')).toEqual(['index.html', 'css/main.css'])
    expect(form.has('overwrite')).toBe(false)

    await api.uploadRepositoryFiles(5, 4, '', [{ file: a, path: 'index.html' }], { overwrite: true })
    const second = h.rawPost.mock.calls[1][1]
    expect([second.get('folder'), second.get('overwrite')]).toEqual(['', '1'])
  })
})

describe('the other file calls', () => {
  it('name the endpoint and the body the server reads', async () => {
    await api.createRepositoryEntry(5, 4, 'src/a.py', 'file')
    await api.renameRepositoryEntry(5, 4, 'a.py', 'b.py')
    await api.deleteRepositoryEntry(5, 4, 'b.py')
    expect(h.rawPost.mock.calls.map(([u, body]) => [u, body])).toEqual([
      ['/systems/5/repositories/4/files/create/', { path: 'src/a.py', type: 'file' }],
      ['/systems/5/repositories/4/files/rename/', { path: 'a.py', new_path: 'b.py' }],
      ['/systems/5/repositories/4/files/delete/', { path: 'b.py' }],
    ])
  })
})
