// @vitest-environment jsdom
// The Let's Code explorer's file calls (ADM-1205) as they leave the browser. Live on 2026-11-11 an upload went out as
// application/json (the instance's default) and the server read no files: "Choose files to upload."
import { describe, it, expect, beforeEach, vi } from 'vitest'

// api.js wraps instance.get and instance.post (caching, cache invalidation), so the spies are held apart from the
// instance.
const h = vi.hoisted(() => ({ instance: null, rawPost: null, rawGet: null }))

vi.mock('axios', () => {
  h.rawPost = vi.fn(() => Promise.resolve({ data: {} }))
  h.rawGet = vi.fn(() => Promise.resolve({ data: {} }))
  h.instance = {
    get: h.rawGet,
    post: h.rawPost,
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { withCredentials: true },
  }
  return { default: { create: () => h.instance, defaults: {} } }
})

import api, { clearApiCache } from './api'
import { MAX_BYTES_PER_PART } from '@/utils/droppedFiles'

beforeEach(() => {
  clearApiCache()
  h.rawPost.mockReset()
  h.rawPost.mockResolvedValue({ data: {} })
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

describe('a file larger than an upload part (ADM-1269)', () => {
  it('goes in pieces of one part each, with one id, and the last answer is the upload', async () => {
    const big = new File([new Uint8Array(MAX_BYTES_PER_PART * 2 + 5)], 'video.mp4')
    h.rawPost.mockResolvedValueOnce({ status: 202, data: { received: 0 } })
      .mockResolvedValueOnce({ status: 202, data: { received: 1 } })
      .mockResolvedValueOnce({ status: 201, data: { uploaded: ['media/video.mp4'] } })
    const pieces = []
    const res = await api.uploadRepositoryFiles(5, 4, 'media', [{ file: big, path: 'video.mp4' }],
      { overwrite: true, onPiece: (sent, total) => pieces.push([sent, total]) })
    expect(res.data).toEqual({ uploaded: ['media/video.mp4'] })
    const forms = h.rawPost.mock.calls.map(([, form]) => form)
    expect(forms.map((f) => [f.get('chunk'), f.get('chunks'), f.get('files').size, f.get('paths'), f.get('overwrite')]))
      .toEqual([['0', '3', MAX_BYTES_PER_PART, 'video.mp4', '1'], ['1', '3', MAX_BYTES_PER_PART, 'video.mp4', '1'],
        ['2', '3', 5, 'video.mp4', '1']])
    expect(new Set(forms.map((f) => f.get('chunk_upload'))).size).toBe(1)
    expect(forms[0].get('chunk_upload')).toMatch(/^[0-9a-f]{32}$/)
    expect(pieces).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('stops at a refused piece', async () => {
    const big = new File([new Uint8Array(MAX_BYTES_PER_PART + 1)], 'a.bin')
    h.rawPost.mockRejectedValueOnce({ response: { status: 409, data: { exists: ['a.bin'] } } })
    await expect(api.uploadRepositoryFiles(5, 4, '', [{ file: big, path: 'a.bin' }])).rejects
      .toMatchObject({ response: { status: 409 } })
    expect(h.rawPost).toHaveBeenCalledTimes(1)
  })
})

const doneJob = (kind, result, extra = {}) => ({ id: 'j1', kind, state: 'done', status_code: 200, result, ...extra })

describe('downloads (the explorer and the backup) are packed by a job, then fetched (ADM-1269)', () => {
  beforeEach(() => h.rawGet.mockReset())

  it('the backup is pressed at its own address, then the file comes from the job as a Blob', async () => {
    h.rawGet.mockResolvedValueOnce({ status: 202, data: { job: doneJob('backup', { name: 'shop.tar.gz' }) } })
      .mockResolvedValueOnce({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="b"' } })
    const res = await api.downloadProjectBackup(5, 4)
    expect(h.rawGet.mock.calls[0][0]).toBe('/systems/5/repositories/4/backup/')
    const [url, config] = h.rawGet.mock.calls[1]
    expect(url).toBe('/systems/5/repositories/4/jobs/j1/download/')
    expect(config.responseType).toBe('blob')
    expect(res.headers['content-disposition']).toContain('filename="b"')
  })

  it('a folder names its path on the press', async () => {
    h.rawGet.mockResolvedValueOnce({ status: 202, data: { job: doneJob('download', { name: 'src.tar.gz' }) } })
      .mockResolvedValueOnce({ data: new Blob(['x']), headers: {} })
    await api.downloadRepositoryEntry(5, 4, 'src')
    expect(h.rawGet.mock.calls[0].slice(0, 2)).toEqual(['/systems/5/repositories/4/files/download/',
      { params: { path: 'src' }, noCache: true }])
  })

  it("a refusal reaches the caller with the server's code and words", async () => {
    h.rawGet.mockRejectedValueOnce({ response: { status: 503, data: { code: 'RUNNER_STARTING', error: 'Starting' } } })
    await expect(api.downloadRepositoryEntry(5, 4, 'src')).rejects
      .toMatchObject({ response: { data: { code: 'RUNNER_STARTING', error: 'Starting' } } })
    h.rawGet.mockResolvedValueOnce({ status: 202, data: { job: doneJob('backup', {}, { state: 'failed', status_code: 502,
      result: { error: 'The backup could not be packed.' } }) } })
    await expect(api.downloadProjectBackup(5, 4)).rejects
      .toMatchObject({ response: { status: 502, data: { error: 'The backup could not be packed.' } } })
  })

  it('a fetch refused as a Blob is read back as JSON', async () => {
    h.rawGet.mockResolvedValueOnce({ status: 202, data: { job: doneJob('backup', {}) } })
      .mockRejectedValueOnce({ response: { status: 410, data: new Blob([JSON.stringify({ code: 'FETCHED' })]) } })
    await expect(api.downloadProjectBackup(5, 4)).rejects.toMatchObject({ response: { data: { code: 'FETCHED' } } })
  })
})
