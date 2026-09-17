// Save a Blob to disk under a real file name.
//
// WHY THIS EXISTS (reported 2026-09-17, conv 1689). Downloading the agent's report saved a 656-byte file named
// "d48a6524-5b04-4fbc-9ccf-49ef254f980a" with no extension — the right bytes under the blob's own id, so the
// file would not open. The viewer revoked the object URL in the same tick it clicked the link; Chrome resolves
// the download's name asynchronously, and with the URL already gone it falls back to the blob's UUID. Six
// download buttons copied that pattern. The URL is now released a minute later, when the save has long started.
//
// The anchor is attached to the document before clicking because Firefox ignores a click on a detached one.
const REVOKE_AFTER_MS = 60_000

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

export const _REVOKE_AFTER_MS = REVOKE_AFTER_MS
