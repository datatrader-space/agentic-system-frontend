// @vitest-environment jsdom
// Resumable uploads (VIDEO_CLIP_EDITOR_PLAN.md E7): a file is created with its length, sent in parts each with its
// SHA-1, and a dropped connection asks where the upload stands and goes on from there.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHUNK_BYTES, sha1Base64, uploadFile } from './resumableUpload'

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), head: vi.fn(), get: vi.fn(), delete: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

const fileOf = bytes => new File([new Uint8Array(bytes)], 'clip.mp4', { type: 'video/mp4', lastModified: 1 })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.post.mockResolvedValue({ headers: { location: '/api/video/editor/uploads/u1/' }, data: { upload_id: 'u1' } })
})

describe('uploadFile', () => {
  it('creates the upload with its length and metadata, then sends every part with its checksum', async () => {
    const size = CHUNK_BYTES + 10
    let at = 0
    api.patch.mockImplementation(async (url, body) => { at += body.byteLength; return { headers: { 'upload-offset': String(at) } } })
    const progress = []
    const id = await uploadFile(fileOf(size), { projectId: 'p1', onProgress: p => progress.push(p) })
    expect(id).toBe('u1')
    const [, , create] = api.post.mock.calls[0]
    expect(create.headers['Tus-Resumable']).toBe('1.0.0')
    expect(create.headers['Upload-Length']).toBe(String(size))
    expect(atob(create.headers['Upload-Metadata'].split(',').find(x => x.startsWith('project_id')).split(' ')[1])).toBe('p1')
    expect(api.patch).toHaveBeenCalledTimes(2)
    const [url, body, opts] = api.patch.mock.calls[1]
    expect([url, opts.headers['Upload-Offset'], body.byteLength]).toEqual(['/api/video/editor/uploads/u1/', String(CHUNK_BYTES), 10])
    expect(opts.headers['Content-Type']).toBe('application/offset+octet-stream')
    expect(opts.headers['Upload-Checksum']).toBe(`sha1 ${await sha1Base64(body)}`)
    expect(progress.at(-1)).toBe(1)
    expect(localStorage.getItem('aadml.clipEditor.uploads')).toBe('{}')      // finished: nothing left to resume
  })

  it('a dropped connection asks where the upload stands and continues from there', async () => {
    vi.useFakeTimers()
    let calls = 0
    api.patch.mockImplementation(async (url, body, opts) => {
      calls++
      if (calls === 1) throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
      return { headers: { 'upload-offset': String(Number(opts.headers['Upload-Offset']) + body.byteLength) } }
    })
    api.head.mockResolvedValue({ headers: { 'upload-offset': '4' } })                // 4 bytes had arrived
    const done = uploadFile(fileOf(20), { projectId: 'p1' })
    await vi.advanceTimersByTimeAsync(1500)
    await done
    expect(api.head).toHaveBeenCalledWith('/api/video/editor/uploads/u1/', expect.objectContaining({ baseURL: '' }))
    expect(api.patch.mock.calls[1][2].headers['Upload-Offset']).toBe('4')
    expect(api.patch.mock.calls[1][1].byteLength).toBe(16)
    vi.useRealTimers()
  })

  it('choosing the same file again after a reload continues the same upload', async () => {
    api.patch.mockRejectedValueOnce({ response: { status: 413, data: { error: { message: 'too big' } } } })
    await expect(uploadFile(fileOf(20), { projectId: 'p1' })).rejects.toBeTruthy()
    api.head.mockResolvedValue({ headers: { 'upload-offset': '0' } })
    api.patch.mockResolvedValue({ headers: { 'upload-offset': '20' } })
    await uploadFile(fileOf(20), { projectId: 'p1' })
    expect(api.post).toHaveBeenCalledTimes(1)                                       // not created twice
  })

  it('a refusal the server explains is not retried', async () => {
    api.patch.mockRejectedValue({ response: { status: 415, data: { error: { message: 'not media' } } } })
    await expect(uploadFile(fileOf(20), { projectId: 'p1' })).rejects.toMatchObject({ response: { status: 415 } })
    expect(api.patch).toHaveBeenCalledTimes(1)
  })
})
