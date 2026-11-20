// Resumable uploads into the clip editor: the tus 1.0 protocol (creation, checksum, expiration, termination), against
// /api/video/editor/uploads/ (agentic-docs/VIDEO_CLIP_EDITOR_PLAN.md E7). A file is created with its length, then sent
// in 8 MB parts, each with its SHA-1. A dropped connection asks the server where the upload stands (HEAD) and goes on
// from there; a page reloaded while uploading continues the same upload when the same file is chosen again.
// No library: the protocol is a handful of requests, and every request goes through the app's own api client.
import api from '../../services/api'

export const CHUNK_BYTES = 8 * 1024 * 1024
const TUS = { 'Tus-Resumable': '1.0.0' }
const STORE = 'aadml.clipEditor.uploads'
const RETRIES = [1000, 3000, 8000, 15000]

const b64 = s => btoa(unescape(encodeURIComponent(String(s))))
const fingerprint = (file, projectId) => `${projectId}:${file.name}:${file.size}:${file.lastModified}`
function remembered() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') } catch { return {} } }
function remember(key, location) {
  try {
    const all = remembered()
    if (location) all[key] = location; else delete all[key]
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch { /* private window or blocked storage: the upload still works, only not across a reload */ }
}

export async function sha1Base64(buffer) {
  const digest = await crypto.subtle.digest('SHA-1', buffer)
  let bin = ''
  for (const byte of new Uint8Array(digest)) bin += String.fromCharCode(byte)
  return btoa(bin)
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Upload stopped', 'AbortError')) }, { once: true })
})
// A refusal the server explains (4xx other than a wrong offset) is final; a dropped connection or a server error is
// tried again from where the server says the upload stands.
const retryable = e => !e.response || e.response.status >= 500 || e.response.status === 409 || e.response.status === 460

async function offsetOf(location, signal) {
  const res = await api.head(location, { headers: TUS, signal, baseURL: '' })
  return Number(res.headers['upload-offset'] || 0)
}

// Upload one file into a project. Resolves with the server's upload id once every byte is in (the server then checks
// and prepares the file: follow it with `uploadStatus`). Rejects with the server's own message when it refuses.
export async function uploadFile(file, { projectId, onProgress = () => {}, signal } = {}) {
  const key = fingerprint(file, projectId)
  let location = remembered()[key] || null, offset = 0
  if (location) {
    try { offset = await offsetOf(location, signal) } catch { location = null; remember(key, null) }
  }
  if (!location) {
    const meta = [`filename ${b64(file.name)}`, `filetype ${b64(file.type || '')}`, `project_id ${b64(projectId)}`].join(',')
    const res = await api.post('/video/editor/uploads/', null, { signal, headers: { ...TUS, 'Upload-Length': String(file.size), 'Upload-Metadata': meta } })
    location = res.headers.location || `/api/video/editor/uploads/${res.data.upload_id}/`
    remember(key, location)
  }
  onProgress(offset / file.size)
  let attempt = 0
  while (offset < file.size) {
    const part = file.slice(offset, Math.min(offset + CHUNK_BYTES, file.size))
    try {
      const body = await part.arrayBuffer()
      const res = await api.patch(location, body, {
        signal, baseURL: '', timeout: 300000,
        headers: { ...TUS, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': String(offset), 'Upload-Checksum': `sha1 ${await sha1Base64(body)}` },
        transformRequest: [data => data],
      })
      offset = Number(res.headers['upload-offset'] || offset + body.byteLength)
      attempt = 0
      onProgress(offset / file.size)
    } catch (e) {
      if (signal?.aborted) throw e
      if (!retryable(e) || attempt >= RETRIES.length) {
        if (e.response?.status === 410 || e.response?.status === 404) remember(key, null)
        throw e
      }
      await sleep(RETRIES[attempt++], signal)
      offset = await offsetOf(location, signal)
    }
  }
  remember(key, null)
  return location.split('/').filter(Boolean).pop()
}

export async function uploadStatus(uploadId) {
  const { data } = await api.get(`/video/editor/uploads/${uploadId}/`)
  return data
}
export async function cancelUpload(uploadId) {
  await api.delete(`/video/editor/uploads/${uploadId}/`, { headers: TUS })
}
